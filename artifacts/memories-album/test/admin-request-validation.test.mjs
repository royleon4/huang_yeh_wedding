import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { readAdminJson } from "../src/server/admin/request.mjs";

function requestWith(body) {
  return Readable.from([Buffer.from(body, "utf8")]);
}

test("administrator JSON reader accepts numeric and object byte limits", async () => {
  assert.deepEqual(await readAdminJson(requestWith('{"ok":true}'), 64), {
    ok: true,
  });
  assert.deepEqual(
    await readAdminJson(requestWith('{"value":1}'), { maxBytes: 64 }),
    { value: 1 },
  );
});

test("administrator JSON reader rejects invalid limit configuration", async () => {
  for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "none"]) {
    await assert.rejects(
      readAdminJson(requestWith("{}"), limit),
      (error) => error instanceof TypeError && /positive integer/.test(error.message),
    );
  }
});

test("administrator JSON reader distinguishes oversized and malformed input", async () => {
  await assert.rejects(
    readAdminJson(requestWith('{"value":123}'), 4),
    (error) => error?.status === 413 && error?.code === "BODY_TOO_LARGE",
  );
  await assert.rejects(
    readAdminJson(requestWith("{"), 64),
    (error) => error?.status === 400 && error?.code === "INVALID_JSON",
  );
});
