import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { createProcessApi } from "../src/server/processes/api.mjs";

function adminCookie() {
  return createAdminSessionCookie({
    configuredToken: "secret",
  }).header.split(";", 1)[0];
}

async function withApi(run, { initialProcesses } = {}) {
  const repository = {
    processes: initialProcesses ?? [
      {
        id: "drive-folder-1",
        labelZh: "進場",
        labelEn: "Entrance",
        displayOrder: 1,
        driveFolderId: "folder-1",
        syncState: "synced",
        isActive: true,
        lastSyncedAt: null,
      },
    ],
    async listProcesses() {
      return this.processes.filter((process) => process.isActive !== false);
    },
    async findProcessById(id) {
      return this.processes.find((process) => process.id === id) ?? null;
    },
    async deactivateProcess(id, syncState) {
      const process = this.processes.find((item) => item.id === id);
      if (!process) return null;
      process.isActive = false;
      process.syncState = syncState;
      return process;
    },
  };
  const driveCalls = { listChildren: 0, delete: 0 };
  const synchronizer = {
    drive: {
      async listChildren() {
        driveCalls.listChildren += 1;
        return [];
      },
      async delete() {
        driveCalls.delete += 1;
      },
    },
    async reconcileFromDrive() {
      return repository.listProcesses();
    },
    async syncProcessFoldersFromDrive() {
      return repository.listProcesses();
    },
    async createProcess(input) {
      const process = {
        id: "drive-folder-2",
        labelZh: input.labelZh,
        labelEn: input.labelEn || input.labelZh,
        displayOrder: 2,
        driveFolderId: "folder-2",
        syncState: "synced",
        isActive: true,
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
      const active = await repository.listProcesses();
      repository.processes = [
        ...ids.map((id, index) => ({
          ...active.find((item) => item.id === id),
          displayOrder: index + 1,
        })),
        ...repository.processes.filter((item) => item.isActive === false),
      ];
      return repository.listProcesses();
    },
  };
  const api = createProcessApi({
    repository,
    synchronizer,
    adminToken: "secret",
  });
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
    await run(`http://127.0.0.1:${address.port}`, {
      repository,
      synchronizer,
      driveCalls,
    });
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

test("admin mutations require an administrator session", async () => {
  await withApi(async (origin) => {
    const denied = await fetch(`${origin}/Memories/api/admin/processes/sync`, {
      method: "POST",
    });
    assert.equal(denied.status, 401);
    const allowed = await fetch(`${origin}/Memories/api/admin/processes/sync`, {
      method: "POST",
      headers: { Cookie: adminCookie() },
    });
    assert.equal(allowed.status, 200);
  });
});

test("website process creation writes through the synchronizer", async () => {
  await withApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/admin/processes`, {
      method: "POST",
      headers: {
        Cookie: adminCookie(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ labelZh: "宴客" }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.process.labelZh, "宴客");
  });
});

test("legacy ghost process deletion succeeds without calling Drive", async () => {
  await withApi(
    async (origin, { repository, driveCalls }) => {
      const response = await fetch(
        `${origin}/Memories/api/admin/processes/entrance`,
        {
          method: "DELETE",
          headers: { Cookie: adminCookie() },
        },
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.deletedProcessId, "entrance");
      assert.equal(body.ghostCleaned, true);
      assert.deepEqual(body.processes, []);
      assert.equal(driveCalls.listChildren, 0);
      assert.equal(driveCalls.delete, 0);
      assert.equal(repository.processes[0].isActive, false);
    },
    {
      initialProcesses: [
        {
          id: "entrance",
          labelZh: "進場",
          labelEn: "Entrance",
          displayOrder: 1,
          driveFolderId: null,
          syncState: "pending",
          isActive: true,
          lastSyncedAt: null,
        },
      ],
    },
  );
});

test("deleting an already missing process is idempotent", async () => {
  await withApi(async (origin) => {
    const response = await fetch(
      `${origin}/Memories/api/admin/processes/group-photo`,
      {
        method: "DELETE",
        headers: { Cookie: adminCookie() },
      },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.deletedProcessId, "group-photo");
    assert.equal(body.alreadyDeleted, true);
  });
});
