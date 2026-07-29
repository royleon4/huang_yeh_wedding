import assert from "node:assert/strict";
import test from "node:test";
import { createMemoriesRuntimeManager } from "../src/server/runtime.mjs";

test("a failed runtime initialization recovers after bounded backoff", async () => {
  let now = 1_000;
  let attempts = 0;
  const readyRuntime = { id: "ready" };
  const manager = createMemoriesRuntimeManager({
    now: () => now,
    retryDelayMs: () => 500,
    logger: { info() {}, warn() {} },
    create: async () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error("secret connector response");
        error.code = "DRIVE_RETRYABLE";
        throw error;
      }
      return readyRuntime;
    },
  });

  await assert.rejects(manager.getRuntime({}), {
    code: "DRIVE_RETRYABLE",
  });
  await assert.rejects(manager.getRuntime({}), {
    code: "DRIVE_RETRYABLE",
  });
  assert.equal(attempts, 1, "backoff must prevent a tight retry loop");

  now += 500;
  const recovered = await Promise.all([
    manager.getRuntime({}),
    manager.getRuntime({}),
    manager.getRuntime({}),
  ]);

  assert.deepEqual(recovered, [readyRuntime, readyRuntime, readyRuntime]);
  assert.equal(attempts, 2, "concurrent callers must share one recovery");
  assert.equal(await manager.getRuntime({}), readyRuntime);
  assert.equal(attempts, 2, "a successful runtime stays memoized");
});

test("runtime recovery logs bounded operational metadata only", async () => {
  let now = 10;
  const events = [];
  const manager = createMemoriesRuntimeManager({
    now: () => now,
    retryDelayMs: () => 250,
    logger: {
      info(message, metadata) {
        events.push({ level: "info", message, metadata });
      },
      warn(message, metadata) {
        events.push({ level: "warn", message, metadata });
      },
    },
    create: async () => {
      now += 25;
      const error = new Error(
        "postgres://private-user:private-password@private-host/database",
      );
      error.code = "DATABASE_CONNECTION_FAILED";
      throw error;
    },
  });

  await assert.rejects(manager.getRuntime({}));

  assert.deepEqual(events, [
    {
      level: "info",
      message: "Memories runtime initialization started",
      metadata: { attempt: 1 },
    },
    {
      level: "warn",
      message: "Memories runtime initialization failed",
      metadata: {
        attempt: 1,
        durationMs: 25,
        code: "DATABASE_CONNECTION_FAILED",
        retryAfterMs: 250,
      },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(events), /private-password|private-host/);
});
