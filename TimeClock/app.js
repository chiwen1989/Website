// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBWpY0HKWmHhZLpgbfX4aja9jMu7kQ24Oo",
  authDomain: "chiwen1989-1.firebaseapp.com",
  databaseURL: "https://chiwen1989-1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chiwen1989-1",
  storageBucket: "chiwen1989-1.firebasestorage.app",
  messagingSenderId: "418637060347",
  appId: "1:418637060347:web:c4369195ba68a11f65385e",
  measurementId: "G-EYTFGZLLH3"
};
const fbReady = typeof firebase !== 'undefined';
if (fbReady) firebase.initializeApp(firebaseConfig);
const auth = fbReady ? firebase.auth() : null;
const ALLOWED_EMAILS = new Set(['chiwen1989@gmail.com']);
const localCacheKey = 'daKaLocalTimes';

// 型別元數據
const TYPE_META = {
  commute: { label: '通勤', className: 'tag-commute' },
  work: { label: '工作', className: 'tag-work' },
  shopping: { label: '購物', className: 'tag-shopping' },
  event: { label: '事件', className: 'tag-event' },
  unknown: { label: '未知', className: 'tag-unknown' }
};

// 全局狀態
let userId = null;
let times = [];
let timers = {};
let syncState = 'OFFLINE';
let lastSyncAt = '';
let isFirstSync = true;
let firebaseTimesRef = null;
let firebaseTimesListener = null;
let saveTimer = null;
let btnsInitialized = false;
let initAfterAuthCalled = false;
let clockIntervalId = null; // 修正：用來記錄時鐘定時器，避免重複設定

// ============================================================
// DOM 元素引用
// ============================================================

// ============================================================
// 核心功能
// ============================================================

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(localCacheKey);
    return raw ? normalizeTimes(JSON.parse(raw)) : [];
  } catch { return []; }
}

function persistLocalCache() {
  localStorage.setItem(localCacheKey, JSON.stringify(times));
}

function normalizeTimes(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item => ({
    id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    t: Number(item.t) || Date.now(),
    type: item.type || 'work',
    note: item.note || '',
    startTime: item.startTime ? Number(item.startTime) : null
  }));
}

function normalizeRemoteSnapshot(snapshot) {
  if (!snapshot) return [];
  return Object.entries(snapshot).map(([id, item]) => ({
    id,
    t: Number(item.t) || Date.now(),
    type: item.type || 'work',
    note: item.note || '',
    startTime: item.startTime ? Number(item.startTime) : null
  }));
}

