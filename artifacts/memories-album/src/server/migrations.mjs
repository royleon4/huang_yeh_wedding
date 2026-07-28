import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATION_LOCK_NAME = "huang-yeh-memories-schema-migrations";
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultMigrationDirectory = path.resolve(moduleDirectory, "../../db");

function checksum(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function createPostgresPool(databaseUrl) {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: databaseUrl, max: 1 });
}

async function loadMigrations(migrationDirectory) {
  const filenames = (await readdir(migrationDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();

  return Promise.all(
    filenames.map(async (filename) => {
      const sql = await readFile(path.join(migrationDirectory, filename), "utf8");
      return { filename, sql, checksum: checksum(sql) };
    }),
  );
}

async function readAppliedMigrations(client) {
  const table = await client.query(
    "SELECT to_regclass('public.memories_schema_migrations') AS table_name",
  );
  if (!table.rows[0]?.table_name) return null;

  const applied = await client.query(
    "SELECT filename, checksum FROM memories_schema_migrations",
  );
  return new Map(applied.rows.map((row) => [row.filename, row.checksum]));
}

function pendingMigrations(migrations, applied) {
  if (!applied) return migrations;

  for (const migration of migrations) {
    const existingChecksum = applied.get(migration.filename);
    if (existingChecksum && existingChecksum !== migration.checksum) {
      throw new Error(
        `Memories migration ${migration.filename} changed after it was applied`,
      );
    }
  }

  return migrations.filter((migration) => !applied.has(migration.filename));
}

export function shouldRunProductionMigrations(env = process.env) {
  return env.NODE_ENV === "production" || env.REPLIT_DEPLOYMENT === "1";
}

export async function runMemoriesMigrations({
  databaseUrl = process.env.DATABASE_URL,
  migrationDirectory = defaultMigrationDirectory,
  createPool = createPostgresPool,
  logger = console,
} = {}) {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required before the Memories production server can start",
    );
  }

  const migrations = await loadMigrations(migrationDirectory);
  const pool = await createPool(databaseUrl);
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    const preflightApplied = await readAppliedMigrations(client);
    const preflightPending = pendingMigrations(migrations, preflightApplied);

    if (preflightPending.length === 0) {
      logger.log("Memories database schema is current; no migration needed.");
      return { applied: 0, current: true };
    }

    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      MIGRATION_LOCK_NAME,
    ]);
    lockAcquired = true;

    let applied = await readAppliedMigrations(client);
    if (!applied) {
      await client.query(`
        CREATE TABLE memories_schema_migrations (
          filename text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      applied = new Map();
    }

    const pending = pendingMigrations(migrations, applied);
    if (pending.length === 0) {
      logger.log("Memories database schema was updated by another instance.");
      return { applied: 0, current: true };
    }

    logger.log(`Applying ${pending.length} pending Memories migration(s)...`);
    for (const migration of pending) {
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO memories_schema_migrations (filename, checksum)
         VALUES ($1, $2)`,
        [migration.filename, migration.checksum],
      );
      logger.log(`Applied Memories migration: ${migration.filename}`);
    }

    logger.log("Memories database schema is ready.");
    return { applied: pending.length, current: true };
  } finally {
    if (lockAcquired) {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
          MIGRATION_LOCK_NAME,
        ]);
      } catch {
        // PostgreSQL releases the session-level advisory lock when the
        // connection closes, even if an explicit unlock is unavailable.
      }
    }
    client.release();
    await pool.end();
  }
}
