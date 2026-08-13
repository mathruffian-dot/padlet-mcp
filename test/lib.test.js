import test from "node:test";
import assert from "node:assert/strict";
import { resolveApiUrl, validatePadletApiKey, validatePoll, validateReaction } from "../lib.js";

test("resolveApiUrl accepts Padlet API paths and official status URLs", () => {
  assert.equal(resolveApiUrl("/me"), "https://api.padlet.dev/v1/me");
  assert.equal(
    resolveApiUrl("https://api.padlet.dev/v1/ai-recipe-boards/status/abc"),
    "https://api.padlet.dev/v1/ai-recipe-boards/status/abc"
  );
});

// 官方文件把 statusUrl 記載成 padlet.dev/api/public/v1，但 2026-08-13 實測
// 真實回傳是 api.padlet.dev/v1/ai-recipe-boards/status/<id>（已被上面那條涵蓋）。
// 這條測的是「文件版格式」也放行，純屬防禦：若 Padlet 哪天改用文件寫的網址，
// create_board 不會突然被白名單擋掉。
test("resolveApiUrl also accepts the documented padlet.dev statusUrl format", () => {
  const statusUrl =
    "https://padlet.dev/api/public/v1/ai-recipe-boards/status/ai_recipe_board_7e3e243039";
  assert.equal(resolveApiUrl(statusUrl), statusUrl);
});

test("resolveApiUrl rejects non-Padlet hosts and paths outside the allowed prefixes", () => {
  assert.throws(() => resolveApiUrl("https://example.com/steal"), /拒絕傳送/);
  assert.throws(() => resolveApiUrl("https://api.padlet.dev/admin"), /拒絕傳送/);
  // padlet.dev 只放行 /api/public/v1/，其餘路徑仍須擋掉
  assert.throws(() => resolveApiUrl("https://padlet.dev/dashboard/settings"), /拒絕傳送/);
  // 子網域仿冒與明文 http 都不能通過
  assert.throws(() => resolveApiUrl("https://padlet.dev.evil.com/api/public/v1/me"), /拒絕傳送/);
  assert.throws(() => resolveApiUrl("http://api.padlet.dev/v1/me"), /拒絕傳送/);
});

test("validatePoll requires a complete and useful poll", () => {
  assert.equal(validatePoll(undefined, undefined), false);
  assert.equal(validatePoll("選一個", ["A", "B"]), true);
  assert.throws(() => validatePoll("選一個", undefined), /必須一起提供/);
  assert.throws(() => validatePoll("選一個", ["A"]), /至少需要 2 個/);
  assert.throws(() => validatePoll("選一個", ["A", "A"]), /不可重複/);
});

test("validateReaction enforces each reaction range", () => {
  assert.doesNotThrow(() => validateReaction("like", 1));
  assert.doesNotThrow(() => validateReaction("star", 5));
  assert.doesNotThrow(() => validateReaction("grade", 100));
  assert.doesNotThrow(() => validateReaction("vote", -1));
  assert.throws(() => validateReaction("like", 2), /必須是 1/);
  assert.throws(() => validateReaction("star", 6), /0 到 5/);
  assert.throws(() => validateReaction("grade", 101), /0 到 100/);
  assert.throws(() => validateReaction("vote", 0), /1 或 -1/);
});

test("validatePadletApiKey checks the expected prefix and length", () => {
  const key = `pdltp_${"a".repeat(64)}`;
  assert.equal(validatePadletApiKey(key), key);
  assert.throws(() => validatePadletApiKey("not-a-key"), /格式不正確/);
});
