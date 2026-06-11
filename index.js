#!/usr/bin/env node
/**
 * padlet-mcp — Padlet MCP Server
 * 讓任何支援 MCP 的 AI Agent（Claude Code、Claude Desktop、Cursor…）操作 Padlet。
 *
 * 環境變數：PADLET_API_KEY（必填）
 * 取得方式：Padlet Dashboard → Settings → Developer → API key → Generate
 * （需要 Padlet 付費訂閱）
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.PADLET_API_KEY;
const BASE = "https://api.padlet.dev/v1";

// ── 首次使用精靈：沒有 API key 時給出繁中教學而不是直接報錯 ──
if (!API_KEY) {
  console.error(`
╔══════════════════════════════════════════════════════╗
║  padlet-mcp：找不到 PADLET_API_KEY                    ║
╠══════════════════════════════════════════════════════╣
║  取得 API key 三步驟：                                ║
║  1. 開啟 https://padlet.com/dashboard/settings        ║
║  2. 左側選「Developer（開發者）」                      ║
║  3. 點 API key 旁的「Generate」並複製                  ║
║                                                      ║
║  ⚠️ 需要 Padlet 付費訂閱才能產生 API key               ║
║                                                      ║
║  然後在 MCP 設定的 env 加入：                          ║
║    "PADLET_API_KEY": "你的金鑰"                        ║
╚══════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const HEADERS = {
  "X-API-KEY": API_KEY,
  "Content-Type": "application/vnd.api+json",
  Accept: "application/vnd.api+json",
};

/** 統一的 API 呼叫：自動處理錯誤訊息，讓 AI 拿到可讀的失敗原因 */
async function api(path, options = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, { headers: HEADERS, ...options });
  const text = await res.text();
  if (!res.ok) {
    const hints = {
      401: "API key 無效或過期，請重新產生",
      403: "沒有權限——你必須是該 board 的 admin 或 owner",
      404: "找不到資源——請確認 board ID / post ID 是否正確",
      429: "請求太頻繁（rate limit），請稍候再試",
    };
    throw new Error(
      `Padlet API ${res.status}：${hints[res.status] ?? ""}\n${text.slice(0, 500)}`
    );
  }
  return text ? JSON.parse(text) : {};
}

/**
 * board ID 自動解析：使用者可貼整段 Padlet 網址或直接給 ID。
 * API 的 board ID 是 16-22 字元的英數字串。
 * 網址最後一段 slug 的結尾雜湊通常就是它；解析不到時給出取得教學。
 */
const ID_RE = /^[A-Za-z0-9_]{15,22}$/; // 實測 board ID 可能只有 15 字元
function resolveBoardId(input) {
  const s = input.trim();
  if (ID_RE.test(s)) return s;
  // 網址：取最後一段 path，再取最後一個 '-' 之後的雜湊
  if (s.includes("padlet.")) {
    const lastSegment = new URL(s).pathname.split("/").filter(Boolean).pop() ?? "";
    const hash = lastSegment.split("-").pop() ?? "";
    if (ID_RE.test(hash)) return hash;
  }
  throw new Error(
    `無法從「${input}」解析出 board ID。\n` +
      `請改用官方方式取得：打開該 Padlet → 右上「⋯」選單 → Developer info → 複製 API ID。\n` +
      `（board ID 是 15-22 個英數字元的字串）`
  );
}

/** 把 API 回傳的 JSON 整理成精簡摘要，省 token 又好讀 */
function summarizeBoard(json) {
  const board = json.data;
  const included = json.included ?? [];
  const sections = included.filter((x) => x.type === "section");
  const posts = included.filter((x) => x.type === "post");
  const comments = included.filter((x) => x.type === "comment");
  return {
    board: {
      id: board.id,
      title: board.attributes?.title,
      description: board.attributes?.description,
      url: board.attributes?.webUrl?.live ?? board.attributes?.webUrl,
    },
    sections: sections.map((s) => ({
      id: s.id,
      title: s.attributes?.title,
    })),
    posts: posts.map((p) => ({
      id: p.id,
      subject: p.attributes?.content?.subject,
      body: p.attributes?.content?.bodyHtml ?? p.attributes?.content?.body,
      color: p.attributes?.color,
      sectionId: p.relationships?.section?.data?.id ?? null,
      author: p.relationships?.author?.data?.id ?? null,
      createdAt: p.attributes?.createdAt,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      postId: c.relationships?.post?.data?.id ?? null,
      html: c.attributes?.htmlContent,
    })),
  };
}

const ok = (obj) => ({
  content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }],
});

const server = new McpServer({ name: "padlet", version: "0.1.0" });

