# handoff — padlet-mcp 多 Agent 交接

> 固定檔名交接檔。任何 agent（Claude Code / Codex / …）開工先讀這裡，有進度就回寫。
> 架構與長期知識寫 `CLAUDE.md`，規劃藍圖寫 `教學應用規劃.md`，這裡只寫「現在做到哪、下一步」。

## 📌 目前狀態

- 分支：`master`，版本 **0.2.0**
- npm 上仍是 **0.1.0** → 0.2.0 尚未發布
- 測試：`npm test` **9/9 通過**（Node v24.14.0）；MCP `tools/list` 與 `tools/call` 皆實測通過
- 進行中的大任務：**padlet-mcp 教學應用**（示範牆 ＋ 四項技能），規劃見 `教學應用規劃.md`
- **Phase 0 測試牆已建立**：<https://padlet.com/mathruffian/padlet-mcp-phase-0-hh8ifa3bdccexve2>（ID `hh8ifa3bdccexve2`）
  下一步等使用者用**學生身分**把 `phase0-samples/` 的四個檔案貼上去，才能跑 0-5

### 🔑 sortIndex 的方向：section 遞增、post 遞減（實測）

這兩個方向相反，踩過一次坑：

- **section**：sortIndex 遞增＝版面第 1~10 區（對照牆面實際渲染確認）
- **post**：sortIndex **遞減**＝版面由上到下。證據是把新卡片指定 `after_post_id = p01`，
  其 sortIndex 為 -11635401889，正好夾在 p01（-11634236416）與 p02（-11636567362）之間
  且**小於** p01 → 「排在後面」＝ sortIndex 較小

`summarizeBoard` 已依此排序（section `asc`、post `desc`）。**`after_post_id` 實測完全正常**，
兩張錨定測試卡都精準落在指定卡片的後一位。

> 教訓：先前只憑 sortIndex 遞減就判定「after_post_id 沒生效」是錯的。
> 關鍵線索是**數量級**——錨定的卡片落在錨點 6 萬以內，未錨定的相差幾十億。

### Phase 0 已測出的結論

1. ✅ `create_board` 正常，真實 statusUrl 在 `api.padlet.dev/v1/ai-recipe-boards/status/`
2. ✅ AI Recipe 對區段**數量與順序可靠**，但會把指令裡的編號抄進標題 → 規格清單**不要編號**，並明寫「標題不得含編號」
3. 🔴 `board.settings` 只回 `{font, colorScheme}`，**無法自動偵測留言／reactions 是否開啟**——只能提醒使用者，或主動試一次 `create_comment` 看是否 `COMMENTS_NOT_ALLOWED`（但成功會留下刪不掉的測試留言）

## ⏯️ 上次做到哪

### 2026-08-13（Claude Code）

**A. 金鑰暴露處理**

`get_me_boards.js` 內有明文 Padlet API key。已 grep 全 commit 歷史確認**公開 repo 未洩漏**，金鑰只在該未追蹤檔案。使用者已重新 Generate 金鑰，檔案已刪除。`.gitignore` 補上 `get_me_boards.js`、`scratch_*.js`、`padlet-assets/`（後者是巢狀獨立 repo，約 40MB，先前完全沒被忽略）。

**B. 合併 Codex 的 `codex/secure-key-rotation`**（`33ceafd`）

`lib.js`（網域白名單＋各種驗證）、`setup --update` 金鑰輪替、`test/`、CI、`LICENSE`。合併前先讀測試檔確認 `setup.js` 頂層無寫檔副作用才執行。

**C. ⚠️ 我曾誤判「`create_board` 有迴歸」——實測證明沒有（已更正）**

我依官方文件（statusUrl 記載為 `padlet.dev/api/public/v1/...`）推論 Codex 的白名單會擋掉自家輪詢網址。**實測真實 statusUrl 是 `https://api.padlet.dev/v1/ai-recipe-boards/status/<id>`，完全符合原白名單——是文件範例過時，功能從來沒壞。**

白名單仍保留雙 origin，但定位改為**防禦性保留**（Padlet 若改用文件寫的格式不會突然壞掉）。`lib.js` 註解與測試名稱已更正。要收緊時 `padlet.dev/api/public/v1` 那組可拿掉。

**教訓：官方文件的範例網址不等於實際行為，涉及外部 API 的推論必須實測才算數。**

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

### ✅ padlet MCP 安裝狀況（2026-08-13 查清）

本機**已安裝**，但**不在 Claude Code**：

| Agent | 設定檔 | 金鑰 |
|-------|--------|------|
| Codex | `~/.codex/config.toml` | 明文寫死，已是新金鑰 |
| OpenCode | `~/.config/opencode/opencode.json` | `{env:PADLET_API_KEY}` 參照 ✅ 最安全 |
| Antigravity | `~/.gemini/config/mcp_config.json` | 明文寫死，已是新金鑰 |
| **Claude Code** | `~/.claude.json` | ❌ 未安裝（user scope／project scope／`.mcp.json` 都沒有） |

三者都指向本機路徑 `C:\2026Padlet_agent\index.js`。`PADLET_API_KEY` 已設為**使用者環境變數**（新金鑰），所以 `setup --update` 實質上已完成。

### 🔑 不需要 Claude Code 註冊 MCP 也能跑實測

`PADLET_API_KEY` 在環境變數裡 → 直接用 JSON-RPC 餵 `node index.js` 即可呼叫任何工具，**全程不需取得金鑰明文**，而且測到的是我們自己的程式碼路徑而非裸 API。範本：

