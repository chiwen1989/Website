const ALLOWED_EMAILS = new Set(['chiwen1989@gmail.com']);
const MY_EMAIL = 'chiwen1989@gmail.com';
const fbReady = window.firebaseReady === true;
const auth = window.auth;

function isAuthorizedUser(user) {
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!email) return false;
  return ALLOWED_EMAILS.has(email);
}

let userId = null;
let log = null;
let recordCountLabel = null;
let recordStat = null;
let commuteCountStat = null;
let workCountStat = null;
let shoppingCountStat = null;
let eventCountStat = null;
let exportMenu = null;
let syncBadge = null;
let syncStateLabel = null;
let updatedAtLabel = null;
let sideNowLabel = null;
let times = [];
let timers = {}; // key: entry id -> {startTime, intervalId}
let syncState = 'OFFLINE';
let lastSyncAt = '';
let saveTimer = null;
let localCacheKey = 'daKaLocalTimes';
let firebaseTimesRef = null;
let firebaseTimesListener = null;
let isFirstSync = true; // 標記是否為首次同步
const TYPE_META = {
  commute: { label: '通勤', className: 'tag-commute' },
  work: { label: '工作', className: 'tag-work' },
  shopping: { label: '購物', className: 'tag-shopping' },
  event: { label: '事件', className: 'tag-event' },
  unknown: { label: '未知', className: 'tag-unknown' }
};

if (fbReady) {
  auth.onAuthStateChanged(user => {
    if (user && isAuthorizedUser(user)) {
      userId = user.uid;
      document.getElementById('userIdLabel').textContent = userId;
      document.getElementById('btnLogin').style.display = 'none';
      document.getElementById('btnLogout').style.display = '';
      setSyncState('SYNCING', new Date().toLocaleTimeString('zh-Hant'));
      setupFirebaseListener();
      initAfterAuth(); // 確保 Firebase 已就緒後才初始化
    } else {
      cleanupFirebaseListener();
      userId = null;
      document.getElementById('btnLogin').style.display = '';
      document.getElementById('btnLogout').style.display = 'none';
      if (user) {
        alert('未授權的帳號拒絕存取：' + (user.email || '未知'));
        auth.signOut();
      }
      setSyncState('OFFLINE', lastSyncAt || '');
      // 登出後重新初始化，確保按鈕可用
      initAfterAuth();
    }
  });
} else {
  setSyncState('OFFLINE', '離線模式（無 Firebase SDK）');
  initAfterAuth(); // 無 Firebase 時也初始化
}

function doLogin() {
  if (!fbReady) { alert('Firebase SDK 無法載入，無法登入（可能沒有網路）'); return; }
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (!email || !pass) { alert('請輸入 Email 與密碼'); return; }
  auth.signInWithEmailAndPassword(email, pass)
    .then(() => { document.getElementById('loginModal').style.display = 'none'; document.getElementById('loginPass').value = ''; })
    .catch(err => {
      console.error('登入失敗', err);
      let msg = err.message || '登入失敗';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Email 或密碼錯誤';
      if (err.code === 'auth/invalid-email') msg = 'Email 格式不正確';
      if (err.code === 'auth/operation-not-allowed') msg = 'Firebase 未啟用 Email/密碼登入，請到 Console 啟用';
      alert(msg);
    });
}

document.getElementById('btnLogin').addEventListener('click', () => { if (!fbReady) { alert('Firebase SDK 無法載入，無法登入（可能沒有網路）'); return; } document.getElementById('loginModal').style.display = 'flex'; document.getElementById('loginEmail').focus(); });

document.getElementById('btnLogout').addEventListener('click', () => { if (fbReady) auth.signOut(); });

document.getElementById('loginSubmit').addEventListener('click', doLogin);
document.getElementById('loginCancel').addEventListener('click', () => { document.getElementById('loginModal').style.display = 'none'; });
document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

document.getElementById('appContainer').style.display = 'block';

// 等待 Firebase 或立即初始化
function waitForFirebase() {
  if (window.firebaseReady) {
    initAfterAuth();
    return;
  }
  // 等 2 秒，如果 Firebase 還沒載入就初始化（離線模式）
  setTimeout(() => {
    if (!window.firebaseReady) {
      console.log('[App] Firebase 未載入，使用離線模式');
      initAfterAuth();
    }
  }, 2000);
}
waitForFirebase();

