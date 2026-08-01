# Standalone Memories｜Developer and Maintainer Guide

> **Status:** Current maintainer handbook  
> **Product status:** Phase 1 complete  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)  
> **Baseline commit reviewed:** `4fb33f0655eca557c6755066bce8083b0f15c7df`

This guide is the starting point for developers who maintain, debug, refactor, deploy, or extend **Standalone Memories** in `royleon4/huang_yeh_wedding`.

It complements, rather than replaces:

- [`README.md`](README.md) for the repository overview;
- [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) for the detailed product and API contract;
- [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) for deployment and incident procedures;
- [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md) for architecture debt;
- [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md) for the Phase 1 handoff and recommended next work.

## 1. Phase terminology

Two different roadmaps previously used the words “Phase 1.” Keep them separate:

1. **Product Phase 1 — complete.** The public archive, guest upload, private batch management, administrator application, Google Drive storage, PostgreSQL index, stable routes, appearance controls, and production deployment path form the accepted first product baseline.
2. **Architecture hardening stages — not complete.** The risk-containment and transform-removal work described in the code-health audit remains future engineering work.

Do not state that Playwright coverage, transform removal, trash/restore, people classification, or selfie search is complete merely because Product Phase 1 is complete.

## 2. Source-of-truth order

When documentation, issues, prototypes, and code disagree, use this order:

1. `main` branch production code and immutable migrations;
2. tests that exercise the final production behavior;
3. current documents indexed by [`DOCUMENTATION.md`](DOCUMENTATION.md);
4. the latest merged PR and its CI result;
5. issues, old prototypes, design baselines, research notes, and exported conversations.

Historical or research documents must never silently override current code.

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

### Data ownership

| Data | Canonical owner |
| --- | --- |
| Original photos and attachments | Google Drive |
| Generated WebP thumbnails | Google Drive `系統縮圖` |
| Numbered wedding-process folder labels and order | Google Drive, mirrored into PostgreSQL |
| Public visibility, album/process relationships, author, capture time | PostgreSQL |
| Upload batches, content hashes, token hashes, resumable state | PostgreSQL |
| Videos, rich content, pinned photos and application settings | PostgreSQL |
| Administrator password | Replit Secret `MEMORIES_ADMIN_TOKEN` |

The browser receives opaque Memories IDs and controlled media URLs. Never expose Drive IDs, folder IDs, connector responses, credentials, raw management tokens, or database connection strings.

## 4. Local setup and commands

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

Standalone Memories:

