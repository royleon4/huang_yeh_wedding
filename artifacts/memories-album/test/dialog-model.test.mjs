import assert from "node:assert/strict";
import test from "node:test";
import { nextDialogFocusIndex } from "../src/client/dialog-model.mjs";

test("Tab and Shift+Tab wrap inside a dialog", () => {
  assert.equal(
    nextDialogFocusIndex({ current: 0, count: 3, reverse: false }),
    1,
  );
  assert.equal(
    nextDialogFocusIndex({ current: 2, count: 3, reverse: false }),
    0,
  );
  assert.equal(
    nextDialogFocusIndex({ current: 0, count: 3, reverse: true }),
    2,
  );
  assert.equal(
    nextDialogFocusIndex({ current: 1, count: 3, reverse: true }),
    0,
  );
  assert.equal(
    nextDialogFocusIndex({ current: -1, count: 3, reverse: false }),
    0,
  );
});
