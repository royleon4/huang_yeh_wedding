import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Memories migrations");
}

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  moduleDirectory,
  "../db/001_memories_foundation.sql",
);
const sql = await readFile(migrationPath, "utf8");
const { Pool } = await import("pg");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  await pool.query(sql);
  console.log("Memories database foundation is ready.");
} finally {
  await pool.end();
}
