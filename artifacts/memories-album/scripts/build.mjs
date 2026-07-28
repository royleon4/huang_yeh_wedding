import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("src/app.mjs", "dist/app.mjs");
await cp("src/server.mjs", "dist/server.mjs");
await cp("public", "dist/public", { recursive: true });
