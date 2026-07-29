import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalAdminRequestPath,
  internalAdminUrl,
} from "../src/admin-route-paths.mjs";

test("legacy browser requests are canonicalized beneath Memories", () => {
  assert.equal(canonicalAdminRequestPath("/admin"), "/Memories/admin/");
  assert.equal(
    canonicalAdminRequestPath("/admin/api/session"),
    "/Memories/admin/api/session",
  );
});

test("canonical Memories admin URLs translate to existing internal handlers", () => {
  assert.equal(
    internalAdminUrl(new URL("https://example.test/Memories/admin/")).pathname,
    "/admin",
  );
  assert.equal(
    internalAdminUrl(
      new URL("https://example.test/Memories/admin/api/photos?limit=10"),
    ).pathname,
    "/admin/api/photos",
  );
});
