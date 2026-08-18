// sw.js - 離線快取與強制同步
const CACHE_NAME = 'timeclock-v1';
const OFFLINE_URL = '/offline.html';

// 核心資產快取清單
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/output.css',
  '/styles.css'
];

// 靜態資源 MIME 類型映射
const MIME_TYPES = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// 安裝階段 - 預先快取核心資產
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活階段 - 清理舊快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// 網絡請求 - 先快取再回傳
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // 只快取同源請求
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // 有快取就回傳
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 沒有快取就網絡獲取
        return fetch(request)
          .then(response => {
            // 只快取成功的 GET 請求
            if (!event.request.method === 'GET' && event.request.url.includes('/api/')) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, responseClone));
            }
            return response;
          })
          .catch(() => {
            // 網絡失敗時回傳離線頁面
            return caches.match('/offline.html');
          });
      })
  );
});

// 背景同步 - Firebase 離線資料同步
self.addEventListener('sync', event => {
  if (event.tag === 'firebase-data-sync') {
    event.waitUntil(handleFirebaseSync());
  }
});

// 處理 Firebase 離線同步
async function handleFirebaseSync() {
  try {
    const failedData = await getFailedSyncData();
    if (failedData.length === 0) return;
    
    for (const data of failedData) {
      await syncToFirebase(data);
      await removeFailedSyncData(data.id);
    }
    
    // 通知前端同步完成
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        syncedCount: failedData.length
      });
    });
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// 獲取待同步的失敗資料
async function getFailedSyncData() {
  const cache = await caches.open('failed-requests');
  const responses = await cache.matchAll('/failed-request/');
  return Promise.all(responses.map(r => r.json()));
}

// 同步到 Firebase
async function syncToFirebase(data) {
  const dbUrl = data.dbUrl || 'https://chiwen1989-1-default-rtdb.europe-west1.firebasedatabase.app';
  const endpoint = `${dbUrl}/users/${data.userId}/times.json`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Offlinetoken': data.token || ''
    },
    body: JSON.stringify(data.payload)
  });
  
  return response.json();
}

// 保存失敗的同步資料
async function saveFailedSyncData(data) {
  const cache = await caches.open('failed-requests');
  const request = new Request('/failed-request/' + data.id, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  });
  await cache.put(request, request);
}

// 刪除已同步的資料
async function removeFailedSyncData(id) {
  const cache = await caches.open('failed-requests');
  await cache.delete(new Request('/failed-request/' + id));
}