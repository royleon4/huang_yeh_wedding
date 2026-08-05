# Standalone Memories｜Developer and Maintainer Guide

> **Status:** Current  
> **Product:** Phase 1 complete；Phase 2.1 browser／In-App／performance gates active  
> **Reviewed:** 2026-08-05T10:31:00+08:00 (Asia/Taipei)  
> **Baseline:** `09293817935f5548aa4c7ef6918db9afd0a62b98`

本文件是修改、除錯、重構、測試與發佈 Standalone Memories 的維護入口。

| 目的 | 文件 |
| --- | --- |
| Repository overview | [`README.md`](README.md) |
| Documentation lifecycle | [`DOCUMENTATION.md`](DOCUMENTATION.md) |
| Memories technical contract | [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) |
| Replit operations | [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) |
| 從零架站／多雲 | [`docs/site-handbook/`](docs/site-handbook/README.md) |
| CI strategy | [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md) |
| Device evidence | [`docs/memories/phase-2-device-validation-2026-08-05.md`](docs/memories/phase-2-device-validation-2026-08-05.md) |
| Performance gate | [`docs/memories/phase-2-performance-gate-2026-08-05.md`](docs/memories/phase-2-performance-gate-2026-08-05.md) |
| Architecture debt | [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md) |

## 1. Runtime boundary

| Surface | Package | Route／Port | Data |
| --- | --- | --- | --- |
| Wedding Invitation | `@workspace/wedding-invitation` | `/` · `19315` | Legacy application |
| Standalone Memories | `@workspace/memories-album` | `/Memories/*` · `19316` | PostgreSQL + Google Drive |
| Legacy API | `@workspace/api-server` | `/api/*` · `8080` | Legacy PostgreSQL/Object Storage |
| Mockup Sandbox | `@workspace/mockup-sandbox` | `/__mockup` · `8081` | Development preview |

Ordinary Memories changes must not modify:

```text
artifacts/wedding-invitation/**
artifacts/api-server/src/routes/photos.ts
```

`Memories legacy boundary` enforces this. A required legacy change needs explicit owner approval、narrow scope 與 legacy-specific regression evidence。

## 2. Source of truth

1. Current `main` code、migrations、package manifests、lockfile。
2. Final production tests、browser and performance evidence。
3. Current documents indexed by `DOCUMENTATION.md`。
4. Latest merged PR and CI。
5. Dated evidence only for its exact commit/date。
6. Historical、Research、Issues and old conversations only as background。

## 3. Data ownership

| Data | Canonical owner |
| --- | --- |
| Original photos／image attachments | Google Drive |
| Generated WebP thumbnails | Google Drive `系統縮圖` |
| Albums、labels、processes、visibility、author、capture time | PostgreSQL |
| Guestbook messages | PostgreSQL |
| Upload batches、token/content hashes、resumable state | PostgreSQL |
| Video、rich content、pinned/featured settings、site settings | PostgreSQL |
| Admin secret | Replit Secret `MEMORIES_ADMIN_TOKEN` |

Browser receives opaque Memories IDs and controlled routes only. Never expose Drive IDs、folder IDs、connector responses、credentials、token hashes or database URLs。

## 4. Current contracts

- Chinese default；English under `/Memories/en/*`。
- Public routes use stable identities, never display indexes。
- Each non-guest album can own labels；generated all-album label remains first。
- Wedding-process titles may override public label text。
- Guest album keeps all-visitors、latest and uploader-name labels。
- Featured photos must reset with active album/label context。
- Message albums render guestbook content；admin accordion stays collapsed and lazy-loads on open。
- Rich-content import supports Word-related files only；general attachments accept images only。
- Upload uses durable `(batchId, clientUploadId)` identity、bounded concurrency and retry。
- Permanent delete has no trash/restore lifecycle。
- Migrations currently extend through `016_explicit_guest_album_membership.sql`。

## 5. Current performance contract

| Area | Current behavior |
| --- | --- |
| Route splitting | Admin、admin login and private batch-management are dynamic imports |
| First public page | First photo request is 24 records |
| Progressive feed | First snapshot renders immediately；later cursor pages yield to idle/timer |
| First image | First thumbnail remains high priority |
| Browser diagnostics | `window.__MEMORIES_WEB_VITALS__` records LCP、CLS、interaction and navigation timing |
| Local debug | `?performance=1` prints diagnostics without third-party transmission |
| Build evidence | Vite manifest + `dist/performance/bundle-report.json/.md` |
| Budgets | Public entry 450 KiB gzip；single JS chunk 800 KiB；total JS 2 MiB |

These budgets are regression ceilings, not target values. Route-splitting changes must preserve the required dynamic imports。

## 6. Repository map

| Path | Responsibility |
| --- | --- |
| `artifacts/memories-album/src/client` | Public/Admin React、route/model、performance monitor |
| `artifacts/memories-album/src/server` | HTTP、repositories、Drive、uploads、messages、thumbnails |
| `artifacts/memories-album/src/app.mjs` | Production route/server composition |
| `artifacts/memories-album/vite.routes.config.js` | Transform order、manifest and build plugins |
| `artifacts/memories-album/*-ui-transform.mjs` | High-risk exact-string transforms |
| `artifacts/memories-album/scripts/analyze-bundle.mjs` | Bundle report and budgets |
| `artifacts/memories-album/scripts/select-tests.mjs` | Test Impact Analysis |
| `artifacts/memories-album/e2e` | Production Playwright specs |
| `artifacts/memories-album/playwright.config.mjs` | Browser/In-App profiles |
| `artifacts/memories-album/db` | Immutable migrations |
| `.github/workflows/memories-ci.yml` | Ready PR + full `main` integration |
| `.github/workflows/memories-cross-browser.yml` | Production cross-browser gate |
| `.github/workflows/memories-legacy-boundary.yml` | Legacy boundary |

