# Replit Workspace

> **Product:** Phase 1 complete；Phase 2.1 browser／In-App／performance gates active  
> **Reviewed:** 2026-08-05T10:31:00+08:00 (Asia/Taipei)  
> **Baseline:** `09293817935f5548aa4c7ef6918db9afd0a62b98`  
> **Deployment guide:** [`docs/site-handbook/deployments/replit.md`](docs/site-handbook/deployments/replit.md)

## Runtime applications

| Package | Route | Port | Replit role |
| --- | --- | ---: | --- |
| `@workspace/wedding-invitation` | `/` | 19315 | User-facing invitation |
| `@workspace/memories-album` | `/Memories/*` | 19316 | Primary archive/admin service |
| `@workspace/api-server` | `/api/*` | 8080 | Legacy API/Object Storage |
| `@workspace/mockup-sandbox` | `/__mockup` | 8081 | Canvas preview artifact |

`mockup-sandbox` is registered by `.replit` and is not dead code。

## Current deployment contract

```toml
modules = ["nodejs-24", "python-base-3.13"]

[deployment]
router = "application"
deploymentTarget = "autoscale"
```

Memories workflow:

```text
PORT=19316
MEMORIES_BASE_PATH=/Memories
pnpm --filter @workspace/memories-album run dev
```

Never place production Secrets in `.replit`。

## Required Published App configuration

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Published runtime also needs Replit Google Drive Integration。Workspace Secrets may not automatically become Published App Secrets；verify every deployment configuration。

## Toolchain

- Node.js 24、pnpm 10
- React 19、Vite 7
- PostgreSQL
- Google Drive via `@replit/connectors-sdk`
- Sharp、Tiptap、Mammoth、docx-preview
- Node tests、focused Chrome and Playwright Chromium/Firefox/WebKit/In-App profiles
- Vite manifest、Web Vitals diagnostics and bundle budgets

## Commands

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
```

```bash
pnpm --filter @workspace/memories-album dev
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:impact
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

Live Drive tests may use only a safe test folder。

## Database safety

Memories uses checksum-protected SQL migrations under `artifacts/memories-album/db`。Current latest:

```text
016_explicit_guest_album_membership.sql
```

- Never use `drizzle-kit push`。
- Never modify an applied migration。
- Stop Publish on unexpected DROP operations。
- Rollback is compatible code rollback/forward fix, not deletion of migration history。

The legacy API Drizzle schema and Memories migration model have separate ownership。

## Repository boundary

Ordinary Memories work must not modify:

```text
artifacts/wedding-invitation/**
artifacts/api-server/src/routes/photos.ts
```

`Memories legacy boundary` enforces this。Intentional legacy changes require `owner-approved-legacy-change` and exact regression evidence。

## Browser validation

The production workflow uses a pinned Playwright runner and covers Chromium、Firefox、WebKit、desktop/mobile and representative Samsung Internet、WeChat、LINE、Facebook and Instagram profiles。Failures retain screenshots、traces、video and HTML reports。

Automated profiles are not physical-device proof。See [`docs/memories/phase-2-device-validation-2026-08-05.md`](docs/memories/phase-2-device-validation-2026-08-05.md)。

## Performance gate

Current behavior:

- Admin、login and private-management routes remain dynamic imports。
- First public photo request is 24 records。
- First page renders before later cursor pages continue。
- `window.__MEMORIES_WEB_VITALS__` records LCP、CLS、interaction and navigation timing。
- `?performance=1` prints the diagnostic snapshot only。
- Production build writes `dist/performance/bundle-report.json` and `.md`。

Budgets:

```text
Public entry: 450 KiB gzip
Any JS chunk: 800 KiB gzip
Total JS: 2 MiB gzip
```

See [`docs/memories/phase-2-performance-gate-2026-08-05.md`](docs/memories/phase-2-performance-gate-2026-08-05.md)。

## Architecture warning

Memories still has exact-string Vite transforms against `App.jsx` and `AdminApp.jsx`。Transform/Vite changes must validate the final chain、production build、bundle report and cross-browser runtime。Prefer direct React composition and delete replaced transforms。

## Portability

Replit Google Drive Integration is platform-specific。Cloud Run、ECS、Azure、OCI、Kubernetes and On-premise deployments need a production container、Drive API/object-storage adapter、provider Secret Manager/runtime identity、explicit migration/background jobs and backup/observability。

See [`docs/site-handbook/README.md`](docs/site-handbook/README.md)。

## Documentation

- [`README.md`](README.md)
- [`DOCUMENTATION.md`](DOCUMENTATION.md)
- [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md)
- [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md)
- [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md)
- [`docs/site-handbook/`](docs/site-handbook/README.md)
