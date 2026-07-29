import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("archive title owns the hidden admin trigger through shared state", async () => {
  const [appSource, stateSource] = await Promise.all([
    readFile(new URL("../src/client/App.jsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/client/MemoriesState.jsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(appSource, /onClick=\{recordArchiveTitleTap\}/);
  assert.match(stateSource, /titleTaps\.current\.length < 5/);
  assert.match(stateSource, /type: "admin-open", open: true/);
  assert.doesNotMatch(
    `${appSource}\n${stateSource}`,
    /MutationObserver|document\.addEventListener\("click"/,
  );
});
