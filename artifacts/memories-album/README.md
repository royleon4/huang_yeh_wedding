# Standalone Memories album

This artifact owns the new wedding waterfall gallery at `/Memories/` and its isolated API namespace at `/Memories/api/`.

## Hard boundary

It must not import from or modify:

- `artifacts/wedding-invitation/**`
- the legacy `/api/photos*` implementation
- legacy Replit Object Storage photo-wall files

Google Drive, PostgreSQL indexing, guest management, face processing, trash retention, and backups added later apply only to this artifact.

## Commands

```bash
pnpm --filter @workspace/memories-album run dev
pnpm --filter @workspace/memories-album run test
pnpm --filter @workspace/memories-album run build
pnpm --filter @workspace/memories-album run start
```

The initial shell deliberately avoids choosing the final UI framework or face provider. Those decisions remain in their own tickets and owner decision gates.
