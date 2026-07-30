# Standalone Memories album

`@workspace/memories-album` owns the independent wedding archive under `/Memories/`: public gallery, guest uploads, private batch management, administrator application, Node HTTP APIs, immutable PostgreSQL migrations, and Google Drive media storage.

It does **not** own the legacy invitation photo wall or legacy `/api/photos*` Object Storage implementation.

## Canonical routes

| Route | Purpose |
| --- | --- |
| `/Memories/` | Public gallery |
| `/Memories/api/health` | Lightweight healthcheck without full runtime initialization |
| `/Memories/api/albums` | Public album metadata |
| `/Memories/api/processes` | Public process, video and rich-content metadata |
| `/Memories/api/photos*` | Public listing and controlled image streaming |
| `/Memories/api/upload-batches*` | Guest batches and per-photo uploads |
| `/Memories/manage/:batchId#token=...` | Private batch management and permanent deletion |
| `/Memories/admin/login` | Administrator login |
| `/Memories/admin/` | Administrator application |
| `/Memories/admin/api/session` | Login, session and logout |
| `/Memories/admin/api/changes` | Patch-style global save API |
| `/Memories/admin/api/albums*` | Album API |
| `/Memories/admin/api/photos*` | Photo list, batch classification, edit and permanent-delete API |
| `/Memories/admin/api/categories*` | Drive-backed process and video API |
| `/Memories/admin/api/process-content*` | Process rich text and attachment API |
| `/Memories/admin/api/settings` | UI, ordering, pinned-photo and upload-mode settings |
| `/admin*` | Compatibility redirects only |

The Replit artifact router sends Memories routes to port 19316. Production health must target `/Memories/api/health`, not an authenticated administrator page.

## Stack

- React 19 + Vite
- Node.js 24 HTTP server
- PostgreSQL
- Google Drive through `@replit/connectors-sdk`
- `sharp` image normalization and WebP thumbnails
- Busboy multipart parsing
- Tiptap rich-content editor
- Node test runner and GitHub Actions

## Source of truth

Google Drive owns original files, generated thumbnails, attachments and numbered process folders. PostgreSQL owns public visibility, album/process relationships, capture time, author, process videos/articles, upload batches, token hashes, content hashes, resumable-upload state, settings, administrator overrides and login rate limits.

Reserved folders:

```text
00 未分類
訪客上傳
生活照
系統縮圖
```

Browser payloads expose Memories UUIDs and controlled image routes. Drive IDs, folder IDs, connector details, credentials and raw private tokens remain server-side.

## Public gallery

- Only `visibility = 'public'` rows are returned publicly.
- Album-specific ordering supports random, time ascending/descending, photo name ascending/descending and author ascending/descending.
- Random ordering remains stable for the current page load.
- Wedding process media can contain video, bilingual rich text, attachments, pinned photos and the continuous photo wall.
- General settings control media ordering.
- Traditional process buttons are the default; an optional centered wheel can be enabled and given a mobile density target.
- Public, pinned and private-management thumbnails use IntersectionObserver-based lazy loading. The network `src` is withheld until an image approaches the viewport.
- Explicit “load more memories” pagination remains in place to prevent unbounded React and DOM growth.
- Missing thumbnails can be repaired and may temporarily fall back to the original with `no-store`.

## Guest upload

1. Create a PostgreSQL upload batch.
2. Assign every selected file a stable `clientUploadId`.
3. Send one multipart request per photo, with up to three photos active at once.
4. Stream the request to a temporary file and normalize it with `sharp`.
5. Claim durable `(batch_id, client_upload_id)` state and record a SHA-256 content hash.
6. Upload the original through a Drive resumable session.
7. Insert the completed photo and allow the background thumbnail service to build the derivative.

Limits and behavior:

- Maximum 10 selected guest photos per batch.
- JPEG, PNG, WebP, HEIC and HEIF; 25 MB per file.
- Administrator setting can allow Guest-only, Life or wedding-process classification; disabled mode falls back to Guest uploads.
- Same filename with different bytes is allowed. Duplicate identity is content-based, never filename-based.
- First pass allows two attempts per file. Retryable failures release the worker and enter the deferred pass after every photo has had a turn.
- Deferred pass allows two more attempts. Permanent validation failures are not retried.
- Offline waiting does not consume an attempt.
- Manual “continue unfinished photos” reuses the same batch, upload ID and Drive session.

