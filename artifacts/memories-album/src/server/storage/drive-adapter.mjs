import { open, stat } from "node:fs/promises";

const DRIVE_MULTIPART_UPLOAD_PATH =
  "/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size&supportsAllDrives=true";
const DRIVE_RESUMABLE_UPLOAD_PATH =
  "/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size&supportsAllDrives=true";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const RESUMABLE_CHUNK_BYTES = 4 * 1024 * 1024;
const RESUMABLE_RETRY_ATTEMPTS = 5;

function driveQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sessionPath(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return String(value);
  }
}

function nextOffsetFromRange(value, fallback = 0) {
  const match = String(value ?? "").match(/(?:bytes=)?\s*\d+-(\d+)/i);
  return match ? Number(match[1]) + 1 : fallback;
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

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

function retryableResponse(response) {
  return response?.status === 429 || Number(response?.status ?? 0) >= 500;
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

  async #rawRequest(path, options = {}) {
    return this.proxy("google-drive", path, options);
  }

  async #request(path, options = {}) {
    const response = await this.#rawRequest(path, options);
    if (!response?.ok) {
      throw new DriveConnectorError(Number(response?.status ?? 500));
    }
    return response;
  }

  async listChildren(parentId) {
    const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
    const response = await this.#request(
      `/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,parents,createdTime,modifiedTime,imageMediaMetadata(time))&pageSize=1000&orderBy=name_natural&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    );
    const data = await response.json();
    return Array.isArray(data?.files) ? data.files : [];
  }

  async findChildByName(parentId, name) {
    const q = encodeURIComponent(
      `'${driveQueryValue(parentId)}' in parents and name = '${driveQueryValue(name)}' and trashed = false`,
    );
    const response = await this.#request(
      `/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,parents,createdTime,modifiedTime,imageMediaMetadata(time))&pageSize=10&orderBy=createdTime&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    );
    const data = await response.json();
    return Array.isArray(data?.files) ? (data.files[0] ?? null) : null;
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

  async uploadOriginal({
    bytes = null,
    filePath = null,
    byteSize = null,
    filename,
    contentType,
    parentId = null,
    appProperties = {},
    resumeSessionUri = null,
    resumeOffset = 0,
    onSession = async () => {},
    onProgress = async () => {},
  }) {
    return this.#uploadResumable({
      bytes,
      filePath,
      byteSize,
      filename,
      contentType,
      folderId: parentId ?? this.originalFolderId,
      description: "Memories original",
      appProperties,
      resumeSessionUri,
      resumeOffset,
      onSession,
      onProgress,
    });
  }

  async uploadThumbnail({
    bytes,
    filename,
    contentType = "image/webp",
    parentId = null,
    appProperties = {},
  }) {
    const folderId = parentId ?? this.thumbnailFolderId;
    if (!folderId) {
      const error = new Error(
        "MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID is required before storing derivatives",
      );
      error.code = "THUMBNAIL_FOLDER_NOT_CONFIGURED";
      throw error;
    }
    return this.#uploadMultipart({
      bytes,
      filename,
      contentType,
      folderId,
      description: "Memories web thumbnail",
      appProperties,
    });
  }

  #metadata({ filename, folderId, description, appProperties }) {
    return {
      name: filename,
      parents: [folderId],
      description,
      appProperties: {
        application: "huang-yeh-memories",
        ...appProperties,
      },
    };
  }

  async #startResumableSession({
    filename,
    folderId,
    description,
    appProperties,
    contentType,
    totalBytes,
  }) {
    const response = await this.#request(DRIVE_RESUMABLE_UPLOAD_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": String(totalBytes),
      },
      body: JSON.stringify(
        this.#metadata({ filename, folderId, description, appProperties }),
      ),
    });
    const location = response.headers?.get?.("location");
    if (!location) {
      throw new DriveConnectorError(502, "DRIVE_REQUEST_FAILED");
    }
    return location;
  }

  async #queryResumableSession(uri, totalBytes) {
    const response = await this.#rawRequest(sessionPath(uri), {
      method: "PUT",
      headers: {
        "Content-Length": "0",
        "Content-Range": `bytes */${totalBytes}`,
      },
      body: Buffer.alloc(0),
    });
    if (response?.status === 308) {
      return {
        state: "active",
        offset: nextOffsetFromRange(response.headers?.get?.("range"), 0),
      };
    }
    if (response?.ok) {
      return { state: "complete", data: await responseJson(response) };
    }
    if (response?.status === 404 || response?.status === 410) {
      return { state: "expired" };
    }
    throw new DriveConnectorError(Number(response?.status ?? 500));
  }

  async #sendResumableChunk({ uri, chunk, start, totalBytes, contentType }) {
    const end = start + chunk.length - 1;
    return this.#rawRequest(sessionPath(uri), {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${totalBytes}`,
      },
      body: chunk,
    });
  }

  async #source({ bytes, filePath, byteSize }) {
    if (filePath) {
      const file = await open(filePath, "r");
      const size = Number(byteSize ?? (await stat(filePath)).size);
      return {
        size,
        async read(start, length) {
          const buffer = Buffer.allocUnsafe(length);
          const { bytesRead } = await file.read(buffer, 0, length, start);
          return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
        },
        async close() {
          await file.close();
        },
      };
    }
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
    return {
      size: buffer.length,
      async read(start, length) {
        return buffer.subarray(start, start + length);
      },
      async close() {},
    };
  }

  async #uploadResumable({
    bytes,
    filePath,
    byteSize,
    filename,
    contentType,
    folderId,
    description,
    appProperties,
    resumeSessionUri,
    resumeOffset,
    onSession,
    onProgress,
  }) {
    const existing = await this.findChildByName(folderId, filename);
    if (existing?.id) {
      return {
        fileId: existing.id,
        name: existing.name ?? filename,
        size: Number(existing.size ?? byteSize ?? bytes?.length ?? 0),
        reused: true,
      };
    }

    const source = await this.#source({ bytes, filePath, byteSize });
    let uri = resumeSessionUri;
    let offset = Math.max(0, Math.min(Number(resumeOffset) || 0, source.size));
    let completed = null;

    try {
      if (uri) {
        const state = await this.#queryResumableSession(uri, source.size);
        if (state.state === "complete") {
          completed = state.data;
        } else if (state.state === "expired") {
          uri = null;
          offset = 0;
        } else {
          offset = state.offset;
        }
      }

      if (!completed && !uri) {
        uri = await this.#startResumableSession({
          filename,
          folderId,
          description,
          appProperties,
          contentType,
          totalBytes: source.size,
        });
        offset = 0;
        await onSession({ sessionUri: uri, uploadedBytes: 0 });
      }

      while (!completed && offset < source.size) {
        const length = Math.min(RESUMABLE_CHUNK_BYTES, source.size - offset);
        const chunk = await source.read(offset, length);
        if (chunk.length === 0) {
          throw new DriveConnectorError(502, "DRIVE_REQUEST_FAILED");
        }

        let advanced = false;
        for (let attempt = 1; attempt <= RESUMABLE_RETRY_ATTEMPTS; attempt += 1) {
          const response = await this.#sendResumableChunk({
            uri,
            chunk,
            start: offset,
            totalBytes: source.size,
            contentType,
          });
          if (response?.status === 308) {
            const next = nextOffsetFromRange(
              response.headers?.get?.("range"),
              offset + chunk.length,
            );
            offset = Math.max(offset, next);
            await onProgress({ sessionUri: uri, uploadedBytes: offset });
            advanced = true;
            break;
          }
          if (response?.ok) {
            completed = await responseJson(response);
            offset = source.size;
            await onProgress({ sessionUri: uri, uploadedBytes: offset });
            advanced = true;
            break;
          }
          if (response?.status === 404 || response?.status === 410) {
            uri = await this.#startResumableSession({
              filename,
              folderId,
              description,
              appProperties,
              contentType,
              totalBytes: source.size,
            });
            offset = 0;
            await onSession({ sessionUri: uri, uploadedBytes: 0 });
            advanced = true;
            break;
          }
          if (!retryableResponse(response)) {
            throw new DriveConnectorError(Number(response?.status ?? 500));
          }

          await delay(250 * 2 ** (attempt - 1));
          try {
            const state = await this.#queryResumableSession(uri, source.size);
            if (state.state === "complete") {
              completed = state.data;
              offset = source.size;
              advanced = true;
              break;
            }
            if (state.state === "expired") {
              uri = await this.#startResumableSession({
                filename,
                folderId,
                description,
                appProperties,
                contentType,
                totalBytes: source.size,
              });
              offset = 0;
              await onSession({ sessionUri: uri, uploadedBytes: 0 });
              advanced = true;
              break;
            }
            if (state.offset > offset) {
              offset = state.offset;
              await onProgress({ sessionUri: uri, uploadedBytes: offset });
              advanced = true;
              break;
            }
          } catch (error) {
            if (attempt === RESUMABLE_RETRY_ATTEMPTS) throw error;
          }

          if (attempt === RESUMABLE_RETRY_ATTEMPTS) {
            throw new DriveConnectorError(
              Number(response?.status ?? 503),
              "DRIVE_RETRYABLE",
            );
          }
        }
        if (!advanced) {
          throw new DriveConnectorError(503, "DRIVE_RETRYABLE");
        }
      }

      if (!completed && source.size === 0) {
        throw new DriveConnectorError(400, "DRIVE_REQUEST_FAILED");
      }

      let data = completed;
      if (!data?.id) {
        const recovered = await this.findChildByName(folderId, filename);
        if (recovered?.id) data = recovered;
      }
      if (!data?.id) {
        throw new Error("Google Drive resumable upload did not return a file id");
      }
      return {
        fileId: data.id,
        name: data.name ?? filename,
        size: Number(data.size ?? source.size),
        reused: false,
      };
    } catch (error) {
      if (error?.code === "DRIVE_RETRYABLE") {
        try {
          const recovered = await this.findChildByName(folderId, filename);
          if (recovered?.id) {
            return {
              fileId: recovered.id,
              name: recovered.name ?? filename,
              size: Number(recovered.size ?? source.size),
              reused: true,
            };
          }
        } catch {
          // The caller can safely retry with the same persisted session URI.
        }
      }
      throw error;
    } finally {
      await source.close();
    }
  }

  async #uploadMultipart({
    bytes,
    filename,
    contentType,
    folderId,
    description,
    appProperties = {},
  }) {
    const existing = await this.findChildByName(folderId, filename);
    if (existing?.id) {
      return {
        fileId: existing.id,
        name: existing.name ?? filename,
        size: Number(existing.size ?? bytes.length),
        reused: true,
      };
    }

    const boundary = `memories_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const metadata = JSON.stringify(
      this.#metadata({ filename, folderId, description, appProperties }),
    );
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
      ),
      Buffer.from(bytes),
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    try {
      const response = await this.#request(DRIVE_MULTIPART_UPLOAD_PATH, {
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
        reused: false,
      };
    } catch (error) {
      if (error?.code === "DRIVE_RETRYABLE") {
        try {
          const recovered = await this.findChildByName(folderId, filename);
          if (recovered?.id) {
            return {
              fileId: recovered.id,
              name: recovered.name ?? filename,
              size: Number(recovered.size ?? bytes.length),
              reused: true,
            };
          }
        } catch {
          // The outer retry performs the same deterministic lookup again.
        }
      }
      throw error;
    }
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
