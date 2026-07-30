---
name: Current Memories project architecture
updated: 2026-07-30
description: Canonical routes, ownership, guest grouping, process videos, admin deletion, save workflow, deployment, security and limitations for standalone Memories.
---

# Baseline and boundary

Treat `royleon4/huang_yeh_wedding` branch `main` as the primary source for 詠葉的婚禮.

Two isolated systems exist:

- Legacy invitation/photo wall: `artifacts/wedding-invitation/**` and legacy `/api/photos*` in `artifacts/api-server`.
- Standalone Memories: `artifacts/memories-album/**` and `/Memories/*`.

Never modify or import legacy photo-wall code for a Memories task unless the repo owner explicitly approves it. The legacy-boundary workflow enforces this.

# Canonical routes

- Gallery: `/Memories/`
- Health: `/Memories/api/health`
- Public API: `/Memories/api/*`
- Admin login: `/Memories/admin/login`
- Admin page: `/Memories/admin/`
- Admin session: `/Memories/admin/api/session`
- Global admin save: `PATCH /Memories/admin/api/changes`
- Photo permanent delete: `DELETE /Memories/admin/api/photos/:id`
- Other admin APIs: `/Memories/admin/api/albums*`, `/photos*`, `/categories*`
- Lowercase `/memories/*` redirects to `/Memories/*`.
- Old `/admin*` is compatibility-only.

Replit routes these paths to port 19316. Health must use `/Memories/api/health`.

# Required production configuration

Exact Production Secret names:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Never use `SECRET_TOKEN`. Missing `MEMORIES_ADMIN_TOKEN` causes `503 ADMIN_TOKEN_NOT_CONFIGURED` before password comparison.

Replit Google Drive Integration must be connected. Do not introduce service-account JSON, OAuth client secrets, refresh tokens or `GOOGLE_APPLICATION_CREDENTIALS`.

# Data ownership

- Drive owns originals, WebP thumbnails and numbered wedding-process folders.
- PostgreSQL owns visibility, ordering, albums, process relationships, per-process YouTube settings, upload batches, durable upload state, settings, admin overrides and login failure limits.
- Browser receives opaque Memories UUIDs and controlled media URLs only.
- Numbered Drive folders are canonical for process labels/order.
- Reserved folders: `00 未分類`, `訪客上傳`, `生活照`, `系統縮圖`.
- Guest originals stay in `訪客上傳`; uploader-name subcategories are derived from PostgreSQL photo metadata.
- Manual Drive photo deletion is not complete website deletion; DB public rows, separate thumbnails and browser cache may remain.
- Use the administrator permanent-delete endpoint for complete single-photo deletion.

# Gallery

- Order: `created_at ASC, id ASC`.
- Drive import time: capture time, then Drive creation time, then modified time.
- Visual order: left-to-right, top-to-bottom.
- Measured CSS Grid masonry reduces gaps without cropping.
- Duplicate top navigation is hidden; bottom navigation remains.
- Guest uploads automatically expose uploader-name filters as `Name (count)` plus an all-guests count.
- Selecting a wedding process with `youtube_video_id` renders a privacy-enhanced YouTube iframe before the photos, followed immediately by a divider.
- Mobile video uses a centered full-row 16:9 frame.
- Optional autoplay is sent with `mute=1` and `playsinline=1`.
- CSP permits frames only from `https://www.youtube-nocookie.com`.
- Five title taps in about 3.5 seconds check the nested admin session and open admin/login.

# Guest upload

- Name required; up to 30 files, 25 MB each.
- JPEG, PNG, WebP, HEIC, HEIF.
- One file per request.
- Visitor UI no longer offers process/life classification; completed uploads are grouped automatically by normalized uploader name.
- Stable client upload IDs and `memories_upload_items` prevent duplicate Drive files.
- `sharp` validates, normalizes orientation, strips metadata and creates WebP.
- Drive 429/5xx use bounded exponential backoff.
- DB stores only management-token hash; raw token is returned in the private URL fragment.

# Administrator authentication

- Password is `MEMORIES_ADMIN_TOKEN`.
- POST sends it only in Bearer Authorization.
- Success returns a 30-minute HMAC cookie: `HttpOnly; Secure; SameSite=Strict; Path=/Memories/admin`.
- Login limits use `memories_admin_login_failures` across Autoscale instances.
- `ADMIN_RATE_LIMIT_UNAVAILABLE` means the PostgreSQL limiter/table failed.
- Login session creation must not depend on Drive runtime.

# Administrator draft/save workflow

- Album, category, process-video, photo, ordering and new-record edits remain local React draft state.
- A persistent footer displays pending operation count.
- `儲存所有變更` compares original and draft data and sends changed general JSON fields to `PATCH /Memories/admin/api/changes`.
- Per-process YouTube settings use the protected category item endpoint during the same global save action.
- Successful operations are removed from draft state; failures remain pending for retry.
- Drive-backed category/photo operations can partially fail without falsely marking the full batch successful.
- New photo binary upload occurs after the JSON batch; failed files remain selected.
- Reload, leaving the archive and logout protect unsaved changes.

Current admin supports create/edit albums; create/rename/reorder Drive categories; assign/clear process YouTube links and muted autoplay; one official-photo upload; photo name/time/visibility/album/category editing; permanent single-photo deletion; cross-tab global save; partial-failure retry.

Permanent photo deletion is immediate and irreversible. It deletes the thumbnail and original Drive files, clears durable upload references, removes process/album relationships and deletes the PostgreSQL photo row. Drive 404 is treated as already deleted; other Drive errors stop database deletion.

Current admin does not expose batch deletion, album deletion, category deletion or trash/restore.

# Runtime and synchronization

`getMemoriesRuntime()` caches one initialization Promise. Runtime creation validates settings, applies migrations, creates PostgreSQL/Drive adapters, ensures reserved folders, returns APIs, then starts background reconciliation and thumbnail backfill.

Default sync is 300000 ms, minimum 60000 ms. A rejected first runtime initialization can remain cached until restart; after correcting configuration, restart/re-publish until recovery work is implemented.

Reconciliation imports numbered folders/photos, deactivates missing process folders and backfills thumbnails. It does not currently deactivate missing Drive photo rows. Process YouTube settings are PostgreSQL-owned and survive Drive folder reconciliation.

# Migrations

Immutable tracked SQL: `db/001_...sql` through `010_...sql`.

- Migration 010 adds `youtube_video_id` and `youtube_autoplay` to `memories_processes`.
- Tracking table: `memories_schema_migrations`.
- Applied checksum changes are rejected.
- Advisory lock prevents concurrent migration races.
- Production listens only after migration success.
- Build copies server modules and `db/` into `dist/`.
- Replit `postMerge` runs the same `db:migrate` against development when `DATABASE_URL` exists.
- Never use `drizzle-kit push` for Memories tables.
- If Replit proposes destructive DROP because development is behind production, cancel, run tracked `db:migrate`, and publish again. Never copy development data over production unless replacement is intentional.

# Verification

```bash
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

Every Memories PR must pass standalone tests/build/production health smoke and legacy boundary.
