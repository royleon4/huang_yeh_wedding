import { timingSafeEqual } from "node:crypto";

export function adminAuthorized(request, configuredToken) {
  const header = request.headers.authorization;
  const supplied =
    typeof header === "string"
      ? (header.match(/^Bearer\s+(.+)$/i)?.[1] ?? "")
      : "";
  if (!configuredToken || !supplied) return false;

  const expectedBytes = Buffer.from(configuredToken);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export function sendAdminJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}
