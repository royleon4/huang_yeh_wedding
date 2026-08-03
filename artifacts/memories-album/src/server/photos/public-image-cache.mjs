const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_ENTRY_BYTES = 2 * 1024 * 1024;

async function readWebStream(body, maxBytes) {
  const reader = body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }

  return Buffer.concat(chunks, total);
}

function normalizedCachedFile(file, body) {
  return {
    ...file,
    body,
    contentLength: body.length,
  };
}

export function createPublicImageCache({
  maxBytes = DEFAULT_MAX_BYTES,
  maxEntryBytes = DEFAULT_MAX_ENTRY_BYTES,
} = {}) {
  const boundedMaxBytes = Math.max(0, Number(maxBytes) || 0);
  const boundedMaxEntryBytes = Math.max(0, Number(maxEntryBytes) || 0);
  const entries = new Map();
  const pending = new Map();
  let storedBytes = 0;

  const remove = (key) => {
    const existing = entries.get(key);
    if (!existing) return;
    entries.delete(key);
    storedBytes -= existing.bytes;
  };

  const touch = (key) => {
    const existing = entries.get(key);
    if (!existing) return null;
    entries.delete(key);
    entries.set(key, existing);
    return existing.file;
  };

  const store = (key, file, body) => {
    if (
      !Buffer.isBuffer(body) ||
      body.length === 0 ||
      body.length > boundedMaxEntryBytes ||
      body.length > boundedMaxBytes
    ) {
      return null;
    }

    remove(key);
    while (entries.size > 0 && storedBytes + body.length > boundedMaxBytes) {
      remove(entries.keys().next().value);
    }

    const cachedFile = normalizedCachedFile(file, body);
    entries.set(key, { file: cachedFile, bytes: body.length });
    storedBytes += body.length;
    return cachedFile;
  };

  const load = async (key, loader) => {
    const cacheKey = String(key ?? "");
    if (!cacheKey || typeof loader !== "function") {
      throw new TypeError("A cache key and image loader are required");
    }

    const cached = touch(cacheKey);
    if (cached) return { file: cached, status: "hit" };

    const inFlight = pending.get(cacheKey);
    if (inFlight) {
      await inFlight;
      const completed = touch(cacheKey);
      if (completed) return { file: completed, status: "hit" };
    }

    const file = await loader();
    if (!file?.body) return { file, status: "miss" };

    if (Buffer.isBuffer(file.body) || file.body instanceof Uint8Array) {
      const body = Buffer.from(file.body);
      return {
        file: store(cacheKey, file, body) ?? file,
        status: "miss",
      };
    }

    const contentLength = Number(file.contentLength ?? 0);
    if (
      (contentLength > 0 && contentLength > boundedMaxEntryBytes) ||
      typeof file.body.tee !== "function"
    ) {
      return { file, status: "miss" };
    }

    const [responseBody, cacheBody] = file.body.tee();
    const capture = readWebStream(cacheBody, boundedMaxEntryBytes)
      .then((body) => (body ? store(cacheKey, file, body) : null))
      .catch(() => null)
      .finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, capture);

    return {
      file: { ...file, body: responseBody },
      status: "miss",
    };
  };

  return {
    load,
    clear() {
      entries.clear();
      pending.clear();
      storedBytes = 0;
    },
    stats() {
      return {
        entries: entries.size,
        pending: pending.size,
        storedBytes,
        maxBytes: boundedMaxBytes,
        maxEntryBytes: boundedMaxEntryBytes,
      };
    },
  };
}
