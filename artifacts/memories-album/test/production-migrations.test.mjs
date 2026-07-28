import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  runMemoriesMigrations,
  shouldRunProductionMigrations,
} from "../src/server/migrations.mjs";

class FakeMigrationClient {
  constructor() {
    this.applied = new Map();
    this.executedMigrations = [];
    this.released = false;
  }

  async query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, " ").trim();

    if (normalized.startsWith("SELECT pg_advisory_")) {
      return { rows: [] };
    }

    if (normalized.startsWith("CREATE TABLE IF NOT EXISTS memories_schema_migrations")) {
      return { rows: [] };
    }

    if (normalized.startsWith("SELECT checksum FROM memories_schema_migrations")) {
      const checksum = this.applied.get(params[0]);
      return { rows: checksum ? [{ checksum }] : [] };
    }

    if (normalized.startsWith("INSERT INTO memories_schema_migrations")) {
      this.applied.set(params[0], params[1]);
      return { rows: [] };
    }

    this.executedMigrations.push(normalized);
    return { rows: [] };
  }

  release() {
    this.released = true;
  }
}

function fakePool(client) {
  return {
    async connect() {
      return client;
    },
    async end() {},
  };
}

async function withMigrationDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memories-migrations-"));
  try {
    await writeFile(path.join(directory, "001_first.sql"), "SELECT 1;\n");
    await writeFile(path.join(directory, "002_second.sql"), "SELECT 2;\n");
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("only production or a published Replit instance enables startup migrations", () => {
  assert.equal(shouldRunProductionMigrations({ NODE_ENV: "development" }), false);
  assert.equal(shouldRunProductionMigrations({ NODE_ENV: "production" }), true);
  assert.equal(shouldRunProductionMigrations({ REPLIT_DEPLOYMENT: "1" }), true);
});

test("applies each migration once and records its checksum", async () => {
  await withMigrationDirectory(async (migrationDirectory) => {
    const client = new FakeMigrationClient();
    const logs = [];
    const options = {
      databaseUrl: "postgres://production.example/memories",
      migrationDirectory,
      createPool: async () => fakePool(client),
      logger: { log: (message) => logs.push(message) },
    };

    await runMemoriesMigrations(options);
    await runMemoriesMigrations(options);

    assert.deepEqual(client.executedMigrations, ["SELECT 1;", "SELECT 2;"]);
    assert.deepEqual([...client.applied.keys()], [
      "001_first.sql",
      "002_second.sql",
    ]);
    assert.ok(logs.includes("Memories migration already applied: 001_first.sql"));
    assert.equal(client.released, true);
  });
});

test("fails safely when an already-applied migration file changes", async () => {
  await withMigrationDirectory(async (migrationDirectory) => {
    const client = new FakeMigrationClient();
    const options = {
      databaseUrl: "postgres://production.example/memories",
      migrationDirectory,
      createPool: async () => fakePool(client),
      logger: { log() {} },
    };

    await runMemoriesMigrations(options);
    await writeFile(path.join(migrationDirectory, "001_first.sql"), "SELECT 99;\n");

    await assert.rejects(
      runMemoriesMigrations(options),
      /migration 001_first\.sql changed after it was applied/,
    );
  });
});

test("refuses to start production migrations without DATABASE_URL", async () => {
  await assert.rejects(
    runMemoriesMigrations({ databaseUrl: "" }),
    /DATABASE_URL is required/,
  );
});
