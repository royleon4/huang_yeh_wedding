# 詠葉的婚禮

婚禮邀請網站與照片檔案館的 pnpm monorepo。

> **Product status:** Standalone Memories Phase 1 complete; post-Phase-1 maintenance active  
> **Reviewed:** 2026-08-04T03:11:00+08:00 (Asia/Taipei)  
> **Review baseline:** `52008c1470b5fe74764a5b7f1956a676622f52f7`  
> **Documentation index:** [`DOCUMENTATION.md`](DOCUMENTATION.md)  
> **Developer handoff:** [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md)  
> **Security remediation preparation:** [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md)  
> **Dated SCA evidence:** [`docs/software-composition-analysis-2026-08-02.md`](docs/software-composition-analysis-2026-08-02.md)  
> **Production → Development database runbook:** [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md)  
> **Phase 1 closeout and next steps:** [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md)

## Choose your role

| Role | Start here | Purpose |
| --- | --- | --- |
| Guest viewing photos or messages | [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md#我只想看照片) | Browse albums, processes, labels, guestbook messages and photos; switch language |
| Guest sharing photos | [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md#我想上傳照片) | Upload photos and save the private management link |
| Previous uploader | [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md#我想管理自己上傳的照片) | Manage or permanently delete one uploaded batch |
| Content administrator | [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md) | Manage appearance, copy, albums, labels, messages, processes, photos and upload settings |
| Deployment/operator | [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) | Replit, Drive, Secrets, migrations, releases and incidents |
| Dependency remediation operator | [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md) | Refresh SCA evidence, plan dependency batches, validate and roll back safely |
| Database copy/rollback operator | [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md) | Back up Development, copy Production into Development, validate and roll back safely |
| Developer/maintainer | [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md) | Safe changes, tests, architecture risks and release discipline |
| Detailed Memories developer | [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) | Current product, API, storage and implementation contracts |

## Product Phase 1 and current maintenance state

Product Phase 1 established the accepted first production baseline for **Standalone Memories** under `/Memories/`.

The current product includes:

- bilingual public wedding archive;
- stable album, label, photo and administrator routes;
- wedding-process video, rich content, Word document import, image attachments, dividers and pinned photos;
- traditional and wheel-based navigation with independent per-album looping;
- album-scoped labels for every non-guest album, with an automatically generated all-album label;
- dedicated guest labels for all visitors, latest photos and uploader names;
- a guestbook/message album with public submission, sorting and administrator moderation;
- configurable random featured-photo ranges per album, scoped to the active album and label;
- responsive masonry layouts, bottom navigation and fullscreen photo viewer;
- guest uploads with configurable 1–100 photo limits, bounded concurrency and retry;
- private batch management with token rotation and permanent deletion;
- Google Drive originals, image attachments and WebP thumbnails;
- PostgreSQL application state and immutable SQL migrations through `016_explicit_guest_album_membership.sql`;
- administrator appearance, copy, icon, album, label, message, process, photo and upload management;
- impact-focused PR validation, full `main` integration validation, focused Chrome layout checks, production build, health smoke and legacy-boundary CI;
- guest, administrator, operations, maintainer and security-remediation documentation.

“Phase 1 complete” does **not** mean every architecture hardening item or future feature is complete. A required Playwright production-browser gate, transform removal, trash/restore, people classification and selfie search remain future work.

## Repository applications

| Area | Package | Route or port | Status |
| --- | --- | --- | --- |
| Wedding Invitation | `@workspace/wedding-invitation` | `/`, port `19315` | Existing legacy application |
| Standalone Memories | `@workspace/memories-album` | `/Memories/*`, port `19316` | Product Phase 1 baseline plus active maintenance features |
| Legacy API | `@workspace/api-server` | `/api/*`, port `8080` | Legacy Express/Object Storage boundary |
| Mockup Sandbox | `@workspace/mockup-sandbox` | `/__mockup`, port `8081` | Replit Canvas development tool |

## Application boundary

Standalone Memories and the legacy invitation/photo wall are different systems.

- `/Memories/*` is owned by `artifacts/memories-album`.
- The old photo wall uses legacy `/api/photos*` and Object Storage.
- Ordinary Memories changes must not import or modify legacy photo-wall code.
- `.github/workflows/memories-legacy-boundary.yml` protects the boundary.
- A protected-path change requires explicit owner approval and narrowly scoped regression evidence.

See [`docs/memories/architecture-boundary.md`](docs/memories/architecture-boundary.md) and [`docs/memories/legacy-protection.md`](docs/memories/legacy-protection.md).

## Data ownership

| Data | Canonical owner |
| --- | --- |
| Original photos and process image attachments | Google Drive |
| Generated WebP thumbnails | Google Drive `系統縮圖` |
| Numbered wedding-process names and order | Google Drive, mirrored to PostgreSQL |
| Visibility, albums, labels, processes, author and capture time | PostgreSQL |
| Guestbook messages and moderation state | PostgreSQL |
| Upload batches, token hashes, content hashes and resumable state | PostgreSQL |
| Videos, rich content, pinned photos, featured-photo settings and application settings | PostgreSQL |
| Administrator password | Replit Secret `MEMORIES_ADMIN_TOKEN` |

Drive IDs, folder IDs, connector responses, OAuth details, raw private tokens and database credentials remain server-side.

## Main routes

| Purpose | Route |
| --- | --- |
| Public archive | `/Memories/` |
| Chinese album | `/Memories/albums/:albumKey` |
| English album | `/Memories/en/albums/:albumKey` |
| Label | `/Memories/albums/:albumKey/labels/:labelKey` |
| Open photo | append `/photos/:photoId` |
| Guest upload | `/Memories/upload` or `/Memories/en/upload` |
| Private batch management | `/Memories/manage/:batchId#token=...` |
| Administrator login | `/Memories/admin/login` |
| Administrator tabs | `/Memories/admin/general`, `albums`, `photos`, `categories` |
| Health | `/Memories/api/health` |

A message album uses the same stable album route and renders messages instead of a photo feed according to its persisted album type. Display order never defines canonical URLs. Old ordinal and semantic routes are migration aliases only. See [`artifacts/memories-album/docs/logical-routes.md`](artifacts/memories-album/docs/logical-routes.md).

## Local development

Requirements: Node.js 24 and pnpm 10.x.

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

Use a frozen install for CI reproduction, security work and release validation:

```bash
pnpm install --frozen-lockfile
```

Run applications:

```bash
pnpm --filter @workspace/wedding-invitation dev
pnpm --filter @workspace/memories-album dev
pnpm --filter @workspace/api-server dev
pnpm --filter @workspace/mockup-sandbox dev
```

Standalone Memories checks:

```bash
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:impact
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

`test:drive-live` requires an approved test folder and configured Replit Google Drive Integration. Do not run destructive diagnostics against the production wedding root.

## Production requirements

Required settings:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The Published App must also connect Replit Google Drive Integration.

Do not commit secrets, folder IDs, OAuth credentials, resumable session URIs, raw management tokens or connector response bodies.

## Migration safety

Standalone Memories uses immutable numbered SQL files under:

```text
artifacts/memories-album/db
```

The current sequence extends through:

```text
016_explicit_guest_album_membership.sql
```

- Add a new migration; never edit an applied migration.
- Never use `drizzle-kit push` for Memories tables.
- Cancel a Publish plan that unexpectedly proposes `DROP TABLE`, `DROP COLUMN` or constraint removal.
- Production listening starts only after the migration runner succeeds.
- Rollback is normally a compatible code rollback or forward fix, not deletion of migration history.

For the verified Production → Development backup, overwrite, validation and rollback process, use [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md).

## Testing and current gaps

PR validation uses Test Impact Analysis and Selective Test Execution. Draft and ready PRs run the tests, focused Chrome checks and build steps selected by the actual diff. Unknown executable changes fall back to broader validation. A push to `main` or manual dispatch runs the full integration set.

Current integration validation includes:

1. full Node test suite on `main`;
2. focused Chrome checks for guestbook and navigation layouts;
3. production client/server build;
4. `/Memories/api/health` server smoke;
5. Memories/legacy protected-path boundary.

The exact test count is intentionally not pinned here because every regression fix changes it. The CI result for the current commit is the authoritative count. See [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md).

CI does not yet run a required Playwright production-browser suite against the final deployed interaction flow. Transform-sensitive or user-visible changes still require real-browser validation.

## Security and dependency evidence

The first repository-wide SCA was completed on 2026-08-02 and recorded known vulnerabilities, licenses, deprecated packages, outdated direct dependencies and a CycloneDX SBOM.

That scan is **dated evidence**, not the exact verdict for current `main`: `artifacts/memories-album/package.json` and `pnpm-lock.yaml` changed afterwards, including the addition of Word-import dependencies. A fresh SCA is required before beginning dependency remediation or quoting current vulnerability counts.

- Evidence and interpretation: [`docs/software-composition-analysis-2026-08-02.md`](docs/software-composition-analysis-2026-08-02.md)
- Pre-remediation runbook: [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md)

Do not use `pnpm audit fix --force` without reviewed, package-specific changes and repository validation.

## Known deferred work

- production Playwright gate and screenshot baseline;
- incremental removal of the remaining exact-string Vite transforms;
- central settings and route registries;
- atomic administrator upload-and-classify command;
- stronger observability, backup and restore drills;
- recurring SCA/SBOM automation and dependency remediation;
- iOS Safari, Android Chrome and embedded webview acceptance matrix;
- deletion recovery policy;
- people classification and selfie-search product/privacy decision;
- long-term legacy invitation/API strategy.

The proposed order and suggested dates are documented in [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md).

## Documentation

- [Documentation index and lifecycle](DOCUMENTATION.md)
- [Developer and maintainer guide](MAINTAINER_GUIDE.md)
- [Product Phase 1 closeout and next steps](docs/phase-1-closeout-2026-08-01.md)
- [Dated Software Composition Analysis evidence](docs/software-composition-analysis-2026-08-02.md)
- [Dependency security remediation readiness](docs/security-remediation-readiness-2026-08-04.md)
- [Memories test-impact and CI strategy](docs/memories/testing-strategy.md)
- [Guest guide](EASY_USER_GUIDE.md)
- [Administrator guide](ADMIN_GUIDE.md)
- [Operations guide](OPERATIONS_GUIDE.md)
- [Production → Development database backup, overwrite and rollback runbook](docs/memories/production-to-development-database-runbook.md)
- [Standalone Memories technical contract](artifacts/memories-album/README.md)
- [Test-suite conventions](artifacts/memories-album/test/README.md)
- [Architecture debt audit](docs/code-health-audit-2026-07.md)

---

願這個專案留下我們婚禮的每一段回憶，也記錄親友與同工的幫助與祝福。
