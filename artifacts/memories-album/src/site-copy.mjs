export const SITE_COPY_GROUPS = [
  {
    id: "header",
    label: "頁首與標題",
    fields: [
      { key: "headerEyebrow", label: "頁首小標", maxLength: 120 },
      {
        key: "archive",
        label: "網站主標題",
        maxLength: 200,
        multiline: true,
        help: "允許換行；前台會依照輸入的換行顯示。",
      },
      { key: "date", label: "日期文字", maxLength: 100 },
      {
        key: "subtitle",
        label: "主標題下方說明",
        maxLength: 700,
        multiline: true,
      },
    ],
  },
  {
    id: "gallery",
    label: "照片牆與分類",
    fields: [
      { key: "categories", label: "照片分類標題", maxLength: 120 },
      { key: "allProcesses", label: "全部流程", maxLength: 120 },
      { key: "allGuests", label: "全部訪客", maxLength: 120 },
      { key: "photosCount", label: "照片數量單位", maxLength: 60 },
      { key: "loadMore", label: "載入更多按鈕", maxLength: 120 },
      {
        key: "weddingNote",
        label: "婚禮流程預設說明",
        maxLength: 800,
        multiline: true,
      },
      {
        key: "guestNote",
        label: "訪客上傳預設說明",
        maxLength: 800,
        multiline: true,
      },
      {
        key: "lifeNote",
        label: "生活照預設說明",
        maxLength: 800,
        multiline: true,
      },
    ],
  },
  {
    id: "states",
    label: "空白與系統狀態",
    fields: [
      { key: "emptyTitle", label: "沒有照片時的標題", maxLength: 200 },
      {
        key: "emptyBody",
        label: "沒有照片時的說明",
        maxLength: 700,
        multiline: true,
      },
      { key: "comingSoon", label: "即將推出標籤", maxLength: 120 },
      {
        key: "comingBody",
        label: "即將推出說明",
        maxLength: 900,
        multiline: true,
      },
      { key: "errorTitle", label: "載入失敗標題", maxLength: 200 },
      {
        key: "errorBody",
        label: "載入失敗說明",
        maxLength: 900,
        multiline: true,
      },
      { key: "offlineTitle", label: "離線標題", maxLength: 200 },
      {
        key: "offlineBody",
        label: "離線說明",
        maxLength: 900,
        multiline: true,
      },
      { key: "closedTitle", label: "暫停開放標題", maxLength: 200 },
      {
        key: "closedBody",
        label: "暫停開放說明",
        maxLength: 900,
        multiline: true,
      },
    ],
  },
];

export const SITE_COPY_TITLE_KEY = "archive";

export const DEFAULT_SITE_COPY = {
  zh: {
    headerEyebrow: "LEON & YEHY · WEDDING ARCHIVE",
    archive: "詠葉婚禮照片檔案館",
    subtitle: "一座安靜收藏笑聲、祝福與相遇的婚禮檔案館",
    date: "二〇二六年六月二十日",
    categories: "照片分類",
    allProcesses: "全部流程",
    allGuests: "全部訪客",
    photosCount: "張照片",
    loadMore: "載入更多回憶",
    weddingNote: "依照婚禮當天流程整理的正式照片與已分類訪客照片。",
    guestNote: "訪客照片會依照上傳時填寫的姓名自動分組。",
    lifeNote: "婚禮之外的日常片刻。",
    emptyTitle: "這個分類還在等待照片",
    emptyBody: "回憶會慢慢被收藏進來。",
    comingSoon: "尚未開放",
    comingBody:
      "人物分類與自拍找照片目前尚未開放。現在不會要求自拍，也不會進行人臉辨識。",
    errorTitle: "檔案館暫時無法開啟",
    errorBody: "請稍後再試，已收藏的照片不會受到影響。",
    offlineTitle: "目前沒有網路",
    offlineBody: "重新連線後，檔案館會繼續載入。",
    closedTitle: "檔案館目前暫停開放",
    closedBody: "管理員完成整理後會再次開放瀏覽。",
  },
  en: {
    headerEyebrow: "LEON & YEHY · WEDDING ARCHIVE",
    archive: "The Leon & YehYeh Wedding Archive",
    subtitle:
      "A quiet archive of laughter, blessings, and the people who shared our day",
    date: "20 June 2026",
    categories: "Photo collections",
    allProcesses: "All moments",
    allGuests: "All guests",
    photosCount: "photos",
    loadMore: "Load more memories",
    weddingNote:
      "Official wedding photos and guest photos that were classified into a wedding moment.",
    guestNote: "Guest photos are grouped automatically by the name entered during upload.",
    lifeNote: "Everyday memories outside the wedding.",
    emptyTitle: "This collection is waiting for photos",
    emptyBody: "Memories will be carefully added here.",
    comingSoon: "Not available yet",
    comingBody:
      "People and selfie search are not available yet. No selfie is requested and no face recognition is performed now.",
    errorTitle: "The archive is temporarily unavailable",
    errorBody: "Please try again later. Stored photos are not affected.",
    offlineTitle: "You are offline",
    offlineBody: "The archive will continue loading after you reconnect.",
    closedTitle: "The archive is temporarily closed",
    closedBody: "It will reopen after the administrators finish arranging it.",
  },
};

