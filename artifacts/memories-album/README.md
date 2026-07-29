# Standalone Memories album

This artifact owns the independent wedding archive at `/Memories/` and the isolated API namespace at `/Memories/api/*`.

## Stack and ownership

- React + Vite frontend with shared React state
- Node HTTP server
- PostgreSQL query index, audit log, durable upload state and cleanup jobs
- Google Drive originals and derivatives through Replit Google Drive Integration
- Node test runner and dedicated GitHub Actions workflow

Google Drive is the storage source of truth for Memories media. PostgreSQL is the query source of truth for public visibility, ordering, collections, process relationships, upload batches, durable upload state, settings and seven-day retention. Browser responses use opaque Memories IDs and controlled media URLs only.

## Hard boundary

This artifact must not import from or modify:

- `artifacts/wedding-invitation/**`
- the legacy `/api/photos*` implementation
- legacy Replit Object Storage photo-wall files

The CI boundary workflow must pass for every Memories change.

## Implemented Phase 1 behavior

- Responsive waterfall gallery with true 12-item opaque cursor pages
- 480/960 WebP responsive thumbnails and prioritized above-the-fold images
- Full-screen viewer with bounded pan/zoom, keyboard, swipe, pinch, retry and safe-area layout
- Wedding, guest-upload and life-photo collections
- Google Drive-derived wedding process names and ordering
- Required but non-public guest name; 30-photo preview/removal, progress, stable IDs and bounded retry
- Private batch management, withdrawal and token rotation
- Recoverable runtime initialization and separate liveness/readiness endpoints
- 30-minute HttpOnly/Secure/SameSite admin session, album closure, single/bulk photo management, audit and rate limits
- Recoverable seven-day trash with restore, leases, idempotent Drive cleanup and persistent retry
- Accessible dialogs with focus trapping, background inert state, Escape and focus restoration
- React shared state without document-wide observers, hidden DOM clicks or App remounts
- CSP, browser security headers, upload throttling and metadata-sanitized public media
- Traditional Chinese and English UI

The code and Node-test implementation for #5, #6, #7, #49 and #51 is
complete on this branch. #48 and #50 have their core implementation, but still
need the required browser-level viewport, offline, accessibility and performance
evidence plus iOS/Android device checks under #48, #50 and #13. Legacy-site
regression evidence remains #19, and visual comparison remains #26. Face
processing, People and Find-me remain Phase 2 (#24).

## Commands

Run from the repository root:

```bash
pnpm --filter @workspace/memories-album dev
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
```

The live Drive smoke test must run only in a configured Replit environment:

```bash
pnpm --filter @workspace/memories-album test:drive-live
```

## Production configuration

Required Replit Production Secrets:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Optional tuning:

```text
MEMORIES_RUNTIME_RETRY_DELAY_MS
MEMORIES_DRIVE_SYNC_INTERVAL_MS
MEMORIES_THUMBNAIL_BATCH_SIZE
MEMORIES_THUMBNAIL_MAX_PER_RUN
MEMORIES_TRASH_CLEANUP_INTERVAL_MS
MEMORIES_TRASH_CLEANUP_BATCH_SIZE
MEMORIES_TRASH_CLEANUP_LEASE_MS
```

The runtime discovers or creates `訪客上傳`, `生活照`, `系統縮圖` and `00 未分類` below the configured root. Do not add separate provider folder IDs to source code or `.replit`.

Do not add service-account JSON, `GOOGLE_APPLICATION_CREDENTIALS`, OAuth client secrets, refresh tokens, raw guest-management tokens or the real administrator password to the repository.

## Runbooks

- [`../../docs/memories/launch-readiness.md`](../../docs/memories/launch-readiness.md)
- [`../../docs/memories/mobile-acceptance.md`](../../docs/memories/mobile-acceptance.md)
- [`../../docs/memories/admin-security.md`](../../docs/memories/admin-security.md)
- [`../../docs/memories/trash-retention.md`](../../docs/memories/trash-retention.md)
