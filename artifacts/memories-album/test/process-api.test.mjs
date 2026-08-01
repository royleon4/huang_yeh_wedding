import assert from "node:assert/strict";
import test from "node:test";
import { createProcessApi } from "../src/server/processes/api.mjs";
import { withRequestHandler } from "../test-support/http.mjs";

function createProcessRepository() {
  return {
    async listProcesses() {
      return [
        {
          id: "drive-folder-1",
          labelZh: "進場",
          labelEn: "Entrance",
          displayOrder: 1,
          driveFolderId: "private-drive-folder-id",
          syncState: "synced",
          lastSyncedAt: null,
        },
      ];
    },
  };
}

function withProcessApi(run) {
  const api = createProcessApi({ repository: createProcessRepository() });
  return withRequestHandler(api, run);
}

test("public process listing omits Drive identifiers", async () => {
  await withProcessApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/processes`);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.processes[0].labelZh, "進場");
    assert.equal("driveFolderId" in body.processes[0], false);
  });
});

test("removed Memories administrator process routes are not handled", async () => {
  await withProcessApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/admin/processes`, {
      method: "POST",
    });
    assert.equal(response.status, 404);
  });
});
