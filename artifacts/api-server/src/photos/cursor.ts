import type { PhotoCursor } from "./repository";

export function encodePhotoCursor(cursor: PhotoCursor): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
  ).toString("base64url");
}

export function decodePhotoCursor(value: string): PhotoCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid photo cursor");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("createdAt" in parsed) ||
    !("id" in parsed) ||
    typeof parsed.createdAt !== "string" ||
    typeof parsed.id !== "string"
  ) {
    throw new Error("Invalid photo cursor");
  }
  const createdAt = new Date(parsed.createdAt);
  if (
    Number.isNaN(createdAt.getTime()) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      parsed.id,
    )
  ) {
    throw new Error("Invalid photo cursor");
  }
  return { createdAt, id: parsed.id };
}
