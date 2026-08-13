/**
 * padlet-mcp 一鍵安裝精靈
 * 用法：npx -y padlet-mcp setup [--update] [--local] [--dry-run]
 *
 * 自動偵測本機已安裝的 AI Agent，把 padlet MCP server 寫入各自的設定檔：
 *   - Claude Code CLI     ~/.claude.json                （mcpServers，JSON）
 *   - Claude Desktop      平台各異的 claude_desktop_config.json（mcpServers，JSON）
 *   - Codex desktop/CLI   ~/.codex/config.toml          （[mcp_servers.*]，TOML）
 *   - OpenCode desktop/CLI ~/.config/opencode/opencode.json（mcp，JSON、command 為陣列）
 *   - Antigravity IDE/CLI ~/.gemini/config/mcp_config.json（mcpServers，JSON）
 *
 * 安全設計：改檔前先備份成 <檔名>.bak-<時間戳>；預設不覆蓋，--update 才更新既有設定。
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { validatePadletApiKey } from "./lib.js";

// 版本號以 package.json 為單一來源；印在橫幅上，讓 --dry-run 可以當版本檢查用
const { version: PKG_VERSION } = createRequire(import.meta.url)("./package.json");

const HOME = os.homedir();
const IS_WIN = process.platform === "win32";

// ── 解析參數 ──
const argv = process.argv.slice(2); // 第一個是 "setup"
const getFlag = (name) => argv.includes(name);
const getOpt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const DRY_RUN = getFlag("--dry-run");
const USE_LOCAL = getFlag("--local"); // 用本機 index.js 絕對路徑（開發/未發布 npm 時）
const UPDATE_EXISTING = getFlag("--update");

// ── 註冊用的啟動指令 ──
/**
 * ⚠️ 一定要釘 @latest：npx 對「沒指定版本」的套件會沿用快取裡已有的版本，
 * 不保證回 registry 查新版。實測快取留著 0.1.0 時，bare `npx -y padlet-mcp`
 * 會繼續跑舊版，使用者永遠等不到更新。多付一點啟動解析時間換「真的會更新」。
 */
const PKG_SPEC = "padlet-mcp@latest";

function serverCommand() {
  if (USE_LOCAL) {
    const indexPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "index.js");
    return { command: "node", args: [indexPath] };
  }
  return { command: IS_WIN ? "npx.cmd" : "npx", args: ["-y", PKG_SPEC] };
}

// ── 取得 API key：環境變數 > 互動式詢問。--key 僅保留相容性，不建議使用。 ──
async function getApiKey() {
  const fromArg = getOpt("--key");
  if (fromArg) {
    console.warn("⚠️ --key 可能留在命令歷史或程序列表，建議改用互動輸入或 PADLET_API_KEY 環境變數。");
    return validatePadletApiKey(fromArg);
  }
  if (process.env.PADLET_API_KEY) return validatePadletApiKey(process.env.PADLET_API_KEY);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("\n📋 取得 API key：padlet.com/dashboard/settings → Developer → Generate（需付費訂閱）");
  const key = await new Promise((res) => rl.question("請貼上你的 Padlet API key：", res));
  rl.close();
  if (!key?.trim()) {
    console.error("❌ 沒有輸入 API key，安裝中止。");
    process.exit(1);
  }
  return validatePadletApiKey(key.trim());
}

