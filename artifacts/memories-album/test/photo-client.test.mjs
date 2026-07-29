import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPhotoPageUrl,
  fetchPhotoPage,
  mergeChronologicalPhotos,
} from "../src/client/photo-client.mjs";

test("builds one bounded cursor request for the active collection and process", () => {
  assert.equal(
    buildPhotoPageUrl({
      collection: "wedding",
      processId: "ceremony",
      limit: 12,
      cursor: "opaque cursor",
    }),
    "/Memories/api/photos?limit=12&collection=wedding&process=ceremony&cursor=opaque+cursor",
  );
  assert.equal(
    buildPhotoPageUrl({ collection: "guest", limit: 12 }),
    "/Memories/api/photos?limit=12&collection=guest",
  );
});

test("fetches exactly one page and preserves the opaque next cursor", async () => {
  const requests = [];
  const page = await fetchPhotoPage(
    { collection: "life", limit: 12 },
    {
      fetchFn: async (url) => {
        requests.push(url);
        return {
          ok: true,
          async json() {
            return {
              photos: [{ id: "photo-1" }],
              nextCursor: "opaque-next",
            };
          },
        };
      },
    },
  );

  assert.deepEqual(requests, ["/Memories/api/photos?limit=12&collection=life"]);
  assert.deepEqual(page, {
    photos: [{ id: "photo-1" }],
    nextCursor: "opaque-next",
  });
});

test("merges uploads and later pages into deterministic ascending order", () => {
  const merged = mergeChronologicalPhotos(
    [
      { id: "middle", createdAt: "2026-06-20T02:00:00.000Z" },
      { id: "latest", createdAt: "2026-06-20T03:00:00.000Z" },
    ],
    [
      { id: "earliest", createdAt: "2026-06-20T01:00:00.000Z" },
      {
        id: "middle",
        createdAt: "2026-06-20T02:00:00.000Z",
        refreshed: true,
      },
    ],
  );

  assert.deepEqual(
    merged.map((photo) => photo.id),
    ["earliest", "middle", "latest"],
  );
  assert.equal(merged[1].refreshed, true);
});
