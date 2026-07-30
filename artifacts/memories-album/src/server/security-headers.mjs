export const DOCUMENT_SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
});

export function applyDocumentSecurityHeaders(response) {
  for (const [name, value] of Object.entries(DOCUMENT_SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }
}
