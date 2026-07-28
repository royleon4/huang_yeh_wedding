import assert from "node:assert/strict";
import test from "node:test";
import { identityForDriveProcess } from "../src/server/processes/model.mjs";

test("default Drive folders reuse stable website process ids", () => {
  assert.deepEqual(identityForDriveProcess("folder-a", "進場"), {
    id: "entrance",
    en: "Entrance",
  });
  assert.equal(identityForDriveProcess("folder-b", "自訂流程").id.startsWith("drive-"), true);
});
