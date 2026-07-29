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
    this.tableExists = false;
    this.applied = new Map();
    this.executedMigrations = [];
    this.lockAcquires = 0;
    this.createTableCount = 0;
    this.released = false;
  }

  async query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, " ").trim();

    if (normalized.startsWith("SELECT to_regclass")) {
      return {
        rows: [{ table_name: this.tableExists ? "memories_schema_migrations" : null }],
      };
    }

    if (normalized === "SELECT filename, checksum FROM memories_schema_migrations") {
      return {
        rows: [...this.applied.entries()].map(([filename, migrationChecksum]) => ({
          filename,
          checksum: migrationChecksum,
        })),
      };
    }

    if (normalized.startsWith("SELECT pg_advisory_lock")) {
      this.lockAcquires += 1;
      return { rows: [] };
    }

    if (normalized.startsWith("SELECT pg_advisory_unlock")) {
      return { rows: [] };
    }

    if (normalized.startsWith("CREATE TABLE memories_schema_migrations")) {
      this.tableExists = true;
      this.createTableCount += 1;
      return { rows: [] };
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

test("a configured database always enables startup migrations", () => {
  assert.equal(shouldRunProductionMigrations({}), false);
  assert.equal(
    shouldRunProductionMigrations({
      NODE_ENV: "development",
      DATABASE_URL: "postgres://local/memories",
    }),
    true,
  );
  assert.equal(
    shouldRunProductionMigrations({
      REPLIT_DEPLOYMENT: "1",
      DATABASE_URL: "postgres://deployment/memories",
    }),
    true,
  );
  assert.equal(
    shouldRunProductionMigrations({
      DATABASE_URL: "postgres://deployment/memories",
      MEMORIES_SKIP_MIGRATIONS: "1",
    }),
    false,
  );
});

test("creates migration history and applies migrations only on first use", async () => {
  await withMigrationDirectory(async (migrationDirectory) => {
    const client = new FakeMigrationClient();
    const logs = [];
    const options = {
      databaseUrl: "postgres://production.example/memories",
      migrationDirectory,
      createPool: async () => fakePool(client),
      logger: { log: (message) => logs.push(message) },
    };

    const first = await runMemoriesMigrations(options);
    const second = await runMemoriesMigrations(options);

    assert.equal(first.applied, 2);
    assert.equal(second.applied, 0);
    assert.deepEqual(client.executedMigrations, ["SELECT 1;", "SELECT 2;"]);
    assert.deepEqual([...client.applied.keys()], [
      "001_first.sql",
      "002_second.sql",
    ]);
    assert.equal(client.createTableCount, 1);
    assert.equal(client.lockAcquires, 1);
    assert.ok(
      logs.includes("Memories database schema is current; no migration needed."),
    );
    assert.equal(client.released, true);
  });
});

test("acquires the lock and applies only newly added migrations", async () => {
  await withMigrationDirectory(async (migrationDirectory) => {
    const client = new FakeMigrationClient();
    const options = {
      databaseUrl: "postgres://production.example/memories",
      migrationDirectory,
      createPool: async () => fakePool(client),
      logger: { log() {} },
    };

    await runMemoriesMigrations(options);
    await writeFile(path.join(migrationDirectory, "003_third.sql"), "SELECT 3;\n");
    const result = await runMemoriesMigrations(options);

    assert.equal(result.applied, 1);
    assert.deepEqual(client.executedMigrations, ["SELECT 1;", "SELECT 2;", "SELECT 3;"]);
    assert.equal(client.createTableCount, 1);
    assert.equal(client.lockAcquires, 2);
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
    assert.equal(client.lockAcquires, 1);
  });
});

test("refuses to start production migrations without DATABASE_URL", async () => {
  await assert.rejects(
    runMemoriesMigrations({ databaseUrl: "" }),
    /DATABASE_URL is required/,
  );
});
