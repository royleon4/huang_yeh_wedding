# Production → Development PostgreSQL 覆蓋、備份與還原手冊

> **狀態：** Current  
> **首次實際演練：** 2026-08-03T16:50:00+08:00（Asia/Taipei）  
> **適用範圍：** Standalone Memories 的 Replit Production PostgreSQL → Development PostgreSQL  
> **不適用：** Development → Production、Google Drive 檔案複製、跨專案資料搬移

這份手冊記錄 2026-08-03 已完成並驗證的操作流程，包括：

- 備份目前 Development database；
- 從 Production 建立唯讀快照；
- 以 Production 快照覆蓋 Development；
- 執行 Memories migration runner；
- 驗證資料、API 與瀏覽器畫面；
- 需要時還原原本的 Development database；
- 清除敏感憑證與暫存快照。

## 先理解資料邊界

這個流程只處理 PostgreSQL。

| 資料 | Canonical owner |
| --- | --- |
| 原圖、附件、WebP 縮圖 | Google Drive |
| 相片 metadata、相簿、流程、作者、顯示狀態 | PostgreSQL |
| 影片、富文字、置頂圖、網站設定 | PostgreSQL |
| 管理員密碼與資料庫連線字串 | Replit Secrets |

因此資料庫覆蓋成功後，Development 仍需使用有權限讀取對應 Drive IDs 的 Google Drive Integration，且 `MEMORIES_DRIVE_PHOTOS_FOLDER_ID` 必須指向正確根資料夾。若資料存在但所有圖片都打不開，優先檢查 Drive 權限與 folder setting，不要重複還原資料庫。

## 重要警告

1. **這是破壞性的 Development 操作。** `pg_restore --clean` 會刪除並重建 Production dump 內對應的 Development database objects。
2. **絕對不要把目標設成 Production `DATABASE_URL`。**
3. **不要把 Production URL 印出來、貼進聊天、issue、README 或截圖。**
4. **不要用 `drizzle-kit push`。** Memories schema 以編號 SQL migration 為準。
5. **先停止 Development Workflow。** 避免還原期間 app 持續寫入或持有連線。
6. **先備份 Development，再讀取 Production。** 沒有有效 Dev backup 就不要覆蓋。
7. 本流程會還原 Production dump 內的 objects；它不會主動刪除完全不存在於 dump 的無關 Dev-only objects。此專案預期 Development 與 Production schema 維持 migration parity；若 schema 已明顯分歧，先停止並處理 schema 差異。

## 操作前條件

在 Replit Shell 確認：

```bash
command -v pg_dump
command -v pg_restore
command -v psql
pg_dump --version
pg_restore --version
```

三個工具都必須存在。

Replit Project Editor Shell 中的 `DATABASE_URL` 必須是 Development database。不要執行 `echo "$DATABASE_URL"`。

確認方式：

```bash
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Dev DATABASE_URL is present"
else
  echo "ERROR: Dev DATABASE_URL is missing"
fi

printf 'REPLIT_DEPLOYMENT=%s\n' "${REPLIT_DEPLOYMENT:-not-set}"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -Atc "SELECT 'Connected to Development database: ' || current_database();"
```

## 憑證安全規則

Production `DATABASE_URL` 只能從 Published App／Production database settings 取得，並以 silent input 放入目前 Shell session：

```bash
printf 'Paste Production DATABASE_URL, then press Enter: '
IFS= read -r -s PROD_DATABASE_URL
printf '\n'
export PROD_DATABASE_URL
```

只在提示出現後貼上 URL 本身，不要一次貼上多行命令。

驗證格式，但不要顯示內容：

```bash
case "$PROD_DATABASE_URL" in
  postgres://*|postgresql://*) echo "PROD_URL_OK" ;;
  *) echo "STOP: PROD_URL_INVALID"; unset PROD_DATABASE_URL ;;
esac
```

若 URL 曾出現在 Shell 輸出、截圖、聊天或其他可見位置：

1. 立刻停止操作；
2. `unset PROD_DATABASE_URL`；
3. 清除 Shell history；
4. 在資料庫管理介面 rotate/reset Production credential；
5. 更新 Published App 的 Production `DATABASE_URL`；
6. restart／republish Production；
7. 驗證 `/Memories/api/health` 與 `/Memories/`；
8. 只使用新的 Production URL 繼續。

