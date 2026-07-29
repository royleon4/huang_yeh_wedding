import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { MemoryAlbumRepository } from "../src/server/albums/memory-repository.mjs";
import { createAdminPhotoApi } from "../src/server/photos/admin-api.mjs";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import { FakeDriveStorage } from "../src/server/storage/fake-drive.mjs";

const adminToken = "correct-password";
const photoId = "22222222-2222-4222-8222-222222222222";

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

test("administrators can upload and edit a photo through /admin/api/photos", async () => {
  const repository = new MemoryPhotoRepository();
  const albumRepository = new MemoryAlbumRepository([
    {
      id: "wedding",
      titleZh: "婚禮流程",
      titleEn: "Wedding moments",
      descriptionZh: "",
      descriptionEn: "",
      displayOrder: 1,
      isVisible: true,
      isSystem: true,
    },
    {
      id: "story",
      titleZh: "交往回憶",
      titleEn: "Our story",
      descriptionZh: "",
      descriptionEn: "",
      displayOrder: 2,
      isVisible: true,
      isSystem: false,
    },
  ]);
  const categories = [
    {
      id: "ceremony",
      labelZh: "證婚",
      labelEn: "Ceremony",
      displayOrder: 1,
      driveFolderId: "drive-category-ceremony",
    },
  ];
  const categoryRepository = {
    async listProcesses() {
      return categories.map((category) => ({ ...category }));
    },
  };
  const drive = new FakeDriveStorage();
  drive.unclassifiedFolderId = "drive-unclassified";
  drive.lifeFolderId = "drive-life";
  const moves = [];
  const synchronizer = {
    async movePhotoToProcess(input) {
      moves.push(input);
    },
  };
  const api = createAdminPhotoApi({
    repository,
    albumRepository,
    categoryRepository,
    drive,
    synchronizer,
    imageProcessor: {
      async process() {
        return {
          originalBytes: Buffer.from("normalized"),
          originalContentType: "image/jpeg",
          originalExtension: "jpg",
          thumbnailBytes: Buffer.from("thumbnail"),
          thumbnailContentType: "image/webp",
          width: 1200,
          height: 800,
        };
      },
    },
    adminToken,
    createId: () => photoId,
    now: () => new Date("2026-06-20T01:00:00.000Z"),
  });

  await withApi(api, async (origin) => {
    const form = new FormData();
    form.append(
      "photo",
      new Blob([Buffer.from("image")], { type: "image/jpeg" }),
      "original.jpg",
    );
    form.append(
      "metadata",
      JSON.stringify({
        displayName: "交換誓詞",
        albumIds: ["wedding"],
        categoryIds: ["ceremony"],
        capturedAt: "2026-06-20T00:30:00.000Z",
      }),
    );
    const created = await fetch(`${origin}/admin/api/photos`, {
      method: "POST",
      headers: {
        Cookie: adminCookie(),
        "X-Memories-Admin": "1",
      },
      body: form,
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.photo.id, photoId);
    assert.equal(createdBody.photo.displayName, "交換誓詞");
    assert.deepEqual(createdBody.photo.albumIds, ["wedding"]);
    assert.deepEqual(createdBody.photo.categoryIds, ["ceremony"]);
    assert.equal(
      createdBody.photo.thumbnailUrl,
      `/admin/api/photos/${photoId}/thumbnail`,
    );
    assert.equal(
      drive.calls.filter((call) => call.operation === "upload").length,
      2,
    );
    const preview = await fetch(`${origin}${createdBody.photo.thumbnailUrl}`, {
      headers: { Cookie: adminCookie() },
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("cache-control"), "private, no-store");
    assert.equal(await preview.text(), "thumbnail");
    const stored = await repository.findPhotoForAdmin(photoId);

    const updated = await fetch(`${origin}/admin/api/photos/${photoId}`, {
      method: "PATCH",
      headers: {
        Cookie: adminCookie(),
        "Content-Type": "application/json",
        "X-Memories-Admin": "1",
      },
      body: JSON.stringify({
        displayName: "我們的誓詞",
        visibility: "hidden",
        albumIds: ["story"],
        categoryIds: [],
        capturedAt: "2026-06-20T00:35:00.000Z",
      }),
    });
    assert.equal(updated.status, 200);
    const updatedBody = await updated.json();
    assert.equal(updatedBody.photo.displayName, "我們的誓詞");
    assert.equal(updatedBody.photo.visibility, "hidden");
    assert.deepEqual(updatedBody.photo.albumIds, ["story"]);
    assert.deepEqual(updatedBody.photo.categoryIds, []);
    assert.deepEqual(moves, [
      {
        driveFileId: stored.driveFileId,
        fromParentId: "drive-category-ceremony",
        processId: null,
      },
    ]);

    const listed = await fetch(`${origin}/admin/api/photos`, {
      headers: { Cookie: adminCookie() },
    });
    assert.equal(listed.status, 200);
    const listBody = await listed.json();
    assert.equal(listBody.photos.length, 1);
    assert.equal(listBody.photos[0].displayName, "我們的誓詞");

    assert.equal(await repository.findPublicPhoto(photoId), null);
  });
});

test("a failed admin upload never deletes deterministic Drive files it reused", async () => {
  const key = photoId.replace(/-/g, "");
  const existingOriginalId = "existing-original";
  const existingThumbnailId = "existing-thumbnail";
  const drive = new FakeDriveStorage([
    {
      fileId: existingOriginalId,
      bytes: Buffer.from("existing original"),
      contentType: "image/jpeg",
      filename: `admin-${key}-original.jpg`,
      parentId: "drive-unclassified",
    },
    {
      fileId: existingThumbnailId,
      bytes: Buffer.from("existing thumbnail"),
      contentType: "image/webp",
      filename: `admin-${key}.webp`,
      parentId: "fake-thumbnail-folder",
    },
  ]);
  drive.unclassifiedFolderId = "drive-unclassified";
  const duplicate = new Error("Duplicate photo");
  duplicate.code = "DUPLICATE_PHOTO";
  const api = createAdminPhotoApi({
    repository: {
      async insertPhoto() {
        throw duplicate;
      },
    },
    albumRepository: new MemoryAlbumRepository([
      {
        id: "wedding",
        titleZh: "婚禮流程",
        titleEn: "Wedding moments",
        descriptionZh: "",
        descriptionEn: "",
        displayOrder: 1,
        isVisible: true,
        isSystem: true,
      },
    ]),
    categoryRepository: {
      async listProcesses() {
        return [];
      },
    },
    drive,
    synchronizer: {},
    imageProcessor: {
      async process() {
        return {
          originalBytes: Buffer.from("normalized"),
          originalContentType: "image/jpeg",
          originalExtension: "jpg",
          thumbnailBytes: Buffer.from("thumbnail"),
          thumbnailContentType: "image/webp",
          width: 1200,
          height: 800,
        };
      },
    },
    adminToken,
    createId: () => photoId,
    now: () => new Date("2026-06-20T01:00:00.000Z"),
  });

  await withApi(api, async (origin) => {
    const form = new FormData();
    form.append(
      "photo",
      new Blob([Buffer.from("image")], { type: "image/jpeg" }),
      "original.jpg",
    );
    form.append(
      "metadata",
      JSON.stringify({
        displayName: "Already stored",
        albumIds: ["wedding"],
        categoryIds: [],
        capturedAt: "2026-06-20T00:30:00.000Z",
      }),
    );
    const response = await fetch(`${origin}/admin/api/photos`, {
      method: "POST",
      headers: {
        Cookie: adminCookie(),
        "X-Memories-Admin": "1",
      },
      body: form,
    });

    assert.equal(response.status, 409);
    assert.equal(drive.files.has(existingOriginalId), true);
    assert.equal(drive.files.has(existingThumbnailId), true);
    assert.equal(
      drive.calls.some((call) => call.operation === "delete"),
      false,
    );
  });
});
