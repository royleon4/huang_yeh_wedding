import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";

export async function withListeningServer(server, run) {
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });

  const address = server.address();
  assert.ok(address && typeof address === "object", "server must be listening");

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

export function withRequestHandler(handler, run) {
  const server = createHttpServer(async (request, response) => {
    const handled = await handler(request, response);
    if (handled || response.writableEnded) return;

    response.statusCode = 404;
    response.end();
  });

  return withListeningServer(server, run);
}

export function cookiePair(setCookie) {
  assert.ok(setCookie, "expected a Set-Cookie header");
  return setCookie.split(";", 1)[0];
}

export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json", ...headers }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