## 7. Local commands

Requirements: Node.js 24、pnpm 10.x。

```bash
corepack enable
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

Live Drive tests may use only an owner-approved test folder。

## 8. Safe change workflow

1. Branch from latest `main`。
2. Define the smallest behavior/security/architecture contract。
3. Check legacy、route、settings、migration、storage、dependency、transform and performance impact。
4. Add the lowest-layer behavior test that proves the change。
5. Implement the smallest change。
6. Use impact selection；run full validation for cross-cutting files。
7. Build production output and inspect bundle report。
8. Run Playwright for UI/route/transform/performance changes。
9. Record physical-device evidence or accepted residual risk where required。
10. Update the relevant documentation in the same PR。
11. Merge only after required checks pass。

## 9. Change-impact checklist

### Routes／navigation

Verify direct links、refresh、Back/Forward、Chinese/English、photo deep links、invalid identity fallback、async content positioning and bottom navigation visual viewport。

### Albums／labels／featured photos

Preserve label ownership、generated all-label first、guest virtual labels、process-title override、pagination/filter persistence and context-isolated featured photos。

### Settings

Settings still span defaults、normalization、repository、public/admin APIs、bootstrap、draft/save、UI and tests. Prefer a central registry instead of extending another duplicated key chain。

### Upload／document import

Preserve durable upload identity、content-based duplicate handling、bounded retry、resumable recovery、token privacy、original-before-thumbnail、Word-only import、image-only attachments and viewport containment。

Admin classification remains a follow-up PATCH sequence and is a known temporary limitation。

### Drive／portable media

Guest originals remain physically under `訪客上傳` even when logical classification changes；thumbnails remain under `系統縮圖`；provider identifiers remain server-side。Other clouds require a Drive API or object-storage adapter。

### Migrations

Add a new numbered SQL file；never edit an applied migration；prefer additive expand/contract；preserve checksum/advisory lock；stop on unexpected DROP；never use `drizzle-kit push` for Memories production tables。

### Vite／transform／performance

- Verify official transform order。
- Test the final chain, not a single transform。
- Keep Admin/login/private-management route splitting。
- Run production build and review bundle report。
- Fail on budget regressions、pageerror、console error、Error Boundary、blank screen or overflow。
- Prefer direct React composition and delete the replaced transform。

### Dependency／lockfile

Frozen install、fresh SCA/SBOM、small parent-package batches、full typecheck/build/Node/Playwright、post-change SCA tied to the final commit。Do not blindly run `pnpm audit fix --force`。

## 10. Testing model

| Stage | Validation |
| --- | --- |
| Draft PR | Impact-selected Fast CI |
| Ready PR | Formal impact-selected CI + safety fallback |
| Documentation-only | Skip executable checks when only supported doc assets change |
| `main` push | Full Node + focused Chrome + production build + health smoke |
| UI/Playwright paths | Chromium、Firefox、WebKit and representative In-App profiles |
| Performance paths | Feed tests、production build、bundle budgets、browser diagnostics |

Automated profiles are required browser-engine coverage, not physical-device proof. Use the Phase 2 device matrix for real devices。

## 11. Production configuration

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Published App also requires Replit Google Drive Integration。

Never commit or log database URLs、Secrets/OAuth、Drive IDs、resumable session URIs、raw private tokens、signed URLs、image bytes or provider raw responses。

## 12. Release and rollback

Before release: required CI green、migration/backup reviewed、Secrets/Drive present、candidate and last-known-good revisions recorded、documentation current、device risks recorded。

After release verify health、Chinese/English、albums/labels/processes、guestbook、featured context、thumbnail/original/viewer、admin tabs、Word-content width and Web Vitals/bundle evidence。

Rollback is a compatible code/revision rollback, not deletion of migration history. If the previous code cannot read the current schema, use a forward fix。

## 13. Incident first response

1. Record the first error、timestamp、environment and revision。
2. Classify startup、migration、DB、Drive auth/transient、browser、performance/native dependency or individual data。
3. Preserve evidence before restart。
4. Stop repeated upload/delete while the cause is unknown。
5. Fix only the proven root cause。
6. Run relevant tests/build/browser/performance checks。
7. Deploy、observe and update the runbook。

## 14. Documentation responsibility

| Change | Update |
| --- | --- |
| Guest/Admin behavior | Role guide |
| Replit/incident | `OPERATIONS_GUIDE.md` |
| API/storage/product | Memories technical README |
| Browser/CI | Testing strategy/device record |
| Performance | Performance record + handbook chapter |
| Multi-cloud | `docs/site-handbook/` |
| New specialist document | `DOCUMENTATION.md` |

## 15. Definition of done

- [ ] Correct behavior and stable routes/data ownership
- [ ] Tests prove the change
- [ ] Production build and bundle budgets pass
- [ ] Playwright covers browser-sensitive behavior
- [ ] Device evidence or accepted risk recorded
- [ ] Migration/legacy boundary safe
- [ ] Secrets/provider identifiers remain server-side
- [ ] Current documentation updated
