# padlet-mcp

## 專案簡介

Padlet MCP Server：讓任何支援 MCP 的 AI Agent（Claude Code / Claude Desktop / Cursor / Codex / OpenCode / Antigravity）直接操作 Padlet——一句話生成新版子、讀整面牆、貼卡片、出投票、留言、加 reaction、讀附件與即時票數。

三個目標：①好裝好用（`npx` 零安裝）②發布給別人一鍵安裝（npm + setup 精靈）③拍教學影片震撼演示。

## 語言與風格

- 所有回應、文件、程式碼註解皆使用**繁體中文**
- 修改前先確認計畫，優先保留原有資料結構

## 三處位置

| 位置 | 路徑 | 角色 |
|------|------|------|
| 本機開發 | `C:\2026Padlet_agent\`（本目錄） | 主要工作目錄。**刻意不放 GDrive**——實測 node_modules 會被同步成 0-byte 損壞檔 |
| GitHub | [mathruffian-dot/padlet-mcp](https://github.com/mathruffian-dot/padlet-mcp)（公開） | 真理來源 |
| npm | [`padlet-mcp`](https://www.npmjs.com/package/padlet-mcp) | 對外發布通路，觀眾的安裝指令是 `npx -y padlet-mcp setup` |
| Obsidian | `專案/padlet-mcp/專案工作流程.md` | 歷程與踩坑紀錄 |
| 圖床 | `padlet-assets/`（巢狀的獨立 repo → [mathruffian-dot/padlet-assets](https://github.com/mathruffian-dot/padlet-assets)） | draw skill 生成的圖放這，用 raw 網址附到 Padlet 卡片 |

> ⚠️ 舊筆記寫的 `C:\Users\mathr\dev\padlet-mcp\` 是另一台電腦的路徑，本機不存在。

## 檔案結構

| 檔案 | 作用 |
|------|------|
| `index.js` | MCP server 本體（stdio），七個工具的註冊與實作 |
| `lib.js` | 純函式層：API 網址白名單、poll／reaction／API key 驗證（**有測試覆蓋**） |
| `setup.js` | 一鍵安裝精靈，偵測五種 agent 並寫入對應格式（JSON／TOML），支援 `--update` 輪替金鑰 |
| `test/` | `node --test` 測試，**不列入 npm `files`**，不會發布 |
| `.github/workflows/test.yml` | CI：Node 18／20／22 跑 `npm test` ＋ `npm audit --omit=dev` |
| `README.md` | 對外門面（英中混排，安裝為主） |
| `使用說明.md` | 完整繁中手冊：七工具用法、四個教學食譜、錯誤對照表、FAQ |

## 七個工具

`whoami`（驗金鑰）、`create_board`（AI Recipe 生成，非同步輪詢 30~90 秒）、`get_board`（讀牆，回精簡摘要省 token）、`create_post`（卡片＋URL 附件＋poll 投票，可用 section 名稱定位）、`create_comment`、`add_reaction`（like／star／grade／vote）、`get_attachment`（附件原始網址＋poll 即時票數）。

## ⚠️ 已知坑與限制

**Padlet API 做不到**：刪除／編輯既有 post、在既有版子新增 section、刪版子、改版子設定、上傳本機檔案（要先有公開網址）、操作別人的版子。

**運作陷阱**：

- **AI 生成的版子預設關閉留言與 reactions**——演示 `create_comment` / `add_reaction` 前必須先去版子設定手動開啟
- board ID 可短至 15 字元（原本以為 16-22）
- `get_attachment` 對個別附件可能回 500（如維基 SVG 縮圖），屬 Padlet 端個案，跳過即可
- API key 需 Padlet **付費訂閱**才能產生
- node_modules 不能放 GDrive；GDrive 內跑 npm 要加 `--no-progress` 否則 EBADF

**金鑰安全（2026-08-13 事故後的規則）**：

- API key 絕不寫死在任何 `.js` 檔。臨時探測腳本一律寫到 scratchpad 目錄，不要放專案根目錄
- `.gitignore` 已擋 `.env`、`*.key`、`get_me_boards.js`、`scratch_*.js`、`padlet-assets/`
- 金鑰輪替後用 `npx -y padlet-mcp setup --update` 同步更新所有 agent 的設定
- 不要用 `setup --key <金鑰>`（會留在命令歷史與程序列表），改用互動輸入或環境變數

## 測試

```bash
npm test
```

`lib.js` 的純函式有 8 個測試。`index.js` 的 MCP 註冊與真實 API 呼叫**沒有自動化測試**，改動後請用假金鑰做啟動煙霧測試，真實 API 行為要手動驗。

## 多 Agent 協作

本專案 Claude Code 與 Codex 都在動（Codex 開過 `codex/secure-key-rotation` 分支）。進度交接一律寫 `handoff.md`，架構與長期知識寫本檔，兩者不重疊。**動共用檔案前先 `git fetch` 看有沒有別人的分支。**

## 參考版子

測試牆：<https://padlet.com/mathruffian/padlet-68xaov1qztruroz3>（有真實投票數據）