## Phase A：備份目前 Development database

不要把備份放在 `/tmp`。Replit container 重啟或清理時，`/tmp` 內容可能消失。

建立私人備份目錄：

```bash
mkdir -p "$HOME/.memories-db-backups"
chmod 700 "$HOME/.memories-db-backups"
```

保存 Development URL：

```bash
export DEV_DATABASE_URL="$DATABASE_URL"
```

建立備份檔名：

```bash
DEV_BACKUP="$HOME/.memories-db-backups/dev-before-production-copy-$(date +%Y%m%d-%H%M%S).dump"
export DEV_BACKUP
```

執行 custom-format backup：

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --dbname="$DEV_DATABASE_URL" \
  --file="$DEV_BACKUP"
```

驗證檔案存在且不是空檔：

```bash
test -s "$DEV_BACKUP" \
  && echo "DEV_BACKUP_FILE_OK" \
  || echo "STOP: DEV_BACKUP_MISSING_OR_EMPTY"

printf 'Backup size: '
wc -c < "$DEV_BACKUP"
echo ' bytes'
```

驗證 archive 可讀：

```bash
pg_restore --list "$DEV_BACKUP" >/dev/null
echo "pg_restore validation exit code: $?"
```

必須得到 exit code `0`。

保存路徑：

```bash
printf '%s\n' "$DEV_BACKUP" \
  > "$HOME/.memories-db-backups/latest-dev-backup.path"

echo "DEV_BACKUP_OK"
cat "$HOME/.memories-db-backups/latest-dev-backup.path"
```

### Replit `ls` 相容性

某些 Replit Shell 使用精簡版 `ls`，但 alias 會自動加上不支援的 `--color`，因此可能看到：

```text
flag provided but not defined: -color
```

這不是 backup 失敗。改用：

```bash
/bin/ls -l -h "$DEV_BACKUP"
```

或：

```bash
wc -c "$DEV_BACKUP"
```

## Phase B：建立 Production 唯讀快照

先確認 Development backup 仍有效：

```bash
DEV_BACKUP="$(cat "$HOME/.memories-db-backups/latest-dev-backup.path")"
test -s "$DEV_BACKUP" \
  && echo "DEV_BACKUP_OK" \
  || echo "STOP: DEV_BACKUP_MISSING"
```

保存 Development URL：

```bash
export DEV_DATABASE_URL="$DATABASE_URL"
```

依照「憑證安全規則」輸入 Production URL，再確認兩者不是同一字串：

```bash
test "$DEV_DATABASE_URL" != "$PROD_DATABASE_URL" \
  && echo "DATABASES_ARE_DIFFERENT" \
  || echo "STOP: DATABASE_URLS_ARE_IDENTICAL"
```

執行 Production 唯讀連線測試：

```bash
psql "$PROD_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -Atc "
BEGIN READ ONLY;
SELECT 'Connected to Production database: ' || current_database();
COMMIT;
"
```

建立 Production dump 路徑：

```bash
PROD_DUMP="$HOME/.memories-db-backups/production-copy-$(date +%Y%m%d-%H%M%S).dump"
export PROD_DUMP
```

執行唯讀 dump：

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --dbname="$PROD_DATABASE_URL" \
  --file="$PROD_DUMP"
```

驗證：

```bash
test -s "$PROD_DUMP" \
  && echo "PROD_DUMP_FILE_OK" \
  || echo "STOP: PROD_DUMP_EMPTY"

printf 'Production dump size: '
wc -c < "$PROD_DUMP"
echo ' bytes'

pg_restore --list "$PROD_DUMP" >/dev/null
echo "pg_restore validation exit code: $?"
```

必須得到 exit code `0`。

保存路徑：

```bash
printf '%s\n' "$PROD_DUMP" \
  > "$HOME/.memories-db-backups/latest-production-copy.path"

echo "PRODUCTION_SNAPSHOT_OK"
```

## Phase C：Production 覆蓋 Development

先停止 Replit Development Workflow，等 Shell 回到 prompt。

重新載入路徑：

```bash
export DEV_DATABASE_URL="$DATABASE_URL"
DEV_BACKUP="$(cat "$HOME/.memories-db-backups/latest-dev-backup.path")"
PROD_DUMP="$(cat "$HOME/.memories-db-backups/latest-production-copy.path")"
```

