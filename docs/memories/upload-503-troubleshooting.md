# Troubleshooting Memories upload 503 responses

The guest upload flow has two stages:

1. create an upload batch in PostgreSQL;
2. validate and normalize each image, upload its original and thumbnail to Google Drive, then insert the public photo record.

A successful batch ID followed by a `503` from `/Memories/api/upload-batches/:id/photos` means the database batch was created but a later image, Drive, or persistence step is unavailable.

## Required production configuration

Connect the Replit Google Drive Integration and set these **Production Secrets**:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The runtime discovers or creates `訪客上傳`, `生活照`, `系統縮圖`, and `00 未分類` below the configured root. Do not add a separate thumbnail-folder ID to `.replit` or the frontend.

Project Editor secrets and local shell variables are not a substitute for Published App secrets.

## Bounded error codes

- `MEMORIES_ROOT_FOLDER_MISSING`: the published app lacks `MEMORIES_DRIVE_PHOTOS_FOLDER_ID`.
- `DRIVE_AUTHORIZATION_REQUIRED`: reconnect the Replit Google Drive Integration.
- `DRIVE_RETRYABLE`: Google Drive or the connector returned a temporary rate-limit/server failure; the client may retry.
- `DRIVE_REQUEST_FAILED`: Google Drive rejected the request; check Integration authorization and folder access.
- `THUMBNAIL_FOLDER_NOT_CONFIGURED`: the reserved `系統縮圖` folder could not be discovered or created.
- `DATABASE_URL_REQUIRED`: the published app lacks `DATABASE_URL`.
- `ECONNREFUSED`, `ENOTFOUND`, or `ETIMEDOUT`: PostgreSQL or another required dependency is temporarily unreachable.
- `MEMORIES_RUNTIME_INITIALIZATION_FAILED`: another runtime dependency failed; review the bounded code in deployment logs.

The API intentionally does not return folder IDs, connector response bodies, database URLs, OAuth details, administrator secrets, or guest-management tokens.

## Readiness and automatic recovery

- `GET /Memories/api/health` is the process liveness check. It returns `200` without opening Drive or PostgreSQL.
- `GET /Memories/api/ready` checks whether the shared Memories runtime is ready. It returns `200` when ready, or a bounded `503` reason when Drive/PostgreSQL is unavailable.
- A failed initialization is retried on a later request after a bounded delay. Concurrent requests share one attempt, and a successful runtime remains memoized.
- The default retry delay is one second. `MEMORIES_RUNTIME_RETRY_DELAY_MS` may tune it between 250 and 60000 ms for operations testing.

After reconnecting the Google Drive Integration or correcting a transient database outage:

1. call `/Memories/api/health` and confirm liveness;
2. call `/Memories/api/ready`;
3. wait for the bounded retry delay and repeat readiness if the first response is still `503`;
4. confirm one `Memories runtime initialization completed` event appears in deployment logs;
5. retry one gallery request and one small upload.

A restart/re-publish is no longer required for a transient first-attempt failure. Permanent missing configuration remains a bounded `503` and does not retry in a tight loop.
