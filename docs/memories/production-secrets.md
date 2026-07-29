# Memories production secrets

Set these values in **Replit Production Secrets**, not in `.replit`, GitHub, frontend code or documentation examples containing real values:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The exact administrator key is `MEMORIES_ADMIN_TOKEN`. The obsolete `SECRET_TOKEN` name is not read by the current Memories server and causes `503 ADMIN_TOKEN_NOT_CONFIGURED` during login.

The Published App must also have the Replit Google Drive Integration connected. Project Editor secrets and a local shell connection are not substitutes for Published App configuration.

Optional tuning:

```text
MEMORIES_DRIVE_SYNC_INTERVAL_MS=300000
MEMORIES_THUMBNAIL_BATCH_SIZE=12
MEMORIES_THUMBNAIL_MAX_PER_RUN=240
MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID=
MEMORIES_TRUST_PROXY=1
MEMORIES_SKIP_MIGRATIONS=1
```

The runtime discovers or creates `00 未分類`, `訪客上傳`, `生活照` and `系統縮圖` under the configured root. Separate child-folder IDs are normally unnecessary. `MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID` remains only as a legacy override.

`MEMORIES_SKIP_MIGRATIONS=1` is intended only for controlled diagnosis. Normal development and production startup must apply the tracked SQL migrations.