function initAfterAuth() {
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

  times = loadLocalCache();
  syncState = 'OFFLINE';
  lastSyncAt = '';
  saveTimer = null;

  initBtns();
  render();
  rehydrateTimers(); // 恢復頁面關閉前的計時器
  setTimeout(() => render(), 150); // 重新渲染以更新按鈕狀態
  updateNow();
  setInterval(updateNow, 1000);
}

function cleanupFirebaseListener() {
  if (firebaseTimesRef && firebaseTimesListener) { firebaseTimesRef.off('value', firebaseTimesListener); }
  firebaseTimesRef = null;
  firebaseTimesListener = null;
}

function setupFirebaseListener() {
  cleanupFirebaseListener();
  if (!fbReady || !userId) return;
  firebaseTimesRef = window.db.ref(`users/${userId}/times`);
  console.log('[Firebase] 設置監聽器，userId:', userId, '路徑:', firebaseTimesRef.toString());
  firebaseTimesListener = snapshot => {
    const remote = normalizeRemoteSnapshot(snapshot.val());
    console.log('[Firebase] 收到同步更新，遠端數據:', remote.map(r => r.id).join(', ') || '空', '本地數據:', times.map(t => t.id).join(', '), '首次同步:', isFirstSync);

    // 建立 ID 集合
    const localIds = new Set(times.map(t => t.id));
    const remoteIds = new Set(remote.map(r => r.id));

    // 找出需要刪除的項目（本地有但遠端沒有了）
    const toDelete = Array.from(localIds).filter(id => !remoteIds.has(id));
    console.log('[Firebase] 本地 ID:', Array.from(localIds).join(', '), '遠端 ID:', Array.from(remoteIds).join(', '), '檢測到刪除:', toDelete.length > 0 ? toDelete.join(', ') : '無');

    // 先刪除本地不存在的項目
    if (toDelete.length > 0) {
      times = times.filter(t => !toDelete.includes(t.id));
      console.log('[Firebase] 已刪除本地記錄:', toDelete.join(', '));
    }

    // 合併數據：首次登入時優先使用本地數據
    let merged;
    if (isFirstSync && remote.length === 0 && localIds.size > 0) {
      // 首次同步且 Firebase 為空，保留本地數據
      console.log('[Firebase] 首次同步且 Firebase 為空，保留本地數據');
      merged = [...times];
    } else if (isFirstSync && remote.length > 0 && localIds.size > 0) {
      // 首次同步且 Firebase 有數據，合併
      console.log('[Firebase] 首次同步且 Firebase 有數據，合併數據');
      merged = remote.map(remoteItem => {
        const localItem = times.find(l => l.id === remoteItem.id);
        if (localItem) {
          // 保留本地的 startTime
          return {
            ...remoteItem,
            startTime: localItem.startTime || remoteItem.startTime
          };
        }
        return remoteItem;
      });
    } else {
      // 非首次同步，正常合併
      merged = remote.map(remoteItem => {
        const localItem = times.find(l => l.id === remoteItem.id);
        if (localItem) {
          return {
            ...remoteItem,
            startTime: localItem.startTime || remoteItem.startTime
          };
        }
        return remoteItem;
      });
    }

    // 標記已同步（不再首次）
    if (isFirstSync) {
      isFirstSync = false;
      console.log('[Firebase] 首次同步完成，標記為已同步');
    }

    // 如果數據有變化，更新並重新渲染
    const changed = JSON.stringify(merged) !== JSON.stringify(times);
    console.log('[Firebase] 數據有變化:', changed, '合併後:', merged.map(t => t.id).join(', '));
    if (changed) {
      times = merged;
      persistLocalCache();
      // 先恢復計時器，再渲染（確保按鈕狀態正確）
      rehydrateTimers();
      render();
    }
    setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant'));
  };
  firebaseTimesRef.on('value', firebaseTimesListener);
  console.log('[Firebase] 監聽器設置完成');
}

function normalizeTimes(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => {
    const rawType = typeof item?.type === 'string' ? item.type : '';
    const type = rawType === 'commute' || rawType === 'work' || rawType === 'shopping' || rawType === 'event'
      ? rawType
      : rawType === 'rest'
        ? 'shopping'
        : 'unknown';
    return {
      id: item && item.id ? item.id : `${Number(item?.t) || Date.now()}-${index}-${type}`,
      t: Number(item?.t) || Date.now(),
      type,
      note: typeof item?.note === 'string' ? item.note : '',
      startTime: item?.startTime || null
    };
  });
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(localCacheKey);
    return raw ? normalizeTimes(JSON.parse(raw)) : [];
  } catch { return []; }
}

