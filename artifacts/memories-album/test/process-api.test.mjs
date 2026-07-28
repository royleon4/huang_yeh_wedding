import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createProcessApi } from "../src/server/processes/api.mjs";

async function withApi(run) {
  const repository = {
    processes: [{
      id: "drive-folder-1",
      labelZh: "進場",
      labelEn: "Entrance",
      displayOrder: 1,
      syncState: "synced",
      lastSyncedAt: null,
    }],
    async listProcesses() { return this.processes; },
  };
  const synchronizer = {
    async reconcileFromDrive() { return repository.processes; },
    async createProcess(input) {
      const process = {
        id: "drive-folder-2",
        labelZh: input.labelZh,
        labelEn: input.labelEn || input.labelZh,
        displayOrder: 2,
        syncState: "synced",
        lastSyncedAt: null,
      };
      repository.processes.push(process);
      return process;
    },
    async renameProcess(process, labelZh, labelEn) {
      Object.assign(process, { labelZh, labelEn: labelEn || labelZh });
      return process;
    },
    async reorderProcesses(ids) {
      repository.processes = ids.map((id, index) => ({
        ...repository.processes.find((item) => item.id === id),
        displayOrder: index + 1,
      }));
      return repository.processes;
    },
  };
  const api = createProcessApi({ repository, synchronizer, adminToken: "secret" });
  const server = createServer(async (request, response) => {
    const handled = await api(request, response);
    if (!handled) {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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

test("admin mutations require the deployment token", async () => {
  await withApi(async (origin) => {
    const denied = await fetch(`${origin}/Memories/api/admin/processes/sync`, { method: "POST" });
    assert.equal(denied.status, 401);
    const allowed = await fetch(`${origin}/Memories/api/admin/processes/sync`, {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
    });
    assert.equal(allowed.status, 200);
  });
});

test("website process creation writes through the synchronizer", async () => {
  await withApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/admin/processes`, {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ labelZh: "宴客" }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.process.labelZh, "宴客");
  });
});