再次驗證兩個 archive：

```bash
test -s "$DEV_BACKUP" \
  && echo "DEV_BACKUP_EXISTS" \
  || echo "STOP: DEV_BACKUP_MISSING"

test -s "$PROD_DUMP" \
  && echo "PROD_DUMP_EXISTS" \
  || echo "STOP: PROD_DUMP_MISSING"

pg_restore --list "$DEV_BACKUP" >/dev/null \
  && echo "DEV_BACKUP_VALID" \
  || echo "STOP: DEV_BACKUP_INVALID"

pg_restore --list "$PROD_DUMP" >/dev/null \
  && echo "PROD_DUMP_VALID" \
  || echo "STOP: PROD_DUMP_INVALID"
```

確認目前 target 確實是 Development：

```bash
psql "$DEV_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -Atc "SELECT current_database();"
```

不要假設資料庫名稱一定固定；必須與前面確認的 Development database 相同。

執行覆蓋：

```bash
pg_restore \
  --clean \
  --if-exists \
  --single-transaction \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname="$DEV_DATABASE_URL" \
  "$PROD_DUMP"
```

完成後立即確認：

```bash
echo "restore exit code: $?"
```

必須是 `0`。不是 `0` 時：

- 不要啟動 app；
- 不要執行後續 migration；
- 不要刪除任何 backup；
- 保留第一個完整錯誤。

## Phase D：執行 Memories migration runner

還原成功後：

```bash
DATABASE_URL="$DEV_DATABASE_URL" \
  pnpm --filter @workspace/memories-album run db:migrate
```

正常結果為：

```text
Memories database schema is current; no migration needed.
```

或：

```text
Applying N pending Memories migration(s)...
Memories database schema is ready.
```

不要執行：

```text
drizzle-kit push
```

## Phase E：驗證 Development database

確認主要 tables：

```bash
psql "$DEV_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -c "
SELECT
  to_regclass('public.memories_photos') AS photos,
  to_regclass('public.memories_albums') AS albums,
  to_regclass('public.memories_process_content') AS process_content,
  to_regclass('public.memories_app_settings') AS app_settings,
  to_regclass('public.memories_schema_migrations') AS migrations;
"
```

所有欄位都不應為空白。

檢查主要資料量：

```bash
psql "$DEV_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -c "
SELECT
  (SELECT count(*) FROM memories_photos) AS photos,
  (SELECT count(*) FROM memories_albums) AS albums,
  (SELECT count(*) FROM memories_processes) AS processes,
  (SELECT count(*) FROM memories_upload_batches) AS upload_batches,
  (SELECT count(*) FROM memories_app_settings) AS app_settings,
  (SELECT count(*) FROM memories_process_content) AS process_content_rows,
  (SELECT count(*) FROM memories_process_attachments) AS process_attachments,
  (
    SELECT count(*)
    FROM memories_process_content
    WHERE NULLIF(btrim(youtube_video_id), '') IS NOT NULL
  ) AS process_videos;
"
```

影片不是存放在 `memories_process_videos`。目前正確位置是：

```text
memories_process_content.youtube_video_id
memories_process_content.youtube_autoplay
```

檢查 migration history：

```bash
psql "$DEV_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -c "
SELECT filename, applied_at
FROM memories_schema_migrations
ORDER BY filename;
"
```

## Phase F：啟動與瀏覽器驗收

按 Replit 上方 Run，讓 `.replit` Workflow 啟動 Development app。不要同時從另一個 Shell 手動啟動第二個 Vite process。

健康檢查：

```bash
curl -fsS http://127.0.0.1:19316/Memories/api/health
```

實際開啟：

```text
/Memories/
/Memories/admin/login
```

至少確認：

- Production 相簿與流程已出現在 Development；
- 照片、影片、富文字與置頂圖正常；
- 中文與 English 正常；
- 管理後台設定存在；
- 原圖與縮圖可讀；
- Development 的新增測試資料不會出現在 Production。

## Phase G：清除敏感資訊與暫存檔

先移除目前 Shell session 的 Production credential：

```bash
unset PROD_DATABASE_URL
echo "Production credential removed from Shell"
```

Development 完成驗收後，刪除 Production snapshot：

