# Standalone Memories album

`@workspace/memories-album` owns the independent wedding archive under `/Memories/`: public gallery, guest uploads, private batch management, administrator application, Node HTTP APIs, immutable PostgreSQL migrations, Google Drive media storage, and public appearance settings.

It does **not** own the legacy invitation photo wall or the legacy `/api/photos*` Object Storage implementation.

For role-based documentation, start at [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md).

## Canonical routes

Public routes use stable album, label, administrator-tab, and photo identities. Display order is presentation only; moving an item does not change its canonical URL.

| Route | Purpose |
| --- | --- |
| `/Memories/albums/wedding` | Wedding album |
| `/Memories/albums/guest` | Guest album and all-visitors view |
| `/Memories/albums/guest/labels/latest` | Virtual latest-guest-photos label |
| `/Memories/albums/guest/labels/Leon` | URL-encoded normalized guest-name label |
| `/Memories/en/albums/guest` | English guest album |
| `.../photos/:photoId` | Open one photo on the current gallery route |
| `/Memories/upload` | Guest upload |
| `/Memories/en/upload` | English guest upload |
| `/Memories/manage/:batchId#token=...` | Private batch management and permanent deletion |
| `/Memories/admin/login` | Administrator login |
| `/Memories/admin/general` | General administrator tab |
| `/Memories/admin/albums` | Album administrator tab |
| `/Memories/admin/photos` | Photo administrator tab |
| `/Memories/admin/categories` | Category and video administrator tab |
| `/Memories/api/health` | Lightweight liveness endpoint |
| `/Memories/api/albums` | Public album metadata |
| `/Memories/api/processes` | Public process, video, and rich-content metadata |
| `/Memories/api/photos*` | Public listing and controlled image streaming |
| `/Memories/api/upload-batches*` | Guest batches and per-photo uploads |
| `/Memories/admin/api/*` | Administrator session, albums, photos, categories, content, assets, and settings APIs |
| `/admin*` | Compatibility redirects only |

`/Memories/` and `/Memories/en/` are compatibility roots for the first available album. Previous ordinal paths such as `/Memories/group2/subgroup3` and `/Memories/admin/group3`, plus older semantic process paths, remain migration aliases and are replaced with stable identity routes after resolution.

Opening a label URL directly, clicking a label, refreshing, and browser Back/Forward all restore the same identity and request gallery-anchor positioning. Missing or unavailable labels recover to their album; missing albums recover to the first available album. Full rules are in [`docs/logical-routes.md`](docs/logical-routes.md).

The Replit artifact router sends Memories routes to port 19316. Production health must target `/Memories/api/health`, not an authenticated or redirecting page.

## Stack

- React 19 + Vite 7
- Node.js 24 HTTP server
- PostgreSQL
- Google Drive through `@replit/connectors-sdk`
- `sharp` image normalization and WebP derivatives
- Busboy multipart parsing
- Tiptap rich-content editor
- Node test runner and GitHub Actions

## Source of truth

Google Drive owns original files, generated thumbnails, process attachments, and numbered process folders. PostgreSQL owns public visibility, album/process relationships, capture time, author, process videos/articles, upload batches, token hashes, content hashes, resumable-upload state, UI settings, editable site copy, appearance assets, administrator overrides, and login rate limits.

Reserved folders:

```text
00 未分類
訪客上傳
生活照
系統縮圖
```

Browser payloads expose Memories UUIDs and controlled media routes. Drive IDs, folder IDs, connector details, credentials, and raw private tokens remain server-side.

## Public bootstrap contract

`src/client/public-bootstrap.mjs` is the shared startup source for public configuration. Before the first public React render it requests, in parallel:

- `/Memories/api/albums`
- `/Memories/api/settings`
- `/Memories/api/processes`

The normalized snapshot is reused by the gallery, editable copy, site style, media ordering, pinned photos, traditional/wheel selector, wheel-loop settings, guest-label view model, and guest-upload classification UI. Components do not independently refetch the same settings after mount.

