# EP20 不死者 - 任務攻略

## 專案說明

1. **結構**：
   - `index.html`：單頁式 HTML（707 行）
   - `script.js`：主 JS（110 行）
   - `src/input.css`：Tailwind 組件（45 行）
   - `tailwind.config.js`：Tailwind 設定（8 行）
   - `package.json`：npm 指令（12 行）

2. **風格**：
   - 馬卡龍化（薰衣草紫+薄荷綠+淡藍+奶油黃）
   - 背景：遊戲場景圖（無 gradient）
   - 卡片：白色圓角
   - 按鈕：薰衣草紫圓形
   - completed：灰色背景+刪除線
   - checkbox：薰衣草紫邊框+背景

3. **功能**：
   - 任務進度追蹤（localStorage 持久化）
   - 材料需求表格（折疊/展開）
   - 導航指令複製（點擊按鈕複製 /navi 指令）
   - 進度重置（確認對話框）
   - 回頂部按鈕（滾動顯示）

4. **部署**：
   - 靜態網頁（無後端）
   - 依賴：Tailwind CSS（本地編譯）
   - 圖片：`images/` 目錄（需與 HTML 同目錄）

5. **注意事項**：
   - 背景圖 `bg.png` 必須放在 `images/` 目錄
   - 所有 CSS 由 Tailwind 編譯（`dist/output.css`）
   - JS 零改動（僅鉤子 class）
   - 進度存 localStorage（`ro_modern_ep20_progress`）

## 部署步驟：

1. 安裝 Node.js
2. 執行 `npm install`
3. 執行 `npm run build`（編譯 CSS）
4. 上傳所有檔案（含 `images/` 目錄）
5. 確保 `bg.png` 在 `images/` 目錄

## 錯誤檢查：
- 檢查 `images/` 目錄是否存在
- 驗證 `dist/output.css` 是否生成
- 測試 localStorage 是否可用
- 確認所有圖片路徑正確（相對於 HTML）