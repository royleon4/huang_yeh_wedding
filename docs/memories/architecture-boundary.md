# Memories isolation and ownership boundary

> **Status:** Current  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)

Standalone Memories is an independent application inside the monorepo. Its route, runtime, storage, migrations and security boundary must remain separate from the legacy invitation photo wall.

## Runtime namespace

| Surface | Canonical namespace |
| --- | --- |
| Public web | `/Memories/*` |
| Public API | `/Memories/api/*` |
| Administrator web | `/Memories/admin/*` |
| Administrator API | `/Memories/admin/api/*` |
| Compatibility redirects | lowercase `/memories/*` and old root `/admin*` only |

The Replit router sends the Memories namespace to port `19316`. The production health endpoint is `/Memories/api/health`.

## Memories ownership

`artifacts/memories-album` owns:

- public archive and guest upload UI;
- private upload-batch management;
- administrator authentication and application;
- Node HTTP routes under the Memories namespace;
- PostgreSQL repositories and immutable migrations;
- Google Drive originals, attachments, thumbnails and process-folder integration;
- background reconciliation and thumbnail jobs;
- application settings, route models and stable identities;
- Memories tests, production build and deployment lifecycle.

People classification, selfie search and any face-engine adapter are **not currently implemented or approved**. If approved later, they must remain inside the Memories boundary and follow an owner-approved privacy, retention, provider and deletion contract.

## Legacy ownership

The legacy invitation and photo wall own:

- `/` and invitation navigation;
- `artifacts/wedding-invitation/**`;
- legacy `/api/photos*` routes;
- the Object Storage photo implementation;
- existing legacy database and API contracts.

Memories must not import legacy invitation code, call legacy photo endpoints, read or migrate legacy Object Storage photos, or silently alter the invitation page.

## Protected paths

Ordinary Memories work must not change:

```text
artifacts/wedding-invitation/**
artifacts/api-server/src/routes/photos.ts
```

The `Memories legacy boundary` workflow enforces this. An exception requires an explicit owner decision, exact regression evidence and the narrowly scoped `owner-approved-legacy-change` label.

## Data boundary

- Google Drive owns Memories original media, attachments, generated thumbnails and numbered process folders.
- PostgreSQL owns Memories visibility, relationships, upload state, token hashes, content hashes, settings and administrator overrides.
- The browser receives opaque Memories IDs and controlled media URLs.
- Drive IDs, folder IDs, OAuth details, connector responses, resumable session URIs, database credentials and raw management tokens remain server-side.
- Legacy Object Storage data is neither read nor migrated by Memories.

See [`storage-drive.md`](storage-drive.md) and [`drive-process-sync.md`](drive-process-sync.md).

## Root configuration changes

Root workspace, Replit, workflow or routing files may receive additive entries required to register or operate Standalone Memories only when:

1. `/` remains owned by the invitation application;
2. legacy `/api/photos*` remains owned by the legacy API;
3. route tests prove both old and new namespaces;
4. no legacy source import is introduced;
5. the change is documented in the PR.

## Decision gates

Owner approval is required before:

- changing the canonical `/Memories` path or deployment domain;
- moving Memories to another repository or hosting model;
- sharing tables, storage or credentials with the legacy application;
- changing administrator authentication or session scope;
- introducing destructive migrations or a cross-system data migration;
- adopting face/biometric processing, a provider, external hosting or a retention model;
- changing the permanent deletion contract or adding trash/restore behavior;
- bypassing the legacy protected-path workflow.

## Change review checklist

A boundary-sensitive PR must answer:

- Which runtime namespace changes?
- Which application owns the affected data before and after the change?
- Does any provider identifier or secret reach the browser?
- Does the PR touch a protected path?
- Are migration and rollback behavior explicit?
- Are route, build, browser and legacy-boundary tests included?
- Are current documents updated?

For the complete maintainer workflow, see [`../../MAINTAINER_GUIDE.md`](../../MAINTAINER_GUIDE.md).
