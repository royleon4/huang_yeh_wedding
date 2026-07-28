# Production migration no-op behavior

The Published App checks the production database before startup.

When the schema is already current, the check is read-only:

1. Read `memories_schema_migrations` if it exists.
2. Compare recorded checksums with the migration files in the deployed build.
3. Start the server immediately when there are no pending migrations.

The migration lock and schema writes are used only when the production database is initialized for the first time or when a new numbered migration file has been added. Existing migrations are never replayed, existing tables are not dropped, and publishing the same schema again does not recreate the database.