// ── 共用小工具 ──
function backup(file) {
  if (DRY_RUN) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.copyFileSync(file, `${file}.bak-${stamp}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, obj) {
  if (DRY_RUN) return;
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

// ── 各 agent 的安裝器：回傳 "installed" | "updated" | "skipped" | null ──

/** 標準 mcpServers JSON 格式（Claude Code、Claude Desktop、Antigravity 共用） */
function installStandardJson(file, apiKey, { createIfMissing = false } = {}) {
  if (!fs.existsSync(file)) {
    if (!createIfMissing) return null;
    if (!DRY_RUN) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "{}\n", "utf8");
    }
  }
  const json = fs.existsSync(file) ? readJson(file) : {};
  json.mcpServers ??= {};
  const exists = Boolean(json.mcpServers.padlet);
  if (exists && !UPDATE_EXISTING) return "skipped";
  backup(file);
  const { command, args } = serverCommand();
  json.mcpServers.padlet = { command, args, env: { PADLET_API_KEY: apiKey } };
  writeJson(file, json);
  return exists ? "updated" : "installed";
}

function installClaudeCode(apiKey) {
  return installStandardJson(path.join(HOME, ".claude.json"), apiKey);
}

function installClaudeDesktop(apiKey) {
  const file = IS_WIN
    ? path.join(process.env.APPDATA ?? path.join(HOME, "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
    : process.platform === "darwin"
      ? path.join(HOME, "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : path.join(HOME, ".config", "Claude", "claude_desktop_config.json");
  // Claude Desktop 以資料夾存在與否判斷是否有裝（設定檔可能尚未建立）
  if (!fs.existsSync(path.dirname(file))) return null;
  return installStandardJson(file, apiKey, { createIfMissing: true });
}

function installAntigravity(apiKey) {
  const file = path.join(HOME, ".gemini", "config", "mcp_config.json");
  if (!fs.existsSync(path.dirname(file))) return null;
  return installStandardJson(file, apiKey, { createIfMissing: true });
}

export function replaceCodexPadletBlock(toml, apiKey) {
  const keyLine = `PADLET_API_KEY = ${JSON.stringify(apiKey)}`;
  const envSection = /(\[mcp_servers\.padlet\.env\][\s\S]*?)(?=\r?\n\[|$)/;
  if (!envSection.test(toml)) {
    throw new Error("找到 Padlet MCP 設定，但缺少 [mcp_servers.padlet.env] 區段，請手動檢查 config.toml");
  }
  return toml.replace(envSection, (section) => {
    if (/^PADLET_API_KEY\s*=/m.test(section)) {
      return section.replace(/^PADLET_API_KEY\s*=.*$/m, keyLine);
    }
    return `${section.trimEnd()}\n${keyLine}\n`;
  });
}

/**
 * Codex TOML：更新 [mcp_servers.padlet] 區段內的 command / args。
 * 只動這兩行，其餘（startup_timeout_sec 等）與其他區段保持原樣——
 * 不整段重寫是為了不清掉使用者自己加的設定。
 */
export function replaceCodexPadletCommand(toml, command, args) {
  const commandLine = `command = ${JSON.stringify(command)}`;
  const argsLine = `args = [${args.map((a) => JSON.stringify(a)).join(", ")}]`;
  const section = /(\[mcp_servers\.padlet\]\r?\n)([\s\S]*?)(?=\r?\n\[|$)/;
  if (!section.test(toml)) {
    throw new Error("找不到 [mcp_servers.padlet] 區段，請手動檢查 config.toml");
  }
  return toml.replace(section, (_all, header, body) => {
    let next = /^command\s*=/m.test(body)
      ? body.replace(/^command\s*=.*$/m, commandLine)
      : `${commandLine}\n${body}`;
    next = /^args\s*=/m.test(next)
      ? next.replace(/^args\s*=.*$/m, argsLine)
      : `${next.replace(/^(command\s*=.*)$/m, `$1\n${argsLine}`)}`;
    return header + next;
  });
}

/**
 * Codex：TOML 新增時附加區塊；更新時改寫 command / args ＋ 輪替 API key。
 * （0.2.0 前的 --update 只換 key、不換啟動指令，導致 Codex 無法從 --local
 * 的本機路徑切換成 npx，與其他 agent 行為不一致。）
 */
function installCodex(apiKey) {
  const file = path.join(HOME, ".codex", "config.toml");
  if (!fs.existsSync(file)) return null;
  const toml = fs.readFileSync(file, "utf8");
  const exists = /\[mcp_servers\.padlet\]/.test(toml);
  if (exists && !UPDATE_EXISTING) return "skipped";
  backup(file);
  if (exists) {
    const { command, args } = serverCommand();
    const updated = replaceCodexPadletBlock(
      replaceCodexPadletCommand(toml, command, args),
      apiKey
    );
    if (!DRY_RUN) fs.writeFileSync(file, updated, "utf8");
    return "updated";
  }
  const { command, args } = serverCommand();
  const argsToml = args.map((a) => JSON.stringify(a)).join(", ");
  const block = `
[mcp_servers.padlet]
command = ${JSON.stringify(command)}
args = [${argsToml}]
startup_timeout_sec = 60
tool_timeout_sec = 180

[mcp_servers.padlet.env]
PADLET_API_KEY = ${JSON.stringify(apiKey)}
`;
  if (!DRY_RUN) fs.appendFileSync(file, block, "utf8");
  return "installed";
}

/** OpenCode：mcp 物件、command 為陣列、env 鍵名是 environment */
function installOpenCode(apiKey) {
  const file = path.join(HOME, ".config", "opencode", "opencode.json");
  if (!fs.existsSync(file)) return null;
  const json = readJson(file);
  json.mcp ??= {};
  if (json.mcp.padlet && !UPDATE_EXISTING) return "skipped";
  const exists = Boolean(json.mcp.padlet);
  backup(file);
  const { command, args } = serverCommand();
  json.mcp.padlet = {
    type: "local",
    command: [command === "npx.cmd" ? "npx" : command, ...args], // opencode 自行解析，用 npx 即可
    enabled: true,
    environment: { PADLET_API_KEY: apiKey },
  };
  writeJson(file, json);
  return exists ? "updated" : "installed";
}

// ── 主流程 ──
export async function runSetup() {
  console.log(
    `\n🧱 padlet-mcp v${PKG_VERSION} 一鍵安裝精靈${DRY_RUN ? "（dry-run 模式，不會寫入任何檔案）" : ""}\n`
  );
  const apiKey = await getApiKey();

  const targets = [
    ["Claude Code CLI", installClaudeCode],
    ["Claude Desktop", installClaudeDesktop],
    ["Codex（desktop + CLI 共用設定）", installCodex],
    ["OpenCode（desktop + CLI 共用設定）", installOpenCode],
    ["Antigravity（IDE + CLI 共用設定）", installAntigravity],
  ];

  const icons = {
    installed: "✅ 已安裝",
    updated: "🔄 已更新",
    skipped: "⏭️ 已有 padlet 設定，跳過（使用 --update 可輪替 Key）",
    null: "➖ 未偵測到",
  };
  let installedCount = 0;
  let updatedCount = 0;

  for (const [name, fn] of targets) {
    let result = null;
    try {
      result = fn(apiKey);
    } catch (e) {
      console.log(`  ❌ ${name}：寫入失敗 — ${e.message}`);
      continue;
    }
    console.log(`  ${icons[result] ?? icons.null} ${name}`);
    if (result === "installed") installedCount++;
    if (result === "updated") updatedCount++;
  }

  console.log(`\n完成：${installedCount} 個 agent 新增、${updatedCount} 個 agent 更新 padlet MCP。`);
  if (installedCount > 0 || updatedCount > 0) {
    console.log("重新啟動各 agent 後，說「用 padlet 的 whoami 確認連線」即可驗證。");
    console.log("（改動前的設定檔已備份為 *.bak-<時間戳>）");
  }
}
