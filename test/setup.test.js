import test from "node:test";
import assert from "node:assert/strict";
import { replaceCodexPadletBlock, replaceCodexPadletCommand } from "../setup.js";

// --update 必須能把 Codex 從 --local 的本機路徑切換成 npx，
// 才會跟 Claude Code / OpenCode / Antigravity 行為一致。
const LOCAL_CODEX_CONFIG = `[mcp_servers.other]
command = "other"

[mcp_servers.padlet]
command = "node"
args = ["C:\\\\2026Padlet_agent\\\\index.js"]
startup_timeout_sec = 60
tool_timeout_sec = 180

[mcp_servers.padlet.env]
PADLET_API_KEY = "pdltp_old_key_that_is_long_enough"
OTHER_SETTING = "keep-me"
`;

test("replaceCodexPadletCommand switches the local path over to npx", () => {
  const updated = replaceCodexPadletCommand(LOCAL_CODEX_CONFIG, "npx.cmd", [
    "-y",
    "padlet-mcp@latest",
  ]);

  assert.match(updated, /^command = "npx\.cmd"$/m);
  assert.match(updated, /^args = \["-y", "padlet-mcp@latest"\]$/m);
  assert.doesNotMatch(updated, /2026Padlet_agent/);
  // 其餘設定與其他區段都不能被清掉
  assert.match(updated, /^startup_timeout_sec = 60$/m);
  assert.match(updated, /^tool_timeout_sec = 180$/m);
  assert.match(updated, /\[mcp_servers\.other\]/);
  assert.match(updated, /^OTHER_SETTING = "keep-me"$/m);
  // 不能誤改 env 子區段的內容
  assert.match(updated, /PADLET_API_KEY = "pdltp_old_key_that_is_long_enough"/);
});

test("replaceCodexPadletCommand composes with the key rotation", () => {
  const updated = replaceCodexPadletBlock(
    replaceCodexPadletCommand(LOCAL_CODEX_CONFIG, "npx", ["-y", "padlet-mcp@latest"]),
    "pdltp_new_key_that_is_long_enough"
  );

  assert.match(updated, /^args = \["-y", "padlet-mcp@latest"\]$/m);
  assert.match(updated, /PADLET_API_KEY = "pdltp_new_key_that_is_long_enough"/);
  assert.doesNotMatch(updated, /pdltp_old_key_that_is_long_enough/);
  assert.match(updated, /^OTHER_SETTING = "keep-me"$/m);
});

test("replaceCodexPadletCommand rejects a config without the Padlet section", () => {
  assert.throws(
    () => replaceCodexPadletCommand(`[mcp_servers.other]\ncommand = "other"\n`, "npx", ["-y"]),
    /找不到 \[mcp_servers\.padlet\]/
  );
});

test("replaceCodexPadletBlock rotates only the Padlet API key", () => {
  const config = `[mcp_servers.padlet]
command = "node"
args = ["C:\\\\2026Padlet_agent\\\\index.js"]

[mcp_servers.padlet.env]
PADLET_API_KEY = "pdltp_old_key_that_is_long_enough"
OTHER_SETTING = "keep-me"

[mcp_servers.other]
command = "other"
`;

  const updated = replaceCodexPadletBlock(
    config,
    "pdltp_new_key_that_is_long_enough"
  );

  assert.match(updated, /PADLET_API_KEY = "pdltp_new_key_that_is_long_enough"/);
  assert.doesNotMatch(updated, /pdltp_old_key_that_is_long_enough/);
  assert.match(updated, /OTHER_SETTING = "keep-me"/);
  assert.match(updated, /\[mcp_servers\.other\]/);
});

test("replaceCodexPadletBlock inserts a missing key in the env section", () => {
  const config = `[mcp_servers.padlet.env]
OTHER_SETTING = "keep-me"
`;

  const updated = replaceCodexPadletBlock(
    config,
    "pdltp_new_key_that_is_long_enough"
  );

  assert.match(updated, /PADLET_API_KEY = "pdltp_new_key_that_is_long_enough"/);
  assert.match(updated, /OTHER_SETTING = "keep-me"/);
});

test("replaceCodexPadletBlock rejects configs without a Padlet env section", () => {
  assert.throws(
    () =>
      replaceCodexPadletBlock(
        `[mcp_servers.other]\ncommand = "other"\n`,
        "pdltp_new_key_that_is_long_enough"
      ),
    /缺少 \[mcp_servers\.padlet\.env\]/
  );
});
