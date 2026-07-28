# Automatic production database migrations

The standalone Memories service updates its PostgreSQL schema automatically when a published production instance starts.

## Why startup instead of the build step

Replit development and published applications can use different `DATABASE_URL` values. Running migrations from the Project Editor Shell updates the development database. Running them immediately before the production server listens guarantees that the migration uses the published application's production `DATABASE_URL`.

The production artifact sets `NODE_ENV=production`. On startup, `src/server.mjs` therefore:

1. acquires a PostgreSQL advisory lock;
2. creates `memories_schema_migrations` if needed;
3. reads numbered SQL files in `artifacts/memories-album/db`;
4. applies only files not already recorded;
5. verifies that an already-applied migration's checksum has not changed;
6. releases the lock;
7. starts the HTTP server only after migration success.

A failed migration prevents the new production instance from becoming healthy, so an incompatible schema is not served silently. Existing published instances remain separate until Replit completes or rolls back the new publication.

## Required production setting

The Publishing environment must provide the production database connection as:

```text
DATABASE_URL
```

Do not replace it with the development database URL. The Drive folder secrets are independent and remain required for upload functionality:

```text
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID
```

## Adding a migration

Add a new immutable, sequentially numbered file:

```text
artifacts/memories-album/db/003_description.sql
```

Never edit a migration after it has been published. Add a later migration to make further changes. The checksum guard intentionally stops deployment if an already-applied migration was rewritten.

## Manual development migration

The development database can still be updated manually:

```bash
npx -y pnpm@10.15.1 --filter @workspace/memories-album run db:migrate
```

This command now uses the same tracked migration runner as production.

## Publish verification

After publishing, check the deployment logs for:

```text
Checking Memories production database schema before startup...
Applied Memories migration: ...
Memories database schema is ready.
Standalone Memories listening on ...
```

Then inspect the Production Database and confirm these tracking records exist:

```sql
SELECT filename, applied_at
FROM memories_schema_migrations
ORDER BY filename;
```
