import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BatchManagementClientError,
  parsePrivateBatchLocation,
} from "../src/client/batch-management-client.mjs";
import {
  MAX_UPLOAD_PHOTOS,
  uploadQueue,
} from "../src/client/upload-client.mjs";
import {
  createGuestBatchManagementApi,
  hashManagementToken,
} from "../src/server/uploads/management-api.mjs";

const BATCH_ID = "527cde78-e455-419c-9feb-a56093a76508";
const PHOTO_ID = "1a43345e-ab9d-45a4-bbdc-912663f98d23";

async function readClient(name) {
  return readFile(new URL(`../src/client/${name}`, import.meta.url), "utf8");
}

async function readServer(name) {
  return readFile(new URL(`../src/server/${name}`, import.meta.url), "utf8");
}

function makePhoto() {
  return {
    id: PHOTO_ID,
    source: "guest",
    uploaderName: "Leon",
    collection: "guest",
    albumIds: ["guest"],
    processIds: [],
    width: 1200,
    height: 800,
    driveFileId: "drive-original",
    thumbnailDriveFileId: "drive-thumbnail",
    contentHash: "content-hash",
    contentVersion: 1,
    createdAt: "2026-07-31T00:00:00.000Z",
  };
}

async function withManagementApi(run) {
  let tokenHash = hashManagementToken("private-secret");
  let photos = [makePhoto()];
  const deletedDriveIds = [];
  const repository = {
    async findUploadBatchForManagement(id) {
      if (id !== BATCH_ID) return null;
      return {
        id: BATCH_ID,
        uploaderType: "guest",
        uploaderName: "Leon",
        tokenHash,
        status: "open",
        createdAt: "2026-07-31T00:00:00.000Z",
      };
    },
    async listBatchPhotos(id) {
      return id === BATCH_ID ? photos : [];
    },
    async findBatchPhotoForPermanentDeletion({ batchId, photoId }) {
      return batchId === BATCH_ID
        ? photos.find((photo) => photo.id === photoId) ?? null
        : null;
    },
    async deletePhotoPermanently(photoId) {
      const exists = photos.some((photo) => photo.id === photoId);
      photos = photos.filter((photo) => photo.id !== photoId);
      return exists;
    },
    async rotateUploadBatchToken({ id, expectedTokenHash, tokenHash: nextHash }) {
      if (id !== BATCH_ID || expectedTokenHash !== tokenHash) return null;
      tokenHash = nextHash;
      return {
        id: BATCH_ID,
        uploaderType: "guest",
        uploaderName: "Leon",
        tokenHash,
        status: "open",
        createdAt: "2026-07-31T00:00:00.000Z",
      };
    },
  };
  const drive = {
    async delete(fileId) {
      deletedDriveIds.push(fileId);
    },
  };
  const api = createGuestBatchManagementApi({
    repository,
    drive,
    createToken: () => "replacement-secret",
  });
  const server = createServer(async (request, response) => {
    const handled = await api(
      request,
      response,
      new URL(request.url ?? "/", "http://localhost"),
    );
    if (!handled) {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, { deletedDriveIds });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function authenticated(token, options = {}) {
  return {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  };
}

test("upload UI and client enforce a real ten-photo maximum", async () => {
  assert.equal(MAX_UPLOAD_PHOTOS, 10);
  let createdBatches = 0;
  await assert.rejects(
    uploadQueue({
      uploaderName: "Leon",
      files: Array.from({ length: 11 }, (_, index) => ({ name: `${index}.jpg` })),
      createBatchFn: async () => {
        createdBatches += 1;
        return {};
      },
    }),
    (error) => {
      assert.equal(error.code, "TOO_MANY_PHOTOS");
      assert.equal(error.status, 422);
      return true;
    },
  );
  assert.equal(createdBatches, 0);

  const modal = await readClient("UploadModal.jsx");
  assert.match(modal, /const MAX_UPLOAD_PHOTOS = 10/);
  assert.match(modal, /slice\(0, MAX_UPLOAD_PHOTOS\)/);
  assert.match(modal, /Choose up to 10 photos/);
  assert.doesNotMatch(modal, /Choose up to 30 photos/);
});

test("private management URL parser keeps the secret in the fragment", () => {
  assert.deepEqual(
    parsePrivateBatchLocation(
      `/Memories/manage/${BATCH_ID}`,
      "#token=private-secret",
    ),
    { batchId: BATCH_ID, token: "private-secret" },
  );
  assert.deepEqual(
    parsePrivateBatchLocation(`/Memories/manage/${BATCH_ID}/`, ""),
    { batchId: BATCH_ID, token: null },
  );
  assert.equal(
    parsePrivateBatchLocation("/Memories/manage/not-a-uuid", "#token=x"),
    null,
  );
  assert.equal(BatchManagementClientError.prototype instanceof Error, true);
});

test("private management permanently deletes Drive files and database records", async () => {
  await withManagementApi(async (origin, { deletedDriveIds }) => {
    const batchUrl = `${origin}/Memories/api/upload-batches/${BATCH_ID}`;
    const first = await fetch(batchUrl, authenticated("private-secret"));
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.batch.uploaderName, "Leon");
    assert.equal(firstBody.batch.photos.length, 1);

    const deleted = await fetch(
      `${batchUrl}/photos/${PHOTO_ID}`,
      authenticated("private-secret", { method: "DELETE" }),
    );
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), {
      deleted: true,
      photoId: PHOTO_ID,
    });
    assert.deepEqual(deletedDriveIds, ["drive-thumbnail", "drive-original"]);

    const afterDelete = await fetch(batchUrl, authenticated("private-secret"));
    assert.equal((await afterDelete.json()).batch.photos.length, 0);

    const repeated = await fetch(
      `${batchUrl}/photos/${PHOTO_ID}`,
      authenticated("private-secret", { method: "DELETE" }),
    );
    assert.equal(repeated.status, 404);
  });
});

