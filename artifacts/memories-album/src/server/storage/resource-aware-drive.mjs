import {
  DriveConnectorError,
  GoogleDriveStorage,
} from "./drive-adapter.mjs";

const FOLDER_MIME = "application/vnd.google-apps.folder";
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

function rememberResourceKeys(resourceKeys, files) {
  for (const file of files) {
    if (file?.id && file?.resourceKey) {
      resourceKeys.set(file.id, file.resourceKey);
    }
    const shortcut = file?.shortcutDetails;
    if (shortcut?.targetId && shortcut?.targetResourceKey) {
      resourceKeys.set(shortcut.targetId, shortcut.targetResourceKey);
    }
  }
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
    rememberResourceKeys(resourceKeys, files);
    return files;
  };

  storage.download = async (fileId) => {
    const resourceKey = resourceKeys.get(fileId);
    const response = await proxy(
      "google-drive",
      `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      resourceKey
        ? {
            headers: {
              "X-Goog-Drive-Resource-Keys": `${fileId}/${resourceKey}`,
            },
          }
        : {},
    );
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

export function isDriveImageOrDownloadableShortcut(file) {
  if (file?.mimeType?.startsWith("image/")) {
    return file.capabilities?.canDownload !== false;
  }
  return (
    file?.mimeType === FOLDER_MIME
      ? false
      : file?.shortcutDetails?.targetMimeType?.startsWith("image/") &&
        file.capabilities?.canDownload !== false
  );
}
