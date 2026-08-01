import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalAdminRequestPath,
  internalAdminUrl,
} from "../src/admin-route-paths.mjs";

const canonicalPathCases = [
  ["/admin", "/Memories/admin/"],
  ["/admin/api/session", "/Memories/admin/api/session"],
];

const internalUrlCases = [
  ["/Memories/admin/", "/admin"],
  ["/Memories/admin/api/photos?limit=10", "/admin/api/photos"],
  ["/Memories/admin/photos", "/admin"],
  ["/Memories/admin/subcategory-ui", "/admin"],
];

test("legacy browser requests are canonicalized beneath Memories", async (t) => {
  for (const [requestPath, expected] of canonicalPathCases) {
    await t.test(requestPath, () => {
      assert.equal(canonicalAdminRequestPath(requestPath), expected);
    });
  }
});

test("canonical Memories admin URLs translate to internal handlers", async (t) => {
  for (const [requestPath, expectedPathname] of internalUrlCases) {
    await t.test(requestPath, () => {
      const internal = internalAdminUrl(
        new URL(requestPath, "https://example.test"),
      );
      assert.equal(internal.pathname, expectedPathname);
    });
  }

  await t.test("preserves API query parameters", () => {
    const internal = internalAdminUrl(
      new URL(
        "/Memories/admin/api/photos?limit=10&cursor=next",
        "https://example.test",
      ),
    );
    assert.equal(internal.search, "?limit=10&cursor=next");
  });
});
