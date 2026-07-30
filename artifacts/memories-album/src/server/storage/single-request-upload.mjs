import { readFile } from "node:fs/promises";
import { DriveConnectorError } from "./drive-adapter.mjs";

const DRIVE_RESUMABLE_UPLOAD_PATH =
  "/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size&supportsAllDrives=true";

function sessionPath(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return String(value);
  }
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function connectorError(response) {
  const status = Number(response?.status ?? 500);
  return new DriveConnectorError(
    status,
    status === 429 || status >= 500 ? "DRIVE_RETRYABLE" : null,
  );
}

async function sourceBytes({ bytes, filePath }) {
  if (filePath) return readFile(filePath);
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
}

async function recoverExisting(drive, folderId, filename, fallbackSize) {
  try {
    const existing = await drive.findChildByName(folderId, filename);
    if (!existing?.id) return null;
    return {
      fileId: existing.id,
      name: existing.name ?? filename,
      size: Number(existing.size ?? fallbackSize),
      reused: true,
    };
  } catch {
    return null;
  }
}

export async function uploadOriginalSingleRequest({
  drive,
  bytes = null,
  filePath = null,
  byteSize = null,
  filename,
  contentType,
  parentId = null,
  appProperties = {},
  onSession = async () => {},
  onProgress = async () => {},
}) {
  if (!drive?.proxy || !drive?.findChildByName) {
    throw new Error("Drive storage with proxy access is required");
  }

  const folderId = parentId ?? drive.originalFolderId;
  const existing = await drive.findChildByName(folderId, filename);
  if (existing?.id) {
    return {
      fileId: existing.id,
      name: existing.name ?? filename,
      size: Number(existing.size ?? byteSize ?? bytes?.length ?? 0),
      reused: true,
    };
  }

  const body = await sourceBytes({ bytes, filePath });
  const totalBytes = Number(byteSize ?? body.length);
  if (body.length === 0 || totalBytes !== body.length) {
    throw new DriveConnectorError(400, "DRIVE_REQUEST_FAILED");
  }

  const metadata = {
    name: filename,
    parents: [folderId],
    description: "Memories original",
    appProperties: {
      application: "huang-yeh-memories",
      ...appProperties,
    },
  };

  const sessionResponse = await drive.proxy(
    "google-drive",
    DRIVE_RESUMABLE_UPLOAD_PATH,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": String(totalBytes),
      },
      body: JSON.stringify(metadata),
    },
  );
  if (!sessionResponse?.ok) throw connectorError(sessionResponse);

  const sessionUri = sessionResponse.headers?.get?.("location");
  if (!sessionUri) {
    throw new DriveConnectorError(502, "DRIVE_REQUEST_FAILED");
  }
  await onSession({ sessionUri, uploadedBytes: 0 });

  const uploadResponse = await drive.proxy(
    "google-drive",
    sessionPath(sessionUri),
    {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalBytes),
        "Content-Range": `bytes 0-${totalBytes - 1}/${totalBytes}`,
      },
      body,
    },
  );

  if (!uploadResponse?.ok) {
    const recovered = await recoverExisting(
      drive,
      folderId,
      filename,
      totalBytes,
    );
    if (recovered) return recovered;
    if (uploadResponse?.status === 308) {
      throw new DriveConnectorError(503, "DRIVE_RETRYABLE");
    }
    throw connectorError(uploadResponse);
  }

  let data = await responseJson(uploadResponse);
  if (!data?.id) {
    const recovered = await recoverExisting(
      drive,
      folderId,
      filename,
      totalBytes,
    );
    if (recovered) return recovered;
    throw new Error("Google Drive single-request upload did not return a file id");
  }

  await onProgress({ sessionUri, uploadedBytes: totalBytes });
  return {
    fileId: data.id,
    name: data.name ?? filename,
    size: Number(data.size ?? totalBytes),
    reused: false,
  };
}
