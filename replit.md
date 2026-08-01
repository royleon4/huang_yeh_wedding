# Workspace

> **Product status:** Standalone Memories Phase 1 complete  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)  
> **Maintainer handbook:** [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md)  
> **Next work:** [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md)

## Overview

This repository is a pnpm monorepo with two user-facing wedding applications, one legacy API, a standalone Memories service, shared server libraries, and a Replit Canvas preview artifact.

The production-critical photo archive is `artifacts/memories-album`. It intentionally owns its own HTTP server, PostgreSQL migrations, Google Drive integration, public gallery, guest uploads, private batch management, and administrator application.

Product Phase 1 is the accepted functional baseline. Architecture hardening remains active work, especially production browser coverage and incremental removal of exact-string Vite transforms.

## Runtime applications

| Package | Purpose | Main route / port |
| --- | --- | --- |
| `@workspace/wedding-invitation` | Legacy wedding invitation and original photo wall | `/`, port `19315` |
| `@workspace/memories-album` | Standalone wedding archive and administration | `/Memories/`, port `19316` |
| `@workspace/api-server` | Legacy Express API and Object Storage endpoints | `/api`, port `8080` |
| `@workspace/mockup-sandbox` | Replit Canvas component preview server | `/__mockup`, port `8081` |

Do not treat `mockup-sandbox` as dead application code: `.replit` registers it as a Canvas artifact and its generated module registry loads preview components dynamically.

## Shared packages

| Package | Purpose |
| --- | --- |
| `lib/api-spec` | OpenAPI specification and Orval configuration |
| `lib/api-zod` | Generated Zod schemas used by the legacy API |
| `lib/db` | Legacy Drizzle/PostgreSQL connection and schemas |
| `scripts` | Workspace utilities and repository safety checks |

The former generated React Query client package was removed because no application imported it. Orval now generates only the Zod output that has an active consumer.

## Toolchain

- Node.js 24
- pnpm 10.x
- TypeScript 5.9
- React 19 + Vite
- Express 5 for the legacy API
- PostgreSQL
- Google Drive through Replit Connectors for Memories
- Google Cloud Object Storage for the legacy photo wall
- Node test runner and GitHub Actions

## Commands

From the repository root:

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

Run individual applications:

```bash
pnpm --filter @workspace/wedding-invitation dev
pnpm --filter @workspace/memories-album dev
pnpm --filter @workspace/api-server dev
pnpm --filter @workspace/mockup-sandbox dev
```

Memories validation:

```bash
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

`test:drive-live` requires a safe test folder and connected Replit Google Drive Integration. It must not use the production wedding root for destructive diagnostics.

## TypeScript project references

The root `tsconfig.json` references only active shared TypeScript libraries. Application typechecks are run through their package scripts.

- `lib/db`
- `lib/api-zod`

`pnpm run typecheck` first builds shared declarations, then runs package-level typechecks for artifacts and scripts.

## Database ownership and safety

There are two distinct database models:

1. The legacy API uses `lib/db` and Drizzle.
2. Memories uses immutable SQL migrations under `artifacts/memories-album/db`.

Never use `drizzle-kit push` to manage Memories tables. Memories migrations are checksum-protected, ordered SQL files and must remain additive by default. A deployment plan proposing `DROP TABLE`, `DROP COLUMN`, or removal of an existing constraint must be cancelled and investigated.

Do not edit an applied migration. Add a new numbered file and preserve compatibility with the currently deployed application when rollback may be required.

## Repository boundaries

Memories changes should not silently modify the legacy invitation, legacy `/api/photos*`, or Object Storage photo-wall implementation. The `Memories legacy boundary` workflow enforces this unless a repository owner explicitly labels the PR `owner-approved-legacy-change`.

When a change intentionally covers the whole repository, document each legacy modification in the PR and apply that label only after reviewing the exact diff and regression evidence.

## Production configuration

Required Replit Secrets:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The Published App must also connect Replit Google Drive Integration.

Never place actual values, OAuth credentials, management tokens, resumable session URIs, connector response bodies or Drive folder IDs in source, documentation, `.replit`, public logs or browser code.

## Architecture warning

Memories currently uses several Vite pre-transforms that perform exact string replacement against `App.jsx` and `AdminApp.jsx`. This is a temporary compatibility layer, not the target architecture.

Changes touching transformed surfaces must:

1. run the complete official transform chain;
2. run the production build;
3. open the final public and administrator surfaces in a real browser;
4. check for blank screens, missing controls, console errors and `pageerror`;
5. prefer deleting one transform after direct React composition instead of adding more replacement rules.

The current CI does not yet provide a required Playwright browser gate. Health success proves only that the server responds.

See [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md) for the debt inventory and [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md) for the recommended order of work.

## Documentation rule

Use [`DOCUMENTATION.md`](DOCUMENTATION.md) to determine whether a file is Current, Historical, Research, Diagnostic or Internal. Update the role guide, technical contract and maintainer guide in the same PR whenever behavior or operating procedure changes.
