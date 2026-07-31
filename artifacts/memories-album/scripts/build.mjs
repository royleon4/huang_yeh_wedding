import { cp } from "node:fs/promises";

await cp("src/admin-route-paths.mjs", "dist/admin-route-paths.mjs");
await cp("src/app.mjs", "dist/app.mjs");
await cp("src/server.mjs", "dist/server.mjs");
await cp("src/filename-encoding.mjs", "dist/filename-encoding.mjs");
await cp("src/pinned-photo-settings.mjs", "dist/pinned-photo-settings.mjs");
await cp("src/site-copy.mjs", "dist/site-copy.mjs");
await cp("src/upload-settings.mjs", "dist/upload-settings.mjs");
await cp("src/server", "dist/server", { recursive: true });
await cp("db", "dist/db", { recursive: true });
