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

  const migrationFiles = (await readdir(migrationDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();

  const pool = await createPool(databaseUrl);
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      MIGRATION_LOCK_NAME,
    ]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS memories_schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const filename of migrationFiles) {
      const sql = await readFile(path.join(migrationDirectory, filename), "utf8");
      const fileChecksum = checksum(sql);
      const existing = await client.query(
        "SELECT checksum FROM memories_schema_migrations WHERE filename = $1",
        [filename],
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].checksum !== fileChecksum) {
          throw new Error(
            `Memories migration ${filename} changed after it was applied`,
          );
        }
        logger.log(`Memories migration already applied: ${filename}`);
        continue;
      }

      await client.query(sql);
      await client.query(
        `INSERT INTO memories_schema_migrations (filename, checksum)
         VALUES ($1, $2)`,
        [filename, fileChecksum],
      );
      logger.log(`Applied Memories migration: ${filename}`);
    }

    logger.log("Memories database schema is ready.");
  } finally {
    if (lockAcquired) {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
          MIGRATION_LOCK_NAME,
        ]);
      } catch {
        // The database connection may already be unavailable. Releasing it
        // still lets PostgreSQL discard the session-level advisory lock.
      }
    }
    client.release();
    await pool.end();
  }
}
