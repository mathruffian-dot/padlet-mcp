# padlet-mcp

讓 AI Agent（Claude Code / Claude Desktop / Cursor…）直接操作 Padlet 的 MCP Server。

對你的 AI 說一句話，它就能：

| 工具 | 能做什麼 |
|------|----------|
| `create_board` | **一句話生成全新 Padlet**（AI Recipe，可指定 sections 與初始內容） |
| `get_board` | 讀整面牆：標題、區段、所有卡片、所有留言 |
| `create_post` | 貼卡片（可用區段「名稱」指定位置、設顏色、加附件） |
| `create_comment` | 在卡片下留言（個別化回饋） |
| `add_reaction` | 加愛心 / 星等 / 評分 / 投票 |
| `whoami` | 驗證 API key、查目前帳號 |

## 事前準備：取得 Padlet API Key

1. 開啟 [padlet.com/dashboard/settings](https://padlet.com/dashboard/settings)
2. 左側選 **Developer（開發者）**
3. 點 API key 旁的 **Generate**，複製金鑰

> ⚠️ 需要 Padlet 付費訂閱才能產生 API key。
> ⚠️ API 只能操作你是 **admin / owner** 的版子。

## 安裝（三選一）

### 我用 Claude Code（一行指令）

```bash
claude mcp add padlet -e PADLET_API_KEY=你的金鑰 -- npx -y padlet-mcp
```

### 我用 Claude Desktop

打開設定檔 `claude_desktop_config.json`，加入：

```json
{
  "mcpServers": {
    "padlet": {
      "command": "npx",
      "args": ["-y", "padlet-mcp"],
      "env": { "PADLET_API_KEY": "你的金鑰" }
    }
  }
}
```

### 我用 Cursor / 其他 MCP client

標準 stdio MCP 設定，同上面的 JSON 片段。

> 💡 需要 Node.js 18 以上。`npx -y` 會自動下載最新版，不用手動安裝更新。

## 安裝後第一句話

> 「用 padlet 的 whoami 確認連線」

看到你的帳號名稱就代表成功了。

## 三個示範玩法（教學場景）

**1. 一句話生成整面討論牆**
> 「幫我開一面『一元一次方程式』課前討論牆，分四個 section：迷思澄清、生活應用、挑戰題、自由提問，每區放 3 個引導問題。」

**2. AI 即時總結全班留言**
> 「讀這面牆 <貼上網址>，把學生答案分成正確／部分正確／常見迷思三類，統計比例，把總結貼回牆上。」

**3. AI 助教即時個別回饋**
> 「每 60 秒檢查這面牆，答對的卡片加 ❤️，有迷思的在底下留一句蘇格拉底式提問，不要直接給答案。」

## API 限制（Padlet 官方 API 的邊界）

- ❌ 不能刪除、編輯既有卡片
- ❌ 不能在既有版子新增 section（開新版子時可以用指令描述讓 AI 生成）
- ❌ 不能刪除版子、改版子設定
- 這些操作請回 Padlet 介面手動處理

## License

MIT