const FIELD_LIMITS = new Map(
  SITE_COPY_GROUPS.flatMap((group) =>
    group.fields.map((field) => [field.key, field.maxLength]),
  ),
);

function textLength(value) {
  return Array.from(value).length;
}

function truncateText(value, maxLength) {
  return Array.from(value).slice(0, maxLength).join("");
}

function normalizeText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return truncateText(normalized, maxLength);
}

export function normalizeSiteCopy(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    ["zh", "en"].map((language) => {
      const languageSource =
        source[language] &&
        typeof source[language] === "object" &&
        !Array.isArray(source[language])
          ? source[language]
          : {};
      return [
        language,
        Object.fromEntries(
          Object.entries(DEFAULT_SITE_COPY[language]).map(([key, fallback]) => [
            key,
            normalizeText(
              languageSource[key],
              fallback,
              FIELD_LIMITS.get(key) ?? 900,
            ),
          ]),
        ),
      ];
    }),
  );
}

export function normalizeSiteCopyPatch(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    ["zh", "en"].flatMap((language) => {
      const source = value[language];
      if (!source || typeof source !== "object" || Array.isArray(source)) return [];
      const fields = Object.fromEntries(
        Object.entries(source)
          .filter(
            ([key, fieldValue]) =>
              FIELD_LIMITS.has(key) && typeof fieldValue === "string",
          )
          .map(([key, fieldValue]) => [
            key,
            normalizeText(fieldValue, "", FIELD_LIMITS.get(key)),
          ]),
      );
      return Object.keys(fields).length ? [[language, fields]] : [];
    }),
  );
}

export function mergeSiteCopy(base, patch) {
  const current = normalizeSiteCopy(base);
  const normalizedPatch = normalizeSiteCopyPatch(patch);
  return Object.fromEntries(
    ["zh", "en"].map((language) => [
      language,
      { ...current[language], ...(normalizedPatch[language] ?? {}) },
    ]),
  );
}

export function isValidSiteCopy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  for (const language of ["zh", "en"]) {
    const copy = value[language];
    if (!copy || typeof copy !== "object" || Array.isArray(copy)) return false;
    for (const [key, limit] of FIELD_LIMITS) {
      if (typeof copy[key] !== "string" || textLength(copy[key]) > limit) return false;
    }
    if (Object.keys(copy).some((key) => !FIELD_LIMITS.has(key))) return false;
  }
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 24 * 1024;
}

export function isValidSiteCopyPatch(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  let fields = 0;
  for (const [language, patch] of Object.entries(value)) {
    if (!["zh", "en"].includes(language)) return false;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return false;
    for (const [key, fieldValue] of Object.entries(patch)) {
      const limit = FIELD_LIMITS.get(key);
      if (
        !limit ||
        typeof fieldValue !== "string" ||
        textLength(fieldValue) > limit
      ) {
        return false;
      }
      fields += 1;
    }
  }
  return fields > 0 && new TextEncoder().encode(JSON.stringify(value)).byteLength <= 24 * 1024;
}
