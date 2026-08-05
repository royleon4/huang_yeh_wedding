export function invalidPathSegment(message = "The URL contains an invalid path segment") {
  const error = new Error(message);
  error.status = 400;
  error.code = "INVALID_PATH_SEGMENT";
  return error;
}

export function decodePathSegment(value, { allowSlash = false } = {}) {
  if (typeof value !== "string" || value.length === 0) {
    throw invalidPathSegment();
  }
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw invalidPathSegment("The URL contains malformed percent encoding");
  }
  if (
    !decoded ||
    decoded.includes("\0") ||
    (!allowSlash && (decoded.includes("/") || decoded.includes("\\")))
  ) {
    throw invalidPathSegment();
  }
  return decoded;
}
