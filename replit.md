# Workspace

## Overview

This repository is a pnpm monorepo with two user-facing wedding applications, one legacy API, a standalone Memories service, shared server libraries, and a Replit Canvas preview artifact.

The production-critical photo archive is `artifacts/memories-album`. It intentionally owns its own HTTP server, PostgreSQL migrations, Google Drive integration, public gallery, guest uploads, private batch management, and administrator application.

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
```

## TypeScript project references

The root `tsconfig.json` references only active shared TypeScript libraries. Application typechecks are run through their package scripts.

- `lib/db`
- `lib/api-zod`

`pnpm run typecheck` first builds shared declarations, then runs package-level typechecks for artifacts and scripts.

## Database ownership and safety

There are two distinct database models:

1. The legacy API uses `lib/db` and Drizzle.
2. Memories uses immutable SQL migrations under `artifacts/memories-album/db`.

Never use `drizzle-kit push` to manage Memories tables. Memories migrations are checksum-protected, ordered SQL files and must remain additive. A deployment plan proposing `DROP TABLE`, `DROP COLUMN`, or removal of an existing constraint must be cancelled and investigated.

## Repository boundaries

Memories changes should not silently modify the legacy invitation, legacy `/api/photos*`, or Object Storage photo-wall implementation. The `Memories legacy boundary` workflow enforces this unless a repository owner explicitly labels the PR `owner-approved-legacy-change`.

When a change intentionally covers the whole repository, document each legacy modification in the PR and apply that label only after reviewing the diff.

## Architecture warning

Memories currently uses several Vite pre-transforms that perform exact string replacement against `App.jsx` and `AdminApp.jsx`. This is a temporary compatibility layer, not the target architecture. Changes touching those files must run the complete transform chain and a production browser smoke test; isolated source tests are not sufficient.

See `docs/code-health-audit-2026-07.md` for the current refactoring roadmap and code-smell inventory.
