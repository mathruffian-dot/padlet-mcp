# padlet-mcp

讓 AI Agent（Claude Code / Claude Desktop / Cursor…）直接操作 Padlet 的 MCP Server。

對你的 AI 說一句話，它就能：

| 工具 | 能做什麼 |
|------|----------|
| `create_board` | **一句話生成全新 Padlet**（AI Recipe，可指定 sections 與初始內容） |
| `get_board` | 讀整面牆：標題、區段、所有卡片、所有留言 |
| `create_post` | 貼卡片（區段「名稱」定位、顏色、URL 附件＋說明、**poll 投票**） |
| `create_comment` | 在卡片下留言（個別化回饋） |
| `add_reaction` | 加愛心 / 星等 / 評分 / 投票 |
| `get_attachment` | 讀卡片附件：學生上傳的照片/檔案網址、**poll 即時票數** |
| `whoami` | 驗證 API key、查目前帳號 |

## 事前準備：取得 Padlet API Key

1. 開啟 [padlet.com/dashboard/settings](https://padlet.com/dashboard/settings)
2. 左側選 **Developer（開發者）**
3. 點 API key 旁的 **Generate**，複製金鑰

> ⚠️ 需要 Padlet 付費訂閱才能產生 API key。
> ⚠️ API 只能操作你是 **admin / owner** 的版子。

## 安裝

### 🚀 一鍵安裝（推薦）：自動偵測你的所有 AI Agent

```bash
npx -y padlet-mcp setup
```

精靈會自動偵測並寫入以下 agent 的設定（改動前自動備份）：

| Agent | 涵蓋範圍 |
|-------|----------|
| Claude Code | CLI（`~/.claude.json`） |
| Claude Desktop | 桌面版 |
| Codex | desktop + CLI（共用 `~/.codex/config.toml`） |
| OpenCode | desktop + CLI（共用 `~/.config/opencode/opencode.json`） |
| Antigravity | IDE + CLI（共用 `~/.gemini/config/mcp_config.json`） |

選用參數：

- `--update`：更新既有 Padlet MCP 設定——輪替 API Key，並把啟動指令改寫成最新形式
- `--dry-run`：只看會改什麼，不寫入
- `--local`：註冊本機路徑而非 npx，開發用

> 🔐 建議使用互動輸入或 `PADLET_API_KEY` 環境變數。`--key` 僅保留相容性，可能把金鑰留在命令歷史或程序列表。

### 手動安裝（單一 agent）

**Claude Code（一行指令）**

```bash
claude mcp add padlet -e PADLET_API_KEY=你的金鑰 -- npx -y padlet-mcp@latest
```

**Claude Desktop / Cursor / 其他 MCP client**：設定檔加入標準 stdio 片段：

```json
{
  "mcpServers": {
    "padlet": {
      "command": "npx",
      "args": ["-y", "padlet-mcp@latest"],
      "env": { "PADLET_API_KEY": "你的金鑰" }
    }
  }
}
```

> 💡 需要 Node.js 18 以上。
>
> ⚠️ **一定要寫 `padlet-mcp@latest`，不要只寫 `padlet-mcp`。** npx 對沒指定版本的套件會沿用快取裡已有的版本，不保證回 registry 查新版——只寫 `padlet-mcp` 的話，你可能永遠停在第一次裝的那一版。釘 `@latest` 才會真的自動更新（`setup` 精靈寫入的就是這個形式）。

## 安裝後第一句話

> 「用 padlet 的 whoami 確認連線」

看到你的帳號名稱就代表成功了。

若重新產生 API Key：

```bash
npx -y padlet-mcp setup --update
```

更新後需重新啟動 Agent，讓 MCP 程序載入新環境變數。

## 怎麼更新到新版

看你當初是怎麼裝的：

| 你的設定長怎樣 | 怎麼更新 |
|----------------|----------|
| `npx -y padlet-mcp@latest` | ✅ 什麼都不用做，重啟 agent 就是最新版 |
| `npx -y padlet-mcp`（沒有 `@latest`） | ⚠️ 可能卡在舊版 → 跑 `npx -y padlet-mcp@latest setup --update` 改寫設定 |
| `node /某個路徑/index.js`（`--local` 裝的） | 它跑的是你本機那份原始碼，`git pull` 後重啟 agent 即可；想改成跟著 npm 版本走則跑 `setup --update` |

確認目前實際跑到哪一版：

```bash
npx -y padlet-mcp@latest setup --dry-run
```

## 三個示範玩法（教學場景）

以下玩法**只需要 Padlet API key**，不需要 OpenAI key 等其他金鑰：

**1. 一句話生成整面討論牆**
> 「幫我開一面『一元一次方程式』課前討論牆，分四個 section：迷思澄清、生活應用、挑戰題、自由提問，每區放 3 個引導問題。」

**2. AI 即時總結全班留言**
> 「讀這面牆 <貼上網址>，把學生答案分成正確／部分正確／常見迷思三類，統計比例，把總結貼回牆上。」

**3. AI 助教即時個別回饋**
> 「每 60 秒檢查這面牆，答對的卡片加 ❤️，有迷思的在底下留一句蘇格拉底式提問，不要直接給答案。」

🔧 **選配玩法**（需額外能力，詳見[使用說明](使用說明.md)）：AI 生圖貼牆（需 OpenAI API key＋GitHub 圖床）、照片作業批改（需 Agent 有視覺辨識）、`/loop` 自動輪詢（Claude Code 限定）。

## API 限制（Padlet 官方 API 的邊界）

- ❌ 不能刪除、編輯既有卡片
- ❌ 不能在既有版子新增 section（開新版子時可以用指令描述讓 AI 生成）
- ❌ 不能刪除版子、改版子設定
- ⚠️ **AI 生成的新版子預設「關閉」留言與 reactions**——要用 `create_comment` / `add_reaction` 前，先到版子設定手動開啟（設定 → 互動）
- 這些操作請回 Padlet 介面手動處理

## License

[MIT](LICENSE)
