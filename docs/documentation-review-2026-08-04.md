# Documentation review｜2026-08-04

> **Lifecycle:** Dated documentation evidence  
> **Reviewed:** 2026-08-04T03:11:00+08:00 (Asia/Taipei)  
> **Baseline:** `52008c1470b5fe74764a5b7f1956a676622f52f7`

## Scope reviewed

The review covered the current repository entry points, documentation index, maintainer and operations handbooks, Phase 1 closeout, Standalone Memories technical README, current testing strategy, recent migrations, package manifest changes, and the dated Software Composition Analysis evidence.

The review also compared documentation against post-closeout implementation changes, including:

- guestbook/message albums;
- album-scoped labels and explicit guest album membership;
- per-album featured-photo context;
- Word content import and image-only attachments;
- focused Chrome layout checks;
- Test Impact Analysis and Selective Test Execution;
- migrations through `016_explicit_guest_album_membership.sql`;
- package and lockfile changes after the 2026-08-02 SCA.

## Main corrections

1. Updated current-document baselines from the 2026-08-01 closeout commit to the reviewed 2026-08-04 `main` commit where the document describes current behavior.
2. Preserved the original Phase 1 closeout baseline as historical evidence and added a separate post-closeout progress note.
3. Corrected migration references from `013_drive_resumable_upload.sql` to `016_explicit_guest_album_membership.sql` in current technical and operations documentation.
4. Documented message albums, album-scoped labels, process-title label overrides, per-album featured photos, Word import, image-only attachments, and the current CI strategy.
5. Added a dated SCA record and a current dependency-remediation preparation runbook.
6. Marked the 2026-08-02 SCA as dated evidence because package and lockfile changes occurred after the scan.
7. Clarified that focused Chrome layout checks improve coverage but do not replace a required production Playwright end-to-end gate.
8. Added frozen-lockfile, SBOM, re-scan, rollback, backup, Drive authorization and package-specific validation requirements for dependency remediation.

## Files updated

- `README.md`
- `DOCUMENTATION.md`
- `MAINTAINER_GUIDE.md`
- `OPERATIONS_GUIDE.md`
- `artifacts/memories-album/README.md`
- `docs/phase-1-closeout-2026-08-01.md`
- `docs/software-composition-analysis-2026-08-02.md`
- `docs/security-remediation-readiness-2026-08-04.md`

## Validation approach

This change is documentation-only. The repository's impact selector is expected to skip dependency installation and executable tests for Markdown-only changes. Validation consists of:

- reviewing the branch diff against the current baseline;
- checking that new documents are linked from the repository entry and documentation index;
- preserving exact route, migration, package and workflow names from current `main`;
- ensuring no secrets, Drive IDs, database URLs, private tokens or scanner payloads were added;
- confirming the Memories legacy boundary remains untouched.

## Remaining documentation work

The large role-specific user and administrator guides should continue to be updated in the same pull request whenever later UI behavior changes. This review updates the current repository, technical, operational, testing, security and handoff contracts; it does not claim that every historical conversation export or GitHub issue has been rewritten.
