# Standalone Memories｜Product Phase 1 closeout and next steps

> **Decision:** Product Phase 1 is complete  
> **Recorded:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)  
> **Baseline commit:** `4fb33f0655eca557c6755066bce8083b0f15c7df`  
> **Scope:** Product delivery baseline, not completion of all architecture hardening or future features

## Current progress note — 2026-08-04

This dated closeout remains the historical Product Phase 1 decision. The baseline commit and closeout evidence are not rewritten when later features are added.

Since closeout, current `main` has added or improved:

- album-scoped labels for every non-guest album;
- process-title overrides for public label text, including the all-wedding-process label;
- a message/guestbook album type with public submission, sorting and administrator moderation;
- per-album random featured-photo ranges with active-album and active-label context isolation;
- Word content import with browser-width containment and image-only general attachments;
- focused real-Chrome layout validation for navigation and guestbook surfaces;
- Test Impact Analysis and Selective Test Execution for PR commits, while `main` retains the full integration gate;
- migrations `014_guestbook_messages.sql`, `015_album_scoped_labels.sql` and `016_explicit_guest_album_membership.sql`;
- a verified Production → Development database copy/rollback runbook;
- a repository-wide Software Composition Analysis and a dependency-remediation preparation runbook.

The 2026-08-02 SCA is dated evidence. The package manifest and lockfile changed afterwards, so its exact component and vulnerability counts do not describe current `main`; a fresh scan is required before remediation.

See:

- [`software-composition-analysis-2026-08-02.md`](software-composition-analysis-2026-08-02.md)
- [`security-remediation-readiness-2026-08-04.md`](security-remediation-readiness-2026-08-04.md)
- [`memories/testing-strategy.md`](memories/testing-strategy.md)

The following closeout sections preserve the original decision and remain the reference for Phase 1 scope.

## 1. What “Phase 1 complete” means

Phase 1 establishes a usable, deployable and maintainable first version of Standalone Memories under `/Memories/`.

The completed baseline includes:

- bilingual public wedding archive;
- stable identity routes for albums, labels, photos and administrator tabs;
- wedding-process video, rich content, attachments, dividers and pinned photos;
- traditional and wheel-based subcategory navigation with independent per-album looping;
- responsive bottom navigation, language control and fullscreen photo viewing;
- guest uploads with configurable limits, bounded concurrency, fair retry and private management links;
- content-based duplicate handling and resumable Google Drive uploads;
- private batch token rotation and permanent photo deletion;
- administrator login, settings, albums, Drive-backed processes, photos, guest labels, appearance, copy and site icon management;
- PostgreSQL application state with immutable tracked migrations;
- Google Drive originals, attachments and generated thumbnails;
- production build, health smoke and legacy-boundary CI;
- role-based user, administrator and operations documentation.

Phase 1 completion does **not** mean that every desired feature, browser matrix, architecture refactor or recovery feature is finished.

## 2. Evidence at closeout

The baseline reviewed for this closeout is the `main` commit produced by the validation-test refactor.

Recorded automated evidence:

- **429 / 429 Memories tests passed**;
- production Vite and server build passed;
- production server health smoke passed at `/Memories/api/health`;
- Memories legacy-boundary workflow passed.

The current CI at closeout did not run a complete Playwright browser gate. Therefore this closeout does not claim automated proof of every final React interaction in a real browser.

Later focused Chrome layout checks improve coverage but do not yet replace the missing required end-to-end Playwright production-browser gate.

## 3. Accepted Phase 1 limitations

The following items are explicitly deferred rather than silently treated as complete:

- no seven-day trash or restore workflow; deletion is immediate and permanent;
- direct Drive deletion does not perform full PostgreSQL/application cleanup;
- no people classification or selfie-based “Find me” feature;
- no approved face provider or biometric-data operating model;
- no required Playwright production-browser suite;
- limited documented real-device coverage for iOS Safari, Android Chrome and embedded LINE/Instagram browsers;
- exact-string Vite transforms remain the largest production-only architecture risk;
- administrator upload classification still uses client-side follow-up PATCH requests rather than one atomic server command;
- settings remain distributed across several normalization, API, repository, UI and transform layers;
- legacy invitation/API retention strategy is not yet decided;
- recurring SCA/SBOM automation and the first dependency-remediation batches are not complete.

## 4. Recommended next steps

The dates below are **suggested planning windows**, not commitments. Reorder when a dependency, security finding or production incident justifies it.

