import assert from "node:assert/strict";
import test from "node:test";
import { memoriesDevelopmentRoutes } from "../vite.config.js";

function createResponse() {
  return {
    statusCode: 200,
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value);
    },
    end() {
      this.ended = true;
    },
  };
}

test("development middleware delegates every Memories API namespace to the production handler", async () => {
  const handled = [];
  const plugin = memoriesDevelopmentRoutes({
    handleRequest: async (request, response) => {
      handled.push(request.url);
      response.statusCode = 204;
      response.end();
    },
  });
  let middleware;
  plugin.configureServer({
    middlewares: {
      use(candidate) {
        middleware = candidate;
      },
    },
  });

  const paths = [
    "/Memories/api/health",
    "/Memories/api/ready",
    "/Memories/api/photos",
    "/Memories/api/photos/photo-1/media",
    "/Memories/api/upload-batches",
    "/Memories/api/processes",
    "/Memories/api/settings",
    "/Memories/api/admin/session",
    "/Memories/api/admin/settings",
    "/Memories/api/admin/processes/sync",
    "/Memories/api/admin/photos/photo-1",
  ];

  for (const url of paths) {
    const response = createResponse();
    let nextCalled = false;
    await middleware({ url, method: "GET" }, response, () => {
      nextCalled = true;
    });
    assert.equal(response.statusCode, 204, url);
    assert.equal(response.ended, true, url);
    assert.equal(nextCalled, false, url);
  }

  assert.deepEqual(handled, paths);
});
