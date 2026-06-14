const PADLET_API_ORIGIN = "https://api.padlet.dev";
const PADLET_API_BASE_PATH = "/v1";

export function resolveApiUrl(path) {
  const candidate =
    path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${PADLET_API_ORIGIN}${PADLET_API_BASE_PATH}/${path.replace(/^\/+/, "")}`;
  const url = new URL(candidate);
  if (url.origin !== PADLET_API_ORIGIN || !url.pathname.startsWith(`${PADLET_API_BASE_PATH}/`)) {
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