```bash
PROD_DUMP="$(cat "$HOME/.memories-db-backups/latest-production-copy.path")"
rm -f "$PROD_DUMP"
rm -f "$HOME/.memories-db-backups/latest-production-copy.path"
echo "Production snapshot removed"
```

先保留原本 Development backup，直到新的 Development 資料已完成編輯、分類、上傳與照片顯示驗收。

## 還原原本 Development database

當 Production copy 不符合需求，或 Development 驗收失敗時：

1. 停止 Replit Development Workflow；
2. 確認 `$DATABASE_URL` 仍指向 Development；
3. 載入原本的 Dev backup；
4. 還原；
5. 執行 migration runner；
6. 驗證並重新啟動。

載入 backup：

```bash
export DEV_DATABASE_URL="$DATABASE_URL"
DEV_BACKUP="$(cat "$HOME/.memories-db-backups/latest-dev-backup.path")"
```

驗證：

```bash
test -s "$DEV_BACKUP" \
  && echo "DEV_BACKUP_EXISTS" \
  || echo "STOP: DEV_BACKUP_MISSING"

pg_restore --list "$DEV_BACKUP" >/dev/null \
  && echo "DEV_BACKUP_VALID" \
  || echo "STOP: DEV_BACKUP_INVALID"
```

還原原本 Development：

```bash
pg_restore \
  --clean \
  --if-exists \
  --single-transaction \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname="$DEV_DATABASE_URL" \
  "$DEV_BACKUP"
```

確認 exit code：

```bash
echo "restore exit code: $?"
```

套用 migration：

```bash
DATABASE_URL="$DEV_DATABASE_URL" \
  pnpm --filter @workspace/memories-album run db:migrate
```

再執行 Phase E 與 Phase F 的 database、health 及瀏覽器驗證。

## 最終清除 Development backup

只有在確定不需要 rollback 後才執行：

```bash
DEV_BACKUP="$(cat "$HOME/.memories-db-backups/latest-dev-backup.path")"
rm -f "$DEV_BACKUP"
rm -f "$HOME/.memories-db-backups/latest-dev-backup.path"
echo "Old Development backup removed"
```

備份目錄為空時可移除：

```bash
rmdir "$HOME/.memories-db-backups" 2>/dev/null || true
```

## 常見錯誤

### `missing "=" after "export" in connection info string`

通常是把多行命令一次貼入 silent `read`，導致 `PROD_DATABASE_URL` 讀到：

```text
export PROD_DATABASE_URL
```

處理：

```bash
unset PROD_DATABASE_URL
```

再單獨執行 silent input，等提示出現後只貼 URL。

### `DEV_BACKUP_NOT_FOUND`

常見原因：

- 先前 backup 沒有成功；
- backup 放在 `/tmp`，container 重啟後消失；
- Shell multi-line paste 被破壞。

重新備份到：

```text
$HOME/.memories-db-backups
```

### `relation "memories_process_videos" does not exist`

這個 table 不存在。影片資料位於 `memories_process_content`。

### `flag provided but not defined: -color`

這是 Replit 精簡版 `ls` 與 alias 的相容性問題，不代表 dump 失敗。使用 `/bin/ls` 或 `wc -c`。

### `pg_restore` 非零 exit code

立即停止，不要執行 migration，不要刪 backup。保存第一個錯誤並確認：

- target 是 Development；
- archive 有效；
- Development Workflow 已停止；
- PostgreSQL client/server 版本相容；
- target role 有足夠權限；
- Development 與 Production schema 沒有非預期分歧。

## 2026-08-03 實際演練結果

本次操作已完成：

- 確認 Shell 連接 Development database；
- 建立並驗證原本 Development custom-format backup；
- 建立並驗證 Production 唯讀 custom-format snapshot；
- 使用 `pg_restore --clean --if-exists --single-transaction` 覆蓋 Development；
- 執行 Memories migration runner；
- 驗證主要 tables、資料量、migration、health endpoint 與 Dev Preview；
- 確認 Production database 未被寫入；
- 記錄 Replit `ls --color`、`/tmp`、silent input multi-line paste 與 `memories_process_videos` 誤判等實際問題。

這份手冊是此次已完成流程的正式 Current 記錄。未經另外審核，不應將方向反轉為 Development → Production。
