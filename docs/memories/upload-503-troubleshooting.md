# Troubleshooting Memories 503 responses

## First identify the endpoint

A `503` on administrator login, public gallery initialization and photo upload can have different causes. Inspect the failing request and its JSON `code` before changing Drive or database settings.

| Endpoint | Dependencies before success |
| --- | --- |
| `POST /Memories/admin/api/session` | `MEMORIES_ADMIN_TOKEN` and PostgreSQL login-failure store; it does not require Google Drive runtime |
| `GET /Memories/api/processes` | Full Memories runtime: migrations, PostgreSQL, Drive root and reserved folder lookup |
| `POST /Memories/api/upload-batches` | PostgreSQL runtime and valid classification data |
| `POST /Memories/api/upload-batches/:id/photos` | Image processing, durable upload state, Drive original/thumbnail writes and final PostgreSQL insert |
| `GET /Memories/api/photos/:id/thumbnail` | PostgreSQL photo row and Drive thumbnail/original access |

## Required Published App configuration

Connect the Replit Google Drive Integration and set these **Production Secrets**:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The exact admin key is `MEMORIES_ADMIN_TOKEN`. Using the obsolete `SECRET_TOKEN` name causes:

```text
503 ADMIN_TOKEN_NOT_CONFIGURED
```

Project Editor secrets, development database URLs and local Connector access do not automatically configure the Published App.

## Administrator login codes

- `ADMIN_TOKEN_NOT_CONFIGURED`: the Published App did not receive `MEMORIES_ADMIN_TOKEN`.
- `ADMIN_RATE_LIMIT_UNAVAILABLE`: the PostgreSQL rate-limit operation failed, commonly because `DATABASE_URL` is wrong, the database is unavailable or migration `009_admin_login_failures.sql` was not applied.
- `UNAUTHORIZED`: the password was compared and did not match, or the session cookie is invalid/expired.
- `RATE_LIMITED`: too many failed attempts occurred within the current one-minute window.

The login endpoint should not initialize Google Drive. A Drive synchronization warning appearing at the same time is a separate background job unless the failing Network request is a runtime-dependent admin API after login.

## Guest upload stages

1. Create an upload batch in PostgreSQL.
2. For each photo, parse and validate the multipart request.
3. Normalize the image and create a WebP thumbnail.
4. Claim durable `(batch_id, client_upload_id)` state.
5. Find or upload the deterministic original and thumbnail in Drive.
6. Insert the public photo and relationships into PostgreSQL.
7. Mark the durable item ready.

A batch ID followed by a `503` from the per-photo endpoint means the batch was created but a later image, Drive or persistence step failed.

## Storage error codes

- `MEMORIES_ROOT_FOLDER_MISSING`: the Published App lacks `MEMORIES_DRIVE_PHOTOS_FOLDER_ID`.
- `DRIVE_AUTHORIZATION_REQUIRED`: the Connector received 401 or 403; reconnect the Integration and verify edit access to the root and managed children.
- `DRIVE_RETRYABLE`: Drive or the Connector returned 429 or 5xx; the client/server may retry safely.
- `DRIVE_REQUEST_FAILED`: Drive rejected a non-retryable request; inspect authorization, folder access and request details.
- `THUMBNAIL_FOLDER_NOT_CONFIGURED`: `系統縮圖` could not be discovered or created.
- `MEMORIES_STORAGE_UNAVAILABLE`: another bounded server dependency failed; inspect the deployment log name and code.
- PostgreSQL `42P01`: a queried table does not exist; apply the tracked migrations rather than creating ad-hoc tables.

The API intentionally does not return folder IDs, Connector response bodies, database URLs, OAuth details, administrator secrets or raw guest-management tokens.

## Background synchronization logs

```text
Memories Drive synchronization failed { code: 'DRIVE_RETRYABLE', ... }
```

means a background Drive scan failed temporarily; it is not itself proof that the administrator password check failed.

```text
Memories thumbnail backfill completed with failures {
  attempted: 12,
  createdOrAttached: 0,
  failureCodes: [ 'DRIVE_AUTHORIZATION_REQUIRED' ]
}
```

means the default first batch of 12 missing thumbnails all failed. Fix the shared authorization or folder-access problem before increasing batch size.

`Memories background synchronization completed` means the scheduled job reached its end; individual thumbnail failures may still have been collected and logged.

## Current recovery limitation

If the first full runtime initialization rejects, the cached initialization Promise can remain rejected until process restart. After correcting database, Drive or secret configuration, restart or re-publish the Memories service before retesting. A future recovery improvement should clear failed initialization state without requiring restart.
