---
name: Current Memories project architecture
updated: 2026-07-29
description: Canonical routes, data ownership, deployment rules, security invariants and current limitations for the standalone Memories wedding album.
---

# Current project baseline

Treat `royleon4/huang_yeh_wedding` branch `main` as the primary source for the 詠葉的婚禮 project.

There are two isolated systems:

- Legacy invitation/photo wall: `artifacts/wedding-invitation/**` and legacy `/api/photos*` in `artifacts/api-server`.
- Standalone Memories: `artifacts/memories-album/**` and `/Memories/*`.

Never modify or import legacy invitation/photo-wall code for a Memories task unless the repo owner explicitly approves it. The Memories legacy-boundary CI enforces this.

# Canonical routes

- Public gallery: `/Memories/`
- Health: `/Memories/api/health`
- Public API: `/Memories/api/*`
- Admin login: `/Memories/admin/login`
- Admin page: `/Memories/admin/`
- Admin API: `/Memories/admin/api/*`
- Lowercase `/memories/*` redirects to `/Memories/*`.
- Old `/admin*` is compatibility-only and redirects to `/Memories/admin*`.

Replit routes these paths to the Memories service on port 19316. The healthcheck must use `/Memories/api/health`, not `/memories` or an admin page.

# Required production configuration

The exact Replit Production Secret names are:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Never use `SECRET_TOKEN` for the Memories admin password. A missing `MEMORIES_ADMIN_TOKEN` causes `503 ADMIN_TOKEN_NOT_CONFIGURED` before password comparison.

The Replit Google Drive Integration must also be connected. Do not introduce service-account JSON, OAuth client secrets, refresh tokens or `GOOGLE_APPLICATION_CREDENTIALS`.

# Data ownership

- Google Drive owns original media, generated WebP thumbnails and numbered wedding-process folder metadata.
- PostgreSQL owns queryable public state, ordering, visibility, albums, process relationships, upload batches, durable upload state, settings and administrator overrides.
- Browser clients receive opaque Memories UUIDs and controlled media URLs only.
- Numbered Drive folders such as `01 進場` are canonical for process labels and order.
- Reserved Drive folders: `00 未分類`, `訪客上傳`, `生活照`, `系統縮圖`.
- Guest originals stay physically in `訪客上傳`; wedding/life placement for guest photos is logical database classification.

Manual Drive deletion is not a complete website deletion. Current reconciliation deactivates missing process folders but does not automatically trash/deactivate missing photo rows. PostgreSQL records, separate thumbnails and browser cache may remain.

# Public gallery behavior

- Photos are ordered by `created_at ASC, id ASC`.
- Drive imports use capture time, then Drive creation time, then modified time.
- Visual order is row-major: left-to-right, then top-to-bottom.
- Measured CSS Grid masonry reduces gaps without cropping.
- The duplicate top navigation is hidden; bottom collection navigation remains.
- Five title taps within about 3.5 seconds check `/Memories/admin/api/session` and navigate to the admin or login page.

# Guest upload behavior

- Required uploader name.
- Up to 30 selected files, 25 MB each.
- JPEG, PNG, WebP, HEIC and HEIF.
- Files upload one at a time.
- Stable client upload IDs plus `memories_upload_items` prevent duplicate Drive files during retries.
- `sharp` validates, normalizes orientation, strips metadata and creates WebP thumbnails.
- Retryable Drive 429/5xx failures use bounded exponential backoff.
- The database stores only the management-token hash; the raw token is returned in the private URL fragment.

# Administrator security

- Login password is `MEMORIES_ADMIN_TOKEN`.
- Login POST sends it only in a Bearer header.
- Success returns a 30-minute HMAC-signed cookie with `HttpOnly; Secure; SameSite=Strict; Path=/Memories/admin`.
- Login failure limits use `memories_admin_login_failures` in PostgreSQL across Autoscale instances.
- `ADMIN_RATE_LIMIT_UNAVAILABLE` means the PostgreSQL limiter/table failed.
- Admin session creation must not depend on Google Drive runtime.

Current rebuilt admin supports create/edit albums; create/rename/reorder Drive categories; upload one official photo; edit name, capture time, visibility, albums and category. It currently does not expose photo deletion, batch deletion, album deletion, category deletion or trash/restore.

# Runtime and synchronization

`getMemoriesRuntime()` caches one initialization Promise. Runtime creation:

1. validates `DATABASE_URL` and `MEMORIES_DRIVE_PHOTOS_FOLDER_ID`;
2. applies tracked migrations unless `MEMORIES_SKIP_MIGRATIONS=1`;
3. creates PostgreSQL and Drive adapters;
4. discovers/creates reserved folders;
5. returns APIs;
6. starts Drive reconciliation and thumbnail backfill in the background;
7. repeats at `MEMORIES_DRIVE_SYNC_INTERVAL_MS`, default 300000 and minimum 60000.

A rejected first runtime initialization is currently cached until process restart; after correcting configuration, restart/re-publish until recovery work is implemented.

# Database migrations

Tracked immutable migrations live in `artifacts/memories-album/db/001_...sql` through `009_...sql`.

- Runner table: `memories_schema_migrations`.
- Applied file checksums must never change.
- PostgreSQL advisory lock prevents concurrent migration races.
- Production starts listening only after migration success.
- Build copies server modules and `db/` into `dist/`.
- Replit `postMerge` runs the same `db:migrate` against the development database when `DATABASE_URL` exists.
- Never use `drizzle-kit push` for Memories tables.
- If Replit proposes destructive DROP operations because development is behind production, cancel deployment, run `pnpm --filter @workspace/memories-album run db:migrate`, then publish again. Never copy development data over production unless replacement is intentional.

# Verification commands

```bash
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

Every Memories PR must pass standalone tests/build/production health smoke and the legacy-boundary workflow.
