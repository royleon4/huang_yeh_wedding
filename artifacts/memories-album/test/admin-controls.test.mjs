import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { createAdminBatchApi } from "../src/server/uploads/admin-api.mjs";
import { createSettingsApi } from "../src/server/settings/api.mjs";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";

const adminToken = "correct-password";
const batchId = "11111111-1111-4111-8111-111111111111";

function adminCookie() {
  return createAdminSessionCookie({
    configuredToken: adminToken,
    now: Date.now,
    createNonce: () => "fixed",
  }).header.split(";", 1)[0];
}

async function withApi(apis, run) {
  const server = createServer(async (request, response) => {
    for (const api of apis) {
      if (await api(request, response)) return;
    }
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

test("album settings require a session and persist a complete audit event", async () => {
  let settings = {
    primaryNavigationVisible: false,
    albumOpen: true,
  };
  const events = [];
  const repository = {
    async getPublicSettings() {
      return { ...settings };
    },
    async updateSettings(patch) {
      settings = { ...settings, ...patch };
      return { ...settings };
    },
  };
  const api = createSettingsApi({
    repository,
    adminToken,
    now: () => new Date("2026-06-20T01:00:00.000Z"),
    auditRepository: {
      async record(event) {
        events.push(event);
      },
    },
  });

  await withApi([api], async (origin) => {
    const bearerOnly = await fetch(`${origin}/Memories/api/admin/settings`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ albumOpen: false }),
    });
    assert.equal(bearerOnly.status, 401);

    const changed = await fetch(`${origin}/Memories/api/admin/settings`, {
      method: "PATCH",
      headers: {
        Cookie: adminCookie(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ albumOpen: false }),
    });
    assert.equal(changed.status, 200);
    assert.deepEqual(await changed.json(), {
      primaryNavigationVisible: false,
      albumOpen: false,
    });

    assert.deepEqual(events, [
      {
        actor: "shared-secret-admin",
        action: "settings.update",
        targetType: "album",
        targetId: "memories",
        before: {
          primaryNavigationVisible: false,
          albumOpen: true,
        },
        after: {
          primaryNavigationVisible: false,
          albumOpen: false,
        },
        createdAt: "2026-06-20T01:00:00.000Z",
      },
    ]);
  });
});

test("administrators can inspect, revoke and regenerate guest links without exposing stored hashes", async () => {
  const events = [];
  const repository = new MemoryPhotoRepository(
    [],
    [
      {
        id: batchId,
        uploaderType: "guest",
        uploaderName: "Guest",
        tokenHash: "old-hash",
        status: "open",
        classification: "guest",
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
      },
    ],
  );
  const api = createAdminBatchApi({
    repository,
    adminToken,
    createToken: () => "replacement-token",
    now: () => new Date("2026-06-20T02:00:00.000Z"),
    auditRepository: {
      async record(event) {
        events.push(event);
      },
    },
  });

  await withApi([api], async (origin) => {
    const headers = { Cookie: adminCookie() };
    const listed = await fetch(`${origin}/Memories/api/admin/upload-batches`, {
      headers,
    });
    assert.equal(listed.status, 200);
    const listBody = await listed.json();
    assert.equal(listBody.batches[0].id, batchId);
    assert.equal(JSON.stringify(listBody).includes("old-hash"), false);

    const revoked = await fetch(
      `${origin}/Memories/api/admin/upload-batches/${batchId}/revoke`,
      { method: "POST", headers },
    );
    assert.equal(revoked.status, 200);
    assert.equal((await revoked.json()).batch.status, "revoked");

    const regenerated = await fetch(
      `${origin}/Memories/api/admin/upload-batches/${batchId}/management-token`,
      { method: "POST", headers },
    );
    assert.equal(regenerated.status, 200);
    assert.deepEqual(await regenerated.json(), {
      manageUrl: `/Memories/manage/${batchId}#token=replacement-token`,
    });

    assert.deepEqual(
      events.map((event) => ({
        actor: event.actor,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        createdAt: event.createdAt,
      })),
      [
        {
          actor: "shared-secret-admin",
          action: "upload-batch.revoke",
          targetType: "upload-batch",
          targetId: batchId,
          createdAt: "2026-06-20T02:00:00.000Z",
        },
        {
          actor: "shared-secret-admin",
          action: "upload-batch.regenerate-link",
          targetType: "upload-batch",
          targetId: batchId,
          createdAt: "2026-06-20T02:00:00.000Z",
        },
      ],
    );
    assert.equal(JSON.stringify(events).includes("replacement-token"), false);
  });
});
