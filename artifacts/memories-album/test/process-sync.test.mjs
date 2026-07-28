import assert from "node:assert/strict";
import test from "node:test";
import { DriveProcessSynchronizer } from "../src/server/processes/sync.mjs";
import { parseManagedProcessFolder } from "../src/server/processes/model.mjs";

class FakeDrive {
  constructor() {
    this.items = new Map([["root", []]]);
    this.nextId = 1;
  }
  async listChildren(parentId) {
    return [...(this.items.get(parentId) ?? [])];
  }
  async createFolder({ parentId, name }) {
    const folder = {
      id: `folder-${this.nextId++}`,
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    };
    this.items.set(parentId, [...(this.items.get(parentId) ?? []), folder]);
    this.items.set(folder.id, []);
    return folder;
  }
  async rename(fileId, name) {
    for (const [parentId, children] of this.items) {
      const index = children.findIndex((item) => item.id === fileId);
      if (index >= 0) {
        const updated = { ...children[index], name };
        this.items.set(
          parentId,
          children.map((item, itemIndex) =>
            itemIndex === index ? updated : item,
          ),
        );
        return updated;
      }
    }
    throw new Error("Not found");
  }
  async move(fileId, { fromParentId, toParentId }) {
    const source = this.items.get(fromParentId) ?? [];
    const file = source.find((item) => item.id === fileId);
    if (!file) throw new Error("Not found");
    this.items.set(fromParentId, source.filter((item) => item.id !== fileId));
    const moved = { ...file, parents: [toParentId] };
    this.items.set(toParentId, [...(this.items.get(toParentId) ?? []), moved]);
    return moved;
  }
  addImage(parentId, id) {
    this.items.set(parentId, [
      ...(this.items.get(parentId) ?? []),
      {
        id,
        name: `${id}.jpg`,
        mimeType: "image/jpeg",
        size: "10",
        modifiedTime: "2026-06-20T00:00:00.000Z",
        parents: [parentId],
      },
    ]);
  }
}

class FakeProcessRepository {
  constructor() {
    this.processes = [];
  }
  async listProcesses() {
    return [...this.processes].sort((a, b) => a.displayOrder - b.displayOrder);
  }
  async upsertDriveProcess(process) {
    const index = this.processes.findIndex((item) => item.id === process.id);
    const record = {
      ...process,
      syncState: "synced",
      lastSyncedAt: "2026-07-28T00:00:00.000Z",
    };
    if (index >= 0) this.processes[index] = record;
    else this.processes.push(record);
    return record;
  }
  async deactivateMissingDriveProcesses(activeFolderIds) {
    this.processes = this.processes.filter((process) =>
      activeFolderIds.has(process.driveFolderId),
    );
  }
}

class FakePhotoRepository {
  constructor() {
    this.imported = [];
    this.assignments = [];
    this.parentUpdates = [];
  }
  async upsertDrivePhotoMetadata(file, options) {
    this.imported.push({ fileId: file.id, ...options });
  }
  async replacePhotoProcessByDriveFile(
    fileId,
    processId,
    parentFolderId,
    collection,
  ) {
    this.assignments.push({ fileId, processId, parentFolderId, collection });
  }
  async updateDriveParentByDriveFile(fileId, parentFolderId) {
    this.parentUpdates.push({ fileId, parentFolderId });
  }
}

function createSync(drive, processRepository, photoRepository) {
  return new DriveProcessSynchronizer({
    drive,
    processRepository,
    photoRepository,
    rootFolderId: "root",
  });
}

test("parses numbered process folders and rejects reserved folders", () => {
  assert.deepEqual(parseManagedProcessFolder("01 進場"), {
    order: 1,
    labelZh: "進場",
    folderName: "01 進場",
  });
  assert.equal(parseManagedProcessFolder("系統縮圖"), null);
  assert.equal(parseManagedProcessFolder("訪客上傳"), null);
  assert.equal(parseManagedProcessFolder("生活照"), null);
  assert.equal(parseManagedProcessFolder("not numbered"), null);
});

test("initializes reserved folders idempotently", async () => {
  const drive = new FakeDrive();
  const sync = createSync(
    drive,
    new FakeProcessRepository(),
    new FakePhotoRepository(),
  );
  await sync.ensureStructure();
  await sync.ensureStructure();
  const names = (await drive.listChildren("root")).map((item) => item.name);
  assert.deepEqual(
    names.sort(),
    ["00 未分類", "生活照", "系統縮圖", "訪客上傳"].sort(),
  );
});

