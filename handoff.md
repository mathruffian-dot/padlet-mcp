# handoff — padlet-mcp 多 Agent 交接

> 固定檔名交接檔。任何 agent（Claude Code / Codex / …）開工先讀這裡，有進度就回寫。
> 架構與長期知識寫 `CLAUDE.md`，規劃藍圖寫 `教學應用規劃.md`，這裡只寫「現在做到哪、下一步」。

## 📌 目前狀態

- 分支：`master`，版本 **0.2.0**
- npm 上仍是 **0.1.0** → 0.2.0 尚未發布
- 測試：`npm test` **9/9 通過**（Node v24.14.0）；MCP `tools/list` 實測 7 個工具、新參數 JSON Schema 正確
- 進行中的大任務：**padlet-mcp 教學應用**（示範牆 ＋ 四項技能），規劃見 `教學應用規劃.md`

## ⏯️ 上次做到哪

### 2026-08-13（Claude Code）

**A. 金鑰暴露處理**

`get_me_boards.js` 內有明文 Padlet API key。已 grep 全 commit 歷史確認**公開 repo 未洩漏**，金鑰只在該未追蹤檔案。使用者已重新 Generate 金鑰，檔案已刪除。`.gitignore` 補上 `get_me_boards.js`、`scratch_*.js`、`padlet-assets/`（後者是巢狀獨立 repo，約 40MB，先前完全沒被忽略）。

**B. 合併 Codex 的 `codex/secure-key-rotation`**（`33ceafd`）

`lib.js`（網域白名單＋各種驗證）、`setup --update` 金鑰輪替、`test/`、CI、`LICENSE`。合併前先讀測試檔確認 `setup.js` 頂層無寫檔副作用才執行。

**C. 🔴 修掉 Codex 引入的 `create_board` 迴歸**

Codex 的 `resolveApiUrl()` 只放行 `api.padlet.dev` + `/v1/`，但官方文件明載 AI Recipe 的 statusUrl 在 `https://padlet.dev/api/public/v1/ai-recipe-boards/status/...`——**兩個條件都不符，`create_board` 第一次輪詢就會被自己的白名單擋掉**。Codex 的測試綠燈是因為它斷言的是自己想像的網址。

已改為雙 origin 允許清單，並補迴歸測試（含 `padlet.dev.evil.com` 子網域仿冒、明文 http、`padlet.dev/dashboard/settings` 的拒絕案例）。

**D. `create_post` 補上五個官方支援欄位（v0.2.0）**

`custom_fields`、`after_post_id`（manualSortPosition）、`status`、`canvas_props`、`map_props`。
同時 `get_board` 補讀回：卡片的 `attachment` / `status` / `sortIndex` / `customFields`，牆的 `settings` / `customFields`——寫得進去讀不回來等於半個功能，且 `settings` 是自動偵測「留言／reactions 是否開啟」的關鍵。`subject`/`body` 加上 500/10000 字驗證。

**E. 官方文件查證三項結論**（細節見 `教學應用規劃.md` 第零節）

1. **本機檔案完全不能上傳**——不只圖片，PPT/PDF/Word/影片皆然。`add-post` 原句 "Currently only supports url links and poll attachments."
2. **`get_attachment` 拿不到原始檔**——只有 `previewImageUrl` / `embedCode` / `poll`。照片可用預覽圖做視覺批改，但影片／PDF／Word 沒有文件保證的取得路徑，**這會限制「學生繳交分析」技能的範圍**
3. **Cloudflare 可以取代 GitHub 圖床**：Pages 免費給 `*.pages.dev`、不需自有網域、單檔 25MiB；R2 出流量永久免費但公開網址 `r2.dev` 官方限速僅供開發，正式用需綁自有網域

**F. 新增 `CLAUDE.md`、`handoff.md`、`教學應用規劃.md`**（先前完全沒有協作文件）

### 2026-06-11（Claude Code）

專案誕生 → 七工具 → 真 API 全流程實測 → npm 發布 0.1.0 → GitHub 轉公開 → 五 agent 一鍵安裝。詳見 Obsidian `專案/padlet-mcp/專案工作流程.md`。

## ➡️ 下一步

### 🔔 使用者收工時要提醒的兩件事

1. **`npm publish`**（現在是 0.2.0）——需使用者本人在自己的終端機跑，npm 強制 2FA（Windows Hello security key），agent 端網址會被遮罩
2. **`npx -y padlet-mcp setup --update`**——把輪替後的新金鑰同步進五個 agent 的設定

### 技術任務

3. **Phase 0 實測探底**（`教學應用規劃.md` 第二節，0-2 ~ 0-7）。最重要的兩項：
   - **0-2**：真金鑰實跑 `create_board`，確認真實 statusUrl 與文件一致（驗證 C 的修法）
   - **0-5**：用真實學生上傳的照片／影片／PDF／Word，實測 `attachment.url` 與 `previewImageUrl` 到底回什麼——**這決定「學生繳交分析」技能能做到哪**
4. Phase 1~5：示範牆 → Skill 1 範本建牆 → Skill 2 教材上牆 → Skill 3 自動回覆 → Skill 4 繳交分析
5. 舊待辦（6/11）：測試牆開啟留言＋reactions 排練演示 C、`.mcpb` 打包、提交官方 MCP Registry、拍片三演示
6. Obsidian 筆記待更新：本機路徑已改為 `C:\2026Padlet_agent\`，並補 6/14 之後的紀錄

### 等使用者決定

- 有沒有網域掛在 Cloudflare？（決定 R2 能否用於正式教材）
- Skill 4 學生頁的隱私處理：代號化／加密碼／只做教師端
- 0-4 的測試牆要不要先幫他開好

## 🚧 注意事項

- **金鑰**：不寫死在任何 `.js`；臨時腳本放 scratchpad，不放專案根目錄
- **`padlet-assets/` 是獨立 repo**，要推圖床請 `cd padlet-assets` 再操作。新教材已決定改走 Cloudflare，此 repo 保留但不再新增
- **Codex 的測試曾出現「斷言錯誤但綠燈」**——看到測試通過不等於行為正確，涉及外部 API 的斷言要回頭對官方文件
- 動共用檔案（`index.js` / `setup.js` / `lib.js`）前先 `git fetch` 看有沒有其他 agent 的新分支
- `test/` 不在 npm `files` 白名單內，不會發布，這是刻意的

---

*最後更新：2026-08-13 ・ 更新者：Claude Code（Opus 5）*
