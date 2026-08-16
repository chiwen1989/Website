# TimeClock 使用說明書

## 概述
TimeClock 是一個簡單的時間記錄應用程式，用於記錄通勤、工作、購物和事件時間，並提供計時功能和 Google 日曆匯出。

## 功能

### 1. 時間記錄
- 通勤、工作、購物、事件時間記錄
- 自動生成唯一ID
- 記錄開始時間和類型
- 支援備註欄位

### 2. 計時功能
- 計時按鈕：開始/停止計時
- 計時顯示：即時更新計時時間
- 自動記錄計時結果到備註

### 3. 資料管理
- 本地快取：使用localStorage儲存記錄
- Firebase同步：登入後同步到Firebase
- 匯出功能：匯出為TXT格式
- Google 日曆匯出：匯出為ICS格式（全天事件）

### 4. 記錄類型配色
- 通勤：藍色（sky）
- 工作：綠色（emerald）
- 購物：紫色（violet）
- 事件：橘色（orange）

## 使用方式

### 1. 新增記錄
1. 點擊「通勤」「工作」「購物」或「事件」按鈕
2. 輸入備註（可選）
3. 記錄會自動儲存

### 2. 使用計時功能
1. 在記錄項目中點擊「計時」按鈕
2. 計時開始後，時間會即時顯示
3. 點擊「停止計時」按鈕
4. 計時結果會自動記錄到備註中

### 3. 匯出功能
- **匯出 TXT**：将所有記錄匯出為文字檔
- **加入 Google 日曆**：匯出今日記錄為 ICS 檔案，匯入後可加入 Google 日曆（全天事件，合併為單一事件）

### 4. 管理記錄
- 刪除單筆記錄：點擊記錄項目的「刪除」按鈕
- 清除所有記錄：點擊「清除全部」按鈕

## 技術細節

### 1. 核心變數
- `times`：儲存所有時間記錄的陣列
- `timers`：儲存計時器狀態的物件
- `TYPE_META`：記錄類型的元資料

### 2. 主要函數
- `render()`：渲染所有記錄
- `startTimer()`：處理計時器邏輯
- `queueSave()`：排程資料儲存
- `saveToFirebase()`：同步到Firebase

### 3. 計時器實現
```javascript
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
```

## 注意事項
1. 計時功能會自動將時間記錄到備註中，無需額外輸入
2. 資料會自動同步到Firebase（需登入）
3. 匯出功能支援TXT和ICS（Google 日曆）格式
4. ICS 匯出為全天事件（無時間欄位），所有今日記錄合併為單一事件
5. 計時器會即時更新顯示，無需手動刷新

## 修改歷史

### 2026-08-16
- 新增「事件」按鈕（橘色配色）
- 新增 Google 日曆匯出功能（ICS 格式）
- 修正時區問題（改用本地時間）
- 修正 normalizeTimes 函式支援 event 類型
- 合併今日記錄為單一全天事件

### 2026-08-14
- 新增計時功能
- 修正計時顯示問題
- 優化計時器邏輯
