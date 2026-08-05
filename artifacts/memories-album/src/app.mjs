import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer as createNodeServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEGACY_ADMIN_API_PATH,
  LEGACY_ADMIN_PATH,
  LEGACY_ADMIN_SESSION_PATH,
  MEMORIES_ADMIN_LOGIN_PATH,
  MEMORIES_ADMIN_PAGE_PATH,
  MEMORIES_ADMIN_PATH,
  MEMORIES_API_PATH,
  MEMORIES_BASE_PATH,
  MEMORIES_LOWERCASE_PATH,
  internalAdminUrl,
} from "./admin-route-paths.mjs";
import { adminAuthorized } from "./server/admin/auth.mjs";
import { createAdminSessionApi } from "./server/admin/session-api.mjs";
import { decodePathSegment } from "./server/http/path-segment.mjs";
import { getMemoriesRuntime } from "./server/runtime.mjs";
import { DOCUMENT_SECURITY_HEADERS } from "./server/security-headers.mjs";

export {
  MEMORIES_ADMIN_LOGIN_PATH,
  MEMORIES_ADMIN_PAGE_PATH,
  MEMORIES_ADMIN_PATH,
  MEMORIES_API_PATH,
  MEMORIES_BASE_PATH,
  MEMORIES_LOWERCASE_PATH,
};

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

function redirect(response, location, status = 308) {
  response.writeHead(status, {
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
    ...DOCUMENT_SECURITY_HEADERS,
    "Content-Length": html.length,
  });
  response.end(html);
}

function safeAssetPath(pathname) {
  let relative;
  try {
    relative = decodePathSegment(pathname.slice(`${MEMORIES_BASE_PATH}/`.length), {
      allowSlash: true,
    });
  } catch {
    return null;
  }
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

async function handleStandaloneApi(
  request,
  response,
  url,
  { env = process.env, getRuntime = getMemoriesRuntime } = {},
) {
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
    url.pathname.startsWith(`${MEMORIES_API_PATH}/albums`) ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/processes`) ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/process-attachments`) ||
    url.pathname.startsWith(`${MEMORIES_API_PATH}/settings`)
  ) {
    try {
      const runtime = await getRuntime(env);
      if (await runtime.albumApi(request, response, url)) return true;
      if (await runtime.settingsApi(request, response, url)) return true;
      if (await runtime.processContentApi(request, response, url)) return true;
      if (await runtime.processApi(request, response, url)) return true;
      if (await runtime.uploadApi(request, response, url)) return true;
      if (await runtime.photoApi(request, response, url)) return true;
    } catch (error) {
      console.warn("Memories API unavailable", {
        name: error instanceof Error ? error.name : "UnknownError",
        code: error?.code,
      });
      if (!response.headersSent) {
        if (
          request.method === "GET" &&
          url.pathname === `${MEMORIES_API_PATH}/processes`
        ) {
          sendJson(response, 200, {
            allProcess: {
              id: "all",
              labelZh: "全部流程",
              labelEn: "All moments",
              showAllPhotos: true,
            },
            processes: [],
            degraded: true,
            storageError: boundedStorageError(error).code,
          });
          return true;
        }
        if (
          request.method === "GET" &&
          url.pathname === `${MEMORIES_API_PATH}/settings`
        ) {
          sendJson(response, 200, {
            primaryNavigationVisible: false,
            guestUploadCategorySelectionEnabled: true,
            degraded: true,
            storageError: boundedStorageError(error).code,
          });
          return true;
        }
        sendJson(response, 503, boundedStorageError(error));
      } else {
        response.destroy();
      }
      return true;
    }
  }

  return false;
}

export async function handleRequest(request, response, options) {
  const requestedUrl = new URL(request.url ?? "/", "http://localhost");
  const env = options?.env ?? process.env;
  const adminToken = env.MEMORIES_ADMIN_TOKEN;
  const adminSessionApi =
    options?.adminSessionApi ?? createAdminSessionApi({ adminToken });

  if (
    requestedUrl.pathname === LEGACY_ADMIN_PATH ||
    requestedUrl.pathname.startsWith(`${LEGACY_ADMIN_PATH}/`)
  ) {
    const suffix = requestedUrl.pathname.slice(LEGACY_ADMIN_PATH.length);
    const destination =
      !suffix || suffix === "/"
        ? MEMORIES_ADMIN_PAGE_PATH
        : `${MEMORIES_ADMIN_PATH}${suffix}`;
    redirect(response, `${destination}${requestedUrl.search}`, 308);
    return;
  }

  const url = internalAdminUrl(requestedUrl);

  if (url.pathname === LEGACY_ADMIN_SESSION_PATH) {
    if (await adminSessionApi(request, response, url)) return;
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (
    url.pathname === `${LEGACY_ADMIN_PATH}/login` ||
    url.pathname === `${LEGACY_ADMIN_PATH}/login/`
  ) {
    if (adminAuthorized(request, adminToken)) {
      redirect(response, MEMORIES_ADMIN_PAGE_PATH, 303);
      return;
    }
    await sendIndex(response);
    return;
  }

  if (url.pathname === `${LEGACY_ADMIN_PATH}/`) {
    redirect(response, MEMORIES_ADMIN_PAGE_PATH, 308);
    return;
  }

  if (url.pathname === LEGACY_ADMIN_PATH) {
    if (!adminAuthorized(request, adminToken)) {
      redirect(response, MEMORIES_ADMIN_LOGIN_PATH, 303);
      return;
    }
    await sendIndex(response);
    return;
  }

  if (
    url.pathname === LEGACY_ADMIN_API_PATH ||
    url.pathname.startsWith(`${LEGACY_ADMIN_API_PATH}/`)
  ) {
    if (!adminAuthorized(request, adminToken)) {
      sendJson(response, 401, {
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
      return;
    }
    try {
      const runtime = await (options?.getRuntime ?? getMemoriesRuntime)(env);
      if (await runtime.adminAlbumApi?.(request, response, url)) return;
      if (await runtime.adminProcessContentApi?.(request, response, url)) return;
      if (await runtime.adminCategoryApi?.(request, response, url)) return;
      if (await runtime.adminPhotoApi?.(request, response, url)) return;
      if (await runtime.adminSettingsApi?.(request, response, url)) return;
    } catch (error) {
      console.warn("Memories administrator API unavailable", {
        name: error instanceof Error ? error.name : "UnknownError",
        code: error?.code,
      });
      if (!response.headersSent) {
        sendJson(response, 503, boundedStorageError(error));
      } else {
        response.destroy();
      }
      return;
    }
    sendJson(response, 404, { error: "Not found" });
    return;
  }

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
    if (await handleStandaloneApi(request, response, url, options)) return;
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

export function createServer(options = {}) {
  const env = options.env ?? process.env;
  const serverOptions = {
    ...options,
    env,
    adminSessionApi:
      options.adminSessionApi ??
      createAdminSessionApi({
        adminToken: env.MEMORIES_ADMIN_TOKEN,
        trustProxy:
          options.trustProxy ??
          (env.REPLIT_DEPLOYMENT === "1" || env.MEMORIES_TRUST_PROXY === "1"),
        failureStore: options.adminFailureStore,
      }),
  };
  return createNodeServer((request, response) => {
    void handleRequest(request, response, serverOptions).catch((error) => {
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
