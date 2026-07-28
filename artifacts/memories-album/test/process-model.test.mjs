import assert from "node:assert/strict";
import test from "node:test";
import { identityForDriveProcess } from "../src/server/processes/model.mjs";

test("Drive folder identity and label are canonical for every process", () => {
  assert.deepEqual(identityForDriveProcess("folder-a", "進場"), {
    id: "drive-folder-a",
    en: "進場",
  });
  assert.deepEqual(identityForDriveProcess("folder-b", "自訂流程"), {
    id: "drive-folder-b",
    en: "自訂流程",
  });
});