| Priority | Suggested window | Next step | Why now | Completion evidence |
| --- | --- | --- | --- | --- |
| P0 | 2026-08-02 to 2026-08-07 | Add a production Playwright gate | The health endpoint and focused layout checks cannot prove the complete deployed interaction flow | Public page, language switch, album/label navigation, message/photo album types, photo viewer, admin login/tabs and private-management route run without `pageerror` or unexpected console errors |
| P0 | 2026-08-02 to 2026-08-07 | Capture a release browser baseline | Phase 1 needs reproducible visual and behavior evidence | Desktop and mobile-width screenshots plus a short checklist are stored for public, upload, guestbook, admin and empty/error states |
| P0 | Immediate security track | Re-scan current lockfile and begin confirmed production-runtime dependency remediation | The dated SCA predates later package and lockfile changes | Current-commit SBOM and scan exist; confirmed P0 runtime findings are fixed in small batches and post-change scans match the merged lockfile |
| P0 | 2026-08-08 to 2026-08-21 | Begin removing exact-string UI transforms | This is the highest known production-only regression risk | `AdminPhotoWorkspace` is directly composed in React, its transform is deleted, behavior tests replace source-string assertions and the browser gate remains green |
| P1 | 2026-08-08 to 2026-08-21 | Add operational observability and recovery records | A completed background job can still contain per-photo failures | Structured sync/upload summaries, correlation timestamps, backup ownership and a documented restore drill exist without logging secrets or image bytes |
| P1 | 2026-08-15 to 2026-08-28 | Create central settings and route registries | New settings currently require repeated edits across many layers | Defaults, validation, public exposure and storage mapping derive from one registry; duplicated key handling is removed incrementally |
| P1 | 2026-08-22 to 2026-09-04 | Add an atomic administrator upload-and-classify command | Current client upload-then-PATCH flow can leave partially classified results | One server command accepts the classification intent, is idempotent and returns a persisted per-photo result |
| P1 | 2026-08-22 to 2026-09-04 | Complete real-device acceptance | Phase 1 behavior is not yet proven across the main guest devices | iOS Safari, Android Chrome, LINE and Instagram webviews are checked on slow and normal networks with recorded results |
| P2 | 2026-09-05 to 2026-09-18 | Continue component and service extraction | `App.jsx`, `AdminApp.jsx` and editor components still have too many responsibilities | Direct panels/hooks/services replace transforms one slice at a time; no big-bang rewrite |
| P2 | 2026-09-05 to 2026-09-18 | Design deletion lifecycle and recovery | Permanent-only deletion is risky for wedding memories | Owner decides between permanent-only, delayed purge or trash/restore; storage, UI and audit requirements are documented before implementation |
| P2 | After 2026-09-01 decision gate | Decide Product Phase 2 scope | People and Find-me require privacy, hosting and product decisions | Owner approves a written scope, privacy model, provider/hosting decision, test dataset and cost limit, or explicitly defers the feature |
| P3 | After architecture P0/P1 work | Audit invitation and legacy API dependencies | Legacy generated inventory and build externals remain oversized | Static import graph exists; removals are isolated, owner-approved and protected by legacy regression evidence |

## 5. Recommended execution order

### Track A — release confidence

1. Playwright production browser gate.
2. Screenshot and behavior baseline.
3. Real-device/browser matrix.
4. Release checklist automation where practical.

### Track B — security and supply-chain confidence

1. Re-scan current `main` with a frozen install.
2. Fix confirmed production-runtime dependency findings in small batches.
3. Re-scan and retain CycloneDX/SCA evidence for each merged lockfile.
4. Add recurring SCA/SBOM automation after the first manual remediation cycle is stable.

### Track C — architecture risk reduction

1. Directly render `AdminPhotoWorkspace`.
2. Directly render General and process-management panels.
3. Extract public `ProcessMediaSequence`.
4. Delete each obsolete transform immediately after its replacement.
5. Replace source-string tests with behavior tests.

### Track D — domain correctness

1. Atomic administrator upload/classification command.
2. Shared command-result shape.
3. Explicit upload state transitions and idempotency.
4. Shared cursor-aware pagination services.

### Track E — product decisions

1. Deletion/trash policy.
2. People and Find-me privacy and provider decision.
3. Legacy invitation/API long-term ownership.

Tracks A, B and C should start before adding major Phase 2 user-facing features.

## 6. Owner decisions required before Product Phase 2

The repository cannot decide these safely from code alone:

- whether deleted wedding photos need a recovery period;
- whether face processing is acceptable at all;
- whether face embeddings may be stored and for how long;
- whether CompreFace, Amazon Rekognition, another provider or no provider is preferred;
- the maximum recurring hosting/vendor cost;
- the retention period for temporary selfies and derived face data;
- whether the legacy invitation and old photo wall remain indefinitely;
- which browsers and devices are release-blocking;
- what vulnerability severity and exposure constitute a release blocker;
- how long SBOM, SCA and license evidence must be retained.

Record each decision in a dated document or issue before implementation.

## 7. Definition of ready for Product Phase 2

Product Phase 2 feature development should begin only when:

- the production Playwright gate is required and green;
- the Phase 1 browser baseline is recorded;
- at least the first high-risk transform is removed or isolated behind direct React composition;
- current-lockfile SCA evidence exists and confirmed P0 production-runtime findings have an owner-approved disposition;
- recovery and rollback responsibilities are documented;
- the Phase 2 scope and privacy decisions are owner-approved;
- current documentation still matches `main`.

## 8. Closeout statement

Product Phase 1 is accepted as the production baseline at **2026-08-01T19:33:00+08:00**.

Future work must preserve the Phase 1 route, data, privacy and legacy-boundary contracts unless a PR explicitly changes one of them with owner approval, migration safety, updated documentation and regression evidence.
