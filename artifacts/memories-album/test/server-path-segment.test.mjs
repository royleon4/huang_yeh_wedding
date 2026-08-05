import assert from "node:assert/strict";
import test from "node:test";
import { decodePathSegment } from "../src/server/http/path-segment.mjs";

test("server path decoder accepts encoded identifiers and optional forward slashes", () => {
  assert.equal(decodePathSegment("photo%20one"), "photo one");
  assert.equal(
    decodePathSegment("assets%2Fmain.js", { allowSlash: true }),
    "assets/main.js",
  );
});

test("server path decoder rejects malformed encoding traversal separators and nulls", () => {
  for (const value of ["%", "%2F", "%5C", "photo%00.jpg", ""]) {
    assert.throws(
      () => decodePathSegment(value),
      (error) => error?.status === 400 && error?.code === "INVALID_PATH_SEGMENT",
    );
  }
  assert.throws(
    () => decodePathSegment("assets%5Cmain.js", { allowSlash: true }),
    (error) => error?.status === 400 && error?.code === "INVALID_PATH_SEGMENT",
  );
});