// ════════════════════════════════════════════════
// Tool 1：whoami — 驗證 API key、查目前使用者
// ════════════════════════════════════════════════
server.registerTool(
  "whoami",
  {
    description:
      "驗證 Padlet API key 是否有效，回傳目前登入使用者的名稱、email、username。安裝後第一次使用建議先呼叫此工具確認連線正常。",
    inputSchema: {},
  },
  async () => {
    const json = await api("/me");
    const a = json.data?.attributes ?? {};
    return ok({ id: json.data?.id, name: a.name, email: a.email, username: a.username });
  }
);

// ════════════════════════════════════════════════
// Tool 2：create_board — 一句話生成全新 Padlet（AI Recipe）
// ════════════════════════════════════════════════
server.registerTool(
  "create_board",
  {
    description:
      "用自然語言指令建立一面全新的 Padlet board（AI 生成，可在指令中描述要哪些 section 與初始內容）。" +
      "建立是非同步的，本工具會自動輪詢直到完成並回傳新 board 的網址。約需 30~90 秒。",
    inputSchema: {
      instructions: z
        .string()
        .max(2000)
        .describe(
          "自然語言的建板指令，越具體越好：對象、科目、版面、要哪些 section、每區放什麼初始內容。例：「建立國中數學一元一次方程式課前討論牆，分四個 section：迷思澄清、生活應用、挑戰題、自由提問，每區放 3 個引導問題」"
        ),
      role: z
        .string()
        .default("teacher")
        .describe("你的角色（影響 AI 生成風格），預設 teacher"),
    },
  },
  async ({ instructions, role }) => {
    const created = await api("/ai-recipe-boards", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "ai_recipe_board",
          attributes: { boardCreationInstructions: instructions, role: role ?? "teacher" },
        },
      }),
    });
    const statusUrl = created.data?.attributes?.statusUrl;
    if (!statusUrl) return ok({ message: "已送出建立請求，但沒拿到 statusUrl", raw: created });

    // 輪詢直到完成（最多 40 次 × 3 秒 = 2 分鐘）
    // 實測格式：attributes.status 為 "in_progress" → "success"，
    // 完成後 board 物件巢狀在 attributes.board
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const status = await api(statusUrl);
      const attrs = status.data?.attributes ?? {};
      const state = (attrs.status ?? "").toLowerCase();
      if (["success", "completed", "complete", "done", "succeeded"].includes(state)) {
        const board = attrs.board ?? {};
        return ok({
          message: "✅ 新 Padlet 建立完成！",
          boardId: board.id ?? null,
          title: board.attributes?.title ?? null,
          url: board.attributes?.webUrl?.live ?? null,
          qrCode: board.attributes?.webUrl?.qrCode ?? null,
          note: "提醒：AI 生成的版子預設「關閉」留言與 reactions，若要用 create_comment / add_reaction，請先到版子設定開啟。",
        });
      }
      if (["failed", "error"].includes(state)) {
        throw new Error(`建立失敗：${JSON.stringify(status)}`);
      }
    }
    return ok({
      message: "建立仍在進行中（已等 2 分鐘）。可稍後用此 statusUrl 再查。",
      statusUrl,
    });
  }
);

// ════════════════════════════════════════════════
// Tool 3：get_board — 讀整面牆
// ════════════════════════════════════════════════
server.registerTool(
  "get_board",
  {
    description:
      "讀取 Padlet board 的完整內容：標題、所有 sections、所有 posts、所有 comments。可直接貼 Padlet 網址或 board ID。",
    inputSchema: {
      board: z.string().describe("Padlet 網址或 board ID（16-22 字元英數字串）"),
      raw: z
        .boolean()
        .default(false)
        .describe("true 時回傳完整原始 JSON（預設回傳精簡摘要）"),
    },
  },
  async ({ board, raw }) => {
    const id = resolveBoardId(board);
    const json = await api(`/boards/${id}?include=posts,sections,comments`);
    return ok(raw ? json : summarizeBoard(json));
  }
);

