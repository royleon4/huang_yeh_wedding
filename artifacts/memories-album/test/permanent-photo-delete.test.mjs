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

test("administrator permanent delete removes thumbnail, original, and database record", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  let record = {
    id,
    displayName: "交換誓詞",
    driveFileId: "original-file",
    thumbnailDriveFileId: "thumbnail-file",
  };
  const deletedFiles = [];
  const repository = {
    async findPhotoForAdmin(requestedId) {
      return requestedId === id ? record : null;
    },
    async deletePhotoPermanently(requestedId) {
      if (requestedId !== id || !record) return false;
      record = null;
      return true;
    },
  };
  const drive = {
    async delete(fileId) {
      deletedFiles.push(fileId);
    },
  };
  const api = createPermanentPhotoDeleteApi({
    repository,
    drive,
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
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { deleted: true, id });
    assert.deepEqual(deletedFiles, ["thumbnail-file", "original-file"]);
    assert.equal(record, null);
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
