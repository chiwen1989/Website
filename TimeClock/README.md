## 🚀 快速開始

**⚠️ 重要：不要直接雙擊 `index.html`（file:// 模式）**。Firebase SDK 需要 http/https 環境，`file://` 下會拋 `postMessage` origin 錯誤、雲端同步與登入無法運作。

✅ **正確用法：直接雙擊 `index.html`**
- 直接開啟瀏覽器（無需啟動伺服器）
- 本機儲存（localStorage）離線照常運作；登入/雲端同步需此模式

## 🔧 按鍵設計

- **四顆主按鈕**（重新整理、通勤、工作、購物）保持原有寬度、字型，僅改顏色與 hover 效果
- **三顆打卡按鈕**：漸變色區分（通勤藍、工作綠、購物紫）
- **下拉選單**：
  - 登入同步/登出/清除全部均為黃色文字（#ffd700）
  - 登出按鈕移至清除全部下方
  - 匯出功能保持紅色文字（#f77）

## 🔒 登入系統

- **本機優先**：資料先存 localStorage，登入且有網路時才同步 Firebase
- **允許帳號**：僅 `chiwen1989@gmail.com` 可登入
- **Firebase 專案**：chiwen1989-1（已啟用 Email/Password provider）

## 📝 版本記錄

- v2.4（2026-08-07）：
  - 修復空白頁根因（iframe.js:311 錯誤）
  - 實作 email+密碼登入（移除 Google OAuth）
  - 更新按鍵設計與下拉選單排序
  - 完成端到端登入驗證

## 🛠️ 技術細節

- **按鍵顏色**：
  - 通勤：#1f6feb（漸變）
  - 工作：#2ea043（漸變）
  - 購物：#8957e5（漸變）
  - 重新整理：#ffb74d（實色）
- **下拉選單文字**：黃色（#ffd700）
- **清除全部**：紅色（#f77）
- **暗色主題**：背景 #0a1020，卡片漸變 #182840→#101e30

## 📌 已知限制

- **`file://` 不可用**：Firebase Auth SDK 初始化會開隱形 iframe，`file://` origin 為 `null`，直接拋 `Failed to execute 'postMessage'... target origin provided ('file://') does not match... ('null...`
- **Firebase Console 需啟用 Email/Password 登入 provider**，否則登入會報 `auth/operation-not-allowed`（程式已處理此錯誤訊息）

## 📄 更新說明

- 2026-08-07：完成按鍵設計與登入系統整合
- 2026-08-06：修復空白頁根因並實作 email+密碼登入
- 2026-08-05：初始版本（v2.2.4）