```bash
pnpm --filter @workspace/memories-album dev
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

`test:drive-live` requires a configured Replit Google Drive Integration and an owner-approved test folder. Never point destructive diagnostics at the production wedding root.

## 5. Repository map for maintainers

| Path | Responsibility |
| --- | --- |
| `artifacts/memories-album/src/client` | Public and administrator React surfaces and client models |
| `artifacts/memories-album/src/server` | HTTP handlers, repositories, Drive adapters, uploads, refresh, thumbnails and admin services |
| `artifacts/memories-album/src/app.mjs` | Production route composition, headers and application server |
| `artifacts/memories-album/vite.routes.config.js` | Official public/admin transform order and development routing |
| `artifacts/memories-album/*-ui-transform.mjs` | Temporary exact-string build transforms; high-risk maintenance area |
| `artifacts/memories-album/db` | Immutable numbered SQL migrations |
| `artifacts/memories-album/test` | Node tests and source-contract preservation tests |
| `artifacts/memories-album/test-support` | Shared server, fixture and validation helpers |
| `.github/workflows/memories-ci.yml` | Tests, production build and health smoke |
| `.github/workflows/memories-legacy-boundary.yml` | Legacy application boundary protection |
| `.replit` and `.replit-artifact` | Replit artifact routing and deployment integration |

## 6. Safe change workflow

1. Start from the current `main` branch.
2. Identify the smallest product or architecture contract being changed.
3. Confirm whether the change touches the legacy boundary, Drive ownership, migrations, routes, settings, or a Vite transform.
4. Add or update a behavior test at the lowest layer that can prove the contract.
5. Keep source-contract tests only when no behavior-level browser or component test can currently prove the final transformed result.
6. Run the package test suite and production build.
7. For routing, transform, authentication, storage, or startup changes, run the production server health smoke.
8. Update the relevant current document in the same PR.
9. Record manual browser or real-device evidence when CI cannot prove the behavior.
10. Merge only after CI and the legacy-boundary workflow pass.

## 7. Change-impact checklist

### Public route or navigation change

Review:

- `src/client/route-model.mjs` and related route transforms;
- [`artifacts/memories-album/docs/logical-routes.md`](artifacts/memories-album/docs/logical-routes.md);
- direct-link, refresh, Back/Forward and missing-identity behavior;
- Traditional Chinese and `/en` equivalents;
- opened-photo route preservation.

Canonical URLs use stable identities, never current display indexes.

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

### Upload change

Preserve:

- stable `(batchId, clientUploadId)` identity;
- content-based duplicate behavior;
- bounded concurrency and fair retry;
- resumable Drive recovery;
- token hashing and URL-fragment privacy;
- original-before-thumbnail ordering;
- idempotent retries.

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

### Vite transform change

Exact-string transforms are the largest production-only regression risk.

- Confirm the official transform order in `vite.routes.config.js`.
- Test the completed transform chain, not one transform in isolation.
- Build production output.
- Open the resulting public and administrator surfaces in a real browser.
- Fail the review on console errors, `pageerror`, blank screens, missing controls, or stale generated references.
- Prefer deleting a transform after directly composing the feature in React.

## 8. Testing strategy

Read [`artifacts/memories-album/test/README.md`](artifacts/memories-album/test/README.md) before adding tests.

Use these layers:

1. pure model/validator tests;
2. one-handler HTTP tests with shared test support;
3. application route tests for cross-handler behavior;
4. source-contract tests only as a temporary transform/CSS exception;
5. production browser tests when available.

Current CI proves:

- Node test suite;
- final production build;
- server health response;
- legacy protected-path boundary.

Current CI does **not** yet prove a complete browser render through Playwright. Until that gap is closed, manual production-browser validation remains required for user-facing and transform changes.

## 9. Production configuration and secrets

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

## 10. Release and rollback discipline

Before release:

- CI green;
- migration plan reviewed;
- required Secrets and Drive Integration present;
- no unexpected legacy changes;
- documentation updated;
- known manual checks assigned.

After release:

1. check `/Memories/api/health`;
2. open `/Memories/` in a real browser;
3. switch language, albums and labels;
4. open a photo and its controlled original;
5. authenticate and open all four admin tabs;
6. verify one safe save or upload only when production conditions allow it.

Rollback is a code rollback, not a database rewind. Do not delete an applied migration or restore older application code that cannot understand the current schema. Prefer a forward fix or an explicitly designed compatible rollback.

## 11. First response to incidents

1. Capture the first real error and exact timestamp.
2. Classify the failure: server startup, migration, PostgreSQL, Drive authorization, Drive transient error, browser runtime, or individual data.
3. Preserve evidence before restarting.
4. Do not repeatedly upload or delete while the failure mode is unknown.
5. Fix only the proven root cause.
6. Run the relevant tests and production build.
7. Re-verify in a browser after deployment.
8. Add the new failure mode to the appropriate runbook or diagnostic document.

Use [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) for detailed symptom routing.

## 12. Documentation maintenance

Every PR that changes a user-visible, operational, security, route, storage, migration, or architecture contract must update documentation.

- Guest behavior → `EASY_USER_GUIDE.md`
- Administrator behavior → `ADMIN_GUIDE.md`
- Deployment or recovery → `OPERATIONS_GUIDE.md`
- Repository overview → `README.md`
- Detailed Memories contract → `artifacts/memories-album/README.md`
- Route behavior → `artifacts/memories-album/docs/logical-routes.md`
- Developer workflow or architecture risk → this guide and code-health audit
- New specialist document → add it to `DOCUMENTATION.md`

For date-based records, use ISO 8601 with timezone. Mark documents as **Current**, **Historical**, **Superseded**, **Research**, or **Internal**. Never leave a historical requirement looking like an active production contract.

## 13. Definition of done

A maintenance or feature PR is complete only when:

- the behavior is correct at the intended layer;
- the public and administrator route contracts remain coherent;
- tests prove the changed behavior without unnecessary duplication;
- production build succeeds;
- browser validation covers any transform-sensitive UI change;
- migrations and legacy boundaries remain safe;
- secrets and provider identifiers remain server-side;
- current documentation matches the merged implementation;
- deferred risks are recorded rather than implied to be solved.
