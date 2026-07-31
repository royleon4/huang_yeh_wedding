import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  SITE_ICON_ACCEPTED_CONTENT_TYPES,
  SITE_ICON_ADMIN_PATH,
  SITE_ICON_MAX_UPLOAD_BYTES,
  SITE_ICON_OUTPUT_CONTENT_TYPE,
  SITE_ICON_OUTPUT_SIZE,
  SITE_ICON_PUBLIC_PATH,
  normalizeStoredSiteIcon,
  siteIconMetadata,
} from "../../site-icon.mjs";

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

async function readBody(request, maxBytes) {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    const error = new Error("Site icon is too large");
    error.status = 413;
    error.code = "SITE_ICON_TOO_LARGE";
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Site icon is too large");
      error.status = 413;
      error.code = "SITE_ICON_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  if (size === 0) {
    const error = new Error("Site icon file is required");
    error.status = 422;
    error.code = "SITE_ICON_REQUIRED";
    throw error;
  }
  return Buffer.concat(chunks);
}

async function normalizeIcon(input) {
  try {
    return await sharp(input, {
      failOn: "error",
      limitInputPixels: 16_000_000,
    })
      .rotate()
      .resize(SITE_ICON_OUTPUT_SIZE, SITE_ICON_OUTPUT_SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
  } catch {
    const error = new Error("The selected file is not a valid supported image");
    error.status = 422;
    error.code = "INVALID_SITE_ICON";
    throw error;
  }
}

function storedIcon(buffer) {
  return {
    contentType: SITE_ICON_OUTPUT_CONTENT_TYPE,
    data: buffer.toString("base64"),
    version: createHash("sha256").update(buffer).digest("hex"),
    byteLength: buffer.length,
  };
}

export function createSiteIconApi({ repository }) {
  if (!repository?.getSiteIcon) return async () => false;
  return async function handleSiteIconApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (url.pathname !== SITE_ICON_PUBLIC_PATH) return false;
    if (request.method !== "GET" && request.method !== "HEAD") return false;

    const icon = normalizeStoredSiteIcon(await repository.getSiteIcon());
    if (!icon) {
      response.writeHead(404, {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end();
      return true;
    }

    const etag = `"${icon.version}"`;
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, {
        ETag: etag,
        "Cache-Control": "no-cache, max-age=0",
      });
      response.end();
      return true;
    }

    const bytes = Buffer.from(icon.data, "base64");
    response.writeHead(200, {
      "Content-Type": icon.contentType,
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

export function createAdminSiteIconApi({ repository }) {
  if (
    !repository?.getSiteIcon ||
    !repository?.setSiteIcon ||
    !repository?.clearSiteIcon
  ) {
    return async () => false;
  }
  return async function handleAdminSiteIconApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (url.pathname !== SITE_ICON_ADMIN_PATH) return false;

    if (request.method === "GET") {
      json(response, 200, siteIconMetadata(await repository.getSiteIcon()));
      return true;
    }

    if (request.method === "DELETE") {
      await repository.clearSiteIcon();
      json(response, 200, siteIconMetadata(null));
      return true;
    }

    if (request.method !== "PUT") return false;

    try {
      const uploadedContentType = contentType(request);
      if (!SITE_ICON_ACCEPTED_CONTENT_TYPES.includes(uploadedContentType)) {
        json(response, 415, {
          error: "Site icon must be PNG, JPEG, or WebP",
          code: "UNSUPPORTED_SITE_ICON_TYPE",
        });
        return true;
      }
      const input = await readBody(request, SITE_ICON_MAX_UPLOAD_BYTES);
      const output = await normalizeIcon(input);
      const saved = await repository.setSiteIcon(storedIcon(output));
      json(response, 200, siteIconMetadata(saved));
    } catch (error) {
      json(response, error.status ?? 422, {
        error: error.message || "Unable to save site icon",
        code: error.code || "INVALID_SITE_ICON",
      });
    }
    return true;
  };
}
