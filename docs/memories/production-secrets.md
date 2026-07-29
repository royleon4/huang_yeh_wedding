# Memories production secrets

Set these values in **Replit Production Secrets**, not in `.replit`, GitHub, frontend code or examples containing real values:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The exact administrator key is `MEMORIES_ADMIN_TOKEN`. The obsolete `SECRET_TOKEN` name is not read and causes `503 ADMIN_TOKEN_NOT_CONFIGURED` during login.

The Published App must also have Replit Google Drive Integration connected. Project Editor secrets and local Connector access do not automatically configure the Published App.

Optional tuning:

```text
MEMORIES_DRIVE_SYNC_INTERVAL_MS=300000
MEMORIES_THUMBNAIL_BATCH_SIZE=12
MEMORIES_THUMBNAIL_MAX_PER_RUN=240
MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID=
MEMORIES_TRUST_PROXY=1
MEMORIES_SKIP_MIGRATIONS=1
```

The runtime discovers or creates `00 未分類`, `訪客上傳`, `生活照` and `系統縮圖` below the configured root. Separate child-folder IDs are normally unnecessary. The thumbnail ID remains only as a legacy override.

`MEMORIES_SKIP_MIGRATIONS=1` is for controlled diagnosis only. Normal development and production startup must apply tracked SQL migrations.
