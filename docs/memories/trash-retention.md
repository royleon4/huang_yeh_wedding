# Memories 七天垃圾桶

管理員移除照片與訪客透過私人連結撤回照片，都會進入同一套七天保留流程。

## 行為

- 照片進入垃圾桶後會立即從公開相簿、私人批次頁與媒體端點隱藏。
- `trashed_at + 7 days` 之前，管理員可在相簿管理介面還原照片。
- 到達保留期限的瞬間起，照片不可再還原，背景工作可開始永久清理。
- 永久清理依序移除 Drive 縮圖、Drive 原圖、上傳項目及照片資料；流程分類關聯由資料庫外鍵一併清理。
- Drive 回傳 404 視為已完成，讓工作可以安全重跑。
- Drive 或資料庫暫時失敗時，工作會保留為 `retry`；Drive file ID、批次與流程關聯會保留到整個工作成功為止。
- 此流程只操作 Memories 的 PostgreSQL 與 Replit Google Drive Integration，不會存取舊網站的 Object Storage。

## 執行設定

| 環境變數                             |   預設值 | 用途                               |
| ------------------------------------ | -------: | ---------------------------------- |
| `MEMORIES_TRASH_CLEANUP_INTERVAL_MS` | `300000` | 背景清理掃描間隔；最短 60 秒       |
| `MEMORIES_TRASH_CLEANUP_BATCH_SIZE`  |     `20` | 每次最多領取的到期工作；上限 100   |
| `MEMORIES_TRASH_CLEANUP_LEASE_MS`    | `300000` | 工作租約時間，避免多個實例重複處理 |

部署會由 migration `008_trash_retention.sql` 建立
`memories_trash_cleanup_jobs`。服務啟動時會立即執行一次清理，之後依設定間隔重複執行。

## 排錯

1. 在管理員介面確認照片仍列在「七天垃圾桶」，並查看可還原期限。
2. 查詢 `memories_trash_cleanup_jobs` 的 `status`、`attempt_count` 與 `last_error_code`。
3. 若工作停在 `processing`，租約到期後下一輪會自動重新領取，不需手動改資料。
4. 修復 Replit Google Drive Integration 或資料庫連線後，等待下一輪；不要手動清除 Drive ID。
5. 若要立即驗證，可重新啟動服務；啟動時會執行一次 cleanup。