```powershell
$init = @{jsonrpc="2.0";id=1;method="initialize";params=@{protocolVersion="2024-11-05";capabilities=@{};clientInfo=@{name="probe";version="1"}}} | ConvertTo-Json -Depth 6 -Compress -EscapeHandling EscapeNonAscii
$note = '{"jsonrpc":"2.0","method":"notifications/initialized"}'
$call = @{jsonrpc="2.0";id=2;method="tools/call";params=@{name="whoami";arguments=@{}}} | ConvertTo-Json -Depth 6 -Compress -EscapeHandling EscapeNonAscii
(@($init,$note,$call) | node index.js 2>$null) | Where-Object { $_ -match '"id":2' }
```

若仍要裝進 Claude Code，**不必把金鑰寫進 `~/.claude.json`**——省略 `env` 讓子行程繼承環境變數即可（比 Codex／Antigravity 的明文做法更安全）。需使用者自己跑並重啟 Claude Code。

### 🔔 使用者收工時要提醒的事

1. **`npm publish`**（現在是 0.2.0）——需使用者本人在自己的終端機跑，npm 強制 2FA（Windows Hello security key），agent 端網址會被遮罩。**這是唯一剩下的一項**。
   ⚠️ 未 publish 前：本機三個 agent 跑的是本地 `index.js`（重啟即拿到新功能），但任何用 `npx -y padlet-mcp` 的人拿到的仍是 **0.1.0**，沒有新欄位。
2. ~~`setup --update`~~ —— 已完成，金鑰皆為新金鑰，不需再做。

### 技術任務

3. **Phase 0 實測探底**（`教學應用規劃.md` 第二節，0-2 ~ 0-7）。最重要的兩項：
   - **0-2**：真金鑰實跑 `create_board`，確認真實 statusUrl 與文件一致（驗證 C 的修法）
   - **0-5**：用真實學生上傳的照片／影片／PDF／Word，實測 `attachment.url` 與 `previewImageUrl` 到底回什麼——**這決定「學生繳交分析」技能能做到哪**
4. Phase 1~5：示範牆 → Skill 1 範本建牆 → Skill 2 教材上牆 → Skill 3 自動回覆 → Skill 4 繳交分析
5. 舊待辦（6/11）：測試牆開啟留言＋reactions 排練演示 C、`.mcpb` 打包、提交官方 MCP Registry、拍片三演示
6. Obsidian 筆記待更新：本機路徑已改為 `C:\2026Padlet_agent\`，並補 6/14 之後的紀錄

### Cloudflare 實查結果（2026-08-13）

本機 wrangler 為 OAuth 已登入狀態（`mathruffian@gmail.com`，帳號 `b87e54ac…`），權杖含 `zone:read`：

- **zones：0 個** —— 這個帳號下沒有自有網域（與使用者認知不符，待確認是否在另一帳號）
- **Pages 專案：9 個**，全部 `*.pages.dev` 無自訂網域。今天 07:55 才用 antigravity 部署過 `eco-01-decision-making`
- **R2：權杖 scope 完全沒有 r2 權限** → 要用 R2 需重新 `wrangler login` 授權 ＋ 後台啟用 R2

不影響主線：教材走 Pages 不需自有網域，學生作品的 R2 簽章網址也不需要。

### 已確認的決定

- 區段規格：參考資料 / 投票互動 / 留言互動 / 教材 N 段 / 備用 1~5（總 3+N+5）
- Skill 4：**只做前端**（靜態站 + Pages），學生**代號化**（⚠️ 照片上的手寫姓名最容易漏，要一起去識別化）
- 教材來源：本機檔案或 Obsidian 筆記皆可

### Phase 0 樣本檔已備妥

`phase0-samples/`（gitignore，產生器 `tools/gen_phase0_samples.py`）：照片 PNG、影片 MP4（5 秒）、PDF（2 頁）、Word 各一，解題刻意寫錯（移項沒變號）好讓視覺批改測試有東西可抓。使用者只需在測試牆建好後用學生身分上傳，資料夾內有 `讀我.txt` 說明。

影片重新產生的指令（產生器只出首格 PNG）：

```
ffmpeg -y -loop 1 -i phase0-samples\_video_frame.png -f lavfi -i "sine=frequency=440:duration=5" -c:v libx264 -t 5 -pix_fmt yuv420p -vf "scale=1280:720,fade=t=in:st=0:d=0.6,fade=t=out:st=4.4:d=0.6" -c:a aac -shortest phase0-samples\02-學生影片-口說解釋.mp4
```

## 🚧 注意事項

- **金鑰**：不寫死在任何 `.js`；臨時腳本放 scratchpad，不放專案根目錄
- **`padlet-assets/` 是獨立 repo**，要推圖床請 `cd padlet-assets` 再操作。新教材已決定改走 Cloudflare，此 repo 保留但不再新增
- **Codex 的測試曾出現「斷言錯誤但綠燈」**——看到測試通過不等於行為正確，涉及外部 API 的斷言要回頭對官方文件
- 動共用檔案（`index.js` / `setup.js` / `lib.js`）前先 `git fetch` 看有沒有其他 agent 的新分支
- `test/` 不在 npm `files` 白名單內，不會發布，這是刻意的

---

*最後更新：2026-08-13 ・ 更新者：Claude Code（Opus 5）*
