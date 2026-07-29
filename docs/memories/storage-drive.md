# Memories Google Drive and data boundary

## Approved root folder

Standalone Memories originals are stored below the configured wedding root, currently represented as:

```text
相片簿/20260620 我們結婚了
```

The provider ID is intentionally not committed. Set it in Replit Production Secrets as:

```text
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
```

## Managed child folders

The service discovers or creates:

```text
00 未分類
訪客上傳
生活照
系統縮圖
```

Numbered folders such as `01 進場` are canonical for wedding-process names and order. Separate IDs for managed children are normally unnecessary.

## Physical and logical placement

- Official wedding originals remain in a numbered process folder, the root or `00 未分類`.
- Official life photos remain in `生活照`.
- Guest originals remain physically in `訪客上傳` even when their website classification is a wedding process or Life photos.
- WebP derivatives are stored only in `系統縮圖`.
- Moving an official photo between categories moves the original file; it does not create a second copy.

## Data boundary

- Google Drive is the media source of truth for originals, technical thumbnails and process-folder metadata.
- PostgreSQL is the query and logical-state source of truth for visibility, ordering, upload ownership, albums, process membership, dimensions, hashes, durable upload state and administrator overrides.
- The browser receives only opaque Memories UUIDs and controlled `/Memories/api/photos/:id/*` URLs.
- Drive file IDs, folder IDs, connector responses, OAuth details and Drive URLs stay server-side.
- The legacy invitation photo wall and its Object Storage files are not read, moved, copied or migrated.

Current reconciliation does not automatically trash a PostgreSQL photo row when its Drive original is manually deleted. Manual Drive deletion can therefore leave a public card, a separate thumbnail and browser cache. Do not treat direct Drive deletion as a complete website deletion workflow.

## Required production configuration

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The exact administrator secret name is `MEMORIES_ADMIN_TOKEN`. The current server does not read the obsolete `SECRET_TOKEN` name.

Replit Google Drive Integration supplies authorization through `@replit/connectors-sdk`. Do not add service-account JSON, OAuth client secrets, refresh tokens or `GOOGLE_APPLICATION_CREDENTIALS`.
