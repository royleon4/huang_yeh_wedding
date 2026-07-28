import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer as createNodeServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMemoriesRuntime } from "./server/runtime.mjs";

export const MEMORIES_BASE_PATH = "/Memories";
export const MEMORIES_LOWERCASE_PATH = "/memories";
export const MEMORIES_API_PATH = `${MEMORIES_BASE_PATH}/api`;

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const isProductionBuild = path.basename(moduleDirectory) === "dist";
const publicDirectory = isProductionBuild
  ? path.resolve(moduleDirectory, "public")
  : path.resolve(moduleDirectory, "..");
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
]);

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function redirect(response, location) {
  response.writeHead(308, {
    Location: location,
    "Cache-Control": "no-store",
  });
  response.end();
}

async function sendFile(
  response,
  filePath,
  cacheControl = "public, max-age=31536000, immutable",
) {
  const metadata = await stat(filePath);
  if (!metadata.isFile()) throw new Error("Not a file");
  response.writeHead(200, {
    "Content-Type":
      MIME_TYPES.get(path.extname(filePath).toLowerCase()) ??
      "application/octet-stream",
    "Content-Length": metadata.size,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(filePath).pipe(response);
}

async function sendIndex(response) {
  const filePath = path.join(publicDirectory, "index.html");
  const html = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": html.length,
  });
  response.end(html);
}

function safeAssetPath(pathname) {
  const relative = decodeURIComponent(
    pathname.slice(`${MEMORIES_BASE_PATH}/`.length),
  );
  if (!relative || relative.includes("\0")) return null;
  const resolved = path.resolve(publicDirectory, relative);
  return resolved.startsWith(`${publicDirectory}${path.sep}`) ? resolved : null;
}

function boundedStorageError(error) {
  const code = error?.code ?? "MEMORIES_STORAGE_UNAVAILABLE";
  const messages = {
    MEMORIES_ROOT_FOLDER_MISSING:
      "Production is missing the Memories Google Drive root-folder setting.",
    THUMBNAIL_FOLDER_NOT_CONFIGURED:
      "The Memories thumbnail folder is not configured.",
    DRIVE_AUTHORIZATION_REQUIRED:
      "Google Drive authorization is required. Reconnect the Replit Google Drive integration.",
    DRIVE_RETRYABLE:
      "Google Drive is temporarily unavailable. Please retry shortly.",
    DRIVE_REQUEST_FAILED:
      "Google Drive rejected the request. Reconnect the Replit Google Drive integration.",
  };
  return {
    error: messages[code] ?? "Memories storage is temporarily unavailable",
    code,
  };
}

async function handleStandaloneApi(request, response, url) {
  if (url.pathname === `${MEMORIES_API_PATH}/health`) {
    sendJson(response, 200, {
      status: "ok",
      service: "memories-album",
      basePath: MEMORIES_BASE_PATH,
    });
    return true;
  }

  if (
    url.pathname.startsWith(`${MEMORIES_API_PATH}/photos`) ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/upload-batches`) ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/processes`) ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/settings`) ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/admin/processes`) ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/admin/settings`) ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/admin/session`)
  ) {
    try {
      const runtime = await getMemoriesRuntime();
      if (await runtime.settingsApi(request, response, url)) return true;
      if (await runtime.processApi(request, response, url)) return true;
      if (await runtime.uploadApi(request, response, url)) return true;
      if (await runtime.photoApi(request, response, url)) return true;
    } catch (error) {
      console.warn("Memories API unavailable", {
        name: error instanceof Error ? error.name : "UnknownError",
        code: error?.code,
      });
      if (!response.headersSent) {
        sendJson(response, 503, boundedStorageError(error));
      } else {
        response.destroy();
      }
      return true;
    }
  }

  return false;
}

export async function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (
    url.pathname === MEMORIES_LOWERCASE_PATH ||
    url.pathname.startsWith(`${MEMORIES_LOWERCASE_PATH}/`)
  ) {
    const suffix = url.pathname.slice(MEMORIES_LOWERCASE_PATH.length);
    redirect(response, `${MEMORIES_BASE_PATH}${suffix || "/"}${url.search}`);
    return;
  }

  if (url.pathname === MEMORIES_BASE_PATH) {
    redirect(response, `${MEMORIES_BASE_PATH}/${url.search}`);
    return;
  }

  if (
    url.pathname === MEMORIES_API_PATH ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/`)
  ) {
    if (await handleStandaloneApi(request, response, url)) return;
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (
    url.pathname.startsWith(`${MEMORIES_BASE_PATH}/`) &&
    path.extname(url.pathname)
  ) {
    const filePath = safeAssetPath(url.pathname);
    if (!filePath) {
      sendJson(response, 400, { error: "Invalid asset path" });
      return;
    }
    try {
      await sendFile(response, filePath);
    } catch {
      sendJson(response, 404, { error: "Not found" });
    }
    return;
  }

  if (
    url.pathname === `${MEMORIES_BASE_PATH}/` ||
    url.pathname.startsWith(`${MEMORIES_BASE_PATH}/`)
  ) {
    await sendIndex(response);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

export function createServer() {
  return createNodeServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      console.error("Memories request failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        code: error?.code,
      });
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Internal server error" });
      } else {
        response.destroy();
      }
    });
  });
}
