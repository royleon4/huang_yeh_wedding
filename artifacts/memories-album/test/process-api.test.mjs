import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createProcessApi } from "../src/server/processes/api.mjs";

async function withApi(run) {
  const repository = {
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
  const api = createProcessApi({ repository });
  const server = createServer(async (request, response) => {
    if (await api(request, response)) return;
    response.statusCode = 404;
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("public process listing omits Drive identifiers", async () => {
  await withApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/processes`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.processes[0].labelZh, "進場");
    assert.equal("driveFolderId" in body.processes[0], false);
  });
});

test("the removed Memories admin process routes are not handled", async () => {
  await withApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/admin/processes`, {
      method: "POST",
    });
    assert.equal(response.status, 404);
  });
});
