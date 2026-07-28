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
        this.items.set(parentId, children.map((item, itemIndex) => itemIndex === index ? updated : item));
        return updated;
      }
    }
    throw new Error("Not found");
  }
  addImage(parentId, id) {
    this.items.set(parentId, [
      ...(this.items.get(parentId) ?? []),
      { id, name: `${id}.jpg`, mimeType: "image/jpeg", parents: [parentId] },
    ]);
  }
}

class FakeRepository {
  constructor() {
    this.processes = [];
    this.photoAssignments = [];
  }
  async listProcesses() {
    return [...this.processes].sort((a, b) => a.displayOrder - b.displayOrder);
  }
  async upsertDriveProcess(process) {
    const index = this.processes.findIndex((item) => item.id === process.id);
    const record = { ...process, syncState: "synced", lastSyncedAt: "2026-07-28T00:00:00.000Z" };
    if (index >= 0) this.processes[index] = record;
    else this.processes.push(record);
    return record;
  }
  async deactivateMissingDriveProcesses(activeFolderIds) {
    this.processes = this.processes.filter((process) => activeFolderIds.has(process.driveFolderId));
  }
  async replacePhotoProcessByDriveFile(fileId, processId, parentFolderId) {
    this.photoAssignments.push({ fileId, processId, parentFolderId });
  }
}

test("parses numbered process folders and rejects reserved folders", () => {
  assert.deepEqual(parseManagedProcessFolder("01 進場"), {
    order: 1,
    labelZh: "進場",
    folderName: "01 進場",
  });
  assert.equal(parseManagedProcessFolder("系統縮圖"), null);
  assert.equal(parseManagedProcessFolder("訪客上傳"), null);
  assert.equal(parseManagedProcessFolder("not numbered"), null);
});

test("initializes reserved folders idempotently", async () => {
  const drive = new FakeDrive();
  const repository = new FakeRepository();
  const sync = new DriveProcessSynchronizer({ drive, repository, rootFolderId: "root" });
  await sync.ensureStructure();
  await sync.ensureStructure();
  const names = (await drive.listChildren("root")).map((item) => item.name);
  assert.deepEqual(names.sort(), ["00 未分類", "系統縮圖", "訪客上傳"].sort());
});

test("Drive-created folders and contained images become website classifications", async () => {
  const drive = new FakeDrive();
  const repository = new FakeRepository();
  const entrance = await drive.createFolder({ parentId: "root", name: "01 進場" });
  drive.addImage(entrance.id, "drive-photo-1");
  const sync = new DriveProcessSynchronizer({ drive, repository, rootFolderId: "root" });
  const processes = await sync.reconcileFromDrive();
  assert.equal(processes.length, 1);
  assert.equal(processes[0].labelZh, "進場");
  assert.deepEqual(repository.photoAssignments, [{
    fileId: "drive-photo-1",
    processId: processes[0].id,
    parentFolderId: entrance.id,
  }]);
});

test("website create, rename, and reorder mutate Drive folders", async () => {
  const drive = new FakeDrive();
  const repository = new FakeRepository();
  const sync = new DriveProcessSynchronizer({ drive, repository, rootFolderId: "root" });
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
