# TimeClock 打卡記錄工具 v1.3.1

## 概述

TimeClock 是一個輕量級時間記錄工具，用於記錄通勤、工作、購物、事件等活動。資料先存於本機，登入後自動同步至雲端。

## 設計理念

- **本地優先**：所有資料先寫入 localStorage，離線仍可正常使用
- **單一檔案**：整個應用僅兩個檔案（HTML + JS），部署零配置
- **最小依賴**：僅使用 Firebase compat SDK，無框架無構建流程
- **計時持久化**：頁面關閉後重新打開，進行中的計時器自動恢復
- **小檔案哲學**：app.js 約 820 行，index.html 153 行，避免過度工程

## 功能清單

| 功能 | 說明 |
|------|------|
| 四種記錄類型 | 通勤（藍）、工作（綠）、購物（紫）、事件（橘） |
| 計時功能 | 開始/停止計時，即時顯示時長，結果自動記錄至備註 |
| 離線支援 | 無需登入即可使用，資料自動保存於本機 |
| Firebase 同步 | 登入後多裝置同步，id-based merge 優先本地數據 |
| 大批量保存 | >100 筆自動分批（每批 100 筆），避免超時 |
| 刪除優化 | 僅刪除單筆記錄，不觸發全量寫入 |
| Google 日曆匯出 | 各日期獨立匯出為 ICS 格式，支持單日記錄加入日曆 |
| TXT 匯出 | 各日期獨立匯出為純文字檔（按日期分組） |
| 計時器持久化 | 跨頁面關閉恢復，秒級更新 |

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

每個日期群組右側提供 **TXT** 與 **iCal** 按鈕，可獨立匯出該日期的記錄：
- **TXT**：匯出該日期所有記錄為純文字檔
- **iCal**：匯出該日期記錄為 Google 日曆事件（ICS 格式）

> 以前版本從「⋯ 更多」選單操作，現已下放至各日期群組。

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

### v1.3.1 (2026-08-22)
- **計時器修復**：修正 `.timer-display` 修改後，因 JS 選取器大小寫與類別名稱不一致導致無法計時的問題。
- **重構重啟邏輯**：簡化 `rehydrateTimers` 邏輯，改為由 timers 狀態變更後直接調用 `render()` 自動同步 UI，防止破壞 Tailwind 樣式。

### v1.3.0 (2026-08-22)
- **統一按鈕控制列**：計時、停止計時、刪除按鈕整合為單一 `.entry-controls` 行。
- **按鈕與計時樣式**：新增綠色計時按鈕（btn-start）、紅色脈衝停止按鈕（btn-stop）、暗紅刪除按鈕（btn-delete），與黃色邊框之計時顯示徽章（.timer-display）。

### v1.2.0 (2026-08-16)
- **Firebase 同步與優化**：恢復 Firebase compat SDK，修復首次同步數據丟失與刪除同步問題。
- **離線狀態持久化**：修復離線模式刷新後數據消失問題。
- **按鈕觸發優化**：檢查按鈕元素存在後才綁定事件，防止重複綁定與按鈕失效。

### v1.1.0 (2026-08-14)
- 新增各日期匯出功能：每筆日期右側增加 TXT 與 iCal 按鈕，可獨立匯出單日記錄
- 移除「更多」選單中的匯出選項，改下放至記錄區各日期群組
- 更新匯出說明文件

## 編碼與部署前檢查

部署前務必執行以下檢查，確保程式碼品質與正確的文字編碼（防止中文亂碼）：

### 1. 語法檢查
```bash
node --check app.js
```

### 2. 編碼檢查（防止 UTF-8 BOM 與 PUA 私有區字元）
```bash
python3 -c "
import re
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()
# 檢查 BOM
with open('app.js', 'rb') as f:
    bom = f.read(3)
    assert bom != b'\xef\xbb\xbf', '有 BOM'
# 檢查私有使用區字元 (PUA)
pua = re.findall(r'[\ue000-\uf8ff]', js)
assert len(pua) == 0, f'有 {len(pua)} 個 PUA 字元'
print('✓ app.js 編碼與 PUA 檢查通過')
"
```

### 3. 元素引用檢查
```bash
# 確保所有 getElementById 的元素引用正確
grep -n "getElementById" app.js | grep -v "null\|undefined"
```

## 部署

### 手動部署
```bash
# 複製檔案至 GitHub Pages 倉庫
copy "C:\Users\chiwe\Downloads\TimeClock\app.js" "C:\Users\chiwe\Documents\GitHub\Website\TimeClock\app.js"
copy "C:\Users\chiwe\Downloads\TimeClock\index.html" "C:\Users\chiwe\Documents\GitHub\Website\TimeClock\index.html"
copy "C:\Users\chiwe\Downloads\TimeClock\output.css" "C:\Users\chiwe\Documents\GitHub\Website\TimeClock\output.css"
copy "C:\Users\chiwe\Downloads\TimeClock\README.md" "C:\Users\chiwe\Documents\GitHub\Website\TimeClock\README.md"
```

### 編譯 CSS
```bash
cd C:\Users\chiwe\Downloads\TimeClock
npm run build:css
```

## 授權

本專案為個人使用，未開放授權。
