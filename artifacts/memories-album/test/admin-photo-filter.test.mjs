import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { createAdminPhotoFilterApi } from "../src/server/photos/admin-filter-api.mjs";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";

const adminToken = "correct-password";

function adminCookie() {
  return createAdminSessionCookie({
    configuredToken: adminToken,
    createNonce: () => "fixed",
  }).header.split(";", 1)[0];
}

async function withApi(api, run) {
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

function photo({ id, uploaderName, albumIds, processIds = [] }) {
  return {
    id,
    driveFileId: `drive-${id}`,
    thumbnailDriveFileId: `thumb-${id}`,
    originalFilename: `${id}.jpg`,
    displayName: id,
    mimeType: "image/jpeg",
    byteSize: 10,
    contentHash: id,
    source: "guest",
    uploaderName,
    collection: albumIds[0] ?? "guest",
    visibility: "public",
    processingState: "ready",
    albumIds,
    processIds,
    createdAt: `2026-06-20T00:0${id.slice(-1)}:00.000Z`,
    updatedAt: `2026-06-20T00:0${id.slice(-1)}:00.000Z`,
  };
}

test("administrators can combine album, label, and author filters", async () => {
  const repository = new MemoryPhotoRepository([
    photo({
      id: "photo-1",
      uploaderName: "小安",
      albumIds: ["life"],
      processIds: ["daily"],
    }),
    photo({
      id: "photo-2",
      uploaderName: "小安",
      albumIds: ["guest"],
    }),
    photo({
      id: "photo-3",
      uploaderName: "婚禮攝影",
      albumIds: ["wedding"],
      processIds: ["banquet"],
    }),
  ]);
  const api = createAdminPhotoFilterApi({ repository, adminToken });

  await withApi(api, async (origin) => {
    const response = await fetch(
      `${origin}/admin/api/photos?albumId=life&labelId=daily&uploaderName=${encodeURIComponent("小安")}`,
      { headers: { Cookie: adminCookie() } },
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.photos.map((item) => item.id), ["photo-1"]);
    assert.equal(payload.total, 1);
    assert.equal(payload.photos[0].uploaderName, "小安");
    assert.deepEqual(payload.photos[0].albumIds, ["life"]);
    assert.deepEqual(payload.photos[0].categoryIds, ["daily"]);
  });
});

test("selection mode pages through every filtered photo even without visible filters", async () => {
  const repository = new MemoryPhotoRepository([
    photo({ id: "photo-1", uploaderName: "小安", albumIds: ["guest"] }),
    photo({ id: "photo-2", uploaderName: "小安", albumIds: ["life"] }),
    photo({ id: "photo-3", uploaderName: "婚禮攝影", albumIds: ["wedding"] }),
  ]);
  const api = createAdminPhotoFilterApi({ repository, adminToken });

  await withApi(api, async (origin) => {
    const first = await fetch(
      `${origin}/admin/api/photos?selection=all&limit=2`,
      { headers: { Cookie: adminCookie() } },
    );
    assert.equal(first.status, 200);
    const firstPayload = await first.json();
    assert.equal(firstPayload.total, 3);
    assert.equal(firstPayload.photos.length, 2);
    assert.ok(firstPayload.nextCursor);

    const second = await fetch(
      `${origin}/admin/api/photos?selection=all&limit=2&cursor=${encodeURIComponent(firstPayload.nextCursor)}`,
      { headers: { Cookie: adminCookie() } },
    );
    assert.equal(second.status, 200);
    const secondPayload = await second.json();
    assert.equal(secondPayload.total, 3);
    assert.equal(secondPayload.photos.length, 1);
    assert.equal(secondPayload.nextCursor, null);
  });
});

test("administrator author options include every non-empty uploader", async () => {
  const repository = new MemoryPhotoRepository([
    photo({ id: "photo-1", uploaderName: "小安", albumIds: ["guest"] }),
    photo({ id: "photo-2", uploaderName: "婚禮攝影", albumIds: ["wedding"] }),
    photo({ id: "photo-3", uploaderName: "小安", albumIds: ["life"] }),
  ]);
  const api = createAdminPhotoFilterApi({ repository, adminToken });

  await withApi(api, async (origin) => {
    const response = await fetch(`${origin}/admin/api/photo-authors`, {
      headers: { Cookie: adminCookie() },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(new Set(payload.authors), new Set(["小安", "婚禮攝影"]));
  });
});
