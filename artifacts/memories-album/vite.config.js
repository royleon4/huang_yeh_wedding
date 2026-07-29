import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {
  handleRequest,
  MEMORIES_API_PATH,
  MEMORIES_BASE_PATH,
  MEMORIES_LOWERCASE_PATH,
} from "./src/app.mjs";

export function memoriesDevelopmentRoutes({
  handleRequest: handleSharedRequest = handleRequest,
} = {}) {
  return {
    name: "memories-development-routes",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (
          url.pathname === MEMORIES_LOWERCASE_PATH ||
          url.pathname.startsWith(`${MEMORIES_LOWERCASE_PATH}/`) ||
          url.pathname === MEMORIES_BASE_PATH ||
          url.pathname === MEMORIES_API_PATH ||
          url.pathname.startsWith(`${MEMORIES_API_PATH}/`)
        ) {
          await handleSharedRequest(request, response);
          return;
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
