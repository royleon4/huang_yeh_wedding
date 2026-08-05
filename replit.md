# Replit Workspace

> **Product:** Phase 1 complete；Phase 2.1 browser／In-App validation active  
> **Reviewed:** 2026-08-05T10:31:00+08:00 (Asia/Taipei)  
> **Baseline:** `21dc25543de6dd2bfa7e9019a2a9244c8a2ef186`  
> **Replit deployment guide:** [`docs/site-handbook/deployments/replit.md`](docs/site-handbook/deployments/replit.md)

## Runtime applications

| Package | Route | Port | Replit role |
| --- | --- | ---: | --- |
| `@workspace/wedding-invitation` | `/` | 19315 | User-facing invitation |
| `@workspace/memories-album` | `/Memories/*` | 19316 | Primary archive/admin service |
| `@workspace/api-server` | `/api/*` | 8080 | Legacy API/Object Storage |
| `@workspace/mockup-sandbox` | `/__mockup` | 8081 | Canvas preview artifact |

`mockup-sandbox` 由 `.replit` Canvas artifact 使用，不是 dead code。

## Current Replit configuration

```toml
modules = ["nodejs-24", "python-base-3.13"]

[deployment]
router = "application"
deploymentTarget = "autoscale"
```

Memories workflow：

```text
PORT=19316
MEMORIES_BASE_PATH=/Memories
pnpm --filter @workspace/memories-album run dev
```

不要在 `.replit` 放 production Secret。

## Required Published App configuration

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

並連接 Replit Google Drive Integration。

Workspace Secrets 不應被假設會自動出現在 Published App。每次 deployment 都要在 Published App settings 確認。

## Toolchain

- Node.js 24
- pnpm 10.x
- React 19 + Vite 7
- PostgreSQL
- Google Drive via `@replit/connectors-sdk`
- Sharp
- Tiptap／Mammoth／docx-preview
- Node tests、focused Chrome、Playwright Chromium/Firefox/WebKit/In-App profiles

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

Live Drive test 只可使用 safe test folder。

## Database safety

Memories 使用 `artifacts/memories-album/db` immutable SQL migrations，current latest：

```text
016_explicit_guest_album_membership.sql
```

- 不使用 `drizzle-kit push`。
- 不修改 applied migration。
- Unexpected DROP → stop Publish。
- Rollback 是 compatible code rollback/forward fix，不刪 migration history。

Legacy API 的 Drizzle schema 與 Memories migration model 是不同 ownership。

## Repository boundary

Ordinary Memories work 不修改：

```text
artifacts/wedding-invitation/**
artifacts/api-server/src/routes/photos.ts
```

`Memories legacy boundary` workflow 強制此規則。Intentional legacy change 需要 `owner-approved-legacy-change` 與具體 regression evidence。

## Browser validation

Current cross-browser production workflow：

- production build；
- pinned Playwright 1.60.0 runner；
- Chromium、Firefox、WebKit；
- desktop/mobile；
- Samsung Internet、WeChat、LINE、Facebook、Instagram representative profiles；
- fail on pageerror/console error；
- screenshots、traces、video、HTML report。

Automated profile 不等於 physical-device proof。真機 matrix：[`docs/memories/phase-2-device-validation-2026-08-05.md`](docs/memories/phase-2-device-validation-2026-08-05.md)。

## Architecture warning

Memories 仍有 exact-string Vite transforms 修改 `App.jsx`／`AdminApp.jsx`。任何 transform/Vite change 必須：

1. 測 final transform chain；
2. production build；
3. cross-browser Playwright；
4. 檢查 blank page、missing control、overflow、console/pageerror；
5. 優先 direct React composition 並刪 transform。

## Portability

Replit Google Drive Integration 是 platform-specific。移植到 Cloud Run、ECS、Azure、OCI、Kubernetes 或 On-premise 前需要：

- production container；
- Google Drive API 或 object-storage adapter；
- provider Secret Manager/runtime identity；
- explicit migration/background jobs；
- logs/metrics/backup/rollback。

完整手冊：[`docs/site-handbook/README.md`](docs/site-handbook/README.md)

## Documentation

- [`README.md`](README.md)
- [`DOCUMENTATION.md`](DOCUMENTATION.md)
- [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md)
- [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md)
- [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md)
- [`docs/site-handbook/`](docs/site-handbook/README.md)