function getGroupedTimes() {
  const groups = {};
  // 修正：不再回傳高風險的 i 索引，保留物件本身引用，排序由原有邏輯處理
  const indexed = times.map((item) => ({ item }));
  indexed.sort((a, b) => b.item.t - a.item.t);
  indexed.forEach(({ item }) => {
    const d = new Date(item.t);
    const k = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    if (!groups[k]) groups[k] = [];
    groups[k].push({ item });
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatEntryTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatMsToHMS(ms) {
  if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function getTypeColorClass(type) {
  switch (type) {
    case 'commute': return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
    case 'work': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'shopping': return 'border-violet-500/30 bg-violet-500/10 text-violet-300';
    case 'event': return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
    default: return 'border-slate-600 bg-slate-900/70 text-slate-400';
  }
}

function getTimerDisplay(item) {
  if (!timers[item.id]) return '00:00:00';
  return formatMsToHMS(Date.now() - timers[item.id].startTime);
}

function getTimerBtnClass(item) {
  return timers[item.id]
    ? 'timerBtn running'
    : 'timerBtn';
}

function render() {
  if (!log) return;

  log.innerHTML = '';
  recordCountLabel.textContent = times.length;
  recordStat.textContent = times.length;

  const groups = getGroupedTimes();

  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'stat-card rounded-lg border border-slate-800 bg-slate-950/70 p-4';
    empty.innerHTML = '<span class="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">目前沒有記錄</span><strong class="mt-1 block text-sm font-semibold text-slate-100">按「通勤 / 工作 / 購物 / 事件」開始</strong><small class="mt-1 block text-[10px] text-slate-500">資料會同步到 Firebase 與本機快取</small>';
    log.appendChild(empty);
    calcSelectedSummary();
    return;
  }

  const today = new Date();
  const todayKey = formatDateKey(today);

  groups.forEach(([date, entries]) => {
    const det = document.createElement('div');
    det.className = 'group overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70';

    const sum = document.createElement('div');
    sum.className = 'flex cursor-pointer items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-3 py-2.5 text-[12px] text-slate-200';
    sum.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <span class="group-title flex items-center gap-2">
          <strong class="text-sky-300">${date}</strong>
          <span class="rounded border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">${entries.length} 筆</span>
        </span>
        <div class="flex items-center gap-2">
          <button type="button" class="!px-6 py-1.5 text-[11px] bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 text-sky-300" onclick="event.stopPropagation(); exportToTxt('${date}')">TXT</button>
          <button type="button" class="!px-6 py-1.5 text-[11px] bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 text-blue-400" onclick="event.stopPropagation(); exportToIcs('${date}')">iCal</button>
        </div>
      </div>
    `;

    const wrap = document.createElement('div');
    wrap.className = 'entries space-y-2 p-2';
    wrap.style.display = date === todayKey ? '' : 'none';

    sum.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      wrap.style.display = wrap.style.display === 'none' ? '' : 'none';
    });

    det.appendChild(sum);

    entries.forEach(({ item }) => {
      wrap.appendChild(createEntryElement(item));
    });

    det.appendChild(wrap);
    log.appendChild(det);
  });

  calcSelectedSummary();
}

function createEntryElement(item) {
  const row = document.createElement('article');
  row.className = 'entry rounded-lg border border-slate-800 bg-slate-950/70 p-3';

  const main = document.createElement('div');
  main.className = 'entry-main flex flex-col gap-2';

  // 時間和類型標籤
  const top = document.createElement('div');
  top.className = 'entry-top flex flex-wrap items-center gap-2';

  const tTxt = document.createElement('span');
  tTxt.className = 'entry-time text-[12px] font-semibold text-slate-100';
  tTxt.textContent = formatEntryTime(new Date(item.t));

  const typeTag = document.createElement('span');
  const meta = TYPE_META[item.type] || TYPE_META.unknown;
  const colorClass = getTypeColorClass(item.type);
  typeTag.className = `tag rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorClass}`;
  typeTag.textContent = meta.label;

  top.append(tTxt, typeTag);
  main.appendChild(top);

  // 備註輸入
  const note = document.createElement('input');
  note.className = 'entry-note w-full rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none';
  note.type = 'text';
  note.placeholder = '備註';
  note.value = item.note || '';
  note.dataset.id = item.id; // 修正：綁定唯一 ID
  note.addEventListener('input', onNoteInput);
  main.appendChild(note);

  // 計時控制
  const timerCont = document.createElement('div');
  timerCont.className = 'timer-controls flex items-center gap-2 mt-2';

  const timerBtn = document.createElement('button');
  timerBtn.type = 'button';
  timerBtn.className = getTimerBtnClass(item);
  timerBtn.textContent = timers[item.id] ? '停止計時' : '計時';
  timerBtn.dataset.entryId = item.id;
  timerBtn.onclick = () => startTimerById(item.id); // 修正：改用 ID 控制

  const timerDisp = document.createElement('span');
  timerDisp.className = 'timerDisplay text-[10px] text-amber-300';
  timerDisp.dataset.entryId = item.id;
  timerDisp.textContent = getTimerDisplay(item);

  timerCont.append(timerBtn, timerDisp);
  main.appendChild(timerCont);

  row.appendChild(main);

  // 操作按鈕
  const act = document.createElement('div');
  act.className = 'entry-actions mt-2 flex justify-end';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'delBtn rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-300 transition hover:bg-rose-500/20';
  del.textContent = '刪除';
  del.onclick = e => { e.stopPropagation(); removeEntryById(item.id); }; // 修正：改用 ID 刪除
  act.appendChild(del);

  row.appendChild(act);
  return row;
}

function calcSelectedSummary() {
  const commuteCount = times.filter(t => t.type === 'commute').length;
  const workCount = times.filter(t => t.type === 'work').length;
  const shoppingCount = times.filter(t => t.type === 'shopping').length;
  const eventCount = times.filter(t => t.type === 'event').length;

  if (commuteCountStat) commuteCountStat.textContent = commuteCount;
  if (workCountStat) workCountStat.textContent = workCount;
  if (shoppingCountStat) shoppingCountStat.textContent = shoppingCount;
  if (eventCountStat) eventCountStat.textContent = eventCount;
}

// ============================================================
// 記錄操作
// ============================================================

function addEntry(type, note = '', startTime = null) {
  const newItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    t: Date.now(),
    type,
    note,
    startTime
  };
  times.push(newItem);
  persistLocalCache();
  queueSave();
  render();
  return newItem;
}

function promptForNoteAndAddEntry(type) {
  if (type === 'commute') {
    const tripType = confirm('通勤類型？\n按「確定」= 出門\n按「取消」= 返家');
    const note = tripType ? '出門' : '返家';
    addEntry('commute', note);
    return;
  }

  const note = prompt('請輸入備註（可留空）');
  if (note === null) return;

  const newItem = addEntry(type, note || '');

  const startTimer = confirm('是否立即開始計時？\n\n按「確定」：自動開始計時\n按「取消」：僅保存備註');
  if (startTimer) {
    startTimerById(newItem.id); // 修正：直接用 ID 啟動
  }
}

// 修正：完全改用 ID 定位刪除，徹底移除舊有不安全的 index 依賴
function removeEntryById(id) {
  if (!id) return;

  if (timers[id]) {
    clearInterval(timers[id].intervalId);
    delete timers[id];
  }

  times = times.filter(t => t.id !== id);
  persistLocalCache();

  if (fbReady && userId && firebaseTimesRef) {
    setSyncState('SYNCING', new Date().toLocaleTimeString('zh-Hant'));
    firebaseTimesRef.child(id).remove()
      .then(() => setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant')))
      .catch(() => setSyncState('OFFLINE', lastSyncAt || ''));
  }

  render();
}

function clearAll() {
  if (!confirm('確定清除全部時間？')) return;
  times = [];
  for (const k in timers) clearInterval(timers[k].intervalId);
  timers = {};
  persistLocalCache();
  render();
  if (fbReady && userId && firebaseTimesRef) {
    setSyncState('SYNCING', new Date().toLocaleTimeString('zh-Hant'));
    firebaseTimesRef.set(null)
      .then(() => setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant')));
  } else {
    setSyncState('OFFLINE', new Date().toLocaleTimeString('zh-Hant'));
  }
}

// 修正：透過 dataset.id 尋找正確的物件
function onNoteInput(e) {
  const id = e.target.dataset.id;
  const item = times.find(t => t.id === id);
  if (!item) return;
  item.note = e.target.value;
  queueSave();
}

// ============================================================
// 計時器功能
// ============================================================

// 修正：全改用 ID 驅動控制，避免 Index 排序後錯位
function startTimerById(id) {
  const item = times.find(t => t.id === id);
  if (!item) return;

  if (timers[item.id]) {
    clearInterval(timers[item.id].intervalId);
    const elapsed = Date.now() - item.startTime;
    delete timers[item.id];
    item.startTime = null; // 停止後清空開始時間，防重啟判定錯誤
    item.note = `${item.note || ''}${item.note ? ' | ' : ''}計時 ${formatMsToHMS(elapsed)}`;
    persistLocalCache();
    queueSave();
    render();
  } else {
    const nowTime = Date.now();
    timers[item.id] = {
      startTime: nowTime,
      intervalId: setInterval(() => {
        const display = document.querySelector(`.timerDisplay[data-entry-id="${item.id}"]`);
        if (display) {
          display.textContent = formatMsToHMS(Date.now() - timers[item.id].startTime);
        }
      }, 1000)
    };
    item.startTime = nowTime;
    persistLocalCache();
    queueSave();
    render();
  }
}

function rehydrateTimers() {
  setTimeout(() => {
    times.forEach((item) => {
      if (item.startTime && !item.note?.includes('計時') && !timers[item.id]) {
        timers[item.id] = {
          startTime: item.startTime,
          intervalId: setInterval(() => {
            const displayElement = document.querySelector(`.timerDisplay[data-entry-id="${item.id}"]`);
            if (displayElement) {
              displayElement.textContent = formatMsToHMS(Date.now() - timers[item.id].startTime);
            }
          }, 1000)
        };
        const displayElement = document.querySelector(`.timerDisplay[data-entry-id="${item.id}"]`);
        if (displayElement) {
          displayElement.textContent = formatMsToHMS(Date.now() - item.startTime);
        }
        const timerBtn = document.querySelector(`.timerBtn[data-entry-id="${item.id}"]`);
        if (timerBtn) {
          timerBtn.textContent = '停止計時';
          timerBtn.className = 'timerBtn running';
        }
      }
    });
  }, 0);
}

// ============================================================
// 按鈕初始化
// ============================================================

function initBtns() {
  if (btnsInitialized) return;

  const commuteBtn = document.getElementById('commuteBtn');
  const workBtn = document.getElementById('workBtn');
  const shoppingBtn = document.getElementById('shoppingBtn');
  const eventBtn = document.getElementById('eventBtn');
  const clearBtn = document.getElementById('clearBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');

  btnsInitialized = true;

  if (commuteBtn) commuteBtn.onclick = () => promptForNoteAndAddEntry('commute');
  if (workBtn) workBtn.onclick = () => promptForNoteAndAddEntry('work');
  if (shoppingBtn) shoppingBtn.onclick = () => promptForNoteAndAddEntry('shopping');
  if (eventBtn) eventBtn.onclick = () => promptForNoteAndAddEntry('event');
  if (clearBtn) clearBtn.onclick = clearAll;
  if (refreshBtn) refreshBtn.onclick = () => location.reload();
  if (exportBtn) {
    exportBtn.onclick = () => {
      if (exportMenu) {
        exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block';
      }
    };
  }


  if (!document.dataset?._exportMenuListener) {
    document.addEventListener('click', e => {
      if (exportMenu && !e.target.closest('.dropdown')) {
        exportMenu.style.display = 'none';
      }
    });
    if (!document.dataset) document.dataset = {};
    document.dataset._exportMenuListener = 'true';
  }
}

// ============================================================
// Firebase 同步
// ============================================================

function setupFirebaseListener() {
  cleanupFirebaseListener();
  if (!userId) return;

  firebaseTimesRef = firebase.database().ref(`users/${userId}/times`);
  isFirstSync = true;

  firebaseTimesListener = firebaseTimesRef.on('value', snapshot => {
    const remoteData = snapshot.val();
    const remoteItems = normalizeRemoteSnapshot(remoteData);

    // 修正：使用純文字結構比對，阻斷因為非同步傳輸產生的無窮重繪與 UI 卡死
    const fingerprint = items => JSON.stringify(
      items.map(t => ({ id: t.id, t: t.t, type: t.type, note: t.note, startTime: t.startTime }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
    const localStr = fingerprint(times);
    const remoteStr = fingerprint(remoteItems);

    if (localStr !== remoteStr) {
      if (isFirstSync) {
        // ponytail: merge by ID, prefer local for conflicts (offline changes survive)
        const merged = new Map(remoteItems.map(r => [r.id, r]));
        times.forEach(t => { merged.set(t.id, t); });
        times = Array.from(merged.values());
      } else {
        times = remoteItems;
      }
      persistLocalCache();
      rehydrateTimers();
      render();
    }
    setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant'));
    isFirstSync = false;
  }, err => {
    console.error('Firebase 讀取失敗:', err);
    setSyncState('OFFLINE', lastSyncAt || '');
  });
}

function cleanupFirebaseListener() {
  if (firebaseTimesRef && firebaseTimesListener) {
    firebaseTimesRef.off('value', firebaseTimesListener);
  }
  firebaseTimesRef = null;
  firebaseTimesListener = null;
}

function setSyncState(state, time = '') {
  syncState = state;
  lastSyncAt = time;
  if (syncBadge) syncBadge.textContent = state;
  if (syncStateLabel) syncStateLabel.textContent = state === 'OFFLINE' ? '離線' : (state === 'SYNCING' ? '同步中...' : '已同步');
  if (updatedAtLabel) updatedAtLabel.textContent = time ? '最後更新：' + time : '';
}

function queueSave() {
  if (saveTimer) clearTimeout(saveTimer); // 修正 Debounce 機制防抖
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!fbReady || !userId || !firebaseTimesRef) return;
    setSyncState('SYNCING', new Date().toLocaleTimeString('zh-Hant'));
    saveToFirebase();
  }, 800);
}

// 修正：重寫正確的扁平資料物件（Payload）更新邏輯
function saveToFirebase() {
  if (!fbReady || !userId || !firebaseTimesRef) return;

  const payload = {};
  times.forEach(t => {
    payload[t.id] = {
      t: t.t,
      type: t.type,
      note: t.note,
      startTime: t.startTime
    };
  });

  firebaseTimesRef.set(payload)
    .then(() => {
      setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant'));
    })
    .catch(err => {
      console.error('[saveToFirebase] 同步失敗:', err);
      setSyncState('OFFLINE', lastSyncAt || '');
    });
}

// ============================================================
// 匯出功能
// ============================================================

function exportToIcs(targetDate) {
  if (!times.length) {
    alert('目前沒有記錄可以匯出');
    return;
  }

  const dateKey = targetDate || formatDateKey(new Date());
  const targetEntries = times.filter(t => formatDateKey(new Date(t.t)) === dateKey);

  if (!targetEntries.length) {
    alert('該日期沒有記錄');
    return;
  }

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TimeClock//ZH',
    'BEGIN:VEVENT',
    `DTSTART:${dateKey.replace(/-/g, '')}`,
    `DTEND:${dateKey.replace(/-/g, '')}`,
    `SUMMARY:請填寫行程標題`,
    `DESCRIPTION:${targetEntries.map(e => formatEntrySummary(e)).join('\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timeclock-${dateKey}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}


function exportToTxt(targetDate) {
  if (!times.length) {
    alert('目前沒有記錄可以匯出');
    return;
  }
  let groups = getGroupedTimes();
  if (targetDate) {
    groups = groups.filter(([date]) => date === targetDate);
  }
  const lines = groups.flatMap(([date, entries]) => [
    date,
    ...entries.map(({ item }) => formatEntrySummary(item)),
    ''
  ]);
  const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timeclock-${targetDate || formatDateKey(new Date())}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}



function formatEntrySummary(item) {
  const time = formatEntryTime(new Date(item.t));
  const type = TYPE_META[item.type]?.label || '未知';
  const note = item.note || '';
  return `${type} ${time}${note ? ': ' + note : ''}`;
}

function updateNow() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  if (sideNowLabel) sideNowLabel.textContent = timeStr;
}

function showLoginBanner() {
  const banner = document.getElementById('loginBanner');
  if (banner) banner.classList.remove('hidden');
}

function hideLoginBanner() {
  const banner = document.getElementById('loginBanner');
  if (banner) banner.classList.add('hidden');
}

function isAuthorizedUser(user) {
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!email) return false;
  return ALLOWED_EMAILS.has(email);
}

// ============================================================
// 初始化（只在 DOM 就緒後執行）
// ============================================================

function initAfterAuth() {
  if (initAfterAuthCalled) return;
  initAfterAuthCalled = true;

  // 恢復持久化的 userId（防页面刷新後丟失）
  const savedUserId = localStorage.getItem('daKaUserId');
  if (savedUserId) userId = savedUserId;

  log = document.getElementById('log');
  recordCountLabel = document.getElementById('recordCountLabel');
  recordStat = document.getElementById('recordStat');
  commuteCountStat = document.getElementById('commuteCountStat');
  workCountStat = document.getElementById('workCountStat');
  shoppingCountStat = document.getElementById('shoppingCountStat');
  eventCountStat = document.getElementById('eventCountStat');
  exportMenu = document.getElementById('exportMenu');
  syncBadge = document.getElementById('syncBadge');
  syncStateLabel = document.getElementById('syncStateLabel');
  updatedAtLabel = document.getElementById('updatedAtLabel');
  sideNowLabel = document.getElementById('sideNowLabel');
  userIdLabel = document.getElementById('userIdLabel');

  times = loadLocalCache();

  if (!userId) syncState = 'OFFLINE';
  lastSyncAt = '';
  saveTimer = null;

  initBtns();

  render();
  rehydrateTimers();
  updateNow();

  // 修正：先清空舊的 Interval 避免時鐘疊加變快
  if (clockIntervalId) clearInterval(clockIntervalId);
  clockIntervalId = setInterval(updateNow, 1000);
}

function handleAuthStateChange(user) {
  if (user && isAuthorizedUser(user)) {
    userId = user.uid;
    localStorage.setItem('daKaUserId', userId);
    if (userIdLabel) userIdLabel.textContent = userId;
    const btnL = document.getElementById('btnLogin');
    const btnOut = document.getElementById('btnLogout');
    if (btnL) btnL.style.display = 'none';
    if (btnOut) btnOut.style.display = '';
    setSyncState('SYNCING', new Date().toLocaleTimeString('zh-Hant'));
    setupFirebaseListener();
    hideLoginBanner();
    if (!initAfterAuthCalled) initAfterAuth();
  } else {
    cleanupFirebaseListener();
    userId = null;
    localStorage.removeItem('daKaUserId');
    if (userIdLabel) userIdLabel.textContent = '—';
    const btnL = document.getElementById('btnLogin');
    const btnOut = document.getElementById('btnLogout');
    if (btnL) btnL.style.display = '';
    if (btnOut) btnOut.style.display = 'none';
    if (user) {
      alert('未授權的帳號拒絕存取：' + (user.email || '未知'));
      auth.signOut();
    }
    setSyncState('OFFLINE', lastSyncAt || '');
    if (!initAfterAuthCalled) initAfterAuth();
    showLoginBanner();
  }
}

function setupFirebaseListeners() {
  if (!auth) {
    setSyncState('OFFLINE', '離線模式（無 Firebase SDK）');
    if (!initAfterAuthCalled) initAfterAuth();
    showLoginBanner();
    return;
  }
  auth.onAuthStateChanged(handleAuthStateChange);
}

async function doLogin() {
  if (!fbReady) {
    alert('Firebase SDK 無法載入');
    return;
  }

  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;

  if (!email || !pass) {
    alert('請輸入 Email 和密碼');
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPass').value = '';
  } catch (err) {
    alert('登入失敗：' + err.message);
  }
}

// ============================================================
// 主初始化（DOMContentLoaded 後執行）
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('appContainer');
  if (appContainer) {
    appContainer.style.display = 'block';
  }

  setupFirebaseListeners();

  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const loginForm = document.getElementById('loginForm');
  const loginCancel = document.getElementById('loginCancel');
  const loginPass = document.getElementById('loginPass');
  const bannerClose = document.getElementById('bannerClose');
  const bannerLoginBtn = document.getElementById('bannerLoginBtn');

  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      if (!fbReady) { alert('Firebase SDK 無法載入'); return; }
      document.getElementById('loginModal').style.display = 'flex';
      setTimeout(() => document.getElementById('loginEmail').focus(), 100);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', e => { e.preventDefault(); doLogin(); });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => { if (fbReady) auth.signOut(); });
  }

  if (loginCancel) {
    loginCancel.addEventListener('click', () => { document.getElementById('loginModal').style.display = 'none'; });
  }

  if (loginPass) {
    loginPass.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  }

  if (bannerClose) {
    bannerClose.addEventListener('click', () => { document.getElementById('loginBanner').classList.add('hidden'); });
  }

  if (bannerLoginBtn) {
    bannerLoginBtn.addEventListener('click', () => {
      document.getElementById('loginBanner').classList.add('hidden');
      document.getElementById('loginModal').style.display = 'flex';
      setTimeout(() => document.getElementById('loginEmail').focus(), 100);
    });
  }
});
