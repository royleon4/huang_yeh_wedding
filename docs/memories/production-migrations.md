# Automatic Memories database migrations

The standalone Memories service uses immutable, numbered SQL migrations for development and production PostgreSQL schemas.

## Startup behavior

Replit development and Published Apps can use different `DATABASE_URL` values. The production process therefore verifies and updates its own database before accepting traffic.

The runner:

1. reads numbered SQL files from `artifacts/memories-album/db` or packaged `dist/db`;
2. performs a read-only preflight against `memories_schema_migrations`;
3. verifies checksums of already-applied files;
4. obtains a PostgreSQL advisory lock when pending files exist;
5. creates the tracking table when necessary;
6. applies pending files in filename order;
7. records filename and SHA-256 checksum;
8. starts the HTTP listener only after success.

A failed migration prevents the new instance from becoming healthy rather than serving an incompatible schema.

## Required production configuration

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

`MEMORIES_ADMIN_TOKEN` is the administrator password. The obsolete `SECRET_TOKEN` name is not used. Published App Google Drive Integration must also be connected.

## Current migrations

| File | Purpose |
| --- | --- |
| `001_memories_foundation.sql` | Core photos, processes, upload batches and relationships |
| `002_guest_uploads.sql` | Guest management-token hash and batch status |
| `003_drive_process_sync.sql` | Drive folder metadata, parent references and sync runs |
| `004_photo_collections.sql` | wedding／guest／life classifications |
| `005_durable_upload_items.sql` | Stable per-file upload leases and retry state |
| `006_app_settings.sql` | JSONB application settings |
| `007_admin_albums.sql` | Albums, photo-album relationships and display names |
| `008_admin_photo_overrides.sql` | Capture-time and album-membership overrides |
| `009_admin_login_failures.sql` | Shared administrator login limits |

## Adding a migration

Add a new immutable sequential file, for example:

```text
artifacts/memories-album/db/010_description.sql
```

Never edit a migration after it reaches a shared environment. Add a later migration for further changes. The checksum guard intentionally stops startup if an applied file changes.

## Development and production parity

Replit may compare development and production schemas while preparing deployment. If production has a migration that development lacks, Publishing can incorrectly propose destructive `DROP TABLE` or `DROP COLUMN` operations.

The repository `postMerge` hook therefore runs:

```bash
pnpm --filter @workspace/memories-album run db:migrate
```

against development `DATABASE_URL` when available.

Do **not** use `drizzle-kit push` for Memories. The tracked SQL directory is the source of truth.

If Publishing displays destructive changes to `memories_albums`, `memories_photo_albums`, `memories_admin_login_failures` or photo override columns:

1. cancel deployment;
2. run tracked migrations in Replit development;
3. do not copy development data over production unless replacement is intentional;
4. publish again and confirm the destructive plan is gone.

## Manual command

```bash
pnpm --filter @workspace/memories-album run db:migrate
```

## Verification

Current schema:

```text
Memories database schema is current; no migration needed.
```

Pending schema:

```text
Applying N pending Memories migration(s)...
Applied Memories migration: ...
Memories database schema is ready.
```

Then `/Memories/api/health` should return `200`.

```sql
SELECT filename, checksum, applied_at
FROM memories_schema_migrations
ORDER BY filename;
```