## Drive upload modes

New originals always use a resumable session. The General administrator setting selects:

- `single` — default; one complete-file PUT within the resumable session.
- `chunked` — 4 MiB chunks with persisted session URI, byte offset and update timestamp.

An in-progress item keeps the mode with which it started. Session state queries and deterministic Drive names recover accepted work without creating duplicate files.

## Private batch management

The management token is carried in the URL fragment and sent as a Bearer token. PostgreSQL stores only its hash.

The uploader can:

- list photos belonging to that exact batch;
- permanently delete an individual photo;
- rotate the private link, immediately invalidating the old token.

Permanent deletion removes the Drive thumbnail and original, photo relationships, database row and pinned-photo references. A non-404 Drive failure stops database deletion so the client cannot receive a false success response.

## Administrator application

The production secret is:

```text
MEMORIES_ADMIN_TOKEN
```

Successful login creates a 30-minute HMAC-signed cookie:

```text
HttpOnly; Secure; SameSite=Strict; Path=/Memories/admin
```

Current administrator capabilities:

- create and edit albums;
- control album summaries, visibility and photo ordering;
- create, rename and reorder Drive-backed processes;
- edit process video, autoplay, bilingual Tiptap content, attachments and divider spacing;
- select and order up to three pinned photos per process;
- filter photos by album, process and author;
- batch-upload up to 30 administrator photos through the reliable guest upload core, then finalize album/process memberships;
- edit display name, capture time, author, visibility, albums and process;
- permanently delete the complete photo family from every album/process;
- refresh a selected album or process by deleting only generated thumbnails, rescanning originals and rebuilding derivatives;
- keep JSON edits in local drafts and submit only changed fields through the global save action.

The author `婚禮攝影` receives front-end and server-side deletion protection.

## Background synchronization

After readiness, reconciliation runs in the background and every five minutes by default, never more often than once per minute. It discovers reserved folders, imports numbered process folders and photos, deactivates missing process folders and backfills thumbnails.

Manual Drive deletion does not currently deactivate the corresponding PostgreSQL photo automatically. Use the administrator or private-management delete action for complete cleanup.

## Migrations

Tracked migrations live under `db/` and currently extend through `013_drive_resumable_upload.sql`.

The runner:

- records filename and SHA-256 checksum;
- refuses modification of already-applied files;
- uses a PostgreSQL advisory lock;
- applies only pending files;
- starts production listening only after success.

Never use `drizzle-kit push` for Memories tables. A publish plan containing `DROP TABLE`, `DROP COLUMN` or removal of existing constraints must be cancelled.

## Required production configuration

Connect Replit Google Drive Integration and set:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Optional:

```text
MEMORIES_DRIVE_SYNC_INTERVAL_MS=300000
MEMORIES_THUMBNAIL_BATCH_SIZE=12
MEMORIES_THUMBNAIL_MAX_PER_RUN=240
MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID=
MEMORIES_TRUST_PROXY=1
MEMORIES_SKIP_MIGRATIONS=1
```

## Commands

```bash
pnpm install
pnpm --filter @workspace/memories-album dev
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

`test:drive-live` must run only in a configured Replit environment against a safe folder.

## CI and architecture debt

Standalone CI runs Node tests, a production build and a real server health smoke. The legacy-boundary workflow protects the invitation and old photo API.

The largest remaining architecture risk is the collection of Vite pre-transforms that mutate `App.jsx` and `AdminApp.jsx` through exact string replacement. Treat these as a temporary compatibility boundary. Any transform change should validate the complete production transform chain and a real browser render.

Detailed smells and the staged extraction plan are documented in [`../../docs/code-health-audit-2026-07.md`](../../docs/code-health-audit-2026-07.md).

This documentation-only and dead-code cleanup introduces no database schema change, no migration and no DROP statement.