The resources fail independently. A failed endpoint uses a safe local fallback while successful results remain active. Fallback selection happens before React renders, avoiding a flash from bundled defaults to saved settings.

The editable site icon is loaded and applied through its controlled settings asset route. Public settings expose metadata, not stored image bytes.

## Appearance, icon, navigation, and viewer

The General administrator tab contains **樣式與首頁首圖**, **其他網站文字**, and **網站圖示**.

### Site style and hero

Administrators can edit:

- bilingual multiline site titles;
- a hero background image;
- hero overlay opacity from 0% through 95%;
- page, text, brand, detail, accent, hero, and bottom-navigation colors.

Hero uploads accept PNG, JPEG, and WebP up to 10 MB. The recommended source is a horizontal 16:9 image at 1600 × 900 or larger. The server applies orientation, center cover-crops to 1600 × 900, converts to WebP, and serves the asset through a controlled settings route with versioned metadata.

CSS variables are applied before the public React root is created. This avoids a flash of the bundled palette.

The site-style card owns the bilingual title. The website-copy card owns the remaining public text. Both merge against the latest saved copy so one section does not overwrite fields owned by the other.

### Site icon

The site icon editor accepts PNG, JPEG, and WebP up to 5 MB. It preserves a local preview, normalizes the saved image to a 192 × 192 PNG, and applies it as the browser favicon and touch icon through a controlled public route.

### Bottom navigation and language control

The bottom navigation is Safe-Area-aware, keeps touch targets of at least approximately 44 pixels, uses responsive sizing, and allows labels to wrap instead of ellipsizing. Its colors come from the public site-style settings.

The language switcher remains inside the hero header rather than floating independently over the viewport.

### Per-album wheel looping

Under **子分類操作方式**, infinite horizontal looping can be enabled independently for the `wedding` and `guest` albums. Disabled wheels remain finite.

Enabled wheels render a complete clickable copy of the logical items before and after the real sequence, filling both directions without empty edge space. Copy buttons select the same logical item as their real counterpart, but they are excluded from canonical tab semantics and keyboard tab order. After scrolling or choosing a copy, the component recenters on the matching real item. Arrow-key navigation follows the same wrap rule.

### Fullscreen photo viewer

The viewer displays the already loaded thumbnail immediately instead of preloading every original. It provides:

- **查看原圖 / View original** at the upper left, opening the controlled original in a new tab with `noopener noreferrer`;
- a close control at the upper right;
- previous/next navigation;
- wheel, pinch, keyboard, double-activation, and panning interactions for zoomed content.

Visible minus, percentage, and plus controls are intentionally absent. The loading label is neutral: **正在載入照片… / Loading photo…**.

Detailed contracts are documented in [`docs/site-style-wheel-and-viewer.md`](docs/site-style-wheel-and-viewer.md).

## Public gallery

- Traditional Chinese is the default; English adds `/en` after `/Memories`.
- Only `visibility = 'public'` rows are returned publicly.
- Global media-group ordering remains authoritative. Album-specific random, time, photo-name, or author sorting applies only inside photo groups.
- Random ordering remains stable for the current page load.
- Wedding-process media can contain YouTube video, bilingual rich text, Drive attachments, divider spacing, one to three pinned photos, and the continuous photo wall.
- Traditional process buttons are the default; an optional centered wheel can be enabled and given a mobile density target.
- Subgroup clicks and deep links use the same anchor-positioning behavior.
- Public, pinned, and private-management thumbnails use IntersectionObserver-based lazy loading. The network `src` is withheld until an image approaches the viewport.
- Explicit “load more memories” pagination prevents unbounded React and DOM growth.
- Missing thumbnails can be repaired and may temporarily fall back to the original with `no-store`.
- Known label surfaces wrap onto multiple lines instead of truncating.

## Guest-label settings

