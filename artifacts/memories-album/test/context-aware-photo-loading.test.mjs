import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createPublicPhotoFeedLoader,
} from "../src/client/public-photo-feed.mjs";
import { prioritizedPhotoLoadingUiTransform } from "../prioritized-photo-loading-ui-transform.mjs";

function response(body, ok = true) {
  return {
    ok,
    async json() {
      return body;
    },
  };
}

function photo(
  id,
  source,
  {
    processIds = [],
    albumIds = [],
    uploaderName = id,
    createdAt = `2026-06-20T00:00:0${id.length}.000Z`,
  } = {},
) {
  return {
    id,
    source,
    processIds,
    albumIds,
    uploaderName,
    createdAt,
    thumbnailUrl: `/thumb/${id}`,
  };
}

test("wedding loading fetches current official process, then all official, then the remaining feed", async () => {
  const urls = [];
  const current = photo("current", "official", {
    processIds: ["process-a"],
    albumIds: ["wedding"],
  });
  const other = photo("other", "official", {
    processIds: ["process-b"],
    albumIds: ["wedding"],
  });
  const guest = photo("guest", "guest", {
    processIds: ["process-a"],
    albumIds: ["wedding", "guest"],
  });

  const loader = createPublicPhotoFeedLoader({
    ImageConstructor: null,
    async fetchImpl(url) {
      urls.push(url);
      if (url.includes("process=process-a")) {
        return response({ photos: [current], nextCursor: null });
      }
      if (url.includes("source=official")) {
        return response({ photos: [current, other], nextCursor: null });
      }
      return response({ photos: [current, other, guest], nextCursor: null });
    },
  });

  loader.setContext({ collectionId: "wedding", filterId: "process-a" });
  await loader.whenMetadataIdle();

  assert.deepEqual(urls, [
    "/Memories/api/photos?limit=100&process=process-a&source=official",
    "/Memories/api/photos?limit=100&source=official",
    "/Memories/api/photos?limit=100",
  ]);
  assert.equal(loader.getSnapshot().metadataComplete, true);
  assert.deepEqual(
    loader.getSnapshot().photos.map((item) => item.id).sort(),
    ["current", "guest", "other"],
  );
});

test("a new wedding process raises its queued metadata above the previous process without cancelling active work", async () => {
  const urls = [];
  let releaseFirst;
  const firstBlocked = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => {
    firstStarted = resolve;
  });

  const loader = createPublicPhotoFeedLoader({
    ImageConstructor: null,
    async fetchImpl(url) {
      urls.push(url);
      if (urls.length === 1) {
        firstStarted();
        await firstBlocked;
        return response({
          photos: [photo("a", "official")],
          nextCursor: "old-next",
        });
      }
      if (url.includes("process=process-b")) {
        return response({ photos: [photo("b", "official")], nextCursor: null });
      }
      return response({ photos: [], nextCursor: null });
    },
  });

  loader.setContext({ collectionId: "wedding", filterId: "process-a" });
  await firstStartedPromise;
  loader.setContext({ collectionId: "wedding", filterId: "process-b" });
  releaseFirst();
  await loader.whenMetadataIdle();

  assert.match(urls[0], /process=process-a/);
  assert.match(urls[1], /process=process-b/);
});

test("non-wedding pages prioritize the active album without elevating official photos", async () => {
  const urls = [];
  const loader = createPublicPhotoFeedLoader({
    ImageConstructor: null,
    async fetchImpl(url) {
      urls.push(url);
      return response({ photos: [], nextCursor: null });
    },
  });

  loader.setContext({ collectionId: "guest", filterId: "all" });
  await loader.whenMetadataIdle();

  assert.deepEqual(urls, [
    "/Memories/api/photos?limit=100&albumId=guest",
    "/Memories/api/photos?limit=100",
  ]);
  assert.equal(urls.some((url) => url.includes("source=official")), false);
});

test("thumbnail queue keeps active work, reprioritizes queued photos, and does not reload settled thumbnails", async () => {
  const created = [];
  class ControlledImage {
    set src(value) {
      this.value = value;
      created.push(this);
    }

    finish() {
      this.onload?.();
    }
  }

  const current = photo("current", "official", {
    processIds: ["process-a"],
    albumIds: ["wedding"],
  });
  const other = photo("other", "official", {
    processIds: ["process-b"],
    albumIds: ["wedding"],
  });
  const guest = photo("guest", "guest", {
    albumIds: ["guest"],
    uploaderName: "Leon",
  });

  const loader = createPublicPhotoFeedLoader({
    ImageConstructor: ControlledImage,
    thumbnailConcurrency: 1,
    async fetchImpl(url) {
      if (url.includes("process=process-a")) {
        return response({ photos: [current], nextCursor: null });
      }
      if (url.includes("source=official")) {
        return response({ photos: [current, other], nextCursor: null });
      }
      return response({ photos: [current, other, guest], nextCursor: null });
    },
  });

  loader.setContext({ collectionId: "wedding", filterId: "process-a" });
  await loader.whenMetadataIdle();
  assert.equal(created[0].value, "/thumb/current");

  created[0].finish();
  await Promise.resolve();
  assert.equal(created[1].value, "/thumb/other");

  loader.setContext({ collectionId: "guest", filterId: "Leon" });
  created[1].finish();
  await Promise.resolve();
  assert.equal(created[2].value, "/thumb/guest");

  created[2].finish();
  await loader.whenThumbnailsIdle();
  const countAfterComplete = created.length;

  loader.setContext({ collectionId: "wedding", filterId: "process-b" });
  await Promise.resolve();
  assert.equal(created.length, countAfterComplete);
  assert.equal(loader.getSnapshot().thumbnailsComplete, true);
});

test("production transform connects one session loader without changing gallery markup", async () => {
  const source = `import { loadPublicPhotoFeed } from "./public-photo-feed.mjs";
function App() {
  const [remotePhotos, setRemotePhotos] = useState(null);
  useEffect(() => {
    if (runtimeState !== "ready") return undefined;
    let cancelled = false;
    const controller = new AbortController();
    setPhotoFeedComplete(false);
    void loadPublicPhotoFeed({ signal: controller.signal });
    return () => controller.abort();
  }, [runtimeState, useMockFallback]);

  const sourcePhotos = remotePhotos ?? [];
  const handleUploaded = (photo) => {
    setRemotePhotos((current) => [photo, ...(current ?? [])]);
  };
}`;
  const transformed = prioritizedPhotoLoadingUiTransform().transform(
    source,
    "/workspace/src/client/App.jsx",
  ).code;

  assert.match(transformed, /getPublicPhotoFeedLoader/);
  assert.match(transformed, /photoFeedLoader\.subscribe/);
  assert.match(transformed, /photoFeedLoader\.setContext\(\{/);
  assert.match(transformed, /collectionId: activeCollection/);
  assert.match(transformed, /filterId: activeFilter/);
  assert.match(
    transformed,
    /setPhotoFeedComplete\(snapshot\.metadataComplete\)/,
  );
  assert.match(transformed, /photoFeedLoader\.addPhoto\(photo\)/);
  assert.doesNotMatch(transformed, /AbortController|loadPublicPhotoFeed\(/);

  const config = await readFile(new URL("../vite.routes.config.js", import.meta.url), "utf8");
  assert.match(
    config,
    /publicBootstrapUiTransform\(\),\s*prioritizedPhotoLoadingUiTransform\(\),/,
  );
  assert.match(config, /stableIdentityRoutesUiTransform\(\),\s*\],/);
});
