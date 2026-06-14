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

test("resolveApiUrl rejects non-Padlet hosts and paths outside v1", () => {
  assert.throws(() => resolveApiUrl("https://example.com/steal"), /拒絕傳送/);
  assert.throws(() => resolveApiUrl("https://api.padlet.dev/admin"), /拒絕傳送/);
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
