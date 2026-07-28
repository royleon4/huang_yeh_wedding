import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const CANONICAL_BASE = "/Memories";

function memoriesDevelopmentRoutes() {
  return {
    name: "memories-development-routes",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (url.pathname === "/memories" || url.pathname.startsWith("/memories/")) {
          const suffix = url.pathname.slice("/memories".length) || "/";
          response.statusCode = 308;
          response.setHeader("Location", `${CANONICAL_BASE}${suffix}${url.search}`);
          response.end();
          return;
        }
        if (url.pathname === CANONICAL_BASE) {
          response.statusCode = 308;
          response.setHeader("Location", `${CANONICAL_BASE}/${url.search}`);
          response.end();
          return;
        }
        if (url.pathname === `${CANONICAL_BASE}/api/health`) {
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ status: "ok", service: "memories-album", basePath: CANONICAL_BASE }));
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
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
});
