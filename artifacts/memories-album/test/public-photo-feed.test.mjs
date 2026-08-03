import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_PHOTO_PAGE_CAP,
  PUBLIC_PHOTO_PAGE_LIMIT,
  loadPublicPhotoFeed,
} from "../src/client/public-photo-feed.mjs";

function response(body, ok = true) {
  return {
    ok,
    async json() {
      return body;
    },
  };
}

test("public photo loading exposes the first page before the remaining feed completes", async () => {
  let releaseSecondPage;
  const secondPageReady = new Promise((resolve) => {
    releaseSecondPage = resolve;
  });
  const requests = [];
  const snapshots = [];
  let initialPageSeen;
  const initialPagePromise = new Promise((resolve) => {
    initialPageSeen = resolve;
  });

  const loading = loadPublicPhotoFeed({
    async fetchImpl(url, options) {
      requests.push({ url, options });
      if (requests.length === 1) {
        return response({
          photos: [{ id: "first" }],
          nextCursor: "cursor-1",
        });
      }
      await secondPageReady;
      return response({ photos: [{ id: "second" }], nextCursor: null });
    },
    onInitialPage(photos) {
      snapshots.push(photos.map((photo) => photo.id));
      initialPageSeen();
    },
  });

  await initialPagePromise;
  assert.deepEqual(snapshots, [["first"]]);

  let settled = false;
  void loading.finally(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);

  releaseSecondPage();
  assert.deepEqual(
    (await loading).map((photo) => photo.id),
    ["first", "second"],
  );
  assert.equal(requests[0].url, `/Memories/api/photos?limit=${PUBLIC_PHOTO_PAGE_LIMIT}`);
  assert.equal(
    requests[1].url,
    `/Memories/api/photos?limit=${PUBLIC_PHOTO_PAGE_LIMIT}&cursor=cursor-1`,
  );
  assert.equal(requests[0].options.headers.Accept, "application/json");
});

test("public photo loading forwards AbortSignal and respects an explicit page cap", async () => {
  const controller = new AbortController();
  const urls = [];

  const photos = await loadPublicPhotoFeed({
    signal: controller.signal,
    pageCap: 2,
    pageLimit: 3,
    async fetchImpl(url, options) {
      urls.push(url);
      assert.equal(options.signal, controller.signal);
      return response({
        photos: [{ id: `page-${urls.length}` }],
        nextCursor: `cursor-${urls.length}`,
      });
    },
  });

  assert.deepEqual(
    photos.map((photo) => photo.id),
    ["page-1", "page-2"],
  );
  assert.deepEqual(urls, [
    "/Memories/api/photos?limit=3",
    "/Memories/api/photos?limit=3&cursor=cursor-1",
  ]);
  assert.equal(PUBLIC_PHOTO_PAGE_CAP, 20);
});

test("public photo loading rejects failed listing responses", async () => {
  await assert.rejects(
    loadPublicPhotoFeed({
      async fetchImpl() {
        return response({}, false);
      },
    }),
    /Photo listing failed/,
  );
});
