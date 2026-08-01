# Legacy wedding site protection

> **Status:** Current boundary contract  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)

Issue: #19

The invitation application and its original photo wall are immutable for ordinary Memories work.

## Protected paths

```text
artifacts/wedding-invitation/**
artifacts/api-server/src/routes/photos.ts
```

The first path protects the invitation design, navigation, animations, embedded photo wall and existing client behavior. The second protects the original Object Storage list, upload and image endpoints used by that photo wall.

## Pull-request guard

`.github/workflows/memories-legacy-boundary.yml` compares each pull request with its base branch and fails when a protected path changes.

Run the same check locally:

```bash
node scripts/check-memories-legacy-boundary.mjs origin/main HEAD
```

## Owner-approved exception

A protected-path change requires an explicit owner decision recorded in the issue or pull request. Only then may the pull request receive:

```text
owner-approved-legacy-change
```

The label bypasses the automated path check; it is not general permission to refactor unrelated legacy code.

The pull request must document:

- the exact protected files changed;
- why a Memories-only solution is insufficient;
- route and storage ownership before and after;
- regression evidence for the invitation and legacy photo wall;
- rollback or forward-fix behavior;
- confirmation that the change does not silently migrate or delete legacy data.

## Additive root changes

Standalone Memories may add root workspace, routing, workflow or deployment entries only when:

1. the change is additive;
2. it does not change ownership or behavior of `/` or legacy `/api/photos*`;
3. route tests cover both old and new namespaces;
4. no legacy source import is introduced;
5. documentation and PR scope explain the cross-repository effect.

## Current protection layers

- protected-path GitHub Actions guard;
- route tests proving `/` and legacy `/api/photos*` are not claimed by Memories;
- production build and Memories health smoke;
- owner-review requirement for the bypass label.

## Remaining hardening

The path guard does not prove the old invitation still renders correctly in a real browser. A future browser suite or recorded deployed-style baseline should include representative invitation and legacy photo-wall checks without changing their implementation.

Long-term archive, retention or migration of the legacy application is an owner decision and must not be inferred from cleanup work.

See [`architecture-boundary.md`](architecture-boundary.md), [`../../MAINTAINER_GUIDE.md`](../../MAINTAINER_GUIDE.md) and [`../phase-1-closeout-2026-08-01.md`](../phase-1-closeout-2026-08-01.md).
