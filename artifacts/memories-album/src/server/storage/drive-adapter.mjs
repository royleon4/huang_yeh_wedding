const DRIVE_UPLOAD_PATH =
  "/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size&supportsAllDrives=true";

export class DriveConnectorError extends Error {
  constructor(status) {
    super(`Google Drive request failed with status ${status}`);
    this.name = "DriveConnectorError";
    this.status = status;
    this.code =
      status === 429 || status >= 500
        ? "DRIVE_RETRYABLE"
        : "DRIVE_REQUEST_FAILED";
  }
}

export class GoogleDriveStorage {
  constructor({ proxy, originalFolderId, thumbnailFolderId = null }) {
    if (typeof proxy !== "function") {
      throw new Error("A Google Drive proxy function is required");
    }
    if (!originalFolderId) {
      throw new Error("MEMORIES_DRIVE_PHOTOS_FOLDER_ID is required");
    }
    this.proxy = proxy;
    this.originalFolderId = originalFolderId;
    this.thumbnailFolderId = thumbnailFolderId;
  }

  async #request(path, options = {}) {
    const response = await this.proxy("google-drive", path, options);
    if (!response?.ok) {
      throw new DriveConnectorError(Number(response?.status ?? 500));
    }
    return response;
  }

  async uploadOriginal({ bytes, filename, contentType }) {
    return this.#upload({
      bytes,
      filename,
      contentType,
      folderId: this.originalFolderId,
      description: "Memories original",
    });
  }

  async uploadThumbnail({ bytes, filename, contentType = "image/webp" }) {
    if (!this.thumbnailFolderId) {
      const error = new Error(
        "MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID is required before storing derivatives",
      );
      error.code = "THUMBNAIL_FOLDER_NOT_CONFIGURED";
      throw error;
    }
    return this.#upload({
      bytes,
      filename,
      contentType,
      folderId: this.thumbnailFolderId,
      description: "Memories web thumbnail",
    });
  }

  async #upload({ bytes, filename, contentType, folderId, description }) {
    const boundary = `memories_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const metadata = JSON.stringify({
      name: filename,
      parents: [folderId],
      description,
      appProperties: { application: "huang-yeh-memories" },
    });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
      ),
      Buffer.from(bytes),
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await this.#request(DRIVE_UPLOAD_PATH, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    const data = await response.json();
    if (!data?.id) {
      throw new Error("Google Drive upload did not return a file id");
    }
    return {
      fileId: data.id,
      name: data.name ?? filename,
      size: Number(data.size ?? bytes.length),
    };
  }

  async download(fileId) {
    const response = await this.#request(
      `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    );
    if (!response.body) {
      throw new Error("Google Drive returned an empty file body");
    }
    return {
      body: response.body,
      contentType:
        response.headers?.get?.("content-type") ?? "application/octet-stream",
      contentLength:
        Number(response.headers?.get?.("content-length") ?? 0) || null,
    };
  }

  async delete(fileId) {
    await this.#request(
      `/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      { method: "DELETE" },
    );
  }
}
