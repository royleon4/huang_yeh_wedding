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
SECRET_TOKEN
```

The runtime discovers or creates `訪客上傳`, `生活照`, `系統縮圖`, and `00 未分類` below the configured root. Do not add a separate thumbnail-folder ID to `.replit` or the frontend.

Project Editor secrets and local shell variables are not a substitute for Published App secrets.

## Bounded error codes

- `MEMORIES_ROOT_FOLDER_MISSING`: the published app lacks `MEMORIES_DRIVE_PHOTOS_FOLDER_ID`.
- `DRIVE_AUTHORIZATION_REQUIRED`: reconnect the Replit Google Drive Integration.
- `DRIVE_RETRYABLE`: Google Drive or the connector returned a temporary rate-limit/server failure; the client may retry.
- `DRIVE_REQUEST_FAILED`: Google Drive rejected the request; check Integration authorization and folder access.
- `THUMBNAIL_FOLDER_NOT_CONFIGURED`: the reserved `系統縮圖` folder could not be discovered or created.
- `MEMORIES_STORAGE_UNAVAILABLE`: another server-side dependency failed; review the bounded name/code in deployment logs.

The API intentionally does not return folder IDs, connector response bodies, database URLs, OAuth details, administrator secrets, or guest-management tokens.

## Current recovery limitation

Issue #49 tracks a known runtime behavior: if the very first Drive/database initialization rejects, the rejected initialization Promise can stay cached until the process restarts. Until #49 is complete, reconnect the Integration or correct secrets and restart/re-publish the Memories service before retesting.
