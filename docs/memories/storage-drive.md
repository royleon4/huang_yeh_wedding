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

## Technical thumbnail decision still open

The approved originals folder must not be cluttered with generated thumbnail files without the owner's approval. The adapter therefore refuses to upload thumbnails unless a separate server-side folder is configured:

```text
MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID
```

Until that folder is approved and configured, public thumbnail requests may fall back to the original through the controlled endpoint. Ticket #4 must resolve the final derivative-folder arrangement before production batch uploads generate thumbnails.

## Rules

- Google Drive is canonical only for new Memories originals.
- The legacy invitation photo wall and its Object Storage files are not read, moved, copied, or migrated.
- The browser receives only opaque Memories UUIDs and controlled `/Memories/api/photos/:id/*` URLs.
- Drive file IDs, folder IDs, connector responses, tokens, and Drive URLs stay server-side.
- A wedding original is stored exactly once.
- Technical derivatives require an explicitly configured folder and are never silently placed beside originals.
- PostgreSQL is the query/index source for visibility, upload ownership, process membership, dimensions, hashes, and processing state.
- Guest uploads use `uploader_type = guest`, retain the submitted name, and have no wedding-process membership.

## Runtime configuration

Required:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
```

Optional until the thumbnail arrangement is approved:

```text
MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID
```

Replit Google Drive Integration supplies authorization through `@replit/connectors-sdk`; do not add a service account, OAuth client secret, refresh token, or `GOOGLE_APPLICATION_CREDENTIALS`.
