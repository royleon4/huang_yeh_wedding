# Legacy wedding site protection

Issue: #19

The invitation application and its original photo wall are immutable for Memories work.

## Protected paths

- `artifacts/wedding-invitation/**`
- `artifacts/api-server/src/routes/photos.ts`

The first path protects the invitation design, navigation, animations, embedded photo wall, and all existing client behavior. The second protects the original Object Storage list, upload, and image endpoints used by that photo wall.

## Pull-request guard

`.github/workflows/memories-legacy-boundary.yml` compares each pull request with its base branch and fails when a protected path changes.

Run the same check locally:

```bash
node scripts/check-memories-legacy-boundary.mjs origin/main HEAD
```

## Owner-approved exception

A protected-path change requires an explicit owner decision recorded in the issue or pull request. Only then may the pull request receive the label:

```text
owner-approved-legacy-change
```

The label bypasses the automated path check; it is not general permission to refactor unrelated legacy code. The pull request must still document the exact requested change and regression evidence.

## Additive root changes

Standalone Memories may add root workspace, routing, workflow, or deployment entries only when:

1. the change is additive;
2. it does not change ownership or behavior of `/` or legacy `/api/photos*`;
3. route tests cover both the old and new namespaces;
4. no legacy source import is introduced.

## Remaining work

The path guard is the first protection layer. The ticket still requires deployed-style smoke tests and representative visual/regression evidence for the existing photo wall without modifying its implementation.
