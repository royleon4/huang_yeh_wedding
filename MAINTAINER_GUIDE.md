# Standalone Memories｜Developer and Maintainer Guide

> **Status:** Current maintainer handbook  
> **Product status:** Product Phase 1 complete; post-Phase-1 maintenance active  
> **Reviewed:** 2026-08-04T03:11:00+08:00 (Asia/Taipei)  
> **Baseline commit reviewed:** `52008c1470b5fe74764a5b7f1956a676622f52f7`

This guide is the starting point for developers who maintain, debug, refactor, deploy, secure, or extend **Standalone Memories** in `royleon4/huang_yeh_wedding`.

It complements, rather than replaces:

- [`README.md`](README.md) for the repository overview;
- [`DOCUMENTATION.md`](DOCUMENTATION.md) for document lifecycle and source-of-truth rules;
- [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) for the detailed product and API contract;
- [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) for deployment and incident procedures;
- [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md) for Test Impact Analysis and CI selection;
- [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md) for dependency remediation;
- [`docs/software-composition-analysis-2026-08-02.md`](docs/software-composition-analysis-2026-08-02.md) for dated SCA evidence;
- [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md) for architecture debt;
- [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md) for the Phase 1 handoff and recommended next work.

## 1. Phase terminology

Two different roadmaps previously used the words “Phase 1.” Keep them separate:

1. **Product Phase 1 — complete.** The public archive, guest upload, private batch management, administrator application, Google Drive storage, PostgreSQL index, stable routes, appearance controls, and production deployment path form the accepted first product baseline.
2. **Architecture hardening stages — not complete.** Required Playwright coverage, transform removal, settings/route registries, domain services and recovery hardening remain engineering work.

Post-closeout additions include album-scoped labels, message/guestbook albums, per-album featured-photo ranges, Word content import, focused Chrome checks and impact-focused PR testing. Do not rewrite the dated Phase 1 baseline to imply these existed at closeout.

Do not state that required Playwright coverage, transform removal, trash/restore, people classification, or selfie search is complete merely because Product Phase 1 is complete.

## 2. Source-of-truth order

When documentation, issues, prototypes, scan reports, and code disagree, use this order:

1. current `main` production code, immutable migrations, package manifests and lockfile;
2. tests that exercise the final production behavior;
3. current documents indexed by [`DOCUMENTATION.md`](DOCUMENTATION.md);
4. the latest merged PR and its CI result;
5. dated evidence only for the commit it records;
6. issues, old prototypes, design baselines, research notes, and exported conversations.

Historical, research, diagnostic or dated security evidence must never silently override current code.

## 3. Runtime topology and ownership

| Surface | Package | Route or port | Storage responsibility |
| --- | --- | --- | --- |
| Wedding invitation | `@workspace/wedding-invitation` | `/`, port `19315` | Legacy application |
| Standalone Memories | `@workspace/memories-album` | `/Memories/*`, port `19316` | PostgreSQL + Google Drive |
| Legacy API | `@workspace/api-server` | `/api/*`, port `8080` | Legacy PostgreSQL/Object Storage |
| Canvas preview | `@workspace/mockup-sandbox` | `/__mockup`, port `8081` | Development preview only |

### Isolation rule

Ordinary Memories work must not modify:

```text
artifacts/wedding-invitation/**
artifacts/api-server/src/routes/photos.ts
```

The `Memories legacy boundary` workflow enforces this. A protected-path change requires an explicit owner decision and the narrowly scoped `owner-approved-legacy-change` label.

Security remediation can legitimately touch legacy dependency manifests, but changing protected application paths still requires owner approval and legacy-specific regression evidence.

### Data ownership

| Data | Canonical owner |
| --- | --- |
| Original photos and image attachments | Google Drive |
| Generated WebP thumbnails | Google Drive `系統縮圖` |
| Numbered wedding-process folder labels and order | Google Drive, mirrored into PostgreSQL |
| Public visibility, album/label/process relationships, author, capture time | PostgreSQL |
| Guestbook messages and moderation state | PostgreSQL |
| Upload batches, content hashes, token hashes, resumable state | PostgreSQL |
| Videos, rich content, pinned photos, featured-photo settings and application settings | PostgreSQL |
| Administrator password | Replit Secret `MEMORIES_ADMIN_TOKEN` |