`src/guest-label-settings.mjs` owns shared rules for:

- independent latest-photo, all-visitors, and guest-name visibility;
- compatibility with the former combined setting;
- selector-item construction and order;
- active-filter visibility fallback;
- stable-route label availability;
- guest-name normalization, persisted order, and append-only discovery;
- latest-photo count normalization.

When enabled, guest-album labels are ordered as all visitors, latest photos, then administrator-ordered names. The latest label contains the newest configured 30–50 guest photos and is displayed newest first. New uploader names append after the saved names rather than being alphabetically resorted.

Hidden latest/name labels are unavailable to canonical label routes. Hiding a label does not delete photos.

## Guest upload

1. Create a PostgreSQL upload batch.
2. Assign each selected file a stable `clientUploadId`.
3. Send one multipart request per photo, with up to three photos active at once.
4. Stream the request to a temporary file and normalize it with `sharp`.
5. Claim durable `(batch_id, client_upload_id)` state and record a SHA-256 content hash.
6. Upload the original through a Drive resumable session.
7. Insert the completed photo and let the background thumbnail service build the derivative.

Limits and behavior:

- Guest and administrator selection limits are independent integer settings from 1 through 100. Defaults are 10 guest photos and 30 administrator photos.
- The active limit is enforced by the UI and upload queue; changing it does not increase fixed worker concurrency.
- Administrators can edit the bilingual upload description shown under the selector.
- JPEG, PNG, WebP, HEIC, and HEIF; 25 MB per file.
- Administrator settings can allow Guest-only, Life, or wedding-process classification; disabled mode falls back to Guest uploads.
- The reserved uploader name `婚禮攝影` is rejected for guest batches by the client, server, and database guard.
- The same filename with different bytes is allowed. Duplicate identity is content-based, never filename-based.
- The first pass allows two attempts per file. Retryable failures release the worker and enter a deferred pass after every photo has had a turn.
- The deferred pass allows two further attempts. Permanent validation failures are not retried.
- Offline waiting does not consume an attempt.
- Manual “continue unfinished photos” reuses the same batch, upload ID, and Drive session.

## Drive upload modes

New originals always use a resumable session. The Upload Method card selects:

- `single` — default; one complete-file PUT within the resumable session;
- `chunked` — 4 MiB chunks with persisted session URI, byte offset, and update timestamp.

An in-progress item keeps the mode with which it started. Session-state queries and deterministic Drive names recover accepted work without creating duplicate files.

## Private batch management

The management token is carried in the URL fragment and sent as a Bearer token. PostgreSQL stores only its hash.

The uploader can:

- list photos belonging to that exact batch;
- permanently delete an individual photo;
- rotate the private link, immediately invalidating the old token.

Permanent deletion removes the Drive thumbnail and original, photo relationships, database row, and pinned-photo references. A non-404 Drive failure stops database deletion so the client cannot receive a false success response.

## Administrator application

The production secret is:

```text
MEMORIES_ADMIN_TOKEN
```

Successful login creates a 30-minute HMAC-signed cookie:

```text
HttpOnly; Secure; SameSite=Strict; Path=/Memories/admin
```

Current capabilities include:

- edit site appearance, hero background, bilingual title, public copy, and site icon;
- choose traditional or wheel selectors and per-album wheel looping;
- create, edit, reorder, and show/hide albums;
- control album summaries and photo ordering;
- create, rename, and reorder Drive-backed processes;
- edit process video, autoplay, bilingual Tiptap content, attachments, and divider spacing;
- select and order up to three pinned photos per process;
- configure independent guest/admin upload limits, Drive upload mode, and bilingual upload guidance;
- independently show/hide latest-photo, all-visitors, and guest-name labels;
- drag guest-name labels into a saved order and configure latest-photo count;
- filter photos by album, process, and author;
- batch-upload administrator photos through the reliable guest-upload core, then finalize album/process memberships;
- edit display name, capture time, author, visibility, albums, and process;
- select photos on the current page and bulk-add or replace albums, replace process classification, bulk-change uploader/author, or permanently delete eligible photo families;
- refresh a selected album or process by deleting only generated thumbnails, rescanning originals, and rebuilding derivatives;
- keep drafts and submit registered sections through the global save coordinator.

