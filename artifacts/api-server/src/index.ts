import app from "./app";
import { parsePort } from "./config";
import { logger } from "./lib/logger";

const port = parsePort(process.env["PORT"]);
const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (error) => {
  logger.fatal({ error, port }, "Server failed to listen");
  process.exitCode = 1;
});
