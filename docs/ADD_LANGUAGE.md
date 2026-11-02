# 新增一種語言（v2.55.1 之後的流程）

1. **經文**：產生 `bible.<xx>.{law,hist,poet,proph,nt}.json`（KJV 節號，骨架對照 `bible.en.*`），格式 `['p', 節, 文字, 節, 文字…]`。
2. **語言包** `lang-<xx>.js`：匯出 `window.<XX>_PACK`，包含 `I18N.<xx>`、`PIC/HYM/TWEAK/TEAM`、`CR/QBANK/QAUD/AUD2/FU`、`Q20/Q20SK`、`dict/pair/rules/t`、`books`（每卷剛好兩個欄位：全名、縮寫）、`groups`（9 組）。結構以 `lang-ar.js` 為範本。
3. **接線**（仍需手動的地方，之後可再收斂）：
   - `index.html`：語言選單按鈕、載入器的清單 `var P='…'`、（需要時）字體 CSS。
   - `app.js`：`PACK_LANGS` 清單、`isXX()` 判斷與各處的語言分支（書名欄位、朗讀語言與語音、宗教清單、AI 回答語言指示、關於頁授權聲明）。
   - `sw.js`：不用加（語言包用到才快取）。
   - `plans.json`：計畫標題與副標。
4. **版本號**：`app.js`、`index.html`（`var V=`）、`sw.js`（兩處）、`version.json`、`README.md`。
5. **檢查**：`node scripts/check.js`（新語言第一次請加 `--update-baseline`）與 `node scripts/smoke.js`。
