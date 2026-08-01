import assert from "node:assert/strict";
import test from "node:test";
import { persistAlbumPhotoSortChanges } from "../src/client/admin-album-sort-persistence.mjs";

function successfulPayload() {
  return {
    results: [
      {
        key: "album:update:guest",
        type: "album.update",
        id: "guest",
        status: "ok",
        album: { id: "guest" },
      },
      {
        key: "album:create:new-album",
        type: "album.create",
        id: "custom",
        status: "ok",
        album: { id: "custom" },
      },
    ],
    summary: { attempted: 2, succeeded: 2, failed: 0 },
  };
}

test("Save All persists every supplementary per-album setting", async () => {
  const calls = [];
  const body = {
    albums: {
      update: [
        {
          id: "guest",
          changes: {
            photoSortMode: "name-desc",
            featuredPhotosEnabled: true,
            featuredPhotoMin: 0,
            featuredPhotoMax: 4,
          },
        },
      ],
      create: [
        {
          clientId: "new-album",
          values: {
            titleZh: "新相簿",
            photoSortMode: "random",
            featuredPhotosEnabled: true,
            featuredPhotoMin: 2,
            featuredPhotoMax: 6,
          },
        },
      ],
    },
  };

  const saved = await persistAlbumPhotoSortChanges(successfulPayload(), body, {
    async patchAlbum(id, patch) {
      calls.push({ id, patch });
      return { album: { id, ...patch } };
    },
  });

  assert.deepEqual(calls, [
    {
      id: "guest",
      patch: {
        photoSortMode: "name-desc",
        featuredPhotosEnabled: true,
        featuredPhotoMin: 0,
        featuredPhotoMax: 4,
      },
    },
    {
      id: "custom",
      patch: {
        photoSortMode: "random",
        featuredPhotosEnabled: true,
        featuredPhotoMin: 2,
        featuredPhotoMax: 6,
      },
    },
  ]);
  assert.equal(saved.summary.failed, 0);
  assert.equal(saved.results[0].album.featuredPhotoMin, 0);
  assert.equal(saved.results[1].album.featuredPhotoMax, 6);
});

test("Save All keeps failed album settings pending when the server does not echo them", async () => {
  const body = {
    albums: {
      update: [
        {
          id: "guest",
          changes: {
            featuredPhotosEnabled: true,
            featuredPhotoMin: 1,
            featuredPhotoMax: 4,
          },
        },
      ],
      create: [],
    },
  };
  const payload = {
    results: [successfulPayload().results[0]],
    summary: { attempted: 1, succeeded: 1, failed: 0 },
  };

  const saved = await persistAlbumPhotoSortChanges(payload, body, {
    async patchAlbum(id) {
      return {
        album: {
          id,
          featuredPhotosEnabled: false,
          featuredPhotoMin: 1,
          featuredPhotoMax: 3,
        },
      };
    },
  });

  assert.equal(saved.results[0].status, "error");
  assert.equal(saved.results[0].code, "PERSISTENCE_MISMATCH");
  assert.equal(saved.summary.succeeded, 0);
  assert.equal(saved.summary.failed, 1);
});
