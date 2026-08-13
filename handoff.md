# handoff — padlet-mcp 多 Agent 交接

> 固定檔名交接檔。任何 agent（Claude Code / Codex / …）開工先讀這裡，有進度就回寫。
> 架構與長期知識寫 `CLAUDE.md`，這裡只寫「現在做到哪、下一步」。

## 📌 目前狀態

- 分支：`master` = `33ceafd`（已 fast-forward 合併 `codex/secure-key-rotation`）
- 版本：`package.json` 已是 **0.1.1**，但 **npm 上仍是 0.1.0** → 尚未發布
- 未推送：master 領先 origin/master 1 個 commit（就是那次合併）＋ `.gitignore`、`CLAUDE.md`、`handoff.md` 尚未提交
- 測試：`npm test` 8/8 通過（Node v24.14.0）；假金鑰啟動煙霧測試通過

## ⏯️ 上次做到哪

**2026-08-13（Claude Code）**

1. **處理金鑰暴露**：`get_me_boards.js` 內有明文 Padlet API key（一次性 `/me` 探測腳本）。已 grep 全 commit 歷史確認**公開 repo 未洩漏**，金鑰只存在該未追蹤的本機檔案。使用者已在 Padlet 後台重新 Generate 金鑰，該檔案已刪除。
2. **`.gitignore` 補強**：加入 `get_me_boards.js`、`scratch_*.js`、`padlet-assets/`。`padlet-assets/` 是巢狀的獨立 repo（40 張圖約 40MB），先前完全沒被忽略，一次 `git add .` 就會被推進公開 repo。
3. **合併 Codex 的 `codex/secure-key-rotation`**（`33ceafd`，2026-06-14）：先讀測試檔確認 `setup.js` 頂層無寫檔副作用（只讀 argv）才執行，8/8 通過後 fast-forward 合併。內容：
   - 新增 `lib.js`：`resolveApiUrl()` 官方網域白名單（防金鑰被送去非 padlet.dev）、`validatePoll()`、`validateReaction()`、`validatePadletApiKey()`
   - `setup.js` 新增 `--update` 支援金鑰輪替（Codex TOML 用 `replaceCodexPadletBlock()` 只替換 env 區段）；`--key` 改為保留相容但會警告
   - 新增 `test/`、CI（Node 18/20/22 ＋ `npm audit`）、`LICENSE`
   - 版本 0.1.1、`files` 補 `lib.js`、加 `scripts.test`
4. **新增 `CLAUDE.md` 與本檔**（先前兩者都不存在，導致這次要靠 git 反推 Codex 的進度）。

**2026-06-11（Claude Code）**：專案誕生 → 七工具完成 → 真 API 全流程實測 → npm 發布 0.1.0 → GitHub 轉公開 → 五 agent 一鍵安裝實裝。詳見 Obsidian `專案/padlet-mcp/專案工作流程.md`。

## ➡️ 下一步

1. **提交並推送**目前的合併與三個文件變更（`.gitignore` / `CLAUDE.md` / `handoff.md`）
2. **⚠️ 用真金鑰回歸測試 `create_board`**：新的 `resolveApiUrl()` 白名單要求 statusUrl 的 origin 是 `api.padlet.dev` 且 path 以 `/v1/` 開頭。**Padlet 真實回傳的 statusUrl 格式尚未在合併後驗證過**——若不符白名單，`create_board` 的輪詢會直接拋錯。這是本次合併唯一沒被測試涵蓋的行為風險，發布前務必實測一次。
3. **`npm publish` 0.1.1**：需使用者自己在終端機跑（npm 強制 2FA，Windows Hello security key；agent 端網址會被遮罩）
4. 用 `npx -y padlet-mcp setup --update` 把輪替後的新金鑰同步進五個 agent 的設定
5. 舊待辦（來自 6/11）：測試牆開啟留言＋reactions 排練演示 C、`.mcpb` 打包給 Claude Desktop、提交官方 MCP Registry、拍片三演示
6. Obsidian 筆記需更新：「三處位置」的本機路徑已改為 `C:\2026Padlet_agent\`，並補 6/14 之後的紀錄

## 🚧 注意事項

- **金鑰**：不要寫死在任何 `.js`；臨時腳本放 scratchpad 不放專案根目錄
- **`padlet-assets/` 是獨立 repo**，要推圖床請 `cd padlet-assets` 再操作，別在父 repo 下 `git add`
- 動共用檔案（`index.js` / `setup.js` / `lib.js`）前先 `git fetch`，看有沒有其他 agent 的新分支
- `test/` 不在 npm `files` 白名單內，不會發布，這是刻意的

---

*最後更新：2026-08-13 ・ 更新者：Claude Code（Opus 5）*
