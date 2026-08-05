import { randomUUID } from "node:crypto";

const CONTENT_TYPE_TO_EXTENSION = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

const EXTENSION_TO_CONTENT_TYPE = new Map<string, string>(
  [...CONTENT_TYPE_TO_EXTENSION].map(([contentType, extension]) => [
    extension,
    contentType,
  ]),
);
EXTENSION_TO_CONTENT_TYPE.set("jpeg", "image/jpeg");

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORED_PHOTO_NAME =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9][A-Za-z0-9._-]{0,199})\.(jpe?g|png|webp|gif|heic|heif)$/i;

export class UnsupportedPhotoTypeError extends Error {
  readonly code = "UNSUPPORTED_PHOTO_TYPE";

  constructor(contentType: unknown) {
    super(`Unsupported photo content type: ${String(contentType || "unknown")}`);
    this.name = "UnsupportedPhotoTypeError";
  }
}

export function normalizedPhotoContentType(value: unknown): string | null {
  const contentType = String(value ?? "").trim().toLowerCase();
  return CONTENT_TYPE_TO_EXTENSION.has(contentType) ? contentType : null;
}

export function createStoredPhotoName(
  contentType: unknown,
  createId: () => string = randomUUID,
): string {
  const normalizedContentType = normalizedPhotoContentType(contentType);
  if (!normalizedContentType) throw new UnsupportedPhotoTypeError(contentType);
  const id = createId();
  if (!UUID_V4_PATTERN.test(id)) {
    throw new Error("Photo identifier generator returned an invalid UUID v4");
  }
  return `${id}.${CONTENT_TYPE_TO_EXTENSION.get(normalizedContentType)}`;
}

export function isStoredPhotoName(value: unknown): value is string {
  const filename = String(value ?? "");
  return (
    filename.length <= 220 &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    STORED_PHOTO_NAME.test(filename)
  );
}

export function contentTypeForStoredPhoto(
  filename: string,
  metadataContentType: unknown,
): string {
  const trustedMetadata = normalizedPhotoContentType(metadataContentType);
  if (trustedMetadata) return trustedMetadata;
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_CONTENT_TYPE.get(extension) ?? "application/octet-stream";
}
