import { GoogleDriveStorage } from "./drive-adapter.mjs";

export async function createReplitDriveStorage(env = process.env) {
  const originalFolderId = env.MEMORIES_DRIVE_PHOTOS_FOLDER_ID;
  if (!originalFolderId) {
    throw new Error("MEMORIES_DRIVE_PHOTOS_FOLDER_ID is required");
  }

  const { ReplitConnectors } = await import("@replit/connectors-sdk");
  const connectors = new ReplitConnectors();
  return new GoogleDriveStorage({
    originalFolderId,
    thumbnailFolderId: env.MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID || null,
    proxy: connectors.proxy.bind(connectors),
  });
}
