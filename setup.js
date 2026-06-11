/**
 * padlet-mcp 一鍵安裝精靈
 * 用法：npx -y padlet-mcp setup [--key <API_KEY>] [--local] [--dry-run]
 *
 * 自動偵測本機已安裝的 AI Agent，把 padlet MCP server 寫入各自的設定檔：
 *   - Claude Code CLI     ~/.claude.json                （mcpServers，JSON）
 *   - Claude Desktop      平台各異的 claude_desktop_config.json（mcpServers，JSON）
 *   - Codex desktop/CLI   ~/.codex/config.toml          （[mcp_servers.*]，TOML）
 *   - OpenCode desktop/CLI ~/.config/opencode/opencode.json（mcp，JSON、command 為陣列）
 *   - Antigravity IDE/CLI ~/.gemini/config/mcp_config.json（mcpServers，JSON）
 *
 * 安全設計：改檔前先備份成 <檔名>.bak-<時間戳>；已存在 padlet 設定時跳過不覆蓋。
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

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

// ── 註冊用的啟動指令 ──
function serverCommand() {
  if (USE_LOCAL) {
    const indexPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "index.js");
    return { command: "node", args: [indexPath] };
  }
  return { command: IS_WIN ? "npx.cmd" : "npx", args: ["-y", "padlet-mcp"] };
}

// ── 取得 API key：--key 參數 > 環境變數 > 互動式詢問 ──
async function getApiKey() {
  const fromArg = getOpt("--key");
  if (fromArg) return fromArg;
  if (process.env.PADLET_API_KEY) return process.env.PADLET_API_KEY;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("\n📋 取得 API key：padlet.com/dashboard/settings → Developer → Generate（需付費訂閱）");
  const key = await new Promise((res) => rl.question("請貼上你的 Padlet API key：", res));
  rl.close();
  if (!key?.trim()) {
    console.error("❌ 沒有輸入 API key，安裝中止。");
    process.exit(1);
  }
  return key.trim();
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

// ── 各 agent 的安裝器：回傳 "installed" | "skipped"（已存在）| null（未偵測到）──

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
  if (json.mcpServers.padlet) return "skipped";
  backup(file);
  const { command, args } = serverCommand();
  json.mcpServers.padlet = { command, args, env: { PADLET_API_KEY: apiKey } };
  writeJson(file, json);
  return "installed";
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

/** Codex：TOML，採「檢查字串 + 附加區塊」策略，不解析整份 TOML 以免破壞既有內容 */
function installCodex(apiKey) {
  const file = path.join(HOME, ".codex", "config.toml");
  if (!fs.existsSync(file)) return null;
  const toml = fs.readFileSync(file, "utf8");
  if (/\[mcp_servers\.padlet\]/.test(toml)) return "skipped";
  backup(file);
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
  if (json.mcp.padlet) return "skipped";
  backup(file);
  const { command, args } = serverCommand();
  json.mcp.padlet = {
    type: "local",
    command: [command === "npx.cmd" ? "npx" : command, ...args], // opencode 自行解析，用 npx 即可
    enabled: true,
    environment: { PADLET_API_KEY: apiKey },
  };
  writeJson(file, json);
  return "installed";
}

// ── 主流程 ──
export async function runSetup() {
  console.log(`\n🧱 padlet-mcp 一鍵安裝精靈${DRY_RUN ? "（dry-run 模式，不會寫入任何檔案）" : ""}\n`);
  const apiKey = await getApiKey();

  const targets = [
    ["Claude Code CLI", installClaudeCode],
    ["Claude Desktop", installClaudeDesktop],
    ["Codex（desktop + CLI 共用設定）", installCodex],
    ["OpenCode（desktop + CLI 共用設定）", installOpenCode],
    ["Antigravity（IDE + CLI 共用設定）", installAntigravity],
  ];

  const icons = { installed: "✅ 已安裝", skipped: "⏭️ 已有 padlet 設定，跳過", null: "➖ 未偵測到" };
  let installedCount = 0;

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
  }

  console.log(`\n完成：${installedCount} 個 agent 新增了 padlet MCP。`);
  if (installedCount > 0) {
    console.log("重新啟動各 agent 後，說「用 padlet 的 whoami 確認連線」即可驗證。");
    console.log("（改動前的設定檔已備份為 *.bak-<時間戳>）");
  }
}