test("private management can rotate its token", async () => {
  await withManagementApi(async (origin) => {
    const batchUrl = `${origin}/Memories/api/upload-batches/${BATCH_ID}`;
    const rotated = await fetch(
      `${batchUrl}/management-token`,
      authenticated("private-secret", { method: "POST" }),
    );
    assert.equal(rotated.status, 200);
    assert.equal(
      (await rotated.json()).manageUrl,
      `/Memories/manage/${BATCH_ID}#token=replacement-secret`,
    );

    const oldLink = await fetch(batchUrl, authenticated("private-secret"));
    assert.equal(oldLink.status, 404);
    const replacementLink = await fetch(
      batchUrl,
      authenticated("replacement-secret"),
    );
    assert.equal(replacementLink.status, 200);
  });
});

test("client route and runtime wire permanent private management deletion", async () => {
  const [main, runtime, managementPage, managementClient] = await Promise.all([
    readClient("main.jsx"),
    readServer("runtime.mjs"),
    readClient("BatchManagementPage.jsx"),
    readClient("batch-management-client.mjs"),
  ]);
  assert.match(main, /import BatchManagementPage/);
  assert.match(main, /isBatchManagement/);
  assert.match(main, /<BatchManagementPage \/>/);
  assert.match(runtime, /createGuestBatchManagementApi/);
  assert.match(runtime, /PostgresUploadManagementRepository/);
  assert.match(runtime, /repository: uploadManagementRepository,[\s\S]*?drive,/);
  assert.match(runtime, /if \(await guestBatchManagementApi/);
  assert.match(managementPage, /deletePrivatePhoto/);
  assert.match(managementPage, /永久刪除照片/);
  assert.match(managementClient, /export function deletePrivatePhoto/);
  assert.doesNotMatch(managementPage, /withdrawPrivatePhoto/);
});
