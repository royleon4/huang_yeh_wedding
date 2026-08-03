import assert from "node:assert/strict";
import test from "node:test";

import { selectTestsForFiles } from "../scripts/select-tests.mjs";

const AVAILABLE_TESTS = [
  "artifacts/memories-album/test/album-photo-order.test.mjs",
  "artifacts/memories-album/test/message-album-layout-regressions.test.mjs",
  "artifacts/memories-album/test/message-api.test.mjs",
  "artifacts/memories-album/test/postgres-message-moderation.test.mjs",
  "artifacts/memories-album/test/public-layout-polish.test.mjs",
  "artifacts/memories-album/test/stable-identity-routes.test.mjs",
  "artifacts/memories-album/test/startup-migrations.test.mjs",
];

test("documentation-only changes skip executable Memories tests", () => {
  const selection = selectTestsForFiles(
    ["docs/memories/testing-strategy.md", "artifacts/memories-album/README.md"],
    AVAILABLE_TESTS,
  );

  assert.equal(selection.mode, "none");
  assert.equal(selection.browser, "none");
  assert.equal(selection.build, false);
  assert.deepEqual(selection.tests, []);
});

test("guestbook UI changes select guestbook tests and its Chrome check", () => {
  const selection = selectTestsForFiles(
    ["artifacts/memories-album/src/client/MessageAlbum.jsx"],
    AVAILABLE_TESTS,
  );

  assert.equal(selection.mode, "targeted");
  assert.equal(selection.browser, "guestbook");
  assert.equal(selection.build, false);
  assert.deepEqual(selection.tests, [
    "artifacts/memories-album/test/album-photo-order.test.mjs",
    "artifacts/memories-album/test/message-album-layout-regressions.test.mjs",
    "artifacts/memories-album/test/message-api.test.mjs",
    "artifacts/memories-album/test/postgres-message-moderation.test.mjs",
  ]);
});

test("guestbook server changes avoid an unrelated browser run", () => {
  const selection = selectTestsForFiles(
    ["artifacts/memories-album/src/server/messages/api.mjs"],
    AVAILABLE_TESTS,
  );

  assert.equal(selection.mode, "targeted");
  assert.equal(selection.browser, "none");
  assert(selection.tests.includes("artifacts/memories-album/test/message-api.test.mjs"));
});

test("navigation changes select navigation tests and Chrome", () => {
  const selection = selectTestsForFiles(
    ["artifacts/memories-album/src/client/BottomCollectionNav.jsx"],
    AVAILABLE_TESTS,
  );

  assert.equal(selection.mode, "targeted");
  assert.equal(selection.browser, "navigation");
  assert(selection.tests.includes("artifacts/memories-album/test/public-layout-polish.test.mjs"));
  assert(selection.tests.includes("artifacts/memories-album/test/stable-identity-routes.test.mjs"));
});

test("combined guestbook and navigation changes run both Chrome suites", () => {
  const selection = selectTestsForFiles(
    [
      "artifacts/memories-album/src/client/MessageAlbum.jsx",
      "artifacts/memories-album/src/client/BottomCollectionNav.jsx",
    ],
    AVAILABLE_TESTS,
  );

  assert.equal(selection.mode, "targeted");
  assert.equal(selection.browser, "all");
});

test("a directly changed test file runs by itself", () => {
  const selection = selectTestsForFiles(
    ["artifacts/memories-album/test/message-api.test.mjs"],
    AVAILABLE_TESTS,
  );

  assert.equal(selection.mode, "targeted");
  assert.deepEqual(selection.tests, [
    "artifacts/memories-album/test/message-api.test.mjs",
  ]);
});

test("cross-cutting route configuration safely requests full tests and build", () => {
  const selection = selectTestsForFiles(
    ["artifacts/memories-album/vite.routes.config.js"],
    AVAILABLE_TESTS,
  );

  assert.equal(selection.mode, "full");
  assert.equal(selection.browser, "all");
  assert.equal(selection.build, true);
  assert.deepEqual(selection.tests, []);
});

test("unmapped client changes safely fall back to full tests and Chrome", () => {
  const selection = selectTestsForFiles(
    ["artifacts/memories-album/src/client/NewSurface.jsx"],
    AVAILABLE_TESTS,
  );

  assert.equal(selection.mode, "full");
  assert.equal(selection.browser, "all");
  assert.match(selection.reason, /unmapped client change/);
});
