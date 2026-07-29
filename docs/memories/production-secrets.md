# Memories production secrets

Set these values in Replit Production Secrets, not in `.replit` or GitHub:

- `DATABASE_URL`
- `MEMORIES_DRIVE_PHOTOS_FOLDER_ID`
- `MEMORIES_ADMIN_TOKEN`

Optional:

- `MEMORIES_DRIVE_SYNC_INTERVAL_MS` (default 300000)
- `MEMORIES_RUNTIME_RETRY_DELAY_MS` (default 1000; clamped to 250–60000)
- `MEMORIES_THUMBNAIL_BATCH_SIZE` (default 12)
- `MEMORIES_THUMBNAIL_MAX_PER_RUN` (default 240)
- `MEMORIES_TRASH_CLEANUP_INTERVAL_MS` (default 300000; minimum 60000)
- `MEMORIES_TRASH_CLEANUP_BATCH_SIZE` (default 20; maximum 100)
- `MEMORIES_TRASH_CLEANUP_LEASE_MS` (default 300000)

The runtime discovers or creates `訪客上傳`, `生活照`, `系統縮圖`, and `00 未分類` under the root folder. Separate folder IDs are not required.

Operations endpoints:

- `/Memories/api/health`: process liveness; does not initialize dependencies.
- `/Memories/api/ready`: Drive/PostgreSQL readiness with bounded public error codes.
