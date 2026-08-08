## 🚀 TimeClock 專案說明

這個專案是以靜態網站方式部署的打卡記錄工具，前端使用 Firebase 做登入與資料同步。

### 目前目錄結構

- `index.html`：主畫面與 UI 結構
- `app.js`：登入、權限檢查、資料同步與記錄邏輯
- `styles.css`：基礎樣式
- `output.css`：Tailwind 編譯後的正式樣式檔
- `src/input.css`：Tailwind 原始來源檔
- `package.json` / `package-lock.json`：建置與相依套件
- `database.rules.json`：Firebase Realtime Database 權限規則
- `database.rules.examples.txt`：多帳號隔離範例

### 本機開發

- `npm ci`
- `npm run build`
- 使用 `python -m http.server 8000` 或其他靜態伺服器開啟
- `file://` 不支援 Firebase SDK，請改用 `http://localhost:8000` 或正式網址

### 部署到 Cloudflare Pages

1. 將此 repo 推到 GitHub
2. 在 Cloudflare Pages 建立專案並連接 GitHub repo
3. Build command 填：`npm run build`
4. Build output directory 填：`.`
5. 部署完成後即可使用你的網域或 Cloudflare 提供的網址

### 注意事項

- 這個專案不需要後端服務，Cloudflare Pages 只負責部署靜態檔案
- Firebase 的真正權限限制請由 `database.rules.json` 控制
- 若你使用不同 Firebase 專案，請更新 `app.js` 裡的 Firebase 設定

### 更新說明

- 2026-08-08：整理專案目錄，移除備份與多餘檔案，更新部署說明
- 2026-08-08：修正 Firebase 使用者 email 檢查，避免空值導致錯誤
- 2026-08-07：完成按鍵設計與登入系統整合
- 2026-08-06：修復空白頁根因並實作 email+密碼登入
