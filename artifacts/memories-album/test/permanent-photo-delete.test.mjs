import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { createPermanentPhotoDeleteApi } from "../src/server/photos/permanent-delete-api.mjs";

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

test("administrator permanent delete removes every record and Drive file for the same photo", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const duplicateId = "33333333-3333-4333-8333-333333333333";
  const photos = [
    {
      id,
      displayName: "交換誓詞",
      driveFileId: "original-file-a",
      thumbnailDriveFileId: "thumbnail-file-a",
      uploaderName: "訪客甲",
      albumIds: ["wedding", "guest"],
      processIds: ["vows"],
    },
    {
      id: duplicateId,
      displayName: "交換誓詞",
      driveFileId: "original-file-b",
      thumbnailDriveFileId: "thumbnail-file-b",
      uploaderName: "訪客甲",
      albumIds: ["life"],
      processIds: [],
    },
  ];
  const deletedFiles = [];
  let deletedIds = [];
  let cleanedPinnedIds = [];
  const repository = {
    async findPhotoFamilyForAdmin(requestedId) {
      return requestedId === id ? photos : [];
    },
    async deletePhotosPermanently(requestedIds) {
      deletedIds = [...requestedIds];
      return requestedIds;
    },
    async removePinnedPhotoIds(requestedIds) {
      cleanedPinnedIds = [...requestedIds];
    },
  };
  const drive = {
    async delete(fileId) {
      deletedFiles.push(fileId);
    },
  };
  const api = createPermanentPhotoDeleteApi({ repository, drive, adminToken });

  await withApi(api, async (origin) => {
    const response = await fetch(`${origin}/admin/api/photos/${id}`, {
      method: "DELETE",
      headers: {
        Cookie: adminCookie(),
        "X-Memories-Admin": "1",
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      deleted: true,
      id,
      deletedIds: [id, duplicateId],
      deletedCount: 2,
    });
    assert.deepEqual(deletedFiles, [
      "thumbnail-file-a",
      "original-file-a",
      "thumbnail-file-b",
      "original-file-b",
    ]);
    assert.deepEqual(deletedIds, [id, duplicateId]);
    assert.deepEqual(cleanedPinnedIds, [id, duplicateId]);
  });
});

test("a protected wedding-photographer copy protects the whole photo family", async () => {
  const id = "44444444-4444-4444-8444-444444444444";
  let deleted = false;
  const api = createPermanentPhotoDeleteApi({
    repository: {
      async findPhotoFamilyForAdmin() {
        return [
          { id, uploaderName: "訪客甲", driveFileId: "guest-copy" },
          {
            id: "55555555-5555-4555-8555-555555555555",
            uploaderName: "婚禮攝影",
            driveFileId: "official-copy",
          },
        ];
      },
      async deletePhotosPermanently() {
        deleted = true;
        return [];
      },
    },
    drive: {
      async delete() {
        deleted = true;
      },
    },
    adminToken,
  });

  await withApi(api, async (origin) => {
    const response = await fetch(`${origin}/admin/api/photos/${id}`, {
      method: "DELETE",
      headers: {
        Cookie: adminCookie(),
        "X-Memories-Admin": "1",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(
      (await response.json()).code,
      "WEDDING_PHOTOGRAPHER_PHOTO_PROTECTED",
    );
    assert.equal(deleted, false);
  });
});

test("permanent deletion requires an administrator session", async () => {
  const api = createPermanentPhotoDeleteApi({
    repository: {
      async findPhotoForAdmin() {
        throw new Error("must not read without authentication");
      },
    },
    drive: {},
    adminToken,
  });

  await withApi(api, async (origin) => {
    const response = await fetch(`${origin}/admin/api/photos/photo-id`, {
      method: "DELETE",
      headers: { "X-Memories-Admin": "1" },
    });
    assert.equal(response.status, 401);
  });
});
