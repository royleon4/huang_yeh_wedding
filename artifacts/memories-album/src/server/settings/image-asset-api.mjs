import { createHash } from "node:crypto";

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function contentType(request) {
  return String(request.headers["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

async function readBody(request, maxBytes, errorFactory) {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw errorFactory("too-large");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw errorFactory("too-large");
    chunks.push(chunk);
  }
  if (size === 0) throw errorFactory("required");
  return Buffer.concat(chunks);
}

export function storedImageAsset(buffer, {
  contentType: outputContentType,
  width = null,
  height = null,
}) {
  return {
    contentType: outputContentType,
    data: buffer.toString("base64"),
    version: createHash("sha256").update(buffer).digest("hex"),
    byteLength: buffer.length,
    width,
    height,
  };
}

export function createPublicImageAssetApi({
  path,
  load,
  normalizeStored,
}) {
  if (!path || typeof load !== "function" || typeof normalizeStored !== "function") {
    return async () => false;
  }
  return async function handlePublicImageAsset(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (url.pathname !== path) return false;
    if (request.method !== "GET" && request.method !== "HEAD") return false;

    const asset = normalizeStored(await load());
    if (!asset) {
      response.writeHead(404, {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end();
      return true;
    }

    const etag = `"${asset.version}"`;
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, {
        ETag: etag,
        "Cache-Control": "no-cache, max-age=0",
      });
      response.end();
      return true;
    }

    const bytes = Buffer.from(asset.data, "base64");
    response.writeHead(200, {
      "Content-Type": asset.contentType,
      "Content-Length": bytes.length,
      "Cache-Control": "no-cache, max-age=0",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") response.end();
    else response.end(bytes);
    return true;
  };
}

export function createAdminImageAssetApi({
  path,
  load,
  save,
  clear,
  normalizeStored,
  metadata,
  acceptedContentTypes,
  maxUploadBytes,
  normalizeUpload,
  errorFactory,
  unsupportedMessage,
  fallbackMessage,
}) {
  if (
    !path ||
    typeof load !== "function" ||
    typeof save !== "function" ||
    typeof clear !== "function"
  ) {
    return async () => false;
  }

  return async function handleAdminImageAsset(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (url.pathname !== path) return false;

    if (request.method === "GET") {
      json(response, 200, metadata(await load()));
      return true;
    }

    if (request.method === "DELETE") {
      await clear();
      json(response, 200, metadata(null));
      return true;
    }

    if (request.method !== "PUT") return false;

    try {
      const uploadedContentType = contentType(request);
      if (!acceptedContentTypes.includes(uploadedContentType)) {
        const error = errorFactory("unsupported-type");
        json(response, error.status, {
          error: unsupportedMessage,
          code: error.code,
        });
        return true;
      }
      const input = await readBody(request, maxUploadBytes, errorFactory);
      const stored = normalizeStored(await normalizeUpload(input));
      if (!stored) throw errorFactory("invalid");
      const saved = await save(stored);
      json(response, 200, metadata(saved));
    } catch (error) {
      json(response, error.status ?? 422, {
        error: error.message || fallbackMessage,
        code: error.code || "INVALID_IMAGE_SETTING",
      });
    }
    return true;
  };
}
