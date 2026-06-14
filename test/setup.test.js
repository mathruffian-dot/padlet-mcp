import test from "node:test";
import assert from "node:assert/strict";
import { replaceCodexPadletBlock } from "../setup.js";

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
