const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_CACHE_BYTES = 64 * 1024 * 1024;
const DEFAULT_MAX_CACHED_ITEM_BYTES = 8 * 1024 * 1024;

function mediaTooLargeError() {
  const error = new Error("The source image is too large for public delivery");
  error.code = "PUBLIC_MEDIA_TOO_LARGE";
  return error;
}

function assertBoundedSize(size, maxBytes) {
  if (size > maxBytes) throw mediaTooLargeError();
}

async function bodyToBuffer(body, maxBytes) {
  if (Buffer.isBuffer(body)) {
    assertBoundedSize(body.length, maxBytes);
    return body;
  }
  if (body instanceof Uint8Array) {
    assertBoundedSize(body.byteLength, maxBytes);
    return Buffer.from(body);
  }
  if (body?.getReader) {
    const reader = body.getReader();
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        length += chunk.length;
        assertBoundedSize(length, maxBytes);
        chunks.push(chunk);
      }
    } catch (error) {
      await reader.cancel?.().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock?.();
    }
    return Buffer.concat(chunks);
  }
  if (body?.[Symbol.asyncIterator]) {
    const chunks = [];
    let length = 0;
    for await (const value of body) {
      const chunk = Buffer.from(value);
      length += chunk.length;
      assertBoundedSize(length, maxBytes);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Unsupported Google Drive response body");
}

export class PublicMediaService {
  #inFlight = new Map();
  #cache = new Map();
  #cacheBytes = 0;
  #active = 0;
  #waiters = [];

  constructor({
    drive,
    imageProcessor,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    maxSourceBytes = DEFAULT_MAX_SOURCE_BYTES,
    maxCacheBytes = DEFAULT_MAX_CACHE_BYTES,
    maxCachedItemBytes = DEFAULT_MAX_CACHED_ITEM_BYTES,
  }) {
    if (!drive || !imageProcessor) {
      throw new Error("Public media requires Drive and an image processor");
    }
    this.drive = drive;
    this.imageProcessor = imageProcessor;
    this.maxConcurrent = Math.max(
      1,
      Math.min(Number(maxConcurrent) || DEFAULT_MAX_CONCURRENT, 6),
    );
    this.maxSourceBytes = Math.max(
      1,
      Number(maxSourceBytes) || DEFAULT_MAX_SOURCE_BYTES,
    );
    const configuredCacheBytes = Number(maxCacheBytes);
    this.maxCacheBytes = Number.isFinite(configuredCacheBytes)
      ? Math.max(0, configuredCacheBytes)
      : DEFAULT_MAX_CACHE_BYTES;
    const configuredItemBytes = Number(maxCachedItemBytes);
    this.maxCachedItemBytes = Number.isFinite(configuredItemBytes)
      ? Math.max(0, configuredItemBytes)
      : DEFAULT_MAX_CACHED_ITEM_BYTES;
  }

  getSanitizedMedia(photo) {
    if (!photo?.driveFileId) {
      const error = new Error("Photo is missing its Drive identity");
      error.code = "PHOTO_DRIVE_ID_MISSING";
      throw error;
    }
    const key = `${photo.driveFileId}:${photo.contentVersion ?? 1}`;
    if (this.#cache.has(key)) {
      const cached = this.#cache.get(key);
      this.#cache.delete(key);
      this.#cache.set(key, cached);
      return Promise.resolve(cached);
    }
    if (this.#inFlight.has(key)) {
      return this.#inFlight.get(key);
    }
    const operation = this.#withSlot(() => this.#createSanitizedMedia(photo))
      .then((media) => {
        this.#remember(key, media);
        return media;
      })
      .finally(() => {
        this.#inFlight.delete(key);
      });
    this.#inFlight.set(key, operation);
    return operation;
  }

  async #withSlot(operation) {
    if (this.#active >= this.maxConcurrent) {
      await new Promise((resolve) => this.#waiters.push(resolve));
    }
    this.#active += 1;
    try {
      return await operation();
    } finally {
      this.#active -= 1;
      this.#waiters.shift()?.();
    }
  }

  #remember(key, media) {
    const size = Number(media?.contentLength) || media?.body?.length || 0;
    if (
      this.maxCacheBytes === 0 ||
      size <= 0 ||
      size > this.maxCachedItemBytes ||
      size > this.maxCacheBytes
    ) {
      return;
    }
    while (this.#cacheBytes + size > this.maxCacheBytes) {
      const oldestKey = this.#cache.keys().next().value;
      if (!oldestKey) break;
      const oldest = this.#cache.get(oldestKey);
      this.#cache.delete(oldestKey);
      this.#cacheBytes -=
        Number(oldest?.contentLength) || oldest?.body?.length || 0;
    }
    this.#cache.set(key, media);
    this.#cacheBytes += size;
  }

  async #createSanitizedMedia(photo) {
    const file = await this.drive.download(photo.driveFileId);
    const declaredLength = Number(file.contentLength);
    if (Number.isFinite(declaredLength)) {
      assertBoundedSize(declaredLength, this.maxSourceBytes);
    }
    const sanitized = await this.imageProcessor.sanitizePublicMedia({
      bytes: await bodyToBuffer(file.body, this.maxSourceBytes),
      mimeType: photo.mimeType || file.contentType,
    });
    return {
      body: sanitized.bytes,
      contentType: sanitized.contentType,
      contentLength: sanitized.bytes.length,
    };
  }
}
