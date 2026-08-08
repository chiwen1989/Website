
  const firebaseConfig = {
      apiKey: "AIzaSyDXnzQdc0Ww42hKNaKhjQVajoZDXu8epuo",
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
    if (!user?.email) return false;
    return ALLOWED_EMAILS.has(user.email.toLowerCase());
  }

  let userId = null;
  let log = null;
  let totalLabel = null;
  let commuteTotalLabel = null;
  let workTotalLabel = null;
  let shoppingTotalLabel = null;
  let recordCountLabel = null;
  let selectedCountLabel = null;
  let recordStat = null;
  let checkedStat = null;
  let commuteCountStat = null;
  let workCountStat = null;
  let shoppingCountStat = null;
  let exportMenu = null;
  let nowMiniLabel = null;
  let sideNowLabel = null;
  let syncBadge = null;
  let syncStateLabel = null;
  let updatedAtLabel = null;
  let listHint = null;
  let times = [];
  let syncState = 'OFFLINE';
  let lastSyncAt = '';
  let saveTimer = null;
  let localCacheKey = 'daKaLocalTimes';
  let firebaseTimesRef = null;
  let firebaseTimesListener = null;
  let TYPE_META = {
    commute: { label: '通勤', className: 'tag-commute' },
    work: { label: '工作', className: 'tag-work' },
    shopping: { label: '購物', className: 'tag-shopping' },
    unknown: { label: '未知', className: 'tag-unknown' }
  };

  // 本機優先：登入與否都直接進主畫面；登入後才啟動 Firebase 同步。
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

  // 登入：email + 密碼（無 popup、無 redirect，file:// 也能用）
  function doLogin() {
    if (!fbReady) { alert('Firebase SDK 無法載入，無法登入（可能沒有網路）'); return; }
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    if (!email || !pass) { alert('請輸入 Email 與密碼'); return; }
    auth.signInWithEmailAndPassword(email, pass)
      .then(() => {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('loginPass').value = '';
      })
      .catch(err => {
        console.error('登入失敗', err);
        let msg = err.message || '登入失敗';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Email 或密碼錯誤';
        if (err.code === 'auth/invalid-email') msg = 'Email 格式不正確';
        if (err.code === 'auth/operation-not-allowed') msg = 'Firebase 未啟用 Email/密碼登入，請到 Console 啟用';
        alert(msg);
      });
  }

  document.getElementById('btnLogin').addEventListener('click', () => {
    if (!fbReady) { alert('Firebase SDK 無法載入，無法登入（可能沒有網路）'); return; }
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('loginEmail').focus();
  });

  document.getElementById('btnLogout').addEventListener('click', () => {
    if (fbReady) auth.signOut();
  });

  document.getElementById('loginSubmit').addEventListener('click', doLogin);
  document.getElementById('loginCancel').addEventListener('click', () => {
    document.getElementById('loginModal').style.display = 'none';
  });
  document.getElementById('loginPass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  // 直接顯示主畫面（不再以登入為門檻）
  document.getElementById('appContainer').style.display = 'block';
  initAfterAuth();

  function initAfterAuth() {
      log = document.getElementById('log');
      totalLabel = document.getElementById('totalLabel');
      commuteTotalLabel = document.getElementById('commuteTotalLabel');
      workTotalLabel = document.getElementById('workTotalLabel');
      shoppingTotalLabel = document.getElementById('shoppingTotalLabel');
      recordCountLabel = document.getElementById('recordCountLabel');
      selectedCountLabel = document.getElementById('selectedCountLabel');
      recordStat = document.getElementById('recordStat');
      checkedStat = document.getElementById('checkedStat');
      commuteCountStat = document.getElementById('commuteCountStat');
      workCountStat = document.getElementById('workCountStat');
      shoppingCountStat = document.getElementById('shoppingCountStat');
      exportMenu = document.getElementById('exportMenu');
      nowMiniLabel = document.getElementById('nowMiniLabel');
      sideNowLabel = document.getElementById('sideNowLabel');
      syncBadge = document.getElementById('syncBadge');
      syncStateLabel = document.getElementById('syncStateLabel');
      updatedAtLabel = document.getElementById('updatedAtLabel');
      listHint = document.getElementById('listHint');

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
    if (firebaseTimesRef && firebaseTimesListener) {
      firebaseTimesRef.off('value', firebaseTimesListener);
    }
    firebaseTimesRef = null;
    firebaseTimesListener = null;
  }

  // 登入後才啟動 Firebase 即時監聽（有網路才同步）
  function setupFirebaseListener() {
    cleanupFirebaseListener();
    if (!fbReady || !userId) return;
    const storagePath = `users/${userId}/times`;
    firebaseTimesRef = firebase.database().ref(storagePath);
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
        checked: !!item?.checked,
        type,
        note: typeof item?.note === 'string' ? item.note : ''
      };
    });
  }

  function loadLocalCache() {
    try {
      const raw = localStorage.getItem(localCacheKey);
      return raw ? normalizeTimes(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  function persistLocalCache() {
    localStorage.setItem(localCacheKey, JSON.stringify(times));
  }

  function fmtDuration(ms) {
    if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) return '—';
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  }

  function fmtDate(d) {
    const Y = d.getFullYear();
    const M = d.getMonth() + 1;
    const D = d.getDate();
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return `${Y} 年 ${M} 月 ${D} 日 ${h12}:${m}:${s} ${ampm}`;
  }

  function fmtEntry(d) {
    const Y = d.getFullYear();
    const M = d.getMonth() + 1;
    const D = d.getDate();
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return `${Y}/${M}/${D} ${h12}:${m}:${s} ${ampm}`;
  }

  function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function setSyncState(state, touchedAt) {
    syncState = state;
    if (touchedAt) lastSyncAt = touchedAt;
    if (!syncBadge) return; // initAfterAuth 前呼叫時安全略過
    syncBadge.textContent = state;
    syncStateLabel.textContent = state;
    updatedAtLabel.textContent = lastSyncAt || '—';
  }

  function queueSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      persistLocalCache();
      saveToFirebase();
    }, 220);
  }

  function getGroupedTimes() {
    const groups = {};
    const indexedTimes = times.map((item, index) => ({ item, index }));
    indexedTimes.sort((a, b) => b.item.t - a.item.t);

    indexedTimes.forEach(({ item, index }) => {
      const d = new Date(item.t);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ item, index });
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }

  function calcRange(list) {
    const values = list.map(t => t.t).sort((a, b) => a - b);
    if (values.length < 2) return '';
    return fmtDuration(values[values.length - 1] - values[0]);
  }

  function calcSelectedSummary() {
    const selected = times.filter(t => t.checked);
    const selectedCommute = selected.filter(t => t.type === 'commute');
    const selectedWork = selected.filter(t => t.type === 'work');
    const selectedShopping = selected.filter(t => t.type === 'shopping');
    const total = calcRange(selected);
    const commute = calcRange(selectedCommute);
    const work = calcRange(selectedWork);
    const shopping = calcRange(selectedShopping);

    totalLabel.textContent = total || '—';
    commuteTotalLabel.textContent = commute || '—';
    workTotalLabel.textContent = work || '—';
    shoppingTotalLabel.textContent = shopping || '—';

    const checkedCount = selected.length;
    selectedCountLabel.textContent = checkedCount;
    checkedStat.textContent = checkedCount;
    recordCountLabel.textContent = times.length;
    recordStat.textContent = times.length;
    commuteCountStat.textContent = times.filter(t => t.type === 'commute').length;
    workCountStat.textContent = times.filter(t => t.type === 'work').length;
    shoppingCountStat.textContent = times.filter(t => t.type === 'shopping').length;
    listHint.textContent = checkedCount >= 2 ? `已選 ${checkedCount} 筆，可計算總時數` : '請勾選兩筆以上時間以計算總時數';
  }

  function render() {
    log.innerHTML = '';
    recordCountLabel.textContent = times.length;
    recordStat.textContent = times.length;

    const groups = getGroupedTimes();
    if (!groups.length) {
      const empty = document.createElement('div');
      empty.className = 'stat-card rounded-lg border border-slate-800 bg-slate-950/70 p-4';
      empty.innerHTML = '<span class="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">目前沒有記錄</span><strong class="mt-1 block text-sm font-semibold text-slate-100">按「通勤 / 工作 / 購物」開始</strong><small class="mt-1 block text-[10px] text-slate-500">資料會同步到 Firebase 與本機快取</small>';
      log.appendChild(empty);
      calcSelectedSummary();
      return;
    }

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    groups.forEach(([date, entries]) => {
      const details = document.createElement('details');
      details.className = 'group overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70';
      details.open = date === todayKey;

      const summary = document.createElement('summary');
      const totalChecked = entries.filter(({ item }) => item.checked).length;
      summary.className = 'flex cursor-pointer items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-3 py-2.5 text-[12px] text-slate-200';
      summary.innerHTML = `
        <span class="group-title flex items-center gap-2"><strong class="text-sky-300">${date}</strong><span class="rounded border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">${entries.length} 筆 / ${totalChecked} 已勾選</span></span>
        <span class="rounded border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">點擊可收合</span>
      `;
      details.appendChild(summary);

      const entriesWrap = document.createElement('div');
      entriesWrap.className = 'entries space-y-2 p-2';

      entries.forEach(({ item, index }) => {
        const row = document.createElement('article');
        row.className = 'entry rounded-lg border border-slate-800 bg-slate-950/70 p-3';

        const main = document.createElement('div');
        main.className = 'entry-main flex flex-col gap-2';

        const top = document.createElement('div');
        top.className = 'entry-top flex flex-wrap items-center gap-2';

        const label = document.createElement('label');
        label.className = 'entry-check flex items-center gap-2 text-[11px] text-slate-400';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.idx = index;
        cb.checked = item.checked;
        cb.className = 'h-4 w-4 rounded border-slate-700 bg-slate-900 accent-sky-500';
        cb.addEventListener('change', onCheck);

        const labelText = document.createElement('span');
        labelText.textContent = '勾選';

        const timeText = document.createElement('span');
        timeText.className = 'entry-time text-[12px] font-semibold text-slate-100';
        timeText.textContent = fmtEntry(new Date(item.t));

        const typeTag = document.createElement('span');
        const meta = TYPE_META[item.type] || TYPE_META.work;
        typeTag.className = `tag rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className === 'tag-commute' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : meta.className === 'tag-work' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : meta.className === 'tag-shopping' ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-slate-600 bg-slate-900/70 text-slate-400'}`;
        typeTag.textContent = meta.label;

        label.append(cb, labelText);
        top.append(label, timeText, typeTag);

        const note = document.createElement('input');
        note.className = 'entry-note w-full rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none';
        note.type = 'text';
        note.placeholder = '備註';
        note.value = item.note || '';
        note.dataset.idx = index;
        note.addEventListener('input', onNoteInput);

        main.append(top, note);

        const actions = document.createElement('div');
        actions.className = 'entry-actions mt-2 flex justify-end';
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'delBtn rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-300 transition hover:bg-rose-500/20';
        del.textContent = '刪除';
        del.onclick = e => {
          e.stopPropagation();
          removeEntry(index);
        };
        actions.appendChild(del);

        row.append(main, actions);
        entriesWrap.appendChild(row);
      });

      details.appendChild(entriesWrap);
      log.appendChild(details);
    });

    calcSelectedSummary();
  }

  function addEntry(type) {
    times.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      t: Date.now(),
      checked: false,
      type,
      note: ''
    });
    queueSave();
    render();
  }

  function removeEntry(idx) {
    times.splice(idx, 1);
    queueSave();
    render();
  }

  function onCheck(e) {
    const idx = Number(e.target.dataset.idx);
    if (!times[idx]) return;
    times[idx].checked = e.target.checked;
    queueSave();
    calcSelectedSummary();
  }

  function onNoteInput(e) {
    const idx = Number(e.target.dataset.idx);
    if (!times[idx]) return;
    times[idx].note = e.target.value;
    queueSave();
  }

  function exportAs(type) {
    exportMenu.style.display = 'none';
    if (!times.length) {
      alert('尚無時間資料');
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const totalCommute = calcRange(times.filter(t => t.type === 'commute'));
    const totalWork = calcRange(times.filter(t => t.type === 'work'));
    const totalShopping = calcRange(times.filter(t => t.type === 'shopping'));
    let content = '';
    let blob = null;
    let filename = '';

    if (type === 'csv') {
      const header = ['No.', 'DateTime', 'Checked', 'Type', 'Note'];
      const rows = times.map((t, i) => [
        i + 1,
        fmtEntry(new Date(t.t)),
        t.checked ? '✓' : '',
        t.type,
        t.note || ''
      ].map(csvEscape).join(','));
      content = '\uFEFF' + header.map(csvEscape).join(',') + '\n' + rows.join('\n') + `\n${csvEscape('Total Commute')},${csvEscape(totalCommute)}\n${csvEscape('Total Work')},${csvEscape(totalWork)}\n${csvEscape('Total Shopping')},${csvEscape(totalShopping)}`;
      blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      filename = `timeclock_${date}.csv`;
    } else if (type === 'txt') {
      const lines = times.map((t, i) => `${i + 1}. ${fmtEntry(new Date(t.t))} ${t.checked ? '✓' : ''} (${t.type}) ${t.note ? '- ' + t.note : ''}`);
      content = lines.join('\n') + `\n\nCOMMUTE ${totalCommute} | WORK ${totalWork} | SHOPPING ${totalShopping}`;
      blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      filename = `timeclock_${date}.txt`;
    } else if (type === 'md') {
      const rows = times.map((t, i) => `| ${i + 1} | ${fmtEntry(new Date(t.t))} | ${t.checked ? '✓' : ''} | ${t.type} | ${t.note || ''} |`);
      content = `| No. | DateTime | Checked | Type | Note |\n|---|---|---|---|---|\n${rows.join('\n')}\n| **Total Commute** | **${totalCommute}** |   |   |   |\n| **Total Work** | **${totalWork}** |   |   |   |\n| **Total Shopping** | **${totalShopping}** |   |   |   |`;
      blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      filename = `timeclock_${date}.md`;
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function clearAll() {
    if (!confirm('確定清除全部時間？')) return;
    times = [];
    persistLocalCache();
    setSyncState('SYNCED', new Date().toLocaleTimeString('zh-Hant'));
    render();
    saveToFirebase(); // 同時清除 Firebase 上的時段資料
  }

  function initBtns() {
    document.getElementById('commuteBtn').onclick = () => addEntry('commute');
    document.getElementById('workBtn').onclick = () => addEntry('work');
    document.getElementById('shoppingBtn').onclick = () => addEntry('shopping');
    document.getElementById('clearBtn').onclick = clearAll;
    document.getElementById('refreshBtn').onclick = () => location.reload();
    document.getElementById('exportBtn').onclick = () => {
      exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block';
    };
    document.addEventListener('click', e => {
      if (!e.target.closest('.dropdown')) exportMenu.style.display = 'none';
    });
    exportMenu.querySelectorAll('button[data-export]').forEach(btn => {
      btn.addEventListener('click', () => exportAs(btn.dataset.export));
    });
    exportMenu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => { exportMenu.style.display = 'none'; });
    });
  }

  function updateNow() {
    const now = fmtDate(new Date());
    nowMiniLabel.textContent = now;
    sideNowLabel.textContent = now;
  }

  function normalizeRemoteSnapshot(data) {
    if (!data) return [];
    if (Array.isArray(data)) return normalizeTimes(data);
    return normalizeTimes(Object.values(data));
  }

  function saveToFirebase() {
    persistLocalCache();
    const currentUser = fbReady ? auth.currentUser : null;
    if (!fbReady || !currentUser || !isAuthorizedUser(currentUser)) {
      setSyncState('OFFLINE', lastSyncAt || new Date().toLocaleTimeString('zh-Hant'));
      return;
    }
    userId = currentUser.uid;
    const storagePath = `users/${userId}/times`;
    setSyncState('SYNCING', lastSyncAt || new Date().toLocaleTimeString('zh-Hant'));
    return firebase.database().ref(storagePath).set(times)
      .then(() => {
        const stamp = new Date().toLocaleTimeString('zh-Hant');
        setSyncState('SYNCED', stamp);
      })
      .catch(err => {
        console.error('save error', err);
        setSyncState('OFFLINE', lastSyncAt || '離線');
      });
  }

  
