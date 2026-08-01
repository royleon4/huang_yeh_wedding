# Memories Google Drive and data boundary

> **Status:** Current  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)

## Approved root folder

Standalone Memories originals are stored below the configured wedding root, represented as:

```text
相片簿/20260620 我們結婚了
```

The provider ID is intentionally not committed. Set it in Replit Production Secrets as:

```text
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
```

The Published App must also connect Replit Google Drive Integration with edit access to the root and managed children.

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
- Guest originals remain physically in `訪客上傳` even when logically classified into a wedding process or life collection.
- WebP derivatives are stored only in `系統縮圖`.
- Official reclassification moves the original; it does not copy it.
- Guest classification normally changes PostgreSQL relationships without moving the original.

## Ownership boundary

| Concern | Canonical owner |
| --- | --- |
| Original and attachment bytes | Google Drive |
| Generated thumbnail bytes | Google Drive |
| Numbered process-folder name/order | Google Drive, mirrored to PostgreSQL |
| Visibility, author, capture time and logical memberships | PostgreSQL |
| Upload batches, token/content hashes and resumable state | PostgreSQL |
| Site settings, videos, rich content and pinned-photo references | PostgreSQL |

The browser receives opaque IDs and controlled `/Memories/api/photos/:id/*` URLs. Drive IDs, folder IDs, Connector responses, OAuth details, resumable session URIs and Drive URLs stay server-side.

Legacy invitation photo-wall data is not read, moved, copied or migrated.

## Deletion and reconciliation limitation

Current reconciliation does not automatically trash or fully remove a PostgreSQL photo row when its Drive original is manually deleted. A public row, separate thumbnail and browser cache may remain.

Therefore:

- do not delete production originals directly in Drive;
- use administrator permanent deletion or the uploader’s private-management page;
- treat Drive 404 during an application deletion as already absent, while other Drive failures must stop false database success;
- remember that current deletion is immediate and irreversible.

## Required production configuration

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

The current server does not read obsolete `SECRET_TOKEN`.

Replit Google Drive Integration supplies authorization through `@replit/connectors-sdk`. Do not add service-account JSON, OAuth client secrets, refresh tokens or `GOOGLE_APPLICATION_CREDENTIALS`.

## Maintainer checklist

Before changing Drive behavior:

1. confirm whether the operation changes physical placement, logical classification or both;
2. preserve idempotent upload/retry behavior and provider-ID privacy;
3. test official and guest photo rules separately;
4. keep thumbnails out of the original-photo folders;
5. update [`drive-process-sync.md`](drive-process-sync.md), [`../../OPERATIONS_GUIDE.md`](../../OPERATIONS_GUIDE.md) and tests when behavior changes.
