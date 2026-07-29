import { Pool } from "pg";
import { createServer } from "./app.mjs";
import {
  assertSharedLoginFailureConfiguration,
  PostgresLoginFailureStore,
} from "./server/admin/login-failure-store.mjs";
import {
  runMemoriesMigrations,
  shouldRunProductionMigrations,
} from "./server/migrations.mjs";

const rawPort = process.env.PORT ?? "19316";
const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: ${rawPort}`);
}

assertSharedLoginFailureConfiguration(process.env);

if (shouldRunProductionMigrations()) {
  await runMemoriesMigrations();
}

const adminFailurePool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
    })
  : null;
adminFailurePool?.on("error", (error) => {
  console.warn("Administrator login rate-limit pool unavailable", {
    name: error instanceof Error ? error.name : "UnknownError",
    code: error?.code,
  });
});

const server = createServer({
  adminFailureStore: adminFailurePool
    ? new PostgresLoginFailureStore(adminFailurePool)
    : undefined,
});
server.listen(port, "0.0.0.0", () => {
  console.log(
    `Standalone Memories listening on http://0.0.0.0:${port}/Memories/`,
  );
});
