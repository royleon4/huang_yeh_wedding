import { formatManagedProcessFolder, parseManagedProcessFolder, slugFromFolderId } from "./model.mjs";

export const DRIVE_RESERVED_FOLDERS = {
  unclassified: "00 未分類",
  guest: "訪客上傳",
  thumbnails: "系統縮圖",
};

export class DriveProcessSynchronizer {
  constructor({ drive, repository, rootFolderId }) {
    if (!drive || !repository || !rootFolderId) throw new Error("Drive, repository, and root folder are required");
    this.drive = drive;
    this.repository = repository;
    this.rootFolderId = rootFolderId;
  }

  async ensureStructure() {
    const children = await this.drive.listChildren(this.rootFolderId);
    const folders = children.filter((item) => item.mimeType === "application/vnd.google-apps.folder");
    const byName = new Map(folders.map((folder) => [folder.name, folder]));
    for (const name of Object.values(DRIVE_RESERVED_FOLDERS)) {
      if (!byName.has(name)) {
        const created = await this.drive.createFolder({ parentId: this.rootFolderId, name });
        byName.set(name, created);
      }
    }
    return byName;
  }

  async reconcileFromDrive() {
    await this.ensureStructure();
    const children = await this.drive.listChildren(this.rootFolderId);
    const processFolders = children
      .filter((item) => item.mimeType === "application/vnd.google-apps.folder")
      .map((folder) => ({ folder, parsed: parseManagedProcessFolder(folder.name) }))
      .filter((item) => item.parsed)
      .sort((a, b) => a.parsed.order - b.parsed.order || a.folder.id.localeCompare(b.folder.id));

    const activeFolderIds = new Set();
    const processes = [];
    for (const { folder, parsed } of processFolders) {
      activeFolderIds.add(folder.id);
      const process = await this.repository.upsertDriveProcess({
        id: slugFromFolderId(folder.id),
        labelZh: parsed.labelZh,
        labelEn: parsed.labelZh,
        displayOrder: parsed.order,
        driveFolderId: folder.id,
        driveFolderName: folder.name,
      });
      processes.push(process);
      const files = await this.drive.listChildren(folder.id);
      for (const file of files) {
        if (file.mimeType?.startsWith("image/")) {
          await this.repository.replacePhotoProcessByDriveFile(file.id, process.id, folder.id);
        }
      }
    }
    await this.repository.deactivateMissingDriveProcesses(activeFolderIds);
    return processes;
  }

  async createProcess({ labelZh, labelEn = null }) {
    const current = await this.repository.listProcesses();
    const displayOrder = current.length + 1;
    const folderName = formatManagedProcessFolder(displayOrder, labelZh);
    const folder = await this.drive.createFolder({ parentId: this.rootFolderId, name: folderName });
    return this.repository.upsertDriveProcess({
      id: slugFromFolderId(folder.id),
      labelZh,
      labelEn: labelEn || labelZh,
      displayOrder,
      driveFolderId: folder.id,
      driveFolderName: folderName,
    });
  }

  async renameProcess(process, labelZh, labelEn = null) {
    const folderName = formatManagedProcessFolder(process.displayOrder, labelZh);
    await this.drive.rename(process.driveFolderId, folderName);
    return this.repository.upsertDriveProcess({ ...process, labelZh, labelEn: labelEn || labelZh, driveFolderName: folderName });
  }

  async reorderProcesses(processIds) {
    const current = await this.repository.listProcesses();
    const byId = new Map(current.map((process) => [process.id, process]));
    const ordered = processIds.map((id) => byId.get(id)).filter(Boolean);
    for (let index = 0; index < ordered.length; index += 1) {
      const process = ordered[index];
      const displayOrder = index + 1;
      const folderName = formatManagedProcessFolder(displayOrder, process.labelZh);
      if (folderName !== process.driveFolderName) await this.drive.rename(process.driveFolderId, folderName);
      await this.repository.upsertDriveProcess({ ...process, displayOrder, driveFolderName: folderName });
    }
    return this.repository.listProcesses();
  }
}
