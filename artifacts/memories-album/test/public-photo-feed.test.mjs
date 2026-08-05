import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_PHOTO_PAGE_CAP,
  PUBLIC_PHOTO_PAGE_LIMIT,
  loadPublicPhotoFeed,
  preloadFirstPhotoThumbnail,
} from "../src/client/public-photo-feed.mjs";

function response(body, ok = true) {
  return {
    ok,
    async json() {
      return body;
    },
  };
}

test("first public thumbnail is preloaded at high priority", () => {
  const created = [];
  class FakeImage {
    constructor() {
      created.push(this);
    }
  }

  const image = preloadFirstPhotoThumbnail(
    [{ thumbnailUrl: "/Memories/api/photos/first/thumbnail" }],
    FakeImage,
  );

  assert.equal(image, created[0]);
  assert.equal(image.decoding, "async");
  assert.equal(image.fetchPriority, "high");
  assert.equal(image.src, "/Memories/api/photos/first/thumbnail");
  assert.equal(preloadFirstPhotoThumbnail([], FakeImage), null);
});

test("public photo loading starts the first thumbnail before exposing the page", async () => {
  const order = [];
  class FakeImage {
    set src(value) {
      this.value = value;
      order.push(`preload:${value}`);
    }
  }

  await loadPublicPhotoFeed({
    ImageConstructor: FakeImage,
    async fetchImpl() {
      return response({
        photos: [
          {
            id: "first",
            thumbnailUrl: "/Memories/api/photos/first/thumbnail",
          },
        ],
        nextCursor: null,
      });
    },
    onInitialPage() {
      order.push("initial-page");
    },
    onPage() {
      order.push("page");
    },
  });

  assert.deepEqual(order, [
    "preload:/Memories/api/photos/first/thumbnail",
    "initial-page",
    "page",
  ]);
});

test("public photo loading exposes smaller pages and yields between requests", async () => {
  let releaseSecondPage;
  const secondPageReady = new Promise((resolve) => {
    releaseSecondPage = resolve;
  });
  const requests = [];
  const initialSnapshots = [];
  const pageSnapshots = [];
  const yields = [];
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
      initialSnapshots.push(photos.map((photo) => photo.id));
      initialPageSeen();
    },
    onPage(photos, metadata) {
      pageSnapshots.push({
        ids: photos.map((photo) => photo.id),
        ...metadata,
      });
    },
    async yieldImpl({ signal }) {
      assert.equal(signal, undefined);
      yields.push("yield");
    },
  });

  await initialPagePromise;
  assert.deepEqual(initialSnapshots, [["first"]]);
  assert.deepEqual(pageSnapshots, [
    { ids: ["first"], page: 1, complete: false },
  ]);
  assert.deepEqual(yields, ["yield"]);

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
  assert.deepEqual(pageSnapshots, [
    { ids: ["first"], page: 1, complete: false },
    { ids: ["first", "second"], page: 2, complete: true },
  ]);
  assert.equal(PUBLIC_PHOTO_PAGE_LIMIT, 24);
  assert.equal(requests[0].url, `/Memories/api/photos?limit=${PUBLIC_PHOTO_PAGE_LIMIT}`);
  assert.equal(
    requests[1].url,
    `/Memories/api/photos?limit=${PUBLIC_PHOTO_PAGE_LIMIT}&cursor=cursor-1`,
  );
  assert.equal(requests[0].options.headers.Accept, "application/json");
});

test("default public feed reaches official photos after the former 480-photo cutoff", async () => {
  let requestCount = 0;

  const photos = await loadPublicPhotoFeed({
    ImageConstructor: null,
    yieldImpl: async () => {},
    async fetchImpl() {
      requestCount += 1;
      if (requestCount <= 20) {
        return response({
          photos: Array.from({ length: 24 }, (_, index) => ({
            id: `guest-${requestCount}-${index}`,
            source: "guest",
          })),
          nextCursor: `cursor-${requestCount}`,
        });
      }
      return response({
        photos: [
          {
            id: "official-after-480",
            source: "official",
            collection: "wedding",
          },
        ],
        nextCursor: null,
      });
    },
  });

  assert.equal(requestCount, 21);
  assert.equal(photos.length, 481);
  assert.equal(photos.at(-1).id, "official-after-480");
  assert.equal(PUBLIC_PHOTO_PAGE_CAP, 1000);
});

test("public feed stops safely when the server repeats a cursor", async () => {
  let requestCount = 0;

  const photos = await loadPublicPhotoFeed({
    ImageConstructor: null,
    yieldImpl: async () => {},
    async fetchImpl() {
      requestCount += 1;
      return response({
        photos: [{ id: `photo-${requestCount}` }],
        nextCursor: "repeated-cursor",
      });
    },
  });

  assert.equal(requestCount, 2);
  assert.deepEqual(
    photos.map((photo) => photo.id),
    ["photo-1", "photo-2"],
  );
});

test("public photo loading forwards AbortSignal and respects an explicit page cap", async () => {
  const controller = new AbortController();
  const urls = [];

  const photos = await loadPublicPhotoFeed({
    signal: controller.signal,
    pageCap: 2,
    pageLimit: 3,
    yieldImpl: async () => {},
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
  assert.equal(PUBLIC_PHOTO_PAGE_CAP, 1000);
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
