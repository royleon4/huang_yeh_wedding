import assert from "node:assert/strict";
import test from "node:test";
import { PostgresMessageRepository } from "../src/server/messages/postgres-repository.mjs";

function row(overrides = {}) {
  return {
    id: "message-1",
    album_id: "messages",
    visitor_name: "Leon",
    body: "Blessings",
    message_at: "2026-06-20T00:00:00.000Z",
    visibility: "public",
    source: "guest",
    ...overrides,
  };
}

test("PostgreSQL message moderation scopes visibility updates to the message album", async () => {
  const calls = [];
  const repository = new PostgresMessageRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [row({ visibility: values[2] })] };
    },
  });

  const updated = await repository.updateVisibility({
    id: "message-1",
    albumId: "messages",
    visibility: "hidden",
  });

  assert.equal(updated.visibility, "hidden");
  assert.match(calls[0].sql, /WHERE id = \$1 AND album_id = \$2/);
  assert.deepEqual(calls[0].values, ["message-1", "messages", "hidden"]);
});

test("PostgreSQL message deletion returns null when no scoped row exists", async () => {
  const calls = [];
  const repository = new PostgresMessageRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  });

  const deleted = await repository.deleteMessage({
    id: "missing-message",
    albumId: "messages",
  });

  assert.equal(deleted, null);
  assert.match(calls[0].sql, /DELETE FROM memories_messages/);
  assert.match(calls[0].sql, /WHERE id = \$1 AND album_id = \$2/);
  assert.deepEqual(calls[0].values, ["missing-message", "messages"]);
});