// ════════════════════════════════════════════════
// Tool 4：create_post — 貼卡片（支援用 section 名稱指定區段）
// ════════════════════════════════════════════════
server.registerTool(
  "create_post",
  {
    description:
      "在 Padlet board 上新增一則 post（卡片）。可用 section 的「標題名稱」指定要貼到哪個區段（工具會自動比對 ID）。" +
      "附件支援兩類：①任何公開網址（圖片/影片/YouTube/PDF/網頁，Padlet 自動產生預覽）②poll 投票（問題＋選項）。" +
      "不支援直接上傳本機檔案——檔案需先有公開網址。",
    inputSchema: {
      board: z.string().describe("Padlet 網址或 board ID"),
      subject: z.string().optional().describe("卡片標題"),
      body: z.string().optional().describe("卡片內文"),
      attachment_url: z
        .string()
        .optional()
        .describe("附件的公開網址（圖片、影片、YouTube、PDF、網頁連結等）"),
      attachment_caption: z.string().optional().describe("附件的說明文字"),
      poll_question: z.string().optional().describe("投票問題（附一題投票時使用）"),
      poll_choices: z
        .array(z.string())
        .optional()
        .describe("投票選項列表，例：[\"紅色\", \"藍色\", \"綠色\"]"),
      section: z
        .string()
        .optional()
        .describe("要貼到的 section 標題名稱（例：「挑戰題」）或 section ID，省略則貼到預設位置"),
      color: z
        .enum(["red", "orange", "green", "blue", "purple"])
        .optional()
        .describe("卡片顏色"),
    },
  },
  async ({
    board,
    subject,
    body,
    attachment_url,
    attachment_caption,
    poll_question,
    poll_choices,
    section,
    color,
  }) => {
    const hasPoll = poll_question && poll_choices?.length;
    if (!subject && !body && !attachment_url && !hasPoll) {
      throw new Error("subject、body、attachment_url、poll 至少要有一個");
    }
    const boardId = resolveBoardId(board);

    // section 名稱 → ID 自動比對
    let sectionId = null;
    if (section) {
      if (/^sec_[A-Za-z0-9]+$/.test(section)) {
        sectionId = section;
      } else {
        const boardJson = await api(`/boards/${boardId}?include=sections`);
        const sections = (boardJson.included ?? []).filter((x) => x.type === "section");
        const hit = sections.find((s) => (s.attributes?.title ?? "").trim() === section.trim());
        if (!hit) {
          const names = sections.map((s) => s.attributes?.title).join("、") || "（無）";
          throw new Error(
            `這面牆沒有名為「${section}」的 section。現有區段：${names}。\n` +
              `（Padlet API 不支援新增 section，請到 Padlet 介面手動新增後再試）`
          );
        }
        sectionId = hit.id;
      }
    }

    const content = {};
    if (subject) content.subject = subject;
    if (body) content.body = body;
    if (attachment_url || hasPoll) {
      content.attachment = {
        ...(attachment_url ? { url: attachment_url } : {}),
        ...(attachment_caption ? { caption: attachment_caption } : {}),
        ...(hasPoll ? { poll: { question: poll_question, choices: poll_choices } } : {}),
      };
    }

    const payload = {
      data: {
        type: "post",
        attributes: { content, ...(color ? { color } : {}) },
        ...(sectionId ? { relationships: { section: { data: { id: sectionId } } } } : {}),
      },
    };
    const json = await api(`/boards/${boardId}/posts`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return ok({ message: "✅ Post 已建立", postId: json.data?.id, raw: json.data?.attributes });
  }
);

// ════════════════════════════════════════════════
// Tool 5：create_comment — 在卡片下留言
// ════════════════════════════════════════════════
server.registerTool(
  "create_comment",
  {
    description:
      "在指定的 post（卡片）底下新增一則留言。適合用來給個別回饋。post ID 可先用 get_board 取得。" +
      "注意：board 必須先在 Padlet 設定中開啟留言功能，否則會收到 COMMENTS_NOT_ALLOWED 錯誤。",
    inputSchema: {
      post_id: z.string().describe("post 的 hash ID（用 get_board 查）"),
      html: z
        .string()
        .max(10000)
        .describe("留言內容（支援 HTML，例如 <p>想想看：兩邊同時減 3 會怎樣？</p>）"),
    },
  },
  async ({ post_id, html }) => {
    const json = await api(`/posts/${post_id}/comments`, {
      method: "POST",
      body: JSON.stringify({
        data: { type: "comment", attributes: { htmlContent: html } },
      }),
    });
    return ok({ message: "✅ 留言已送出", commentId: json.data?.id });
  }
);

// ════════════════════════════════════════════════
// Tool 6：add_reaction — 對卡片加 reaction
// ════════════════════════════════════════════════
server.registerTool(
  "add_reaction",
  {
    description:
      "對指定 post 加 reaction：like（讚/愛心）、star（0-5 星）、grade（0-100 分）、vote（+1/-1）。" +
      "注意：board 必須先在 Padlet 設定中開啟 reactions（AI 生成的版子預設關閉），否則會收到 Reactions not enabled 錯誤。",
    inputSchema: {
      post_id: z.string().describe("post 的 hash ID（用 get_board 查）"),
      type: z
        .enum(["like", "star", "grade", "vote"])
        .default("like")
        .describe("reaction 類型，省略時用 board 設定的預設類型"),
      value: z
        .number()
        .int()
        .default(1)
        .describe("like 固定 1；star 0-5；grade 0-100；vote 1 或 -1"),
    },
  },
  async ({ post_id, type, value }) => {
    const json = await api(`/posts/${post_id}/reactions`, {
      method: "POST",
      body: JSON.stringify({
        data: { type: "reaction", attributes: { value: value ?? 1, reactionType: type ?? "like" } },
      }),
    });
    return ok({ message: `✅ 已加上 ${type ?? "like"} reaction`, reactionId: json.data?.id });
  }
);

// ── 啟動 ──
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("padlet-mcp 已啟動（stdio）");
