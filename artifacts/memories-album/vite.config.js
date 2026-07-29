import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
} from "./src/admin-route-paths.mjs";
import { adminAuthorized } from "./src/server/admin/auth.mjs";
import { createAdminSessionApi } from "./src/server/admin/session-api.mjs";
import { getMemoriesRuntime } from "./src/server/runtime.mjs";
import { applyDocumentSecurityHeaders } from "./src/server/security-headers.mjs";

// In dev mode the React Fast Refresh preamble is an inline <script> injected by
// @vitejs/plugin-react. The production CSP has no 'unsafe-inline' for scripts,
// which causes browsers to block that inline script so the preamble flag is never
// set and every JSX module throws "can't detect preamble". CSP is meaningless in
// a local dev server, so we strip it from all HTML responses served by Vite.
function applyDevDocumentHeaders(response) {
  applyDocumentSecurityHeaders(response);
  response.removeHeader("Content-Security-Policy");
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function redirect(response, location, status = 303) {
  response.statusCode = status;
  response.setHeader("Location", location);
  response.setHeader("Cache-Control", "no-store");
  response.end();
}

function memoriesDevelopmentRoutes() {
  return {
    name: "memories-development-routes",
    configureServer(server) {
      const adminToken = process.env.MEMORIES_ADMIN_TOKEN;
      const adminSessionApi = createAdminSessionApi({
        adminToken,
        trustProxy:
          process.env.REPLIT_DEPLOYMENT === "1" ||
          process.env.MEMORIES_TRUST_PROXY === "1",
      });
      server.middlewares.use(async (request, response, next) => {
        const requestedUrl = new URL(request.url ?? "/", "http://localhost");

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

        if (url.pathname === `${LEGACY_ADMIN_PATH}/`) {
          redirect(response, MEMORIES_ADMIN_PAGE_PATH, 308);
          return;
        }

        if (
          url.pathname === `${LEGACY_ADMIN_PATH}/login` ||
          url.pathname === `${LEGACY_ADMIN_PATH}/login/`
        ) {
          if (adminAuthorized(request, adminToken)) {
            redirect(response, MEMORIES_ADMIN_PAGE_PATH);
            return;
          }
          applyDevDocumentHeaders(response);
          request.url = `${MEMORIES_BASE_PATH}/${url.search}`;
          next();
          return;
        }

        if (url.pathname === LEGACY_ADMIN_PATH) {
          if (!adminAuthorized(request, adminToken)) {
            redirect(response, MEMORIES_ADMIN_LOGIN_PATH);
            return;
          }
          applyDevDocumentHeaders(response);
          request.url = `${MEMORIES_BASE_PATH}/${url.search}`;
          next();
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
            const runtime = await getMemoriesRuntime();
            if (await runtime.adminAlbumApi(request, response, url)) return;
            if (await runtime.adminCategoryApi(request, response, url)) return;
            if (await runtime.adminPhotoApi(request, response, url)) return;
            sendJson(response, 404, { error: "Not found" });
          } catch (error) {
            console.warn("Memories development administrator API unavailable", {
              name: error instanceof Error ? error.name : "UnknownError",
              code: error?.code,
            });
            sendJson(response, 503, {
              error: "Memories storage is temporarily unavailable",
            });
          }
          return;
        }

        if (
          url.pathname === MEMORIES_LOWERCASE_PATH ||
          url.pathname.startsWith(`${MEMORIES_LOWERCASE_PATH}/`)
        ) {
          const suffix = url.pathname.slice(MEMORIES_LOWERCASE_PATH.length) || "/";
          response.statusCode = 308;
          response.setHeader(
            "Location",
            `${MEMORIES_BASE_PATH}${suffix}${url.search}`,
          );
          response.end();
          return;
        }

        if (url.pathname === MEMORIES_BASE_PATH) {
          response.statusCode = 308;
          response.setHeader("Location", `${MEMORIES_BASE_PATH}/${url.search}`);
          response.end();
          return;
        }

        if (url.pathname === `${MEMORIES_API_PATH}/health`) {
          sendJson(response, 200, {
            status: "ok",
            service: "memories-album",
            basePath: MEMORIES_BASE_PATH,
          });
          return;
        }

        if (
          url.pathname.startsWith(`${MEMORIES_API_PATH}/photos`) ||
          url.pathname.startsWith(`${MEMORIES_API_PATH}/upload-batches`) ||
          url.pathname.startsWith(`${MEMORIES_API_PATH}/albums`) ||
          url.pathname.startsWith(`${MEMORIES_API_PATH}/processes`) ||
          url.pathname.startsWith(`${MEMORIES_API_PATH}/settings`)
        ) {
          try {
            const runtime = await getMemoriesRuntime();
            if (await runtime.albumApi(request, response, url)) return;
            if (await runtime.settingsApi(request, response, url)) return;
            if (await runtime.processApi(request, response, url)) return;
            if (await runtime.uploadApi(request, response, url)) return;
            if (await runtime.photoApi(request, response, url)) return;
          } catch (error) {
            console.warn("Memories development API unavailable", {
              name: error instanceof Error ? error.name : "UnknownError",
              code:
                typeof error === "object" && error !== null && "code" in error
                  ? String(error.code)
                  : undefined,
            });
            sendJson(response, 503, {
              error: "Memories storage is temporarily unavailable",
            });
            return;
          }
        }

        if (
          url.pathname === MEMORIES_API_PATH ||
          url.pathname.startsWith(`${MEMORIES_API_PATH}/`)
        ) {
          sendJson(response, 404, { error: "Not found" });
          return;
        }

        if (
          url.pathname === `${MEMORIES_BASE_PATH}/` ||
          (url.pathname.startsWith(`${MEMORIES_BASE_PATH}/`) &&
            !url.pathname.split("/").at(-1)?.includes("."))
        ) {
          applyDevDocumentHeaders(response);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: `${MEMORIES_BASE_PATH}/`,
  plugins: [react(), memoriesDevelopmentRoutes()],
  publicDir: false,
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 19316),
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
});
