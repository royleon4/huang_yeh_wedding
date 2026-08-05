import {
  DriveConnectorError,
  GoogleDriveStorage,
} from "./drive-adapter.mjs";

const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const LIST_FIELDS = [
  "id",
  "name",
  "mimeType",
  "size",
  "parents",
  "createdTime",
  "modifiedTime",
  "resourceKey",
  "capabilities(canDownload)",
  "imageMediaMetadata(time,width,height)",
  "shortcutDetails(targetId,targetMimeType,targetResourceKey)",
].join(",");
const FILE_FIELDS = [
  "id",
  "mimeType",
  "resourceKey",
  "capabilities(canDownload)",
  "shortcutDetails(targetId,targetMimeType,targetResourceKey)",
].join(",");

function responseHeaders(response) {
  return (
    response?.headers ??
    ({
      get() {
        return null;
      },
    })
  );
}

function rememberFile(resourceKeys, downloadTargets, file) {
  if (file?.id && file?.resourceKey) {
    resourceKeys.set(file.id, file.resourceKey);
  }
  const shortcut = file?.shortcutDetails;
  if (file?.id && shortcut?.targetId) {
    downloadTargets.set(file.id, shortcut.targetId);
  }
  if (shortcut?.targetId && shortcut?.targetResourceKey) {
    resourceKeys.set(shortcut.targetId, shortcut.targetResourceKey);
  }
}

function rememberFiles(resourceKeys, downloadTargets, files) {
  for (const file of files) {
    rememberFile(resourceKeys, downloadTargets, file);
  }
}

function normalizeLifeFolderShortcuts(storage, parentId, files) {
  if (!storage.lifeFolderId || parentId !== storage.lifeFolderId) return files;
  return files.map((file) => {
    const targetMimeType = file?.shortcutDetails?.targetMimeType;
    if (
      file?.mimeType !== SHORTCUT_MIME ||
      !targetMimeType?.startsWith("image/") ||
      file.capabilities?.canDownload === false
    ) {
      return file;
    }
    return {
      ...file,
      mimeType: targetMimeType,
      size: file.size ?? "0",
      imageMediaMetadata: file.imageMediaMetadata ?? null,
    };
  });
}

function downloadIdentity(resourceKeys, downloadTargets, requestedFileId) {
  const fileId = downloadTargets.get(requestedFileId) ?? requestedFileId;
  return { fileId, resourceKey: resourceKeys.get(fileId) ?? null };
}

function resourceKeyOptions({ fileId, resourceKey }) {
  return resourceKey
    ? {
        headers: {
          "X-Goog-Drive-Resource-Keys": `${fileId}/${resourceKey}`,
        },
      }
    : {};
}

export function createResourceAwareDriveStorage({
  proxy,
  originalFolderId,
  thumbnailFolderId = null,
}) {
  if (typeof proxy !== "function") {
    throw new Error("A Google Drive proxy function is required");
  }

  const storage = new GoogleDriveStorage({
    proxy,
    originalFolderId,
    thumbnailFolderId,
  });
  const resourceKeys = new Map();
  const downloadTargets = new Map();

  storage.listChildren = async (parentId) => {
    const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
    const response = await proxy(
      "google-drive",
      `/drive/v3/files?q=${q}&fields=files(${LIST_FIELDS})&pageSize=1000&orderBy=name_natural&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    );
    if (!response?.ok) {
      throw new DriveConnectorError(Number(response?.status ?? 500));
    }
    const data = await response.json();
    const files = Array.isArray(data?.files) ? data.files : [];
    rememberFiles(resourceKeys, downloadTargets, files);
    return normalizeLifeFolderShortcuts(storage, parentId, files);
  };

  const requestMedia = (identity) =>
    proxy(
      "google-drive",
      `/drive/v3/files/${encodeURIComponent(identity.fileId)}?alt=media&supportsAllDrives=true`,
      resourceKeyOptions(identity),
    );

  const refreshFileIdentity = async (fileId) => {
    const response = await proxy(
      "google-drive",
      `/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(FILE_FIELDS)}&supportsAllDrives=true`,
    );
    if (!response?.ok) return false;
    const file = await response.json();
    rememberFile(resourceKeys, downloadTargets, file);
    return true;
  };

  storage.download = async (requestedFileId) => {
    let identity = downloadIdentity(
      resourceKeys,
      downloadTargets,
      requestedFileId,
    );
    let response = await requestMedia(identity);

    if (!response?.ok && Number(response?.status) === 404) {
      const refreshed = await refreshFileIdentity(requestedFileId);
      if (refreshed) {
        const refreshedIdentity = downloadIdentity(
          resourceKeys,
          downloadTargets,
          requestedFileId,
        );
        if (
          refreshedIdentity.fileId !== identity.fileId ||
          refreshedIdentity.resourceKey !== identity.resourceKey
        ) {
          identity = refreshedIdentity;
          response = await requestMedia(identity);
        }
      }
    }

    if (!response?.ok) {
      throw new DriveConnectorError(Number(response?.status ?? 500));
    }
    if (!response.body) {
      throw new Error("Google Drive returned an empty file body");
    }
    const headers = responseHeaders(response);
    return {
      body: response.body,
      contentType: headers.get("content-type") ?? "application/octet-stream",
      contentLength: Number(headers.get("content-length") ?? 0) || null,
    };
  };

  return storage;
}