function persistLocalCache() {
  localStorage.setItem(localCacheKey, JSON.stringify(times));
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

function fmtDuration(ms) { return ms < 0 ? '—' : `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`; }

function fmtDate(d) {
  const Y = d.getFullYear(); const M = d.getMonth() + 1; const D = d.getDate();
  const h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); const s = String(d.getSeconds()).padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM'; const h12 = h % 12 || 12;
  return `${Y} 年 ${M} 月 ${D} 日 ${h12}:${m}:${s} ${ampm}`;
}

function fmtEntry(d) {
  const Y = d.getFullYear(); const M = d.getMonth() + 1; const D = d.getDate();
  const h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); const s = String(d.getSeconds()).padStart(2, '0');
  const h12 = h % 12 || 12;
  return `${Y}/${M}/${D} ${h12}:${m}:${s}`;
}

function csvEscape(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

function setSyncState(state, touchedAt) {
  syncState = state;
  if (touchedAt) lastSyncAt = touchedAt;
  if (!syncBadge) return;
  syncBadge.textContent = state;
  syncStateLabel.textContent = state;
  updatedAtLabel.textContent = lastSyncAt || '—';
}

function queueSave() {
  // 移除 220ms 延遲，立即保存和同步
  if (saveTimer) clearTimeout(saveTimer);
  persistLocalCache();
  saveToFirebase();
}

function getGroupedTimes() {
  const groups = {}; const indexed = times.map((item, i) => ({ item, i }));
  indexed.sort((a, b) => b.item.t - a.item.t);
  indexed.forEach(({ item, i }) => {
    const d = new Date(item.t); const k = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    if (!groups[k]) groups[k] = []; groups[k].push({ item, i });
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function calcRange(list) {
  const v = list.map(t => t.t).sort((a, b) => a - b);
  if (v.length < 2) return '';
  return fmtDuration(v[v.length - 1] - v[0]);
}

function calcSelectedSummary() {
  recordCountLabel.textContent = times.length;
  recordStat.textContent = times.length;
  commuteCountStat.textContent = times.filter(t => t.type === 'commute').length;
  workCountStat.textContent = times.filter(t => t.type === 'work').length;
  shoppingCountStat.textContent = times.filter(t => t.type === 'shopping').length;
  eventCountStat.textContent = times.filter(t => t.type === 'event').length;
}

function render() {
  log.innerHTML = ''; recordCountLabel.textContent = times.length; recordStat.textContent = times.length;
  const groups = getGroupedTimes();
  if (!groups.length) { const empty = document.createElement('div'); empty.className = 'stat-card rounded-lg border border-slate-800 bg-slate-950/70 p-4'; empty.innerHTML = '<span class="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">目前沒有記錄</span><strong class="mt-1 block text-sm font-semibold text-slate-100">按「通勤 / 工作 / 購物 / 事件」開始</strong><small class="mt-1 block text-[10px] text-slate-500">資料會同步到 Firebase 與本機快取</small>'; log.appendChild(empty); calcSelectedSummary(); return; }
  const today = new Date(); const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  groups.forEach(([date, entries]) => {
    const det = document.createElement('details'); det.className = 'group overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70'; det.open = date === todayKey; const sum = document.createElement('summary'); sum.className = 'flex cursor-pointer items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-3 py-2.5 text-[12px] text-slate-200'; sum.innerHTML = `<span class="group-title flex items-center gap-2"><strong class="text-sky-300">${date}</strong><span class="rounded border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">${entries.length} 筆</span></span><span class="rounded border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">點擊可收合</span>`; det.appendChild(sum);
    const wrap = document.createElement('div'); wrap.className = 'entries space-y-2 p-2';
    entries.forEach(({ item, i }) => { const row = document.createElement('article'); row.className = 'entry rounded-lg border border-slate-800 bg-slate-950/70 p-3'; const main = document.createElement('div'); main.className = 'entry-main flex flex-col gap-2'; const top = document.createElement('div'); top.className = 'entry-top flex flex-wrap items-center gap-2'; const tTxt = document.createElement('span'); tTxt.className = 'entry-time text-[12px] font-semibold text-slate-100'; tTxt.textContent = fmtEntry(new Date(item.t)); const typeTag = document.createElement('span'); const meta = TYPE_META[item.type] || TYPE_META.work; typeTag.className = `tag rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className === 'tag-commute' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : meta.className === 'tag-work' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : meta.className === 'tag-shopping' ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : meta.className === 'tag-event' ? 'border-orange-500/30 bg-orange-500/10 text-orange-300' : 'border-slate-600 bg-slate-900/70 text-slate-400'}`; typeTag.textContent = meta.label; top.append(tTxt, typeTag); const note = document.createElement('input'); note.className = 'entry-note w-full rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none'; note.type = 'text'; note.placeholder = '備註'; note.name = `note-${i}`; note.id = `note-${item.id}`; note.value = item.note || ''; note.dataset.idx = i; note.addEventListener('input', onNoteInput); const timerCont = document.createElement('div'); timerCont.className = 'timer-controls flex items-center gap-2 mt-2'; const timerBtn = document.createElement('button'); timerBtn.type = 'button'; timerBtn.className = `timerBtn rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition ${timers[item.id] ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'}`; timerBtn.textContent = timers[item.id] ? '停止計時' : '計時'; timerBtn.onclick = e => { e.stopPropagation(); startTimer(i); }; const timerDisp = document.createElement('span'); timerDisp.className = 'timerDisplay text-[10px] text-amber-300'; timerDisp.dataset.idx = i; timerDisp.dataset.entryId = item.id; timerDisp.textContent = timers[item.id] ? formatMsToHMS(Date.now() - timers[item.id].startTime) : '00:00:00'; timerCont.append(timerBtn, timerDisp); main.append(top, note, timerCont); const act = document.createElement('div'); act.className = 'entry-actions mt-2 flex justify-end'; const del = document.createElement('button'); del.type = 'button'; del.className = 'delBtn rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-300 transition hover:bg-rose-500/20'; del.textContent = '刪除'; del.onclick = e => { e.stopPropagation(); removeEntry(i); }; act.appendChild(del); row.append(main, act); wrap.appendChild(row); }); det.appendChild(wrap); log.appendChild(det);
  }); calcSelectedSummary();
}

function startTimer(idx) {
  const item = times[idx];
  if (!item) return;

  const entryId = item.id;

  if (timers[entryId]) {
    // 停止計時器
    clearInterval(timers[entryId].intervalId);
    const elapsedTime = Date.now() - item.startTime;
    delete timers[entryId];

    // 直接記錄計時時間，不需要輸入第二則備註
    item.note = `${item.note || ''}${item.note ? ' | ' : ''}計時 ${formatMsToHMS(elapsedTime)}`;
    queueSave();
    render(); // 重新渲染以更新按鈕狀態和顯示
  } else {
    // 開始計時器
    timers[entryId] = {
      startTime: Date.now(),
      intervalId: setInterval(() => {
        const displayElement = document.querySelector(`.timerDisplay[data-entry-id="${entryId}"]`);
        if (displayElement) {
          displayElement.textContent = formatMsToHMS(Date.now() - timers[entryId].startTime);
        }
      }, 1000)
    };
    item.startTime = timers[entryId].startTime; // 記錄開始時間到 item 中
    persistLocalCache(); // 立即保存 startTime
    queueSave(); // 保留 Firebase 同步延遲
    render(); // 重新渲染以更新按鈕狀態
  }
}

// 重新載入時恢復正在進行的計時器
function rehydrateTimers() {
  // 確保 DOM 已就緒
  setTimeout(() => {
    times.forEach((item, idx) => {
      // 只恢復沒有計時器的項目，避免覆蓋已有的
      if (item.startTime && !item.note?.includes('計時') && !timers[item.id]) {
        // 這個計時器在頁面關閉前還在運行
        timers[item.id] = {
          startTime: item.startTime,
          intervalId: setInterval(() => {
            const displayElement = document.querySelector(`.timerDisplay[data-entry-id="${item.id}"]`);
            if (displayElement) {
              displayElement.textContent = formatMsToHMS(Date.now() - timers[item.id].startTime);
            }
          }, 1000)
        };
        // 立即更新一次顯示
        const displayElement = document.querySelector(`.timerDisplay[data-entry-id="${item.id}"]`);
        if (displayElement) {
          displayElement.textContent = formatMsToHMS(Date.now() - item.startTime);
        }
        // 更新按鈕狀態
        const timerBtn = document.querySelector(`.timerBtn[data-entry-id="${item.id}"]`);
        if (timerBtn) {
          timerBtn.textContent = '停止計時';
          timerBtn.className = 'timerBtn rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20';
        }
      }
    });
  }, 0);
}

function addEntry(type) {
  const newItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, t: Date.now(), type, note: '', startTime: null };
  times.push(newItem);
  persistLocalCache(); // 立即保存
  queueSave(); // Firebase 同步
  render();
}

function promptForNoteAndAddEntry(type) {
  const note = prompt('請輸入備註（可留空）');
  if (note === null) return;
  const newItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, t: Date.now(), type, note: note || '', startTime: null };
  times.push(newItem);
  persistLocalCache(); // 立即保存
  queueSave(); // Firebase 同步
  render();
}

function removeEntry(idx) {
  const id = times[idx]?.id;
  console.log('[刪除] 嘗試刪除記錄:', id, 'idx:', idx);
  if (id && timers[id]) {
    clearInterval(timers[id].intervalId);
    delete timers[id];
  }
  times.splice(idx, 1);
  console.log('[刪除] 本地刪除後:', times.map(t => t.id).join(', '));
  persistLocalCache(); // 立即保存
  queueSave(); // Firebase 同步
  console.log('[刪除] 已調用 queueSave');
  render();
}

function onNoteInput(e) { const i = Number(e.target.dataset.idx); if (!times[i]) return; times[i].note = e.target.value; queueSave(); }

function exportAs() {
  exportMenu.style.display = 'none';
  if (!times.length) { alert('尚無時間資料'); return; }

  const TYPE_LABEL = { commute:'通勤', work:'工作', shopping:'購物', event:'事件', unknown:'未知' };
  const date = new Date().toISOString().slice(0, 10);
  const lines = [];

  lines.push('═══════════════════════════════════════');
  lines.push(`  打卡紀錄匯出  ${date}`);
  lines.push('═══════════════════════════════════════');
  lines.push('');

  const groups = {};
  times.slice().sort((a, b) => b.t - a.t).forEach(item => {
    const k = `${new Date(item.t).getFullYear()}-${String(new Date(item.t).getMonth()+1).padStart(2,'0')}-${String(new Date(item.t).getDate()).padStart(2,'0')}`;
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  });

  const totalByType = { commute:0, work:0, shopping:0, event:0 };
  const totalMsByType = { commute:0, work:0, shopping:0, event:0 };

  Object.entries(groups).forEach(([d, items]) => {
    lines.push(`📅 ${d}`);
    lines.push('───────────────────────────────────────');
    items.forEach(item => {
      const h = String(new Date(item.t).getHours()).padStart(2, '0');
      const m = String(new Date(item.t).getMinutes()).padStart(2, '0');
      const s = String(new Date(item.t).getSeconds()).padStart(2, '0');
      const label = TYPE_LABEL[item.type] || item.type;
      const note = item.note ? `  📝 ${item.note}` : '';
      const timer = item.note && item.note.includes('計時') ? `  ⏱ ${item.note.match(/計時 [0-9:]+/)?.[0] || ''}` : '';
      lines.push(`  ▸ ${h}:${m}:${s}  [${label}]${note}${timer}`);
      totalByType[item.type] = (totalByType[item.type] || 0) + 1;
      if (item.startTime) {
        totalMsByType[item.type] = (totalMsByType[item.type] || 0) + ((item.endTime || Date.now()) - item.startTime);
      }
    });
    lines.push('');
  });

  lines.push('═══════════════════════════════════════');
  lines.push('  統計摘要');
  lines.push('═══════════════════════════════════════');
  const fmtMs = ms => {
    if (!ms || ms <= 0) return '—';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
  };
  ['commute', 'work', 'shopping', 'event'].forEach(t => {
    if (totalByType[t]) lines.push(`  ${TYPE_LABEL[t]}：${totalByType[t]} 筆  |  計時總長：${fmtMs(totalMsByType[t])}`);
  });
  lines.push('  ─────────────────');
  lines.push(`  總記錄數：${times.length} 筆`);
  lines.push('═══════════════════════════════════════');

  const content = lines.join('\n') + '\n';
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `timeclock_${date}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function clearAll() { if (!confirm('確定清除全部時間？')) return; times = []; for (const k in timers) { clearInterval(timers[k].intervalId); } timers = {}; persistLocalCache(); setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant')); render(); saveToFirebase(); }

function initBtns() { document.getElementById('commuteBtn').onclick = () => promptForNoteAndAddEntry('commute'); document.getElementById('workBtn').onclick = () => promptForNoteAndAddEntry('work'); document.getElementById('shoppingBtn').onclick = () => promptForNoteAndAddEntry('shopping'); document.getElementById('eventBtn').onclick = () => promptForNoteAndAddEntry('event'); document.getElementById('clearBtn').onclick = clearAll; document.getElementById('refreshBtn').onclick = () => location.reload(); document.getElementById('exportBtn').onclick = () => { exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block'; }; document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) exportMenu.style.display = 'none'; }); exportMenu.querySelectorAll('button[data-export]').forEach(btn => { btn.addEventListener('click', () => exportAs(btn.dataset.export)); }); exportMenu.querySelectorAll('button').forEach(btn => { btn.addEventListener('click', () => { exportMenu.style.display = 'none'; }); }); document.getElementById('gcalBtn').onclick = addToGoogleCalendarToday; }

function updateNow() {
  const now = fmtDate(new Date());
  sideNowLabel.textContent = now;
}

function addToGoogleCalendarToday() {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;
  const todays = times.filter(item => {
    const d = new Date(item.t);
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}` === todayKey;
  });
  if (!todays.length) { alert('今日無資料'); return; }
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TimeClock//Google Calendar Import//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  // Merge all today's records into a single all-day event
  const start = new Date(today.setHours(0,0,0,0));
  const yyyy = start.getFullYear();
  const mm = String(start.getMonth()+1).padStart(2,'0');
  const dd = String(start.getDate()).padStart(2,'0');
  const icalStart = yyyy + mm + dd;
  const nextDay = new Date(start.getTime() + 24*60*60*1000);
  const icalEndStr = nextDay.getFullYear() + String(nextDay.getMonth()+1).padStart(2,'0') + String(nextDay.getDate()).padStart(2,'0');

  const descParts = todays.map(item => {
    const t = new Date(item.t);
    const timeStr = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
    const typeLabel = TYPE_META[item.type]?.label || item.type;
    const note = item.note || '';
    return `${typeLabel} ${timeStr}${note ? ' - ' + note : ''}`;
  });
  const description = descParts.join('\\n');

  ics.push('BEGIN:VEVENT');
  ics.push('UID:today@timeclock');
  ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'')}Z`);
  ics.push(`DTSTART:${icalStart}`);
  ics.push(`DTEND:${icalEndStr}`);
  ics.push('SUMMARY:請填寫行程標題');
  ics.push(`DESCRIPTION:${description}`);
  ics.push('END:VEVENT');
  ics.push('END:VCALENDAR');
  const blob = new Blob([ics.join('\r\n')], {type: 'text/calendar'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timeclock_${todayKey}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeRemoteSnapshot(d){if(!d)return[]; if(Array.isArray(d))return normalizeTimes(d); return normalizeTimes(Object.values(d));}

function saveToFirebase() {
  console.log('[Firebase] saveToFirebase 被調用，userId:', userId, 'times:', times.map(t => t.id).join(', '));
  persistLocalCache();
  const cur = fbReady ? auth.currentUser : null;
  if (!fbReady || !cur || !isAuthorizedUser(cur)) {
    console.log('[Firebase] 無法保存：未認證或用戶未授權');
    setSyncState('OFFLINE', lastSyncAt || new Date().toLocaleTimeString('zh-Hant'));
    return;
  }
  userId = cur.uid;
  const storage = `users/${userId}/times`;
  console.log('[Firebase] 保存到:', storage);
  setSyncState('SYNCING', lastSyncAt || new Date().toLocaleTimeString('zh-Hant'));
  return window.db.ref(storage).set(times).then(() => {
    console.log('[Firebase] 保存成功');
    setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant'));
  }).catch(err => {
    console.error('[Firebase] 保存失敗:', err);
    setSyncState('OFFLINE', lastSyncAt || '離線');
  });
}