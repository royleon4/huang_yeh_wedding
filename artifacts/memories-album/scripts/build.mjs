import { cp } from "node:fs/promises";

await cp("src/app.mjs", "dist/app.mjs");
await cp("src/server.mjs", "dist/server.mjs");
