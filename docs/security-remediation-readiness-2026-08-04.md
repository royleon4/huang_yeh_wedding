# Dependency security remediation readiness

> **Lifecycle:** Current pre-remediation runbook  
> **Reviewed:** 2026-08-04T03:11:00+08:00 (Asia/Taipei)  
> **Current review baseline:** `52008c1470b5fe74764a5b7f1956a676622f52f7`  
> **Related evidence:** [`software-composition-analysis-2026-08-02.md`](software-composition-analysis-2026-08-02.md)

## 1. Purpose

Use this runbook before changing dependencies in response to an SCA, registry advisory, Dependabot alert or maintenance review.

The goal is to make every security update:

- reproducible;
- attributable to a specific lockfile and commit;
- small enough to review and roll back;
- tested against the repository’s real runtime boundaries;
- separated from migrations, architecture rewrites and unrelated feature work.

## 2. Preconditions

Before opening the remediation branch:

1. pause unrelated edits to `package.json`, `pnpm-workspace.yaml` and `pnpm-lock.yaml`;
2. identify the current deployed commit and the current `main` commit;
3. confirm the production site and administrator application are operating normally enough to establish a baseline;
4. confirm PostgreSQL backup ownership and restore instructions;
5. confirm Replit Google Drive Integration is connected to the intended account and can read and write the wedding root and `系統縮圖`;
6. reserve a release observation window with a person able to roll back;
7. do not paste secrets, database URLs, Drive IDs or tokens into issues, pull requests or scanner output.

Dependency remediation must not be combined with:

- a database schema redesign;
- editing an already-applied migration;
- a Vite transform extraction;
- React, Node, pnpm or Vite major-version migration unless the advisory cannot be fixed otherwise;
- bulk Drive cleanup or thumbnail regeneration;
- an unrelated product feature.

## 3. Refresh the evidence first

The 2026-08-02 SCA is dated evidence. The package manifest and lockfile changed afterwards, so a fresh scan is required before using exact counts or asserting that a package remains at the recorded version.

Create a clean branch from current `main`, then run:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:layout-browser
```

Generate and retain:

- recursive pnpm dependency tree;
- pnpm audit JSON;
- OSV results;
- license inventory;
- outdated direct-dependency inventory;
- CycloneDX 1.6 SBOM;
- scan metadata and SHA-256 checksums.

Record the exact commit, Node version, pnpm version and UTC scan time.

## 4. Baseline functional checks

Record the pre-change result for:

### Public application

- `/Memories/` loads without an error boundary;
- Chinese and English routes work;
- album switching positions the active content correctly;
- wedding processes and album-scoped labels work;
- guestbook messages load and sort;
- per-album featured-photo cards remain scoped to the active album and label;
- photo pagination and fullscreen viewing work;
- Word content and image attachments render within the visible width.

### Guest upload and private management

- the current selection limit is displayed;
- one small test image can be uploaded in an approved non-production test context;
- retry and error messages remain bounded;
- the private management link lists the correct batch;
- no destructive deletion test is run against irreplaceable production photos.

### Administrator application

- `/Memories/admin/login` creates a valid session;
- all four administrator tabs open;
- album-scoped label controls load;
- photo filtering and bulk actions load;
- message management remains collapsed until opened;
- one safe draft/save flow works where production conditions permit it.

### Operations

- `/Memories/api/health` returns 200;
- migration runner has no unexpected pending destructive SQL;
- Drive Integration can read and write the approved test folder;
- no repeated `DRIVE_AUTHORIZATION_REQUIRED` or persistent `DRIVE_RETRYABLE` condition is present.

## 5. Remediation batches

Do not update every dependency in one pull request.

### Batch A — production runtime P0

Confirm and address:

- `drizzle-orm`;
- Multer;
- Sharp/libvips;
- `@google-cloud/storage` and its vulnerable transitive chain.

Keep separate commits for each parent dependency where practical. Run the affected API, upload, image-processing and database tests after each commit.

### Batch B — shared build toolchain

Confirm and address:

- Vite within the current supported major when possible;
- PostCSS;
- YAML;
- Babel;
- esbuild and any workspace override.

Because Memories still has exact-string Vite transforms, every Vite/build change requires:

- the completed production transform chain;
- production build;
- focused Chrome layout tests;
- manual or automated real-browser render checks for public and administrator routes.

### Batch C — code generation and preview inventory

Confirm and address:

- Orval and its transitive parser/documentation dependencies;
- Recharts/Lodash only after proving whether the component inventory is reachable;
- deprecated transitive packages;
- unknown-license metadata.

Prefer removing unused generated UI inventory over performing a major upgrade with no real application consumer.

## 6. Test selection rules

The repository uses Test Impact Analysis for PR commits and full integration validation after merge to `main`.

For dependency or lockfile changes, the impact selector treats the change as cross-cutting. Run the full validation set rather than relying on a narrow file-name match:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
```