The browser receives opaque Memories IDs and controlled media URLs. Never expose Drive IDs, folder IDs, connector responses, credentials, raw management tokens, or database connection strings.

## 4. Current product contracts that commonly affect maintenance

- Every non-guest album may define album-scoped labels. The first public label is the generated all-album label.
- Wedding process titles can override label text, including the all-wedding-process label.
- Guest albums retain all-visitors, latest-photo and uploader-name labels.
- Per-album random featured photos are recomputed for the active album and active label; they must not leak across navigation contexts.
- Message albums render guestbook content, support public submission/sorting and expose administrator moderation lazily when the accordion opens.
- Rich-content import accepts Word-related documents; general attachment controls accept images only.
- Migrations currently extend through `016_explicit_guest_album_membership.sql`.
- Permanent deletion remains immediate and has no trash/restore lifecycle.

## 5. Local setup and commands

Requirements:

- Node.js 24;
- pnpm 10.x;
- no npm or Yarn lockfile.

From the repository root:

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

For CI reproduction, security work and releases use:

```bash
pnpm install --frozen-lockfile
```

Standalone Memories:

```bash
pnpm --filter @workspace/memories-album dev
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:impact
pnpm --filter @workspace/memories-album run test:layout-navigation
pnpm --filter @workspace/memories-album run test:layout-guestbook
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

`test:drive-live` requires a configured Replit Google Drive Integration and an owner-approved test folder. Never point destructive diagnostics at the production wedding root.

## 6. Repository map for maintainers

| Path | Responsibility |
| --- | --- |
| `artifacts/memories-album/src/client` | Public and administrator React surfaces and client models |
| `artifacts/memories-album/src/server` | HTTP handlers, repositories, Drive adapters, uploads, refresh, thumbnails, messages and admin services |
| `artifacts/memories-album/src/app.mjs` | Production route composition, headers and application server |
| `artifacts/memories-album/vite.routes.config.js` | Official public/admin transform order and development routing |
| `artifacts/memories-album/*-ui-transform.mjs` | Temporary exact-string build transforms; high-risk maintenance area |
| `artifacts/memories-album/db` | Immutable numbered SQL migrations through `016_explicit_guest_album_membership.sql` |
| `artifacts/memories-album/test` | Node tests and source-contract preservation tests |
| `artifacts/memories-album/scripts/select-tests.mjs` | Test Impact Analysis and Selective Test Execution |
| `artifacts/memories-album/scripts/verify-*-layout.mjs` | Focused real-Chrome layout checks |
| `artifacts/memories-album/test-support` | Shared server, fixture and validation helpers |
| `.github/workflows/memories-fast-ci.yml` | Draft PR impact-focused validation |
| `.github/workflows/memories-ci.yml` | Ready PR impact validation and full `main` integration gate |
| `.github/workflows/memories-legacy-boundary.yml` | Legacy application boundary protection |
| `.replit` and `.replit-artifact` | Replit artifact routing and deployment integration |

## 7. Safe change workflow

1. Start from the current `main` branch.
2. Identify the smallest product, security or architecture contract being changed.
3. Confirm whether the change touches the legacy boundary, dependencies, lockfile, Drive ownership, migrations, routes, settings, message albums, labels, or a Vite transform.
4. Add or update a behavior test at the lowest layer that can prove the contract.
5. Keep source-contract tests only when no behavior-level browser or component test can currently prove the final transformed result.
6. Use the impact selector for local guidance, but run the complete required set for package, lockfile, runtime, Vite or CI changes.
7. Run the package test suite and production build when the change affects executable behavior.
8. For routing, transform, authentication, storage, dependency or startup changes, run the production server health smoke.
9. Update the relevant current document in the same PR.
10. Record manual browser or real-device evidence when CI cannot prove the behavior.
11. Merge only after required CI and the legacy-boundary workflow pass.

## 8. Change-impact checklist

### Public route, album type or navigation change

Review:

- `src/client/route-model.mjs` and related route transforms;
- album type normalization and public bootstrap;
- [`artifacts/memories-album/docs/logical-routes.md`](artifacts/memories-album/docs/logical-routes.md);
- direct-link, refresh, Back/Forward and missing-identity behavior;
- Traditional Chinese and `/en` equivalents;
- opened-photo route preservation;
- message albums versus photo-feed albums;
- content positioning after asynchronous load.

Canonical URLs use stable identities, never current display indexes.

### Album label change

Preserve:

- label ownership by album;
- generated all-album label as first position;
- guest-specific virtual labels;
- process title overrides for wedding labels;
- current album/label route fallback;
- photo pagination and active-filter persistence;
- no cross-album featured-photo leakage.

### Setting change

A setting may require coordinated changes to:

- default and normalization module;
- public/admin API filtering;
- repository storage key mapping;
- administrator draft/save registration;
- public bootstrap normalization;
- UI and tests;
- documentation.

This is a known Shotgun Surgery area. Prefer a central settings registry instead of adding another independent chain of string keys.

### Upload or document-import change

Preserve:

- stable `(batchId, clientUploadId)` identity;
- content-based duplicate behavior;
- bounded concurrency and fair retry;
- resumable Drive recovery;
- token hashing and URL-fragment privacy;
- original-before-thumbnail ordering;
- idempotent retries;
- Word-only document import and image-only general attachments unless a product decision explicitly changes that contract;
- browser-width containment for imported content.

Administrator upload classification currently finishes through follow-up client PATCH requests. Treat that sequence as a known temporary limitation, not a preferred design.

### Google Drive or reconciliation change

Preserve the physical/logical split:

- official wedding photos may move between managed folders;
- guest originals remain physically under `訪客上傳` even when logically classified elsewhere;
- thumbnails remain in `系統縮圖`;
- root and `00 未分類` retain compatibility behavior;
- provider identifiers never leave the server.

Directly deleting an original from Drive is not complete application deletion.

### Migration change

- Add a new numbered SQL file; never edit an applied migration.
- Keep migrations additive unless the owner explicitly approves a destructive maintenance window.
- Confirm checksum tracking and advisory locking still apply.
- Cancel any Replit Publish plan containing unexpected `DROP TABLE`, `DROP COLUMN`, or constraint removal.
- Never use `drizzle-kit push` for Memories tables.

### Vite transform or build dependency change

Exact-string transforms are the largest production-only regression risk.

- Confirm the official transform order in `vite.routes.config.js`.
- Test the completed transform chain, not one transform in isolation.
- Build production output.
- Run the focused Chrome checks selected by the changed surface.
- Open the resulting public and administrator surfaces in a real browser.
- Fail the review on console errors, `pageerror`, blank screens, missing controls, stale generated references or width overflow.
- Prefer deleting a transform after directly composing the feature in React.

### Dependency or lockfile change

- Read [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md).
- Use `pnpm install --frozen-lockfile` for reproduction before editing.
- Record the parent dependency, advisory path and intended target.
- Avoid `pnpm audit fix --force`.
- Run full typecheck, workspace build, Memories tests, all focused Chrome checks and production health smoke.
- Generate a post-change SBOM and SCA tied to the final commit.
- Do not quote the 2026-08-02 SCA counts as current after package or lockfile changes.

## 9. Testing strategy

Read both:

- [`artifacts/memories-album/test/README.md`](artifacts/memories-album/test/README.md)
- [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md)

Use these layers:

1. pure model/validator tests;
2. one-handler HTTP tests with shared test support;
3. application route tests for cross-handler behavior;
4. source-contract tests only as a temporary transform/CSS exception;
5. focused real-Chrome layout checks;
6. production browser tests when available.

PR behavior:

- Draft PRs use `Standalone Memories Fast CI` and impact-selected validation.
- Ready PRs use the formal Memories check with the same impact analysis and safety fallback.
- Documentation-only changes skip dependency installation and executable tests.
- Unknown executable changes fall back to broader validation.
- Pushes to `main` and manual dispatch run the full Node, focused Chrome, production build and health-smoke integration set.

Current CI still does **not** prove a complete final production interaction flow through a required Playwright suite. Until that gap is closed, manual production-browser validation remains required for user-facing and transform changes.

## 10. Software composition and dependency security

The 2026-08-02 SCA recorded a CycloneDX SBOM, vulnerability results, license metadata, deprecated packages and outdated direct dependencies.

It is **dated evidence**, not a permanent release gate. The Memories package manifest and pnpm lockfile changed afterwards, including Word-import dependencies. Before remediation:

1. re-scan current `main`;
2. classify production-runtime versus build/codegen/preview exposure;
3. fix small parent-dependency batches;
4. run repository-specific tests;
5. re-scan the final lockfile;
6. document remaining findings.

See:

- [`docs/software-composition-analysis-2026-08-02.md`](docs/software-composition-analysis-2026-08-02.md)
- [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md)

SCA does not replace source review, SAST, DAST, secrets scanning, cloud configuration review or runtime monitoring.

## 11. Production configuration and secrets

Required:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Published App must also have Replit Google Drive Integration connected.

Never commit or paste into public logs:

- secrets or connection strings;
- Drive folder IDs;
- OAuth credentials;
- resumable session URIs;
- raw private management tokens;
- image bytes or connector response bodies.

Use [`artifacts/memories-album/.env.example`](artifacts/memories-album/.env.example) only as a names-and-purpose template.

## 12. Release and rollback discipline

Before release:

- required CI green;
- migration plan reviewed;
- required Secrets and Drive Integration present;
- no unexpected legacy changes;
- documentation updated;
- known manual checks assigned;
- for dependency changes, post-change SCA/SBOM tied to the candidate commit;
- last known-good deployment commit recorded.

After release:

1. check `/Memories/api/health`;
2. open `/Memories/` in a real browser;
3. switch language, albums, labels and message/photo album types;
4. confirm guestbook load and active-content positioning;
5. confirm featured photos belong to the active album and label;
6. open a photo and its controlled original;
7. authenticate and open all four admin tabs;
8. verify Word content and image attachment width;
9. verify one safe save or upload only when production conditions allow it.

Rollback is a code and lockfile rollback, not a database rewind. Do not delete an applied migration or restore older application code that cannot understand the current schema. Prefer a forward fix or an explicitly designed compatible rollback.

## 13. First response to incidents

1. Capture the first real error and exact timestamp.
2. Classify the failure: server startup, migration, PostgreSQL, Drive authorization, Drive transient error, browser runtime, dependency/native module, or individual data.
3. Preserve evidence before restarting.
4. Do not repeatedly upload or delete while the failure mode is unknown.
5. Fix only the proven root cause.
6. Run the relevant tests and production build.
7. Re-verify in a browser after deployment.
8. Add the new failure mode to the appropriate runbook or diagnostic document.

Use [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) for detailed symptom routing.

## 14. Documentation maintenance

Every PR that changes a user-visible, operational, security, route, storage, migration, dependency or architecture contract must update documentation.

- Guest behavior → `EASY_USER_GUIDE.md`
- Administrator behavior → `ADMIN_GUIDE.md`
- Deployment or recovery → `OPERATIONS_GUIDE.md`
- Repository overview → `README.md`
- Detailed Memories contract → `artifacts/memories-album/README.md`
- Route behavior → `artifacts/memories-album/docs/logical-routes.md`
- Test selection or CI → `docs/memories/testing-strategy.md`
- Dependency/SCA behavior → the SCA evidence and remediation runbook
- Developer workflow or architecture risk → this guide and code-health audit
- New specialist document → add it to `DOCUMENTATION.md`

For date-based records, use ISO 8601 with timezone and exact commit. Mark documents as **Current**, **Current dated runbook**, **Dated evidence**, **Historical**, **Superseded**, **Research**, **Diagnostic**, or **Internal**. Never leave a historical requirement or old SCA looking like an active production contract.

## 15. Definition of done

A maintenance, feature or security PR is complete only when:

- the behavior is correct at the intended layer;
- the public and administrator route contracts remain coherent;
- tests prove the changed behavior without unnecessary duplication;
- production build succeeds when executable behavior changes;
- browser validation covers any transform-sensitive UI change;
- dependency changes have a final frozen lockfile and matching SCA/SBOM evidence;
- migrations and legacy boundaries remain safe;
- secrets and provider identifiers remain server-side;
- current documentation matches the merged implementation;
- deferred risks are recorded rather than implied to be solved.
