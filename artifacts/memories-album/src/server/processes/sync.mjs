import {
  formatManagedProcessFolder,
  identityForDriveProcess,
  parseManagedProcessFolder,
  slugFromFolderId,
} from "./model.mjs";

export const DRIVE_RESERVED_FOLDERS = {
  unclassified: "00 未分類",
  guest: "訪客上傳",
  thumbnails: "系統縮圖",
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveProcessSynchronizer {
  constructor({ drive, processRepository, photoRepository, rootFolderId }) {
    if (!drive || !processRepository || !photoRepository || !rootFolderId) {
      throw new Error(
        "Drive, process repository, photo repository, and root folder are required",
      );
    }
    this.drive = drive;
    this.processRepository = processRepository;
    this.photoRepository = photoRepository;
    this.rootFolderId = rootFolderId;
  }

  async ensureStructure() {
    const children = await this.drive.listChildren(this.rootFolderId);
    const folders = children.filter((item) => item.mimeType === FOLDER_MIME);
    const byName = new Map(folders.map((folder) => [folder.name, folder]));
    for (const name of Object.values(DRIVE_RESERVED_FOLDERS)) {
      if (!byName.has(name)) {
        const created = await this.drive.createFolder({
          parentId: this.rootFolderId,
          name,
        });
        byName.set(name, created);
      }
    }
    return byName;
  }

  async #importFolderPhotos(folder, { source, processId = null }) {
    const files = await this.drive.listChildren(folder.id);
    for (const file of files) {
      if (!file.mimeType?.startsWith("image/")) continue;
      await this.photoRepository.upsertDrivePhotoMetadata(file, {
        source,
        parentFolderId: folder.id,
      });
      await this.photoRepository.replacePhotoProcessByDriveFile(
        file.id,
        processId,
        folder.id,
      );
    }
  }

  async reconcileFromDrive() {
    const reservedFolders = await this.ensureStructure();
    const children = await this.drive.listChildren(this.rootFolderId);
    const processFolders = children
      .filter((item) => item.mimeType === FOLDER_MIME)
      .map((folder) => ({
        folder,
        parsed: parseManagedProcessFolder(folder.name),
      }))
      .filter((item) => item.parsed)
      .sort(
        (a, b) =>
          a.parsed.order - b.parsed.order || a.folder.id.localeCompare(b.folder.id),
      );

    const activeFolderIds = new Set();
    const processes = [];
    for (const { folder, parsed } of processFolders) {
      activeFolderIds.add(folder.id);
      const identity = identityForDriveProcess(folder.id, parsed.labelZh);
      const process = await this.processRepository.upsertDriveProcess({
        id: identity.id,
        labelZh: parsed.labelZh,
        labelEn: identity.en,
        displayOrder: parsed.order,
        driveFolderId: folder.id,
        driveFolderName: folder.name,
      });
      processes.push(process);
      await this.#importFolderPhotos(folder, {
        source: "official",
        processId: process.id,
      });
    }

    const rootImages = children.filter((item) => item.mimeType?.startsWith("image/"));
    for (const file of rootImages) {
      await this.photoRepository.upsertDrivePhotoMetadata(file, {
        source: "official",
        parentFolderId: this.rootFolderId,
      });
      await this.photoRepository.replacePhotoProcessByDriveFile(
        file.id,
        null,
        this.rootFolderId,
      );
    }

    const unclassified = reservedFolders.get(DRIVE_RESERVED_FOLDERS.unclassified);
    if (unclassified) {
      await this.#importFolderPhotos(unclassified, {
        source: "official",
        processId: null,
      });
    }

    const guest = reservedFolders.get(DRIVE_RESERVED_FOLDERS.guest);
    if (guest) {
      await this.#importFolderPhotos(guest, {
        source: "guest",
        processId: null,
      });
    }

    await this.processRepository.deactivateMissingDriveProcesses(activeFolderIds);
    return processes;
  }

  async createProcess({ labelZh, labelEn = null }) {
    const current = await this.processRepository.listProcesses();
    const displayOrder = current.length + 1;
    const folderName = formatManagedProcessFolder(displayOrder, labelZh);
    const folder = await this.drive.createFolder({
      parentId: this.rootFolderId,
      name: folderName,
    });
    return this.processRepository.upsertDriveProcess({
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
    return this.processRepository.upsertDriveProcess({
      ...process,
      labelZh,
      labelEn: labelEn || labelZh,
      driveFolderName: folderName,
    });
  }

  async reorderProcesses(processIds) {
    const current = await this.processRepository.listProcesses();
    const byId = new Map(current.map((process) => [process.id, process]));
    const ordered = processIds.map((id) => byId.get(id)).filter(Boolean);
    for (let index = 0; index < ordered.length; index += 1) {
      const process = ordered[index];
      const displayOrder = index + 1;
      const folderName = formatManagedProcessFolder(
        displayOrder,
        process.labelZh,
      );
      if (folderName !== process.driveFolderName) {
        await this.drive.rename(process.driveFolderId, folderName);
      }
      await this.processRepository.upsertDriveProcess({
        ...process,
        displayOrder,
        driveFolderName: folderName,
      });
    }
    return this.processRepository.listProcesses();
  }

  async movePhotoToProcess({ driveFileId, fromParentId, processId = null }) {
    const processes = await this.processRepository.listProcesses();
    const process = processId
      ? processes.find((item) => item.id === processId)
      : null;
    const folders = await this.ensureStructure();
    const destinationId = process
      ? process.driveFolderId
      : folders.get(DRIVE_RESERVED_FOLDERS.unclassified)?.id;
    if (!destinationId) throw new Error("Unclassified folder is unavailable");
    await this.drive.move(driveFileId, {
      fromParentId,
      toParentId: destinationId,
    });
    await this.photoRepository.replacePhotoProcessByDriveFile(
      driveFileId,
      process?.id ?? null,
      destinationId,
    );
  }
}
