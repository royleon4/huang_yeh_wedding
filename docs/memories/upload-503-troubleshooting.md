# Troubleshooting Memories 503 responses

## Identify the endpoint first

| Endpoint | Dependencies before success |
| --- | --- |
| `POST /Memories/admin/api/session` | `MEMORIES_ADMIN_TOKEN` and PostgreSQL login-failure store; no Drive runtime |
| `PATCH /Memories/admin/api/changes` | Valid admin cookie, PostgreSQL and operation-specific Drive access |
| `GET /Memories/api/processes` | Full runtime: migrations, PostgreSQL, Drive root and reserved-folder lookup |
| `POST /Memories/api/upload-batches` | PostgreSQL runtime and valid classification |
| `POST /Memories/api/upload-batches/:id/photos` | Image processing, durable state, Drive writes and final DB insert |
| `GET /Memories/api/photos/:id/thumbnail` | Photo row plus Drive thumbnail/original access |

## Required Published App configuration

Connect Replit Google Drive Integration and set:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

Using obsolete `SECRET_TOKEN` causes:

```text
503 ADMIN_TOKEN_NOT_CONFIGURED
```

Development secrets and local Connector access do not automatically configure the Published App.

## Admin login codes

- `ADMIN_TOKEN_NOT_CONFIGURED`: Published App did not receive `MEMORIES_ADMIN_TOKEN`.
- `ADMIN_RATE_LIMIT_UNAVAILABLE`: PostgreSQL limiter failed, often due to wrong `DATABASE_URL`, unavailable DB or missing migration 009.
- `UNAUTHORIZED`: wrong password or invalid/expired session.
- `RATE_LIMITED`: too many failed attempts within the current window.

Admin login does not initialize Drive. A simultaneous Drive sync warning is a separate background task unless the failing request is a runtime-dependent API after login.

## Global admin save failures

`PATCH /Memories/admin/api/changes` returns one result per requested operation. Partial failure is expected to be recoverable:

- successful operations are removed from client draft state;
- failed operations remain pending;
- category/photo operations may fail because their required Drive action failed;
- a failed binary photo upload occurs after the JSON batch and remains selected for retry.

Do not interpret one failed operation as proof that every operation was rolled back or saved. Inspect the per-operation results.

## Guest upload stages

1. Create upload batch.
2. Parse and validate one photo.
3. Normalize image and create WebP.
4. Claim durable upload state.
5. Find or upload deterministic original and thumbnail.
6. Insert photo and relationships.
7. Mark durable item ready.

A batch ID followed by per-photo `503` means batch creation succeeded but a later image, Drive or DB step failed.

## Storage codes

- `MEMORIES_ROOT_FOLDER_MISSING`: missing `MEMORIES_DRIVE_PHOTOS_FOLDER_ID`.
- `DRIVE_AUTHORIZATION_REQUIRED`: Connector 401/403; reconnect and verify folder edit access.
- `DRIVE_RETRYABLE`: Connector/Drive 429 or 5xx; retry safely.
- `DRIVE_REQUEST_FAILED`: non-retryable Drive rejection.
- `THUMBNAIL_FOLDER_NOT_CONFIGURED`: `系統縮圖` could not be found or created.
- `MEMORIES_STORAGE_UNAVAILABLE`: another bounded dependency failed.
- PostgreSQL `42P01`: queried table does not exist; apply tracked migrations.

The API intentionally omits folder IDs, Connector bodies, DB URLs, OAuth details, admin secrets and raw guest tokens.

## Background logs

`Memories Drive synchronization failed { code: 'DRIVE_RETRYABLE' }` is a background scan failure, not proof of admin-password failure.

A thumbnail summary with `attempted: 12`, `createdOrAttached: 0` and one authorization code means the default first batch of 12 all failed. Fix the shared authorization/folder problem before increasing batch size.

`Memories background synchronization completed` only means the scheduled task reached its end; collected thumbnail failures may still exist.

## Current recovery limitation

If the first full runtime initialization rejects, the cached Promise can remain rejected until restart. After correcting DB, Drive or secrets, restart or re-publish before retesting.
