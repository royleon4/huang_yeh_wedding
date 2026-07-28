import { readFile } from "node:fs/promises";
import { createServer as createNodeServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MEMORIES_BASE_PATH = "/Memories";
export const MEMORIES_API_PATH = `${MEMORIES_BASE_PATH}/api`;

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory =
  path.basename(moduleDirectory) === "dist"
    ? path.resolve(moduleDirectory, "public")
    : path.resolve(moduleDirectory, "../public");

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function sendIndex(response) {
  const html = await readFile(path.join(publicDirectory, "index.html"));
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(html);
}

export async function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === MEMORIES_BASE_PATH) {
    response.writeHead(308, { Location: `${MEMORIES_BASE_PATH}/` });
    response.end();
    return;
  }

  if (url.pathname === `${MEMORIES_API_PATH}/health`) {
    sendJson(response, 200, {
      status: "ok",
      service: "memories-album",
      basePath: MEMORIES_BASE_PATH,
    });
    return;
  }

  if (url.pathname === MEMORIES_API_PATH || url.pathname.startsWith(`${MEMORIES_API_PATH}/`)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (url.pathname === `${MEMORIES_BASE_PATH}/` || url.pathname.startsWith(`${MEMORIES_BASE_PATH}/`)) {
    await sendIndex(response);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

export function createServer() {
  return createNodeServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      console.error("Memories request failed", error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Internal server error" });
      } else {
        response.destroy(error);
      }
    });
  });
}
