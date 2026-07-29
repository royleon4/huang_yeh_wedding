# Google Drive process-folder synchronization

Issue: #33

## Drive structure

The standalone Memories root folder contains numbered wedding-process folders plus reserved system folders:

```text
00 未分類
01 進場
02 祈禱
03 讚美
04 聖經
05 勉勵
06 證婚
07 謝親恩
08 祝福
09 答禮
10 影片
11 退場
12 分組照相
訪客上傳
生活照
系統縮圖
```

Existing photos directly under the root remain visible as unclassified compatibility content. They are not moved automatically.

## Synchronization rules

- Numbered Drive folders become website processes.
- Renaming a numbered Drive folder changes the website process label after synchronization.
- Adding a numbered Drive folder creates a website process after synchronization.
- Website create, rename, and reorder operations update the matching Drive folders.
- Folder numbering controls public process order.
- An image inside a process folder is classified under that process.
- Moving an image between Drive folders changes its website classification after reconciliation.
- Guest originals are stored under `訪客上傳`.
- Generated WebP thumbnails are stored under `系統縮圖`.
- Process classification moves the original Drive file; it does not copy it.
- Drive IDs remain server-only.

## Reconciliation schedule

Reconciliation runs:

1. when the standalone Memories runtime starts;
2. when an authorized administrator selects **立即同步 Drive**;
3. periodically, every five minutes by default.

Override the interval with `MEMORIES_DRIVE_SYNC_INTERVAL_MS`, with a minimum of one minute.

## Website administration

Tap the archive title five times within 3.5 seconds to open the administrator
login. The password is read from the production secret
`MEMORIES_ADMIN_TOKEN` and is exchanged only at the session endpoint for a
30-minute `HttpOnly`, `Secure`, `SameSite=Strict` cookie. The raw password is
not retained in `sessionStorage`, `localStorage`, the frontend bundle, or the
repository.

The authenticated panel can synchronize and edit processes, manage guest
batches, close or reopen the album, move one or several photos to the
recoverable seven-day trash, and restore photos before the retention boundary.
Administrator actions are rate-limited and written to the audit log.

## Production settings

Required:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The root folder ID must be stored in Replit Production Secrets. Do not place it in `.replit` or browser code.

The Replit Google Drive integration must be connected for the published application. Reconnect it if APIs return `DRIVE_REQUEST_FAILED`.
