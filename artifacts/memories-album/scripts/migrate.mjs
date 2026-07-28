import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Memories migrations");
}

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.resolve(moduleDirectory, "../db");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  for (const filename of migrationFiles) {
    const sql = await readFile(path.join(migrationDirectory, filename), "utf8");
    await pool.query(sql);
    console.log(`Applied Memories migration: ${filename}`);
  }
  console.log("Memories database is ready.");
} finally {
  await pool.end();
}
