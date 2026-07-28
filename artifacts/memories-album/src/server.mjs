import { createServer } from "./app.mjs";
import {
  runMemoriesMigrations,
  shouldRunProductionMigrations,
} from "./server/migrations.mjs";

const rawPort = process.env.PORT ?? "19316";
const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: ${rawPort}`);
}

if (shouldRunProductionMigrations()) {
  await runMemoriesMigrations();
}

const server = createServer();
server.listen(port, "0.0.0.0", () => {
  console.log(
    `Standalone Memories listening on http://0.0.0.0:${port}/Memories/`,
  );
});
