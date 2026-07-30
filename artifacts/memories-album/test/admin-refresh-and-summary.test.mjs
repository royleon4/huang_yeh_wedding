import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import { thumbnailFilenameForDriveFileId } from "../src/server/photos/thumbnail-service.mjs";
import { AdminRefreshService } from "../src/server/refresh/service.mjs";

async function waitForJob(service, id) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const job = service.getJob(id);
    if (["completed", "completed_with_errors", "failed"].includes(job?.status)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Refresh job did not finish");
}

test("scoped refresh deletes only derivatives and rebuilds them from originals", async () => {
  const repository = new MemoryPhotoRepository([
    {
      id: "photo-a",
      driveFileId: "original-a",
      thumbnailDriveFileId: "thumb-a",
      originalFilename: "a.jpg",
      displayName: "A",
      mimeType: "image/jpeg",
      byteSize: 10,
      source: "official",
      uploaderName: "婚禮攝影",
      collection: "wedding",
      visibility: "public",
      processingState: "ready",
      albumIds: ["wedding"],
      processIds: ["process-a"],
      createdAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-20T00:00:00.000Z",
    },
    {
      id: "photo-b",
      driveFileId: "original-b",
      thumbnailDriveFileId: "thumb-b",
      originalFilename: "b.jpg",
      displayName: "B",
      mimeType: "image/jpeg",
      byteSize: 10,
      source: "official",
      uploaderName: "婚禮攝影",
      collection: "life",
      visibility: "public",
      processingState: "ready",
      albumIds: ["life"],
      processIds: [],
      createdAt: "2026-06-21T00:00:00.000Z",
      updatedAt: "2026-06-21T00:00:00.000Z",
    },
  ]);
  const deleted = [];
  let synchronized = 0;
  let invalidated = 0;
  const drive = {
    async listChildren() {
      return [
        {
          id: "thumb-a",
          name: thumbnailFilenameForDriveFileId("original-a"),
        },
        {
          id: "thumb-b",
          name: thumbnailFilenameForDriveFileId("original-b"),
        },
      ];
    },
    async delete(fileId) {
      deleted.push(fileId);
    },
  };
  const thumbnailService = {
    thumbnailFolderId: "thumbnail-folder",
    invalidateIndex() {
      invalidated += 1;
    },
    async ensurePhotoThumbnail(photo) {
      return repository.attachThumbnail(photo.id, `rebuilt-${photo.id}`);
    },
  };
  const service = new AdminRefreshService({
    repository,
    drive,
    synchronizer: {
      async reconcileFromDrive() {
        synchronized += 1;
      },
    },
    thumbnailService,
  });

  const started = service.start({
    scopeType: "album",
    scopeId: "wedding",
    scopeLabel: "婚禮流程",
  });
  const job = await waitForJob(service, started.id);

  assert.equal(job.status, "completed");
  assert.equal(job.total, 1);
  assert.equal(job.rebuilt, 1);
  assert.deepEqual(deleted, ["thumb-a"]);
  assert.equal(synchronized, 1);
  assert.equal(invalidated, 1);
  assert.equal(
    (await repository.findPhotoForAdmin("photo-a")).thumbnailDriveFileId,
    "rebuilt-photo-a",
  );
  assert.equal(
    (await repository.findPhotoForAdmin("photo-b")).thumbnailDriveFileId,
    "thumb-b",
  );
  assert.ok(!deleted.includes("original-a"), "original photo must never be deleted");
});

test("UI exposes summary visibility and centralizes every refresh control in General settings", async () => {
  const transform = processContentUiTransform();
  const [
    appSource,
    adminSource,
    refreshButton,
    refreshManagement,
    refreshManagementStyles,
  ] = await Promise.all([
    readFile(new URL("../src/client/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/AdminApp.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/AdminRefreshButton.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/AdminRefreshManagement.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/admin-refresh-management.css", import.meta.url), "utf8"),
  ]);
  const gallery = transform.transform(
    appSource,
    "/workspace/src/client/App.jsx",
  ).code;
  const admin = transform.transform(
    adminSource,
    "/workspace/src/client/AdminApp.jsx",
  ).code;

  assert.match(gallery, /activeCollectionDefinition\?\.showSummary !== false/);
  assert.match(gallery, /showSummary: true/);
  assert.match(admin, /在子流程上方顯示相簿名稱與介紹/);
  assert.match(admin, /AdminRefreshManagement/);
  assert.match(admin, /albums=\{albums\}/);
  assert.match(admin, /categories=\{orderedCategories\}/);
  assert.doesNotMatch(admin, /scopeType="album"/);
  assert.doesNotMatch(admin, /scopeType="process"/);
  assert.match(admin, /showSummary: true/);
  assert.match(refreshManagement, /scopeType="album"/);
  assert.match(refreshManagement, /scopeType="process"/);
  assert.match(refreshManagement, /高風險操作集中區/);
  assert.match(refreshManagement, /避免誤按/);
  assert.match(refreshManagementStyles, /\.all-process-actions > \.admin-refresh-control/);
  assert.match(refreshManagementStyles, /display: none !important/);
  assert.match(refreshButton, /原始照片不會被刪除/);
  assert.match(refreshButton, /window\.confirm/);
  assert.match(refreshButton, /refresh-jobs/);
});
