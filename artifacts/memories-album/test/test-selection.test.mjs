import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

async function readWorkflow(name) {
  return readFile(new URL(`../../../.github/workflows/${name}`, import.meta.url), "utf8");
}

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

test("dependency analysis selects tests that import or reference a changed module", () => {
  const selection = selectTestsForFiles([
    "artifacts/memories-album/src/client/guest-featured-photos.mjs",
  ]);

  assert.equal(selection.mode, "targeted");
  assert.equal(selection.browser, "none");
  assert.equal(selection.build, false);
  assert(selection.tests.includes(
    "artifacts/memories-album/test/guest-featured-photos.test.mjs",
  ));
  assert(selection.tests.includes(
    "artifacts/memories-album/test/random-featured-photo-context.test.mjs",
  ));
});

test("a production UI transform runs related tests and build without forcing every test", () => {
  const selection = selectTestsForFiles([
    "artifacts/memories-album/guest-featured-photos-ui-transform.mjs",
  ]);

  assert.equal(selection.mode, "targeted");
  assert.equal(selection.build, true);
  assert(selection.tests.includes(
    "artifacts/memories-album/test/guest-featured-photos.test.mjs",
  ));
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
  assert.match(selection.reason, /no related test could be proven/);
});

test("Draft and ready pull requests do not duplicate the same validation workflow", async () => {
  const [fastWorkflow, readyWorkflow] = await Promise.all([
    readWorkflow("memories-fast-ci.yml"),
    readWorkflow("memories-ci.yml"),
  ]);

  assert.match(fastWorkflow, /if: github\.event\.pull_request\.draft == true/);
  assert.match(
    readyWorkflow,
    /if: github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.draft == false/,
  );
  assert.match(readyWorkflow, /Select impacted validation/);
  assert.match(readyWorkflow, /Run targeted Memories tests/);
  assert.match(readyWorkflow, /Run full Memories unit and API tests/);
  assert.match(readyWorkflow, /main or manually dispatched integration gate/);
  assert.match(readyWorkflow, /if: steps\.impact\.outputs\.build == 'true'/);
});