Start the built server and verify:

```text
/Memories/api/health
```

Real Drive tests require an owner-approved test folder and configured integration. Do not point destructive diagnostics at the production wedding root.

## 7. Package-specific checks

### Drizzle ORM

- shared database package typecheck;
- SQL identifier and query tests;
- legacy API build and route smoke;
- no change to the Memories migration model;
- no use of `drizzle-kit push` for Memories.

### Multer

- normal image upload;
- malformed multipart request;
- deeply nested fields;
- aborted request cleanup;
- byte and file-count limits;
- no temporary-file or partial-object leak.

### Sharp

- orientation handling;
- WebP thumbnail output;
- hero 1600 × 900 processing;
- 192 × 192 site icon processing;
- HEIC/HEIF behavior where supported;
- native install on the deployment platform;
- production build and startup.

Treat a Sharp 0.x minor update as potentially breaking.

### Google Storage chain

This package belongs to the legacy API/Object Storage boundary, not Standalone Memories Drive storage.

- verify signed URL and upload behavior;
- verify XML/multipart error handling;
- verify only the intended legacy paths changed;
- require the legacy-boundary workflow and owner approval when protected files are touched.

### Vite and esbuild

- verify all configured plugins and transform order;
- confirm final generated references are defined;
- open public and administrator pages in a real browser;
- fail on `pageerror`, error boundary, blank page or unexpected console errors;
- preserve Replit build/development integration.

## 8. Pull-request and merge discipline

The remediation PR must include:

- the fresh pre-change SCA summary;
- exact parent packages changed;
- lockfile diff explanation;
- advisory identifiers addressed;
- tests and browser checks run;
- known findings intentionally left for later batches;
- rollback commit;
- updated SCA evidence after the final lockfile.

Do not claim “all vulnerabilities fixed” unless the post-change scan supports that exact statement. Prefer wording such as:

> The confirmed P0 production-runtime findings in this batch are no longer present in the post-change scan. Remaining findings are listed separately.

Merge only after required CI and the Memories legacy-boundary check pass.

## 9. Release and rollback

Before release:

- confirm production backup ownership;
- confirm no migration or unexpected DROP is included;
- confirm Secrets and Drive Integration are present;
- record the last known-good deployment commit;
- schedule 30–60 minutes for observation.

After release, watch for:

- HTTP 5xx and process restarts;
- PostgreSQL query or connection errors;
- upload parser failures;
- Sharp/native module or image-format errors;
- Drive 401, 403, 429 or 5xx responses;
- browser runtime and transform errors;
- incorrect image dimensions, orientation or WebP output.

Rollback is normally a code and lockfile rollback to the recorded compatible commit. Do not delete applied migrations or restore code that cannot read the current schema.

## 10. Completion criteria

A remediation batch is complete only when:

- the updated dependency is present in the frozen lockfile;
- the targeted advisory paths are absent or explicitly accepted in the post-change scan;
- relevant unit, API, browser-layout and production-build checks pass;
- the deployed application is observed without new errors;
- the SBOM and SCA evidence match the merged commit;
- documentation records remaining findings and the next batch;
- no secret or provider identifier was added to the repository.