test("Drive-created process folders become wedding classifications", async () => {
  const drive = new FakeDrive();
  const processRepository = new FakeProcessRepository();
  const photoRepository = new FakePhotoRepository();
  const entrance = await drive.createFolder({ parentId: "root", name: "01 進場" });
  drive.addImage(entrance.id, "drive-photo-1");
  const sync = createSync(drive, processRepository, photoRepository);
  const processes = await sync.reconcileFromDrive();
  assert.equal(processes.length, 1);
  assert.equal(processes[0].labelZh, "進場");
  assert.deepEqual(photoRepository.imported, [
    {
      fileId: "drive-photo-1",
      source: "official",
      parentFolderId: entrance.id,
      collection: "wedding",
      preserveLogicalClassification: false,
    },
  ]);
  assert.deepEqual(photoRepository.assignments.at(-1), {
    fileId: "drive-photo-1",
    processId: processes[0].id,
    parentFolderId: entrance.id,
    collection: "wedding",
  });
});

test("life folder photos become the separate life collection", async () => {
  const drive = new FakeDrive();
  const processRepository = new FakeProcessRepository();
  const photoRepository = new FakePhotoRepository();
  const sync = createSync(drive, processRepository, photoRepository);
  const folders = await sync.ensureStructure();
  const life = folders.get("生活照");
  drive.addImage(life.id, "life-photo-1");
  await sync.reconcileFromDrive();
  assert.ok(
    photoRepository.imported.some(
      (item) =>
        item.fileId === "life-photo-1" &&
        item.collection === "life" &&
        item.source === "official",
    ),
  );
  assert.ok(
    photoRepository.assignments.some(
      (item) =>
        item.fileId === "life-photo-1" &&
        item.processId === null &&
        item.collection === "life",
    ),
  );
});

test("guest folder sync preserves website classification", async () => {
  const drive = new FakeDrive();
  const processRepository = new FakeProcessRepository();
  const photoRepository = new FakePhotoRepository();
  const sync = createSync(drive, processRepository, photoRepository);
  const folders = await sync.ensureStructure();
  const guest = folders.get("訪客上傳");
  drive.addImage(guest.id, "guest-photo-1");
  await sync.reconcileFromDrive();
  assert.ok(
    photoRepository.imported.some(
      (item) =>
        item.fileId === "guest-photo-1" &&
        item.collection === "guest" &&
        item.preserveLogicalClassification === true,
    ),
  );
  assert.deepEqual(photoRepository.parentUpdates, [
    { fileId: "guest-photo-1", parentFolderId: guest.id },
  ]);
  assert.equal(
    photoRepository.assignments.some((item) => item.fileId === "guest-photo-1"),
    false,
  );
});

test("root images remain visible as unclassified wedding content", async () => {
  const drive = new FakeDrive();
  const processRepository = new FakeProcessRepository();
  const photoRepository = new FakePhotoRepository();
  drive.addImage("root", "legacy-root-photo");
  const sync = createSync(drive, processRepository, photoRepository);
  await sync.reconcileFromDrive();
  assert.ok(
    photoRepository.imported.some(
      (item) =>
        item.fileId === "legacy-root-photo" && item.collection === "wedding",
    ),
  );
  assert.ok(
    photoRepository.assignments.some(
      (item) =>
        item.fileId === "legacy-root-photo" &&
        item.processId === null &&
        item.collection === "wedding",
    ),
  );
});

test("website create, rename, and reorder mutate Drive folders", async () => {
  const drive = new FakeDrive();
  const processRepository = new FakeProcessRepository();
  const sync = createSync(drive, processRepository, new FakePhotoRepository());
  const first = await sync.createProcess({ labelZh: "進場" });
  const second = await sync.createProcess({ labelZh: "祈禱" });
  await sync.renameProcess(first, "新人進場");
  await sync.reorderProcesses([second.id, first.id]);
  const names = (await drive.listChildren("root"))
    .filter((item) => item.mimeType === "application/vnd.google-apps.folder")
    .map((item) => item.name);
  assert.ok(names.includes("01 祈禱"));
  assert.ok(names.includes("02 新人進場"));
});

test("website photo reclassification moves an official original instead of copying it", async () => {
  const drive = new FakeDrive();
  const processRepository = new FakeProcessRepository();
  const photoRepository = new FakePhotoRepository();
  const source = await drive.createFolder({ parentId: "root", name: "01 進場" });
  const target = await drive.createFolder({ parentId: "root", name: "02 祈禱" });
  drive.addImage(source.id, "photo-to-move");
  const sync = createSync(drive, processRepository, photoRepository);
  const processes = await sync.reconcileFromDrive();
  const targetProcess = processes.find((item) => item.driveFolderId === target.id);
  await sync.movePhotoToProcess({
    driveFileId: "photo-to-move",
    fromParentId: source.id,
    processId: targetProcess.id,
  });
  assert.equal((await drive.listChildren(source.id)).length, 0);
  assert.equal(
    (await drive.listChildren(target.id)).filter(
      (item) => item.id === "photo-to-move",
    ).length,
    1,
  );
});
