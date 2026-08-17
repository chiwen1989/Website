# TimeClock 打卡記錄工具 v1.2.30

## 概述

TimeClock 是一個輕量級時間記錄工具，用於記錄通勤、工作、購物、事件等活動。資料先存於本機，登入後自動同步至雲端。

## 設計理念

- **本地優先**：所有資料先寫入 localStorage，離線仍可正常使用
- **單一檔案**：整個應用僅兩個檔案（HTML + JS），部署零配置
- **最小依賴**：僅使用 Firebase compat SDK，無框架無構建流程
- **計時持久化**：頁面關閉後重新打開，進行中的計時器自動恢復
- **小檔案哲學**：app.js 794 行，index.html 153 行，避免過度工程

## 功能清單

| 功能 | 說明 |
|------|------|
| 四種記錄類型 | 通勤（藍）、工作（綠）、購物（紫）、事件（橘） |
| 計時功能 | 開始/停止計時，即時顯示時長，結果自動記錄至備註 |
| 離線支援 | 無需登入即可使用，資料自動保存於本機 |
| Firebase 同步 | 登入後多裝置同步，使用 update 而非 set 避免覆蓋 |
| 大批量保存 | >100 筆自動分批（每批 100 筆），避免超時 |
| 刪除優化 | 僅刪除單筆記錄，不觸發全量寫入 |
| Google 日曆匯出 | 匯出為 ICS 格式，今日記錄合併為單一全天事件 |
| TXT 匯出 | 所有記錄匯出為純文字檔 |

## 使用方式

### 新增記錄

1. 點擊對應按鈕：通勤 / 工作 / 購物 / 事件
2. **通勤**：直接選擇「出門」或「返家」，無需輸入備註
3. **工作/購物/事件**：輸入備註後，詢問是否立即開始計時

### 計時功能

1. 在記錄項目中點擊「計時」按鈕
2. 計時開始，時間每秒更新
3. 點擊「停止計時」按鈕
4. 結果自動追加至備註（格式：`備註 | 計時 01:23:45`）

### 匯出功能

從「⋯ 更多」選單選擇：
- **匯出 TXT**：所有記錄匯出為文字檔
- **加入 Google 日曆**：今日記錄匯出為 ICS 檔案（全天事件）
- **清除全部**：刪除所有記錄（需確認）

### 登入同步

1. 點擊「登入同步」或底部登入橫幅的「立即登入」
2. 輸入 Email 和密碼（僅授權帳號可存取）
3. 登入後資料自動同步至 Firebase

### 匯出 ICS 格式規範

- SUMMARY 和 DESCRIPTION 為純文字，不使用 encodeURIComponent
- 使用 CRLF 換行
- 匯出為全天事件（DTSTART/DTEND 僅日期無時間）
- 所有今日記錄合併為單一 VEVENT
- 備註與計時寫入 DESCRIPTION

## 同步狀態

| 狀態 | 說明 |
|------|------|
| OFFLINE | 離線模式，資料僅存於本機 |
| SYNCING | 正在同步中 |
| SYNCED | 已同步至 Firebase |

## 技術細節

### 核心變數

```javascript
let times = [];           // 所有記錄
let timers = {};          // 進行中的計時器 {id: {startTime, intervalId}}
let syncState = 'OFFLINE'; // 同步狀態
let isFirstSync = true;   // 首次同步標記（保護本地數據）
let lastSyncData = null;  // 上次同步數據（檢測刪除）
```

### 主要流程

1. **初始化**：加載本地緩存 → 綁定按鈕事件 → 渲染記錄
2. **Firebase 監聽**：登入後訂閱數據變更，合併策略優先本地
3. **保存策略**：本地優先寫入 → 有登入時隊列寫 Firebase
4. **計時恢復**：頁面載入時重啟 `setInterval`，計算實際經過時間

### 相容性

- 支援 GitHub Pages 部署（CSP 限制下使用 compat SDK）
- Firefox / Chrome / Safari 最新兩版本
- 移動端支援（響應式設計）

## 版本歷史

### v1.2.30
- 修復離線模式刷新後數據不顯示問題（先渲染後顯示登入橫幅）

### v1.2.29
- 修復離線模式刷新後數據不顯示（等待登入橫幅動畫完成）

### v1.2.24
- 修復首次同步時不刪除本地數據
- 修復重複記錄問題（Firebase 同步條件優化）

### v1.2.18
- 修復 Firebase 返回空數據時不刪除本地數據

### v1.2.12
- 修復按鈕事件重複綁定（initBtns 只執行一次）
- 等待按鈕元素存在後再綁定事件

### v1.2.0
- 新增計時器持久化（跨頁面關閉恢復）
- 新增 Google 日曆匯出（ICS 格式）
- 新增事件類型記錄
- 大批量數據保存優化（分批 100 筆）
- 刪除操作優化（單筆刪除不觸發全量寫入）

## 部署

### 手動部署
```bash
# 複製檔案至 GitHub Pages 倉庫
copy "C:\Users\chiwe\Downloads\TimeClock\app.js" "C:\Users\chiwe\Documents\GitHub\Website\TimeClock\app.js"
copy "C:\Users\chiwe\Downloads\TimeClock\index.html" "C:\Users\chiwe\Documents\GitHub\Website\TimeClock\index.html"
copy "C:\Users\chiwe\Downloads\TimeClock\output.css" "C:\Users\chiwe\Documents\GitHub\Website\TimeClock\output.css"
copy "C:\Users\chiwe\Downloads\TimeClock\styles.css" "C:\Users\chiwe\Documents\GitHub\Website\TimeClock\styles.css"

# 提交變更
cd C:\Users\chiwe\Documents\GitHub\Website\TimeClock
git add -A && git commit -m "v1.2.30: 修復離線模式刷新問題" && git push
```

### 編譯 CSS
```bash
cd C:\Users\chiwe\Downloads\TimeClock
npm run build:css
```

## 授權

本專案為個人使用，未開放授權。
