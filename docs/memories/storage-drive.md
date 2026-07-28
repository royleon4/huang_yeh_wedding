# Memories Google Drive and data boundary

## Approved original-photo folder

New standalone Memories originals are stored in:

```text
相片簿/20260620 我們結婚了
```

The connected Drive folder has been resolved, but its provider ID is intentionally not committed to this public repository. Configure it in Replit as:

```text
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
```

## Managed child folders

The service discovers or creates these reserved folders below the configured root:

```text
00 未分類
訪客上傳
生活照
系統縮圖
```

Numbered Google Drive folders are the canonical wedding-process names and order. Separate provider IDs for the reserved child folders are not required.

Official wedding originals remain in their process folder or `00 未分類`. Guest originals remain physically in `訪客上傳` even when their website classification is a wedding process or Life photos. Generated WebP derivatives are stored only in `系統縮圖`.

## Rules

- Google Drive is canonical for standalone Memories originals and process-folder metadata.
- The legacy invitation photo wall and its Object Storage files are not read, moved, copied, or migrated.
- The browser receives only opaque Memories UUIDs and controlled `/Memories/api/photos/:id/*` URLs.
- Drive file IDs, folder IDs, connector responses, tokens, and Drive URLs stay server-side.
- A wedding original is stored exactly once.
- Technical derivatives are stored in the managed `系統縮圖` child folder and are never placed beside originals.
- PostgreSQL is the query/index source for visibility, upload ownership, process membership, dimensions, hashes, and processing state.
- Guest uploads use `uploader_type = guest`, retain the submitted name, and may receive a logical wedding-process or Life-photos classification without copying or moving the original out of `訪客上傳`.

## Runtime configuration

Required:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
```

Also required for the current shared-secret administrator boundary:

```text
MEMORIES_ADMIN_TOKEN
```

Replit Google Drive Integration supplies authorization through `@replit/connectors-sdk`; do not add a service account, OAuth client secret, refresh token, or `GOOGLE_APPLICATION_CREDENTIALS`.