Current UI behavior:

- manual accordions wrap maintenance, new/existing albums, new-photo upload, and category editors;
- Guest-label settings are nested inside the `guest` album editor;
- administrator photo previews and pinned-photo candidates are paginated 10 at a time;
- wide photo pages use five columns, reducing responsively to one;
- page changes abort hidden thumbnail requests and release obsolete blob URLs;
- bulk selection applies to the currently rendered photo page;
- text labels wrap instead of clipping.

The author `婚禮攝影` receives front-end and server-side deletion protection and is automatically skipped by bulk permanent deletion.

## Settings and appearance persistence

The feature set reuses the existing `memories_app_settings` JSON key/value table. Important current keys include settings for:

- site copy;
- site style;
- hero background;
- site icon;
- media order;
- selector mode, visible count, and loop album IDs;
- pinned photos;
- guest-label visibility/order/latest count;
- upload limits, guidance, and Drive mode.

Appearance and guest-label additions require no new table schema because they use the existing settings store.

## Background synchronization

After readiness, reconciliation runs in the background and every five minutes by default, never more often than once per minute. It discovers reserved folders, imports numbered process folders and photos, deactivates missing process folders, and backfills thumbnails.

Manual Drive deletion does not currently deactivate and fully remove the corresponding PostgreSQL photo automatically. Use the administrator or private-management delete action for complete cleanup.

A background job may reach the end and log completion while also reporting collected per-photo failures. Operators must inspect attempted, successful, failure count, and failure codes rather than interpreting “completed” as “all succeeded.”

## Migrations

Tracked migrations live under `db/` and currently extend through `013_drive_resumable_upload.sql`.

The runner:

- records filename and SHA-256 checksum;
- refuses modification of already-applied files;
- uses a PostgreSQL advisory lock;
- applies only pending files;
- starts production listening only after success.

Never use `drizzle-kit push` for Memories tables. A publish plan containing `DROP TABLE`, `DROP COLUMN`, or removal of existing constraints must be cancelled.

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

Secrets, Drive folder IDs, OAuth credentials, and private tokens must not be committed to GitHub, `.replit`, or a browser bundle.

Operational procedures are in [`../../OPERATIONS_GUIDE.md`](../../OPERATIONS_GUIDE.md).

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

`test:drive-live` must run only in a configured Replit environment against a safe test folder.

## CI and architecture debt

Standalone CI runs the Node test suite, a production client/server build, final transform-chain structural checks, and a real server health smoke. The legacy-boundary workflow protects the invitation and old photo API.

Preservation tests cover public-bootstrap memoization/fallback, guest-label rules, stable routes, appearance validation, hero and icon assets, fully interactive wheel copies and canonical tab semantics, responsive navigation, photo-viewer behavior, unified saves, and settings persistence.

CI does not yet run a real browser such as Playwright against the completed production transform chain. The largest remaining architecture risk is the collection of Vite pre-transforms that mutate `App.jsx` and `AdminApp.jsx` through exact string replacement. Any transform change should validate final generated code and a real browser render.

Additional known limitations:

- deletion is immediate and permanent; there is no seven-day trash or restore flow;
- manually deleting a Drive original does not perform complete database cleanup;
- people classification and selfie-based photo discovery remain future work;
- broader iOS Safari, Android Chrome, LINE/Instagram webview, and slow-network validation is still needed;
- administrator upload classification is finalized by client-side follow-up PATCH requests rather than one atomic server command.

Detailed smells and the staged extraction plan are in [`../../docs/code-health-audit-2026-07.md`](../../docs/code-health-audit-2026-07.md).