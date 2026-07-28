const DRIVE_UPLOAD_PATH =
  "/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size&supportsAllDrives=true";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveConnectorError extends Error {
  constructor(status, code = null) {
    super(`Google Drive request failed with status ${status}`);
    this.name = "DriveConnectorError";
    this.status = status;
    this.code =
      code ??
      (status === 401 || status === 403
        ? "DRIVE_AUTHORIZATION_REQUIRED"
        : status === 429 || status >= 500
        ? "DRIVE_RETRYABLE"
        : "DRIVE_REQUEST_FAILED");
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

  async listChildren(parentId) {
    const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
    const response = await this.#request(
      `/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,parents,modifiedTime)&pageSize=1000&orderBy=name_natural&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    );
    const data = await response.json();
    return Array.isArray(data?.files) ? data.files : [];
  }

  async createFolder({ parentId, name }) {
    const response = await this.#request(
      "/drive/v3/files?fields=id,name,mimeType,parents&supportsAllDrives=true",
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
      },
    );
    return response.json();
  }

  async rename(fileId, name) {
    const response = await this.#request(
      `/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,parents&supportsAllDrives=true`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ name }),
      },
    );
    return response.json();
  }

  async move(fileId, { fromParentId = null, toParentId }) {
    const params = new URLSearchParams({
      addParents: toParentId,
      fields: "id,name,mimeType,parents",
      supportsAllDrives: "true",
    });
    if (fromParentId) params.set("removeParents", fromParentId);
    const response = await this.#request(
      `/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`,
      { method: "PATCH" },
    );
    return response.json();
  }

  async findOrCreateFolder(parentId, name) {
    const children = await this.listChildren(parentId);
    const existing = children.find(
      (item) => item.mimeType === FOLDER_MIME && item.name === name,
    );
    return existing ?? this.createFolder({ parentId, name });
  }

  async uploadOriginal({ bytes, filename, contentType, parentId = null }) {
    return this.#upload({
      bytes,
      filename,
      contentType,
      folderId: parentId ?? this.originalFolderId,
      description: "Memories original",
    });
  }

  async uploadThumbnail({ bytes, filename, contentType = "image/webp", parentId = null }) {
    const folderId = parentId ?? this.thumbnailFolderId;
    if (!folderId) {
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
      folderId,
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
    if (!data?.id) throw new Error("Google Drive upload did not return a file id");
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
    if (!response.body) throw new Error("Google Drive returned an empty file body");
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
