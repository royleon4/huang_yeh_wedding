function persistenceError(message) {
  const error = new Error(message);
  error.code = "PERSISTENCE_MISMATCH";
  return error;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHtml(value) {
  return String(value ?? "").trim();
}

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value ?? "");
}

function youtubeVideoId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw, "https://www.youtube.com");
    if (url.hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/").filter(Boolean)[1] ?? null;
    }
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function sameValue(field, expected, actual) {
  if ([
    "titleZh",
    "titleEn",
    "descriptionZh",
    "descriptionEn",
    "labelZh",
    "labelEn",
    "displayName",
    "uploaderName",
  ].includes(field)) {
    return normalizeText(expected) === normalizeText(actual);
  }
  if (["contentHtmlZh", "contentHtmlEn"].includes(field)) {
    return normalizeHtml(expected) === normalizeHtml(actual);
  }
  if (field === "capturedAt") {
    return normalizeDate(expected) === normalizeDate(actual);
  }
  if (field === "youtubeUrl") {
    return youtubeVideoId(expected) === (actual ?? null);
  }
  if (["dividerPaddingTop", "dividerPaddingBottom", "processWheelVisibleCount"].includes(field)) {
    return Number(expected) === Number(actual);
  }
  return JSON.stringify(stableValue(expected)) === JSON.stringify(stableValue(actual));
}

function mismatchedFields(expected, actual, fields, aliases = {}) {
  return fields.filter((field) => {
    if (!Object.hasOwn(expected ?? {}, field)) return false;
    const actualField = aliases[field] ?? field;
    return !sameValue(field, expected[field], actual?.[actualField]);
  });
}

function mismatchResult(result, fields) {
  return {
    ...result,
    status: "error",
    error: `伺服器未確認以下欄位已儲存：${fields.join("、")}`,
    code: "PERSISTENCE_MISMATCH",
  };
}

function adjustedSummary(payload, addedFailures) {
  if (!payload?.summary || addedFailures === 0) return payload?.summary;
  return {
    ...payload.summary,
    succeeded: Math.max(0, Number(payload.summary.succeeded ?? 0) - addedFailures),
    failed: Number(payload.summary.failed ?? 0) + addedFailures,
  };
}

const ALBUM_BATCH_FIELDS = [
  "titleZh",
  "titleEn",
  "descriptionZh",
  "descriptionEn",
  "isVisible",
];
const CATEGORY_BATCH_FIELDS = ["labelZh", "labelEn"];
const PHOTO_BATCH_FIELDS = [
  "displayName",
  "visibility",
  "albumIds",
  "categoryIds",
  "capturedAt",
];

export function verifyBatchPersistence(payload, body) {
  if (!Array.isArray(payload?.results)) return payload;
  const expectedByKey = new Map();
  for (const item of body?.albums?.create ?? []) {
    expectedByKey.set(`album:create:${String(item.clientId)}`, {
      fields: ALBUM_BATCH_FIELDS,
      values: item.values ?? {},
      payloadKey: "album",
    });
  }
  for (const item of body?.albums?.update ?? []) {
    expectedByKey.set(`album:update:${String(item.id)}`, {
      fields: ALBUM_BATCH_FIELDS,
      values: item.changes ?? {},
      payloadKey: "album",
    });
  }
  for (const item of body?.categories?.create ?? []) {
    expectedByKey.set(`category:create:${String(item.clientId)}`, {
      fields: CATEGORY_BATCH_FIELDS,
      values: item.values ?? {},
      payloadKey: "category",
    });
  }
  for (const item of body?.categories?.update ?? []) {
    expectedByKey.set(`category:update:${String(item.id)}`, {
      fields: CATEGORY_BATCH_FIELDS,
      values: item.changes ?? {},
      payloadKey: "category",
    });
  }
  for (const item of body?.photos?.update ?? []) {
    expectedByKey.set(`photo:update:${String(item.id)}`, {
      fields: PHOTO_BATCH_FIELDS,
      values: item.changes ?? {},
      payloadKey: "photo",
    });
  }

  let addedFailures = 0;
  const results = payload.results.map((result) => {
    if (result?.status !== "ok") return result;
    const expected = expectedByKey.get(String(result.key));
    if (!expected) return result;
    const fields = mismatchedFields(
      expected.values,
      result[expected.payloadKey],
      expected.fields,
    );
    if (fields.length === 0) return result;
    addedFailures += 1;
    return mismatchResult(result, fields);
  });

  if (addedFailures === 0) return payload;
  return {
    ...payload,
    results,
    summary: adjustedSummary(payload, addedFailures),
  };
}

export function verifyMutationPersistence(path, method, body, payload) {
  if (method !== "PATCH" || !body || typeof body !== "object") return payload;

  let actual = null;
  let fields = [];
  let aliases = {};

  if (path === "/admin/api/settings") {
    actual = payload;
    fields = Object.keys(body);
  } else if (/^\/admin\/api\/albums\/[^/]+$/.test(path)) {
    actual = payload?.album;
    fields = [
      "titleZh",
      "titleEn",
      "descriptionZh",
      "descriptionEn",
      "isVisible",
      "showSummary",
    ];
  } else if (/^\/admin\/api\/categories\/[^/]+$/.test(path)) {
    actual = payload?.category;
    fields = ["labelZh", "labelEn", "youtubeUrl", "youtubeAutoplay"];
    aliases = { youtubeUrl: "youtubeVideoId" };
  } else if (/^\/admin\/api\/photos\/[^/]+\/uploader$/.test(path)) {
    actual = payload?.uploader;
    fields = ["uploaderName"];
  } else if (/^\/admin\/api\/process-content\/[^/]+$/.test(path)) {
    actual = payload?.content;
    const processKey = decodeURIComponent(path.split("/").at(-1) ?? "");
    fields = [
      "contentHtmlZh",
      "contentHtmlEn",
      "dividerPaddingTop",
      "dividerPaddingBottom",
      ...(processKey === "all"
        ? ["labelZh", "labelEn", "youtubeUrl", "youtubeAutoplay", "showAllPhotos"]
        : []),
    ];
    aliases = { youtubeUrl: "youtubeVideoId" };
  } else {
    return payload;
  }

  const fieldsThatDiffer = mismatchedFields(body, actual, fields, aliases);
  if (fieldsThatDiffer.length > 0) {
    throw persistenceError(
      `伺服器回應成功，但未確認以下欄位已儲存：${fieldsThatDiffer.join("、")}`,
    );
  }
  return payload;
}
