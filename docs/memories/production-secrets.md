# Memories production secrets

Set these values in Replit Production Secrets, not in `.replit` or GitHub:

- `DATABASE_URL`
- `MEMORIES_DRIVE_PHOTOS_FOLDER_ID`
- `SECRET_TOKEN`

Optional:

- `MEMORIES_DRIVE_SYNC_INTERVAL_MS` (default 300000)

The runtime discovers or creates `訪客上傳`, `系統縮圖`, and `00 未分類` under the root folder. Separate folder IDs are not required.
