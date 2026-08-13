const PADLET_API_ORIGIN = "https://api.padlet.dev";
const PADLET_API_BASE_PATH = "/v1";

/**
 * 可以傳送 API key 的官方端點白名單。
 *
 * 第一組是所有實際使用的端點——**含 AI Recipe 建牆的輪詢網址（statusUrl）**，
 * 2026-08-13 實測回傳 https://api.padlet.dev/v1/ai-recipe-boards/status/<id>。
 *
 * 第二組 padlet.dev/api/public/v1 是官方文件 ai-recipe-board-creation-status-url-object
 * 標示的格式，但實際 API 並未使用。保留放行是為了萬一 Padlet 改回文件寫的網址時
 * create_board 不會突然壞掉——若哪天要收緊白名單，這組是可以拿掉的。
 */
const ALLOWED_ENDPOINTS = [
  { origin: PADLET_API_ORIGIN, pathPrefix: `${PADLET_API_BASE_PATH}/` },
  { origin: "https://padlet.dev", pathPrefix: "/api/public/v1/" },
];

export function resolveApiUrl(path) {
  const candidate = /^https?:\/\//.test(path)
    ? path
    : `${PADLET_API_ORIGIN}${PADLET_API_BASE_PATH}/${path.replace(/^\/+/, "")}`;
  const url = new URL(candidate);
  const isAllowed = ALLOWED_ENDPOINTS.some(
    ({ origin, pathPrefix }) => url.origin === origin && url.pathname.startsWith(pathPrefix)
  );
  if (!isAllowed) {
    throw new Error(`拒絕傳送 Padlet API key 到非官方 API 網址：${url.origin}${url.pathname}`);
  }
  return url.toString();
}

export function validatePoll(question, choices) {
  const hasQuestion = Boolean(question?.trim());
  const hasChoices = Array.isArray(choices) && choices.length > 0;
  if (hasQuestion !== hasChoices) {
    throw new Error("poll_question 與 poll_choices 必須一起提供");
  }
  if (!hasQuestion) return false;

  const normalized = choices.map((choice) => choice.trim()).filter(Boolean);
  if (normalized.length < 2) {
    throw new Error("投票至少需要 2 個非空白選項");
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("投票選項不可重複");
  }
  return true;
}

export function validateReaction(type = "like", value = 1) {
  const rules = {
    like: (v) => v === 1,
    star: (v) => Number.isInteger(v) && v >= 0 && v <= 5,
    grade: (v) => Number.isInteger(v) && v >= 0 && v <= 100,
    vote: (v) => v === 1 || v === -1,
  };
  if (!rules[type]?.(value)) {
    const ranges = {
      like: "like 的 value 必須是 1",
      star: "star 的 value 必須是 0 到 5 的整數",
      grade: "grade 的 value 必須是 0 到 100 的整數",
      vote: "vote 的 value 必須是 1 或 -1",
    };
    throw new Error(ranges[type] ?? `不支援的 reaction 類型：${type}`);
  }
}

export function validatePadletApiKey(apiKey) {
  if (!/^pdltp_[A-Za-z0-9]{40,}$/.test(apiKey ?? "")) {
    throw new Error("Padlet API key 格式不正確，應以 pdltp_ 開頭");
  }
  return apiKey;
}
