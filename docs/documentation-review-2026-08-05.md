# Documentation review｜2026-08-05

> **Lifecycle:** Dated documentation evidence  
> **Reviewed:** 2026-08-05T10:31:00+08:00 (Asia/Taipei)  
> **Current main baseline:** `09293817935f5548aa4c7ef6918db9afd0a62b98`  
> **Scope:** Documentation and documentation-only SVG assets

## Purpose

This review refreshes the repository documentation for the current Phase 2.1 browser、In-App Browser and performance gates, removes duplicated README material, and adds a from-zero construction and multi-cloud deployment handbook。

## Current behavior verified against `main`

- Product Phase 1 remains complete。
- Production Playwright covers Chromium、Firefox、WebKit and representative Samsung Internet、WeChat、LINE、Facebook and Instagram profiles。
- Physical-device rows remain separate and must not be inferred from automated user-agent profiles。
- Public entry code-splits Admin、login and private management routes。
- The first public photo request is 24 records and later cursor pages yield before continuing。
- `window.__MEMORIES_WEB_VITALS__` exposes local LCP、CLS、interaction and navigation diagnostics。
- Production build emits bundle reports and enforces current gzip ceilings。
- Migrations currently extend through `016_explicit_guest_album_membership.sql`。
- Word-related import is supported；PDF/PPT import and non-image general attachments are not current contracts。
- Google Drive media currently depends on Replit `@replit/connectors-sdk`。

## README changes

The root README was reduced from a long mixed handbook into a repository landing page containing:

- CI badges；
- current Phase 2.1 status；
- architecture and deployment SVGs；
- application and feature tables；
- current stack；
- quick start；
- production settings and routes；
- migration safety；
- browser/performance gate summary；
- direct role and deployment links。

Detailed operating and architecture content now lives in dedicated documents rather than being repeated in the README。

## New handbook

`docs/site-handbook/` adds 28 files:

### Visual assets

1. `assets/system-architecture.svg`
2. `assets/build-and-release-flow.svg`
3. `assets/deployment-options.svg`

### Handbook index and core chapters

1. `README.md`
2. `00-overview.md`
3. `01-technology-stack.md`
4. `02-prerequisites.md`
5. `03-local-development.md`
6. `04-configuration-and-secrets.md`
7. `05-database-and-migrations.md`
8. `06-media-storage.md`
9. `07-security-and-privacy.md`
10. `08-testing-and-ci.md`
11. `09-release-observability.md`
12. `10-backup-and-disaster-recovery.md`
13. `11-portability.md`
14. `12-performance.md`

### Deployment guides

1. `deployments/README.md`
2. `deployments/replit.md`
3. `deployments/on-premise.md`
4. `deployments/google-cloud.md`
5. `deployments/aws.md`
6. `deployments/microsoft-azure.md`
7. `deployments/oracle-cloud.md`
8. `deployments/kubernetes.md`

### References

1. `reference/command-reference.md`
2. `reference/troubleshooting.md`
3. `reference/release-checklists.md`

## Existing documents refreshed

- `README.md`
- `DOCUMENTATION.md`
- `MAINTAINER_GUIDE.md`
- `OPERATIONS_GUIDE.md`
- `artifacts/memories-album/README.md`
- `docs/README.md`
- `replit.md`

## Deployment documentation rules

Each deployment guide includes:

- architecture diagram；
- prerequisites；
- identity/Secret model；
- PostgreSQL setup；
- media-storage requirements；
- migration execution；
- health and browser checks；
- logs/metrics/alerts；
- backup and rollback；
- official provider references。

The documents explicitly distinguish:

| Classification | Meaning |
| --- | --- |
| Current repository | Already implemented and directly verifiable |
| Portable target | Required architecture for another platform；not yet implemented in current code |
| Optional enhancement | Recommended but not required to start current Replit deployment |

No non-Replit guide claims that the current Replit Google Drive Connector can run unchanged outside Replit。

## Visual documentation

The handbook contains three GitHub-renderable SVG diagrams and Mermaid diagrams for:

- system boundaries；
- user/upload/admin data flows；
- build/release process；
- deployment choices；
- schema relationships；
- upload states；
- security trust boundaries；
- browser/CI gates；
- monitoring and rollback；
- backup/restore；
- cloud topologies。

No product UI layout、spacing、font、size、color or DOM order was changed。

## Validation scope

This branch changes only Markdown and SVG documentation assets。It does not change:

- product JavaScript/TypeScript/CSS；
- package manifests or lockfile；
- database schema or migration files；
- Replit runtime configuration；
- Google Drive data；
- production Secrets。

Validation consists of:

- compare against current `main`；
- confirm all new files are indexed；
- confirm relative links and route/migration/workflow names；
- confirm current Playwright and performance status；
- confirm no secret、real provider ID、database URL or private token was added；
- confirm the legacy boundary remains untouched；
- allow repository documentation/legacy checks to validate the PR merge result。

## Follow-up maintenance

- Update the cloud guides when provider CLI/API contracts change。
- Update the performance chapter when responsive images or truly on-demand cursor loading are implemented。
- Update the physical-device matrix with exact device/app/network evidence。
- Keep dated SCA reports tied to the scanned lockfile and commit。
- Preserve README as a concise landing page；place detailed procedures in the handbook。
