import assert from "node:assert/strict";
import test from "node:test";
import {
  initialMemoriesState,
  memoriesStateReducer,
  normalizeServerProcesses,
} from "../src/client/memories-state-model.mjs";

test("normalizes server processes without mutating unrelated UI state", () => {
  const state = {
    ...initialMemoriesState,
    activeCollection: "life",
    modal: "upload",
    photoRevision: 4,
  };
  const next = memoriesStateReducer(state, {
    type: "processes",
    processes: [
      {
        id: "vows",
        labelZh: "證婚",
        labelEn: "Vows",
        displayOrder: 2,
      },
      {
        id: "entrance",
        labelZh: "進場",
        labelEn: "Entrance",
        displayOrder: 1,
      },
    ],
  });

  assert.equal(next.activeCollection, "life");
  assert.equal(next.modal, "upload");
  assert.equal(next.photoRevision, 4);
  assert.deepEqual(
    next.processes.map((process) => process.id),
    ["entrance", "vows"],
  );
  assert.equal(state.processes.length, 0);
});

test("invalid server process entries are removed", () => {
  assert.deepEqual(
    normalizeServerProcesses([
      { id: "", labelZh: "Missing id" },
      { id: "valid", labelZh: "有效", displayOrder: "3" },
    ]),
    [
      {
        id: "valid",
        zh: "有效",
        en: "有效",
        labelZh: "有效",
        labelEn: "有效",
        displayOrder: 3,
      },
    ],
  );
});
