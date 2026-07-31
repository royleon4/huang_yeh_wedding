export const MIN_UPLOAD_PHOTOS = 1;
export const MAX_SUPPORTED_UPLOAD_PHOTOS = 100;
export const UPLOAD_DESCRIPTION_MAX_LENGTH = 800;

export const DEFAULT_UPLOAD_DESCRIPTION = Object.freeze({
  zh: "支援 JPEG、PNG、WebP、HEIC／HEIF；每張上限 25 MB。照片逐張傳送並使用固定識別碼，重新嘗試不會重複建立 Drive 檔案。",
  en: "JPEG, PNG, WebP, HEIC and HEIF are accepted, up to 25 MB each. Stable upload IDs prevent duplicate Drive files when a request is retried.",
});

export const DEFAULT_UPLOAD_SETTINGS = Object.freeze({
  guestUploadMaxPhotos: 10,
  adminUploadMaxPhotos: 30,
  uploadDescription: DEFAULT_UPLOAD_DESCRIPTION,
});

function boundedInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isInteger(normalized) &&
    normalized >= MIN_UPLOAD_PHOTOS &&
    normalized <= MAX_SUPPORTED_UPLOAD_PHOTOS
    ? normalized
    : fallback;
}

function normalizedDescription(value, fallback) {
  if (typeof value !== "string") return fallback;
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, UPLOAD_DESCRIPTION_MAX_LENGTH);
}

export function normalizeUploadDescription(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    zh: normalizedDescription(source.zh, DEFAULT_UPLOAD_DESCRIPTION.zh),
    en: normalizedDescription(source.en, DEFAULT_UPLOAD_DESCRIPTION.en),
  };
}

export function normalizeUploadSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    guestUploadMaxPhotos: boundedInteger(
      source.guestUploadMaxPhotos,
      DEFAULT_UPLOAD_SETTINGS.guestUploadMaxPhotos,
    ),
    adminUploadMaxPhotos: boundedInteger(
      source.adminUploadMaxPhotos,
      DEFAULT_UPLOAD_SETTINGS.adminUploadMaxPhotos,
    ),
    uploadDescription: normalizeUploadDescription(source.uploadDescription),
  };
}

export function isValidUploadMaxPhotos(value) {
  const normalized = Number(value);
  return (
    Number.isInteger(normalized) &&
    normalized >= MIN_UPLOAD_PHOTOS &&
    normalized <= MAX_SUPPORTED_UPLOAD_PHOTOS
  );
}

export function isValidGuestUploadMaxPhotos(value) {
  return isValidUploadMaxPhotos(value);
}

export function isValidAdminUploadMaxPhotos(value) {
  return isValidUploadMaxPhotos(value);
}

export function isValidUploadDescription(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.keys(value).some((key) => !["zh", "en"].includes(key))) return false;
  return ["zh", "en"].every(
    (language) =>
      typeof value[language] === "string" &&
      value[language].length <= UPLOAD_DESCRIPTION_MAX_LENGTH,
  );
}
