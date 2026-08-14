// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAPiY66axJHSA_Z2sBpnbRJPtra7Fvr3aY",
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
const MY_EMAIL = 'chiwen1989@gmail.com';

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
let exportMenu = null;
let syncBadge = null;
let syncStateLabel = null;
let updatedAtLabel = null;
let times = [];
let timers = {}; // key: entry id -> {startTime, intervalId}
let syncState = 'OFFLINE';
let lastSyncAt = '';
let saveTimer = null;
let localCacheKey = 'daKaLocalTimes';
let firebaseTimesRef = null;
let firebaseTimesListener = null;
const TYPE_META = {
  commute: { label: '通勤', className: 'tag-commute' },
  work: { label: '工作', className: 'tag-work' },
  shopping: { label: '購物', className: 'tag-shopping' },
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
    }
  });
} else {
  setSyncState('OFFLINE', '離線模式（無 Firebase SDK）');
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
initAfterAuth();

function initAfterAuth() {
  log = document.getElementById('log');
  recordCountLabel = document.getElementById('recordCountLabel');
  recordStat = document.getElementById('recordStat');
  commuteCountStat = document.getElementById('commuteCountStat');
  workCountStat = document.getElementById('workCountStat');
  shoppingCountStat = document.getElementById('shoppingCountStat');
  exportMenu = document.getElementById('exportMenu');
  syncBadge = document.getElementById('syncBadge');
  syncStateLabel = document.getElementById('syncStateLabel');
  updatedAtLabel = document.getElementById('updatedAtLabel');

  times = loadLocalCache();
  syncState = 'OFFLINE';
  lastSyncAt = '';
  saveTimer = null;

  initBtns();
  render();
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
  firebaseTimesRef = firebase.database().ref(`users/${userId}/times`);
  firebaseTimesListener = snapshot => {
    setSyncState('SYNCING', new Date().toLocaleTimeString('zh-Hant'));
    const remote = normalizeRemoteSnapshot(snapshot.val());
    if (JSON.stringify(remote) !== JSON.stringify(times)) {
      times = remote;
      persistLocalCache();
      render();
    }
    setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant'));
  };
  firebaseTimesRef.on('value', firebaseTimesListener);
}

function normalizeTimes(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => {
    const rawType = typeof item?.type === 'string' ? item.type : '';
    const type = rawType === 'commute' || rawType === 'work' || rawType === 'shopping'
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
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { persistLocalCache(); saveToFirebase(); }, 220);
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
}

function render() {
  log.innerHTML = ''; recordCountLabel.textContent = times.length; recordStat.textContent = times.length;
  const groups = getGroupedTimes();
  if (!groups.length) { const empty = document.createElement('div'); empty.className = 'stat-card rounded-lg border border-slate-800 bg-slate-950/70 p-4'; empty.innerHTML = '<span class="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">目前沒有記錄</span><strong class="mt-1 block text-sm font-semibold text-slate-100">按「通勤 / 工作 / 購物」開始</strong><small class="mt-1 block text-[10px] text-slate-500">資料會同步到 Firebase 與本機快取</small>'; log.appendChild(empty); calcSelectedSummary(); return; }
  const today = new Date(); const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  groups.forEach(([date, entries]) => {
    const det = document.createElement('details'); det.className = 'group overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70'; det.open = date === todayKey; const sum = document.createElement('summary'); sum.className = 'flex cursor-pointer items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-3 py-2.5 text-[12px] text-slate-200'; sum.innerHTML = `<span class="group-title flex items-center gap-2"><strong class="text-sky-300">${date}</strong><span class="rounded border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">${entries.length} 筆</span></span><span class="rounded border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">點擊可收合</span>`; det.appendChild(sum);
    const wrap = document.createElement('div'); wrap.className = 'entries space-y-2 p-2';
    entries.forEach(({ item, i }) => { const row = document.createElement('article'); row.className = 'entry rounded-lg border border-slate-800 bg-slate-950/70 p-3'; const main = document.createElement('div'); main.className = 'entry-main flex flex-col gap-2'; const top = document.createElement('div'); top.className = 'entry-top flex flex-wrap items-center gap-2'; const tTxt = document.createElement('span'); tTxt.className = 'entry-time text-[12px] font-semibold text-slate-100'; tTxt.textContent = fmtEntry(new Date(item.t)); const typeTag = document.createElement('span'); const meta = TYPE_META[item.type] || TYPE_META.work; typeTag.className = `tag rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className === 'tag-commute' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : meta.className === 'tag-work' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : meta.className === 'tag-shopping' ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-slate-600 bg-slate-900/70 text-slate-400'}`; typeTag.textContent = meta.label; top.append(tTxt, typeTag); const note = document.createElement('input'); note.className = 'entry-note w-full rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none'; note.type = 'text'; note.placeholder = '備註'; note.value = item.note || ''; note.dataset.idx = i; note.addEventListener('input', onNoteInput); const timerCont = document.createElement('div'); timerCont.className = 'timer-controls flex items-center gap-2 mt-2'; const timerBtn = document.createElement('button'); timerBtn.type = 'button'; timerBtn.className = `timerBtn rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition ${timers[item.id] ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'}`; timerBtn.textContent = timers[item.id] ? '停止計時' : '計時'; timerBtn.onclick = e => { e.stopPropagation(); startTimer(i); }; const timerDisp = document.createElement('span'); timerDisp.className = 'timerDisplay text-[10px] text-amber-300'; timerDisp.dataset.idx = i; timerDisp.dataset.entryId = item.id; timerDisp.textContent = timers[item.id] ? formatMsToHMS(Date.now() - timers[item.id].startTime) : '00:00:00'; timerCont.append(timerBtn, timerDisp); main.append(top, note, timerCont); const act = document.createElement('div'); act.className = 'entry-actions mt-2 flex justify-end'; const del = document.createElement('button'); del.type = 'button'; del.className = 'delBtn rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-300 transition hover:bg-rose-500/20'; del.textContent = '刪除'; del.onclick = e => { e.stopPropagation(); removeEntry(i); }; act.appendChild(del); row.append(main, act); wrap.appendChild(row); }); det.appendChild(wrap); log.appendChild(det);
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
    queueSave(); // 保存 startTime
    render(); // 重新渲染以更新按鈕狀態
  }
}

function addEntry(type) { times.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, t: Date.now(), type, note: '', startTime: null }); queueSave(); render(); }

