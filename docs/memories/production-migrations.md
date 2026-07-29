# Automatic Memories database migrations

The standalone Memories service uses immutable, numbered SQL migrations for both development and production PostgreSQL schemas.

## Why migrations run before the server listens

Replit development and Published Apps can use different `DATABASE_URL` values. A migration executed in the Project Editor updates development only; the production process must therefore verify and update its own database before accepting traffic.

When a Memories server starts with `DATABASE_URL` and migrations are not explicitly skipped, the migration runner:

1. reads numbered SQL files from `artifacts/memories-album/db` or the packaged `dist/db` directory;
2. performs a read-only preflight against `memories_schema_migrations`;
3. verifies that every already-applied migration still has the recorded checksum;
4. obtains a PostgreSQL advisory lock when pending files exist;
5. creates `memories_schema_migrations` when necessary;
6. applies only pending files in filename order;
7. records each filename and SHA-256 checksum;
8. releases the lock and starts the HTTP listener only after success.

A failed migration prevents the new instance from becoming healthy rather than serving an incompatible schema.

## Required production configuration

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

`MEMORIES_ADMIN_TOKEN` is the administrator password. The obsolete `SECRET_TOKEN` name is not used by the current server.

The Replit Google Drive Integration must also be connected in the Published App environment.

## Current tracked migrations

| File | Purpose |
| --- | --- |
| `001_memories_foundation.sql` | Core photos, processes, upload batches and relationships |
| `002_guest_uploads.sql` | Guest management token hash and batch status |
| `003_drive_process_sync.sql` | Drive folder metadata, parent references and sync runs |
| `004_photo_collections.sql` | wedding／guest／life classifications |
| `005_durable_upload_items.sql` | Stable per-file upload leases and retry state |
| `006_app_settings.sql` | JSONB application settings |
| `007_admin_albums.sql` | Albums, photo-album relationships and display names |
| `008_admin_photo_overrides.sql` | Capture-time and album-membership override flags |
| `009_admin_login_failures.sql` | Shared administrator login failure limits |

## Adding a migration

Add a new immutable sequential file, for example:

```text
artifacts/memories-album/db/010_description.sql
```

Never edit a migration after it has reached any shared environment. Add a later migration for further changes. The checksum guard intentionally stops startup when an applied migration is rewritten.

## Development and production schema parity

Replit may compare development and production schemas when preparing a deployment. If a migration exists in production but not development, the next publish can incorrectly propose destructive operations such as `DROP TABLE` or `DROP COLUMN`.

The repository `postMerge` hook therefore runs:

```bash
pnpm --filter @workspace/memories-album run db:migrate
```

against the development `DATABASE_URL` when available.

Do **not** use `drizzle-kit push` for Memories. The SQL migration directory—not the shared Drizzle schema—is the source of truth.

If Publishing displays destructive changes to `memories_albums`, `memories_photo_albums`, `memories_admin_login_failures` or the photo override columns:

1. cancel the deployment;
2. run the tracked migration command in the Replit development environment;
3. do not choose the option that copies development data over production unless replacing production is intentional;
4. start a new publish and confirm that the destructive plan has disappeared.

## Manual command

```bash
pnpm --filter @workspace/memories-album run db:migrate
```

## Publish verification

A current database logs:

```text
Memories database schema is current; no migration needed.
```

A database with pending files logs:

```text
Applying N pending Memories migration(s)...
Applied Memories migration: ...
Memories database schema is ready.
```

The HTTP server should then log its listener, and `/Memories/api/health` should return `200`.

To inspect recorded migrations:

```sql
SELECT filename, checksum, applied_at
FROM memories_schema_migrations
ORDER BY filename;
```
