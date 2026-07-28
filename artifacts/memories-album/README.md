# Standalone Memories album

This artifact owns the independent wedding archive at `/Memories/` and the isolated API namespace at `/Memories/api/*`.

## Current stack

- React + Vite frontend
- Node HTTP server
- PostgreSQL index and durable upload state
- Google Drive originals and WebP thumbnails
- Replit Google Drive Integration through `@replit/connectors-sdk`
- Node test runner and a dedicated GitHub Actions workflow

Google Drive is the storage source of truth for Memories media. PostgreSQL is the query source of truth for public visibility, ordering, collections, process relationships, upload batches, durable upload state and settings. Browser responses use opaque Memories IDs and controlled media URLs only.

## Hard boundary

This artifact must not import from or modify:

- `artifacts/wedding-invitation/**`
- the legacy `/api/photos*` implementation
- legacy Replit Object Storage photo-wall files

The CI boundary workflow must pass for every Memories change.

## Implemented

- Responsive waterfall gallery with thumbnail delivery
- Full-screen original viewer with keyboard, swipe, wheel, double-click and pinch controls
- Wedding, guest-upload and life-photo collections
- Google Drive-derived wedding process names and ordering
- Required-name multi-photo upload with per-file progress, stable upload IDs and bounded retry
- EXIF orientation normalization and metadata-stripped guest uploads
- Capture-created chronological ordering
- Production migration preflight and background Drive reconciliation
- Shared-secret admin session validation, process management, UI setting and photo deletion

## Known incomplete Phase 1 work

- `/Memories/manage/:batchId` does not yet provide the private management/withdrawal UI or API (#5).
- Album closure and the final admin/audit/session model are incomplete (#6).
- Current admin photo deletion is immediate; seven-day trash/restore/cleanup is not implemented (#7).
- Mobile dialog/lightbox safe-area and focus work remains (#48).
- A rejected first runtime initialization remains cached until restart (#49).
- The client currently fetches all cursor pages before client-side paging (#50).
- Several frontend surfaces still communicate through document-wide observers and hidden DOM clicks (#51).
- Production mobile/visual acceptance remains under #13 and #26.

Face processing, People and Find-me are deferred to Phase 2 (#24).

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
MEMORIES_DRIVE_SYNC_INTERVAL_MS
MEMORIES_THUMBNAIL_BATCH_SIZE
MEMORIES_THUMBNAIL_MAX_PER_RUN
```

The runtime discovers or creates `訪客上傳`, `生活照`, `系統縮圖` and `00 未分類` below the configured root. Do not add separate provider folder IDs to source code or `.replit`.

Do not add service-account JSON, `GOOGLE_APPLICATION_CREDENTIALS`, OAuth client secrets, refresh tokens, raw guest-management tokens or the real administrator password to the repository.
