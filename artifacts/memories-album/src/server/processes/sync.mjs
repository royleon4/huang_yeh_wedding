import {
  formatManagedProcessFolder,
  identityForDriveProcess,
  parseManagedProcessFolder,
} from "./model.mjs";

export const DRIVE_RESERVED_FOLDERS = {
  unclassified: "00 未分類",
  guest: "訪客上傳",
  life: "生活照",
  thumbnails: "系統縮圖",
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

function processOrder(left, right) {
  return (
    left.displayOrder - right.displayOrder ||
    left.driveFolderId.localeCompare(right.driveFolderId)
  );
}

function firstAvailableProcessOrder(processFolders) {
  const usedOrders = new Set(processFolders.map((item) => item.parsed.order));
  for (let order = 1; order <= 99; order += 1) {
    if (!usedOrders.has(order)) return order;
  }
  return null;
}

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

  #processFolders(children) {
    return children
      .filter((item) => item.mimeType === FOLDER_MIME)
      .map((folder) => ({
        folder,
        parsed: parseManagedProcessFolder(folder.name),
      }))
      .filter((item) => item.parsed)
      .sort(
        (a, b) =>
          a.parsed.order - b.parsed.order ||
          a.folder.id.localeCompare(b.folder.id),
      );
  }

  async #upsertProcessFolder(
    folder,
    parsed = parseManagedProcessFolder(folder?.name),
  ) {
    if (!folder?.id || !parsed) {
      const error = new Error("Google Drive process folder is invalid");
      error.status = 409;
      error.code = "INVALID_DRIVE_PROCESS_FOLDER";
      throw error;
    }
    const identity = identityForDriveProcess(folder.id, parsed.labelZh);
    return this.processRepository.upsertDriveProcess({
      id: identity.id,
      labelZh: parsed.labelZh,
      labelEn: identity.en,
      displayOrder: parsed.order,
      driveFolderId: folder.id,
      driveFolderName: folder.name,
    });
  }

  async #applyEnglishLabel(process, labelEn) {
    const normalized = String(labelEn ?? process.labelZh)
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
    if (!this.processRepository.updateProcessLabelEn) {
      return { ...process, labelEn: normalized || process.labelZh };
    }
    return (
      (await this.processRepository.updateProcessLabelEn(
        process.id,
        normalized || process.labelZh,
      )) ?? process
    );
  }

  async syncProcessFoldersFromDrive() {
    const children = await this.drive.listChildren(this.rootFolderId);
    const processFolders = this.#processFolders(children);
    const activeFolderIds = new Set();
    const processes = [];
    for (const { folder, parsed } of processFolders) {
      activeFolderIds.add(folder.id);
      processes.push(await this.#upsertProcessFolder(folder, parsed));
    }
    await this.processRepository.deactivateMissingDriveProcesses(
      activeFolderIds,
    );
    return processes.sort(processOrder);
  }

  async #importFolderPhotos(
    folder,
    {
      source,
      processId = null,
      collection = source === "guest" ? "guest" : "wedding",
      preserveLogicalClassification = false,
    },
  ) {
    const files = await this.drive.listChildren(folder.id);
    for (const file of files) {
      if (!file.mimeType?.startsWith("image/")) continue;
      await this.photoRepository.upsertDrivePhotoMetadata(file, {
        source,
        parentFolderId: folder.id,
        collection,
        preserveLogicalClassification,
      });
      if (preserveLogicalClassification) {
        await this.photoRepository.updateDriveParentByDriveFile?.(
          file.id,
          folder.id,
        );
      } else {
        await this.photoRepository.replacePhotoProcessByDriveFile(
          file.id,
          processId,
          folder.id,
          collection,
        );
      }
    }
  }

  async reconcileFromDrive() {
    const reservedFolders = await this.ensureStructure();
    const children = await this.drive.listChildren(this.rootFolderId);
    const processFolders = this.#processFolders(children);

    const activeFolderIds = new Set();
    const processes = [];
    for (const { folder, parsed } of processFolders) {
      activeFolderIds.add(folder.id);
      const process = await this.#upsertProcessFolder(folder, parsed);
      processes.push(process);
      await this.#importFolderPhotos(folder, {
        source: "official",
        processId: process.id,
        collection: "wedding",
      });
    }

    const rootImages = children.filter((item) =>
      item.mimeType?.startsWith("image/"),
    );
    for (const file of rootImages) {
      await this.photoRepository.upsertDrivePhotoMetadata(file, {
        source: "official",
        parentFolderId: this.rootFolderId,
        collection: "wedding",
      });
      await this.photoRepository.replacePhotoProcessByDriveFile(
        file.id,
        null,
        this.rootFolderId,
        "wedding",
      );
    }

    const unclassified = reservedFolders.get(
      DRIVE_RESERVED_FOLDERS.unclassified,
    );
    if (unclassified) {
      await this.#importFolderPhotos(unclassified, {
        source: "official",
        processId: null,
        collection: "wedding",
      });
    }

    const life = reservedFolders.get(DRIVE_RESERVED_FOLDERS.life);
    if (life) {
      await this.#importFolderPhotos(life, {
        source: "official",
        processId: null,
        collection: "life",
      });
    }

    const guest = reservedFolders.get(DRIVE_RESERVED_FOLDERS.guest);
    if (guest) {
      await this.#importFolderPhotos(guest, {
        source: "guest",
        processId: null,
        collection: "guest",
        preserveLogicalClassification: true,
      });
    }

    await this.processRepository.deactivateMissingDriveProcesses(
      activeFolderIds,
    );
    return processes.sort(processOrder);
  }

  async createProcess({ labelZh, labelEn = "" }) {
    const children = await this.drive.listChildren(this.rootFolderId);
    const currentFolders = this.#processFolders(children);
    const displayOrder = firstAvailableProcessOrder(currentFolders);
    if (displayOrder === null) {
      const error = new Error("No more numbered process folders are available");
      error.status = 409;
      error.code = "PROCESS_LIMIT_REACHED";
      throw error;
    }
    const folder = await this.drive.createFolder({
      parentId: this.rootFolderId,
      name: formatManagedProcessFolder(displayOrder, labelZh),
    });
    return this.#applyEnglishLabel(
      await this.#upsertProcessFolder(folder),
      labelEn || labelZh,
    );
  }

  async renameProcess(process, labelZh, labelEn = "") {
    const current = (await this.syncProcessFoldersFromDrive()).find(
      (item) => item.id === process.id,
    );
    if (!current?.driveFolderId) {
      const error = new Error(
        "Process folder no longer exists in Google Drive",
      );
      error.status = 404;
      error.code = "PROCESS_FOLDER_NOT_FOUND";
      throw error;
    }
    const renamed = await this.drive.rename(
      current.driveFolderId,
      formatManagedProcessFolder(current.displayOrder, labelZh),
    );
    return this.#applyEnglishLabel(
      await this.#upsertProcessFolder(renamed),
      labelEn || labelZh,
    );
  }

  async reorderProcesses(processIds) {
    const current = await this.syncProcessFoldersFromDrive();
    const byId = new Map(current.map((process) => [process.id, process]));
    const requested = [...new Set(processIds)].map((id) => byId.get(id));
    if (
      requested.length !== current.length ||
      requested.some((process) => !process)
    ) {
      const error = new Error(
        "Process order is stale; synchronize Google Drive and try again",
      );
      error.status = 409;
      error.code = "STALE_PROCESS_ORDER";
      throw error;
    }

    for (let index = 0; index < requested.length; index += 1) {
      const process = requested[index];
      const folderName = formatManagedProcessFolder(index + 1, process.labelZh);
      const renamed =
        folderName === process.driveFolderName
          ? {
              id: process.driveFolderId,
              name: process.driveFolderName,
              mimeType: FOLDER_MIME,
            }
          : await this.drive.rename(process.driveFolderId, folderName);
      await this.#upsertProcessFolder(renamed);
    }
    return this.syncProcessFoldersFromDrive();
  }

  async movePhotoToProcess({ driveFileId, fromParentId, processId = null }) {
    const processes = await this.processRepository.listProcesses();
    const process = processId
      ? processes.find((item) => item.id === processId)
      : null;
    if (processId && !process) {
      const error = new Error("The selected wedding process no longer exists");
      error.status = 404;
      error.code = "PROCESS_NOT_FOUND";
      throw error;
    }
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
      "wedding",
    );
  }
}
