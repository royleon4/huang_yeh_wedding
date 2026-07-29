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

Do not replace it with the development database URL. The Drive root-folder secret and current administrator secret are independent:

```text
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
SECRET_TOKEN
```

The runtime discovers or creates `訪客上傳`, `生活照`, `系統縮圖`, and `00 未分類` below the root. A separate thumbnail-folder secret is not required.

## Adding a migration

Add a new immutable, sequentially numbered file:

```text
artifacts/memories-album/db/003_description.sql
```

Never edit a migration after it has been published. Add a later migration to make further changes. The checksum guard intentionally stops deployment if an already-applied migration was rewritten.

## Development and production schema parity

Replit generates its production-database deployment plan by comparing the development schema with the production schema. A migration that has reached production but not development can therefore appear as a destructive `DROP TABLE` or `DROP COLUMN` operation during the next publish.

The repository `postMerge` hook runs the same tracked Memories migration runner against the development `DATABASE_URL`:

```bash
pnpm --filter @workspace/memories-album run db:migrate
```

Do not use `drizzle-kit push` for Memories. The shared Drizzle schema is not the source of truth for these tables, and an empty or incomplete Drizzle schema can incorrectly remove SQL-managed objects.

If Publishing already shows a destructive migration, cancel that deployment, run the command above in the Replit development environment, then start a new publish. Do not choose the option that copies development data over production unless replacing all live production data is intentional.

## Manual development migration

The development database can still be updated manually:

```bash
npx -y pnpm@10.15.1 --filter @workspace/memories-album run db:migrate
```

This command uses the same tracked migration runner as production.

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
