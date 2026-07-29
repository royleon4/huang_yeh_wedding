import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { identityForDriveProcess } from "../src/server/processes/model.mjs";
import { DriveProcessSynchronizer } from "../src/server/processes/sync.mjs";

const FOLDER_MIME = "application/vnd.google-apps.folder";

class CanonicalDrive {
  constructor() {
    this.children = [
      { id: "folder-entrance", name: "01 自訂流程", mimeType: FOLDER_MIME },
    ];
  }
  async listChildren(parentId) {
    return parentId === "root" ? [...this.children] : [];
  }
  async createFolder({ name }) {
    const folder = {
      id: `folder-${this.children.length + 1}`,
      name,
      mimeType: FOLDER_MIME,
    };
    this.children.push(folder);
    return folder;
  }
  async rename(fileId, name) {
    const index = this.children.findIndex((item) => item.id === fileId);
    if (index < 0) throw new Error("Not found");
    const folder = { ...this.children[index], name };
    this.children[index] = folder;
    return folder;
  }
}

class CanonicalProcessRepository {
  constructor() {
    this.records = [];
  }
  async listProcesses() {
    return [...this.records]
      .filter((item) => item.isActive !== false)
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }
  async upsertDriveProcess(process) {
    const existing = this.records.find(
      (item) => item.driveFolderId === process.driveFolderId,
    );
    const record = {
      ...(existing ?? {}),
      ...process,
      id: existing?.id ?? process.id,
      labelEn:
        existing?.labelEn && existing.labelEn !== existing.labelZh
          ? existing.labelEn
          : process.labelEn,
      isActive: true,
      syncState: "synced",
      lastSyncedAt: "2026-07-29T00:00:00.000Z",
    };
    this.records = [
      ...this.records.filter(
        (item) => item.driveFolderId !== process.driveFolderId,
      ),
      record,
    ];
    return record;
  }
  async updateProcessLabelEn(id, labelEn) {
    const record = this.records.find((item) => item.id === id);
    if (!record) return null;
    record.labelEn = labelEn;
    return { ...record };
  }
  async deactivateMissingDriveProcesses(activeFolderIds) {
    this.records = this.records.map((item) => ({
      ...item,
      isActive: activeFolderIds.has(item.driveFolderId),
    }));
  }
}

const photoRepository = {
  async upsertDrivePhotoMetadata() {},
  async replacePhotoProcessByDriveFile() {},
  async updateDriveParentByDriveFile() {},
};

function createSynchronizer(drive, processRepository) {
  return new DriveProcessSynchronizer({
    drive,
    processRepository,
    photoRepository,
    rootFolderId: "root",
  });
}

test("known wedding words do not select bundled process identities", () => {
  const identity = identityForDriveProcess("folder-real-id", "進場");
  assert.equal(identity.id, "drive-folder-real-id");
  assert.equal(identity.en, "進場");
  assert.notEqual(identity.id, "entrance");
});

test("manual Google Drive folder edits overwrite database process metadata", async () => {
  const drive = new CanonicalDrive();
  const repository = new CanonicalProcessRepository();
  const synchronizer = createSynchronizer(drive, repository);

  await synchronizer.syncProcessFoldersFromDrive();
  assert.equal((await repository.listProcesses())[0].labelZh, "自訂流程");

  drive.children[0] = { ...drive.children[0], name: "01 我在 Drive 改的名稱" };
  await synchronizer.syncProcessFoldersFromDrive();

  const [process] = await repository.listProcesses();
  assert.equal(process.labelZh, "我在 Drive 改的名稱");
  assert.equal(process.driveFolderName, "01 我在 Drive 改的名稱");
});

test("website process changes write to Drive before database refresh", async () => {
  const drive = new CanonicalDrive();
  const repository = new CanonicalProcessRepository();
  const synchronizer = createSynchronizer(drive, repository);
  const [process] = await synchronizer.syncProcessFoldersFromDrive();

  await synchronizer.renameProcess(process, "網站改名", "Renamed online");
  assert.equal(drive.children[0].name, "01 網站改名");
  assert.equal((await repository.listProcesses())[0].labelZh, "網站改名");
  assert.equal((await repository.listProcesses())[0].labelEn, "Renamed online");

  const added = await synchronizer.createProcess({
    labelZh: "網站新增",
    labelEn: "Added online",
  });
  assert.equal(added.driveFolderName, "02 網站新增");
  assert.equal(added.labelEn, "Added online");
  assert.ok(drive.children.some((folder) => folder.name === "02 網站新增"));
});

test("client process and guest-upload options are database hydrated, not bundled", async () => {
  const [galleryModel, mainSource, adminSource, uploadSource] =
    await Promise.all([
      readFile(
        new URL("../src/client/gallery-model.mjs", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../src/client/main.jsx", import.meta.url), "utf8"),
      readFile(new URL("../src/client/AdminApp.jsx", import.meta.url), "utf8"),
      readFile(
        new URL("../src/client/UploadModal.jsx", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(galleryModel, /export const PROCESS_DEFINITIONS = \[\];/);
  assert.doesNotMatch(galleryModel, /進場|祈禱|證婚|分組照相/);
  assert.match(mainSource, /fetch\("\/Memories\/api\/processes"/);
  assert.match(mainSource, /PROCESS_DEFINITIONS\.splice/);
  assert.match(adminSource, /\/admin\/api\/categories/);
  assert.doesNotMatch(
    adminSource,
    /sessionStorage|CustomEvent|MutationObserver/,
  );
  assert.match(uploadSource, /processes\.map/);
});
