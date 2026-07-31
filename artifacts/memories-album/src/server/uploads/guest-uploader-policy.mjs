export const RESERVED_GUEST_UPLOADER_NAME = "婚禮攝影";

export function normalizeGuestUploaderName(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function isReservedGuestUploaderName(value) {
  return normalizeGuestUploaderName(value) === RESERVED_GUEST_UPLOADER_NAME;
}
