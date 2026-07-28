const CURSOR_VERSION = 1;

export function encodePhotoCursor(photo) {
  if (!photo?.createdAt || !photo?.id) return null;
  const payload = JSON.stringify({
    v: CURSOR_VERSION,
    createdAt: new Date(photo.createdAt).toISOString(),
    id: String(photo.id),
  });
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodePhotoCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (
      parsed?.v !== CURSOR_VERSION ||
      typeof parsed.id !== "string" ||
      typeof parsed.createdAt !== "string" ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      throw new Error("Invalid cursor payload");
    }
    return { id: parsed.id, createdAt: new Date(parsed.createdAt).toISOString() };
  } catch {
    const error = new Error("Invalid photo cursor");
    error.code = "INVALID_CURSOR";
    throw error;
  }
}
