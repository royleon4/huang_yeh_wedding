import assert from "node:assert/strict";
import test from "node:test";
import { createPublicImageCache } from "../src/server/photos/public-image-cache.mjs";

function file(body) {
  return {
    body,
    contentType: "image/webp",
    contentLength: body.length,
  };
}

test("public image cache serves repeated buffers without reloading", async () => {
  const cache = createPublicImageCache({ maxBytes: 32, maxEntryBytes: 16 });
  let loads = 0;
  const loader = async () => {
    loads += 1;
    return file(Buffer.from("thumbnail"));
  };

  const first = await cache.load("photo-1", loader);
  const second = await cache.load("photo-1", loader);

  assert.equal(first.status, "miss");
  assert.equal(second.status, "hit");
  assert.equal(second.file.body.toString(), "thumbnail");
  assert.equal(loads, 1);
  assert.equal(cache.stats().entries, 1);
});

test("public image cache mirrors a web stream without delaying its response branch", async () => {
  const cache = createPublicImageCache({ maxBytes: 64, maxEntryBytes: 32 });
  const bytes = new TextEncoder().encode("streamed-thumbnail");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  const first = await cache.load("photo-2", async () => ({
    body: stream,
    contentType: "image/webp",
    contentLength: bytes.length,
  }));
  assert.equal(first.status, "miss");
  assert.equal(
    new TextDecoder().decode(await new Response(first.file.body).arrayBuffer()),
    "streamed-thumbnail",
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = await cache.load("photo-2", async () => {
    throw new Error("cached stream should not reload");
  });
  assert.equal(second.status, "hit");
  assert.equal(second.file.body.toString(), "streamed-thumbnail");
});

test("public image cache rejects oversized entries and evicts least-recently-used data", async () => {
  const cache = createPublicImageCache({ maxBytes: 8, maxEntryBytes: 6 });
  await cache.load("a", async () => file(Buffer.from("aaaa")));
  await cache.load("b", async () => file(Buffer.from("bbbb")));
  assert.equal(cache.stats().entries, 2);

  await cache.load("a", async () => {
    throw new Error("entry a should still be cached");
  });
  await cache.load("c", async () => file(Buffer.from("cccc")));

  let bLoads = 0;
  const b = await cache.load("b", async () => {
    bLoads += 1;
    return file(Buffer.from("bbbb"));
  });
  assert.equal(b.status, "miss");
  assert.equal(bLoads, 1);

  let oversizedLoads = 0;
  const oversized = async () => {
    oversizedLoads += 1;
    return file(Buffer.from("1234567"));
  };
  await cache.load("large", oversized);
  await cache.load("large", oversized);
  assert.equal(oversizedLoads, 2);
});
