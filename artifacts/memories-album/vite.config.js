import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createAdminSessionApi } from "./src/server/admin/session-api.mjs";
import { getMemoriesRuntime } from "./src/server/runtime.mjs";

const CANONICAL_BASE = "/Memories";
const API_BASE = `${CANONICAL_BASE}/api`;

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function memoriesDevelopmentRoutes() {
  return {
    name: "memories-development-routes",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        const adminSessionApi = createAdminSessionApi({
          adminToken: process.env.MEMORIES_ADMIN_TOKEN,
        });
        if (adminSessionApi(request, response, url)) return;

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
          url.pathname.startsWith(`${API_BASE}/upload-batches`)
        ) {
          try {
            const runtime = await getMemoriesRuntime();
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
