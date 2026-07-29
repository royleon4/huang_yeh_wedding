# Memories administrator security

## Approved Phase 1 model

Memories keeps the existing shared administrator secret in the Replit Production Secret `MEMORIES_ADMIN_TOKEN`. It does not add an identity provider or place the secret in the repository or browser bundle.

The browser sends the shared secret only to `POST /Memories/api/admin/session`. A successful exchange returns a signed, 30-minute session cookie with:

- `HttpOnly`
- `Secure`
- `SameSite=Strict`
- `Path=/Memories`

The raw secret is not stored in `localStorage` or `sessionStorage` and is not accepted by other administrator endpoints. Signing uses HMAC-SHA256; changing `MEMORIES_ADMIN_TOKEN` invalidates every existing session. Signing out clears the cookie.

This is the owner-approved Phase 1 boundary, not a selection of a third-party authentication provider. A later move to individual administrator identities can replace the auth interface without changing public or Drive contracts.

## Rate limits

- Login exchange: 10 requests per client address per 10 minutes.
- Authenticated settings, process, photo and upload-batch administration: 60 requests per client address per minute for each API surface.
- Guest batch creation: 20 requests per client address per 10 minutes.
- Guest photo upload: 120 requests per client address per hour.

Rate-limited responses use `429`, `Retry-After` and a bounded `RATE_LIMITED` code. Login responses never echo the supplied password.

## Album closure

The `album_open` setting defaults to `true`.

When closed, guest photo listing/media, upload creation/file upload, private batch management and later selfie paths return:

```json
{
  "error": "The Memories album is currently closed",
  "code": "ALBUM_CLOSED"
}
```

An authenticated administrator session retains access. Closure does not change the legacy invitation site or legacy `/api/photos*` routes.

## Audit trail

Administrative and destructive changes write to `memories_admin_audit_log` with:

- actor
- timestamp
- action
- target type and ID
- bounded before state
- bounded after state

Raw administrator passwords, session cookies, guest management tokens, token hashes, Drive file IDs, connector bodies and database URLs must never be placed in audit state.

## Private link operations

The administrator batch panel can inspect recent batches and upload-item status, revoke a link, or generate a replacement. A replacement token is returned once inside the URL fragment. The old token stops working immediately, and neither token nor its hash appears in list responses or audit records.

Guest names are required for private batch ownership and administration, but public photo list responses always return `uploaderName: null` for guest media.

## Browser and media policy

- HTML and API responses set CSP, Referrer-Policy, Permissions-Policy, X-Frame-Options, COOP/CORP and HSTS.
- The client loads no Google Fonts or other external style/font origin.
- `PublicMediaService` decodes and re-encodes Drive originals before public delivery, removing EXIF/GPS and orientation metadata.
- A broken thumbnail may fall back only to the same sanitized public-media output, never the raw Drive original.
