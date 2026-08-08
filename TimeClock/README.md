## 🚀 快速開始

**⚠️ 重要：本專案使用 Tailwind 本地編譯，部署前請先執行 `npm ci` 與 `npm run build`。**

### 本機開發
- `npm ci`
- `npm run build`
- 透過 `python -m http.server 8000` 或任何靜態伺服器開啟
- `file://` 模式仍然不支援 Firebase SDK，請使用 `http://localhost:8000` 或正式網址

### 部署到 GitHub + Cloudflare Pages
1. 先在 GitHub 建立 Repository，將此專案推上去。
2. 進入 Cloudflare Pages，點選「Create project」→「Connect to Git」。
3. 選擇你的 GitHub Repository。
4. 建置設定：
   - Build command: `npm run build`
   - Build output directory: `.`
   - Root directory: 留空
5. 點選「Deploy」。

Cloudflare Pages 會在每次推送到 GitHub 的指定分支時自動重新部署。

## 🔧 主要檔案

- `index.html`：主頁面
- `app.js`：Firebase 登入、同步與 UI 邏輯
- `output.css`：Tailwind 編譯後的樣式
- `database.rules.json`：Firebase Realtime Database 規則
- `database.rules.examples.txt`：多帳號隔離範例

## 🔒 登入與資料權限

- 使用 Firebase Auth 的 Email/Password 登入。
- 資料路徑使用 `/users/<uid>/times`，避免不同帳號共用同一份資料。
- 真正的權限限制請在 Firebase Realtime Database Rules 中設定，前端只負責 UI 與使用者體驗。

## 📝 部署注意事項

- Cloudflare Pages 是靜態網站，這個專案不需要額外後端服務。
- 若要讓 Firebase 正常運作，請確認 Firebase Console 中已開啟 Email/Password provider。
- 若你使用不同的 Firebase 專案，請先更新 `app.js` 裡的 Firebase 設定。

## 📄 更新說明

- 2026-08-08：補上 GitHub / Cloudflare Pages 部署教學，並讓 `npm run build` 可直接使用
- 2026-08-07：完成按鍵設計與登入系統整合
- 2026-08-06：修復空白頁根因並實作 email+密碼登入
- 2026-08-05：初始版本（v2.2.4）