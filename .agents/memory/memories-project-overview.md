---
name: Current Memories project architecture
updated: 2026-08-01T19:33:00+08:00
description: Concise internal handoff for Product Phase 1, canonical documentation, ownership, safety and open architecture work.
---

# Source of truth

Treat `royleon4/huang_yeh_wedding` branch `main` as the primary source for 詠葉的婚禮.

Use this order when facts conflict:

1. current code, migrations and final production tests;
2. [`../../MAINTAINER_GUIDE.md`](../../MAINTAINER_GUIDE.md);
3. [`../../artifacts/memories-album/README.md`](../../artifacts/memories-album/README.md);
4. Current documents indexed by [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md);
5. issues, prototypes, historical baselines, research and old conversations.

Do not copy large volatile feature inventories into internal memory. Link to maintained documents instead.

# Phase status

- **Product Phase 1 is complete** as of 2026-08-01T19:33:00+08:00.
- Architecture hardening remains open: Playwright production browser coverage, exact-string transform removal, settings/route registries and domain services.
- Next work is recorded in [`../../docs/phase-1-closeout-2026-08-01.md`](../../docs/phase-1-closeout-2026-08-01.md).

# Application boundary

Two isolated systems exist:

- Legacy invitation/photo wall: `artifacts/wedding-invitation/**` and legacy `/api/photos*` in `artifacts/api-server`.
- Standalone Memories: `artifacts/memories-album/**` and `/Memories/*`.

Never modify or import legacy photo-wall code for a Memories task unless the owner explicitly approves it. The legacy-boundary workflow enforces this.

# Canonical routes

- Public archive: `/Memories/`
- Public API: `/Memories/api/*`
- Health: `/Memories/api/health`
- Upload: `/Memories/upload` and `/Memories/en/upload`
- Private batch: `/Memories/manage/:batchId#token=...`
- Admin login: `/Memories/admin/login`
- Admin tabs: `/Memories/admin/general`, `/albums`, `/photos`, `/categories`
- Admin API: `/Memories/admin/api/*`
- Lowercase `/memories/*` and old `/admin*` are compatibility-only.

Stable identity routes are authoritative; display order never defines URLs. See [`../../artifacts/memories-album/docs/logical-routes.md`](../../artifacts/memories-album/docs/logical-routes.md).

# Required production configuration

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Published App must connect Replit Google Drive Integration. Never use `SECRET_TOKEN`. Never expose actual values, Drive IDs, OAuth material, raw private tokens, resumable session URIs or connector response bodies.

# Data ownership

- Drive owns originals, attachments, WebP thumbnails and numbered process folders.
- PostgreSQL owns visibility, albums/process relationships, author/time, videos, rich content, pinned photos, settings, uploads, token hashes, content hashes, resumable state and login limits.
- Guest originals stay physically in `訪客上傳`; logical wedding/life classification is PostgreSQL state.
- Reserved folders: `00 未分類`, `訪客上傳`, `生活照`, `系統縮圖`.
- Direct Drive deletion is not complete application deletion. Use administrator or private-management deletion.

# Current product rules that frequently drift in old documents

- Guest and administrator selection limits are independently configurable from 1 through 100; defaults are 10 and 30.
- Guest photos may be logically classified while remaining physically in `訪客上傳`.
- Processes are Drive-backed numbered folders, not a bundled fixed twelve-item list.
- Permanent deletion is immediate and irreversible; no seven-day trash exists.
- People and selfie-based Find-me are not implemented and no face provider is approved.
- Migrations are immutable numbered SQL and currently extend through `013_drive_resumable_upload.sql`.
- The administrator supports paginated photo management, bulk operations, appearance/copy/icon settings, guest-label settings, process content and a global save coordinator.

# Engineering safety

- Never use `drizzle-kit push` for Memories tables.
- Add a migration; never edit an applied migration.
- Cancel unexpected destructive Replit Publish plans.
- Exact-string Vite transforms are the largest production-only risk.
- Run the complete transform chain, production build and real-browser check for transformed UI changes.
- Current CI has Node tests, build, health smoke and legacy boundary, but no required Playwright browser gate.
- Follow [`../../artifacts/memories-album/test/README.md`](../../artifacts/memories-album/test/README.md) to avoid duplicate and brittle tests.

# Verification

```bash
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

`test:drive-live` requires a safe test folder and must not target production for destructive diagnostics.

# Documentation rule

Use [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md) to classify documents as Current, Historical, Research, Diagnostic or Internal. Update current documentation in the same PR as the behavior it describes.