function promptForNoteAndAddEntry(type) { const note = prompt('請輸入備註（可留空）'); if (note === null) return; times.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, t: Date.now(), type, note: note || '', startTime: null }); queueSave(); render(); }

function removeEntry(idx) { const id = times[idx]?.id; if (id && timers[id]) { clearInterval(timers[id].intervalId); delete timers[id]; } times.splice(idx, 1); queueSave(); render(); }

function onNoteInput(e) { const i = Number(e.target.dataset.idx); if (!times[i]) return; times[i].note = e.target.value; queueSave(); }

function exportAs(type) { exportMenu.style.display = 'none'; if (!times.length) { alert('尚無時間資料'); return; } const date = new Date().toISOString().slice(0, 10); const totalC = calcRange(times.filter(t => t.type === 'commute')); const totalW = calcRange(times.filter(t => t.type === 'work')); const totalS = calcRange(times.filter(t => t.type === 'shopping')); const lines = times.map((t, i) => `${i + 1}. ${fmtEntry(new Date(t.t))} (${t.type}) ${t.note ? '- ' + t.note : ''}`); const content = lines.join('\n') + `\n\nCOMMUTE ${totalC} | WORK ${totalW} | SHOPPING ${totalS}`; const blob = new Blob([content], { type: 'text/plain;charset=utf-8' }); const f = `timeclock_${date}.txt`; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f; a.click(); URL.revokeObjectURL(a.href); }

function clearAll() { if (!confirm('確定清除全部時間？')) return; times = []; for (const k in timers) { clearInterval(timers[k].intervalId); } timers = {}; persistLocalCache(); setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant')); render(); saveToFirebase(); }

function initBtns() { document.getElementById('commuteBtn').onclick = () => promptForNoteAndAddEntry('commute'); document.getElementById('workBtn').onclick = () => promptForNoteAndAddEntry('work'); document.getElementById('shoppingBtn').onclick = () => promptForNoteAndAddEntry('shopping'); document.getElementById('clearBtn').onclick = clearAll; document.getElementById('refreshBtn').onclick = () => location.reload(); document.getElementById('exportBtn').onclick = () => { exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block'; }; document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) exportMenu.style.display = 'none'; }); exportMenu.querySelectorAll('button[data-export]').forEach(btn => { btn.addEventListener('click', () => exportAs(btn.dataset.export)); }); exportMenu.querySelectorAll('button').forEach(btn => { btn.addEventListener('click', () => { exportMenu.style.display = 'none'; }); }); }

function updateNow() { const now = fmtDate(new Date()); syncStateLabel.textContent = now; sideNowLabel.textContent = now; }

function normalizeRemoteSnapshot(d) { if (!d) return []; if (Array.isArray(d)) return normalizeTimes(d); return normalizeTimes(Object.values(d)); }

function saveToFirebase() { persistLocalCache(); const cur = fbReady ? auth.currentUser : null; if (!fbReady || !cur || !isAuthorizedUser(cur)) { setSyncState('OFFLINE', lastSyncAt || new Date().toLocaleTimeString('zh-Hant')); return; } userId = cur.uid; const storage = `users/${userId}/times`; setSyncState('SYNCING', lastSyncAt || new Date().toLocaleTimeString('zh-Hant')); return firebase.database().ref(storage).set(times).then(() => { setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant')); }).catch(err => { console.error('save error', err); setSyncState('OFFLINE', lastSyncAt || '離線'); }); }