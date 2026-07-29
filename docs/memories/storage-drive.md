# Memories Google Drive and data boundary

## Approved root folder

Standalone Memories originals are stored below the configured wedding root, represented as:

```text
相片簿/20260620 我們結婚了
```

The provider ID is intentionally not committed. Set it in Replit Production Secrets as:

```text
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
```

## Managed child folders

```text
00 未分類
訪客上傳
生活照
系統縮圖
```

Numbered folders such as `01 進場` are canonical for wedding-process names and order. Separate child IDs are normally unnecessary.

## Physical and logical placement

- Official wedding originals remain in a numbered process folder, root or `00 未分類`.
- Official life photos remain in `生活照`.
- Guest originals remain physically in `訪客上傳` even when logically classified elsewhere.
- WebP derivatives are stored only in `系統縮圖`.
- Official reclassification moves the original; it does not copy it.

## Boundary

- Drive owns originals, thumbnails and process-folder metadata.
- PostgreSQL owns visibility, ordering, upload ownership, albums, process relationships, durable state and admin overrides.
- Browser receives opaque IDs and controlled `/Memories/api/photos/:id/*` URLs.
- Drive IDs, folder IDs, Connector responses, OAuth details and Drive URLs stay server-side.
- Legacy invitation photo-wall data is not read, moved, copied or migrated.

Current reconciliation does not automatically trash a PostgreSQL photo row when its Drive original is manually deleted. A public card, separate thumbnail and browser cache may remain.

## Required production configuration

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The current server does not read obsolete `SECRET_TOKEN`.

Replit Google Drive Integration supplies authorization through `@replit/connectors-sdk`. Do not add service-account JSON, OAuth client secrets, refresh tokens or `GOOGLE_APPLICATION_CREDENTIALS`.
