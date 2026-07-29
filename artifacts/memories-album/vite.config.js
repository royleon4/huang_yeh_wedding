import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { adminAuthorized } from "./src/server/admin/auth.mjs";
import { createAdminSessionApi } from "./src/server/admin/session-api.mjs";
import { getMemoriesRuntime } from "./src/server/runtime.mjs";
import { applyDocumentSecurityHeaders } from "./src/server/security-headers.mjs";

// In dev mode the React Fast Refresh preamble is an inline <script> injected by
// @vitejs/plugin-react.  The production CSP has no 'unsafe-inline' for scripts,
// which causes browsers to block that inline script so the preamble flag is never
// set and every JSX module throws "can't detect preamble".  CSP is meaningless in
// a local dev server, so we strip it from all HTML responses served by Vite.
function applyDevDocumentHeaders(response) {
  applyDocumentSecurityHeaders(response);
  response.removeHeader("Content-Security-Policy");
}

const CANONICAL_BASE = "/Memories";
const API_BASE = `${CANONICAL_BASE}/api`;

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
      const adminToken = process.env.SECRET_TOKEN;
      const adminSessionApi = createAdminSessionApi({
        adminToken,
        trustProxy:
          process.env.REPLIT_DEPLOYMENT === "1" ||
          process.env.MEMORIES_TRUST_PROXY === "1",
      });
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (url.pathname === "/admin/api/session") {
          if (await adminSessionApi(request, response, url)) return;
          sendJson(response, 405, { error: "Method not allowed" });
          return;
        }

        if (url.pathname === "/admin/") {
          redirect(response, "/admin", 308);
          return;
        }

        if (
          url.pathname === "/admin/login" ||
          url.pathname === "/admin/login/"
        ) {
          if (adminAuthorized(request, adminToken)) {
            redirect(response, "/admin");
            return;
          }
          applyDevDocumentHeaders(response);
          request.url = `${CANONICAL_BASE}/${url.search}`;
          next();
          return;
        }

        if (url.pathname === "/admin") {
          if (!adminAuthorized(request, adminToken)) {
            redirect(response, `${CANONICAL_BASE}/`);
            return;
          }
          applyDevDocumentHeaders(response);
          request.url = `${CANONICAL_BASE}/${url.search}`;
          next();
          return;
        }

        if (
          url.pathname === "/admin/api" ||
          url.pathname.startsWith("/admin/api/")
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
          url.pathname === "/memories" ||
          url.pathname.startsWith("/memories/")
        ) {
          const suffix = url.pathname.slice("/memories".length) || "/";
          response.statusCode = 308;
          response.setHeader(
            "Location",
            `${CANONICAL_BASE}${suffix}${url.search}`,
          );
          response.end();
          return;
        }

        if (url.pathname === CANONICAL_BASE) {
          response.statusCode = 308;
          response.setHeader("Location", `${CANONICAL_BASE}/${url.search}`);
          response.end();
          return;
        }

        if (url.pathname === `${API_BASE}/health`) {
          sendJson(response, 200, {
            status: "ok",
            service: "memories-album",
            basePath: CANONICAL_BASE,
          });
          return;
        }

        if (
          url.pathname.startsWith(`${API_BASE}/photos`) ||
          url.pathname.startsWith(`${API_BASE}/upload-batches`) ||
          url.pathname.startsWith(`${API_BASE}/albums`) ||
          url.pathname.startsWith(`${API_BASE}/processes`) ||
          url.pathname.startsWith(`${API_BASE}/settings`)
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
          url.pathname === API_BASE ||
          url.pathname.startsWith(`${API_BASE}/`)
        ) {
          sendJson(response, 404, { error: "Not found" });
          return;
        }

        if (
          url.pathname === `${CANONICAL_BASE}/` ||
          (url.pathname.startsWith(`${CANONICAL_BASE}/`) &&
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
  base: `${CANONICAL_BASE}/`,
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
