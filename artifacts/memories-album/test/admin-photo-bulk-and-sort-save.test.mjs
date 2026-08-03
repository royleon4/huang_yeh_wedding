import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adminPhotoUploaderUiTransform } from "../admin-photo-uploader-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { albumLabelsUiTransform } from "../album-labels-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import {
  buildBulkClassificationUpdates,
  chunkBulkItems,
  isWeddingPhotographerProtected,
  successfulBulkPhotoResults,
} from "../src/client/admin-photo-bulk-actions.mjs";
import { persistAlbumPhotoSortChanges } from "../src/client/admin-album-sort-persistence.mjs";

const photos = [
  {
    id: "one",
    albumIds: ["guest"],
    categoryIds: [],
    uploaderName: "Leon",
  },
  {
    id: "two",
    albumIds: ["life"],
    categoryIds: ["old-label"],
    uploaderName: "婚禮攝影",
    deleteProtected: true,
  },
];

test("bulk classification can add albums or replace an album-owned label", () => {
  assert.deepEqual(
    buildBulkClassificationUpdates({
      photos,
      albumMode: "add",
      albumIds: ["life"],
      labelMode: "keep",
    }),
    [{ id: "one", changes: { albumIds: ["guest", "life"] } }],
  );

  assert.deepEqual(
    buildBulkClassificationUpdates({
      photos: [photos[0]],
      albumMode: "keep",
      labelMode: "replace",
      labelId: "daily",
      selectedLabel: { id: "daily", albumId: "life" },
    }),
    [
      {
        id: "one",
        changes: {
          albumIds: ["guest", "life"],
          categoryIds: ["daily"],
        },
      },
    ],
  );

  assert.throws(
    () =>
      buildBulkClassificationUpdates({
        photos,
        albumMode: "replace",
        albumIds: [],
      }),
    (error) => error.code === "ALBUM_REQUIRED",
  );
  assert.throws(
    () =>
      buildBulkClassificationUpdates({
        photos: [photos[0]],
        labelMode: "replace",
        labelId: "missing",
        selectedLabel: null,
      }),
    (error) => error.code === "INVALID_LABEL",
  );
  assert.equal(isWeddingPhotographerProtected(photos[0]), false);
  assert.equal(isWeddingPhotographerProtected(photos[1]), true);
  assert.equal(isWeddingPhotographerProtected({ uploaderName: " 婚禮攝影 " }), true);
});

test("large filtered selections are divided by existing API limits", () => {
  assert.deepEqual(chunkBulkItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("bulk result extraction keeps only successful photo updates", () => {
  assert.deepEqual(
    successfulBulkPhotoResults({
      results: [
        { status: "ok", type: "photo.update", id: "one", photo: { id: "one" } },
        { status: "error", type: "photo.update", id: "two" },
        { status: "ok", type: "album.update", id: "album" },
      ],
    }),
    [{ id: "one", photo: { id: "one" } }],
  );
});

test("album photo sort mode is patched and verified after the global batch save", async () => {
  const calls = [];
  const payload = await persistAlbumPhotoSortChanges(
    {
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
    },
    {
      albums: {
        update: [{ id: "guest", changes: { photoSortMode: "name-desc" } }],
        create: [
          {
            clientId: "new-album",
            values: { titleZh: "新相簿", photoSortMode: "random" },
          },
        ],
      },
    },
    {
      async patchAlbum(id, patch) {
        calls.push({ id, patch });
        return { album: { id, photoSortMode: patch.photoSortMode } };
      },
    },
  );

  assert.deepEqual(calls, [
    { id: "guest", patch: { photoSortMode: "name-desc" } },
    { id: "custom", patch: { photoSortMode: "random" } },
  ]);
  assert.equal(payload.summary.failed, 0);
  assert.equal(payload.results[0].album.photoSortMode, "name-desc");
  assert.equal(payload.results[1].album.photoSortMode, "random");
});

test("admin transforms expose label-aware editors and complete filtered selection", async () => {
  const [appSource, workspaceSource, bulkSource] = await Promise.all([
    readFile(new URL("../src/client/AdminApp.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/AdminPhotoWorkspace.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/AdminPhotoBulkActions.jsx", import.meta.url), "utf8"),
  ]);

  const appId = "/workspace/src/client/AdminApp.jsx";
  let appCode = adminPhotoUploaderUiTransform().transform(appSource, appId).code;
  appCode = processContentUiTransform().transform(appCode, appId).code;
  appCode = albumLabelsUiTransform().transform(appCode, appId).code;
  appCode = adminPhotoWorkspaceUiTransform().transform(appCode, appId).code;
  assert.match(appCode, /setPhotoDrafts=\{setPhotoDrafts\}/);
  assert.match(appCode, /photoLabels = orderedCategories/);
  assert.match(appCode, /categories=\{photoLabels\}/);
  assert.match(appCode, /子分類／標籤/);
  assert.match(appCode, /buildAlbumLabelGroups\(albums, categories\)/);

  const labeledWorkspace = albumLabelsUiTransform().transform(
    workspaceSource,
    "/workspace/src/client/AdminPhotoWorkspace.jsx",
  ).code;
  const workspace = adminPhotoWorkspaceUiTransform().transform(
    labeledWorkspace,
    "/workspace/src/client/AdminPhotoWorkspace.jsx",
  ).code;
  assert.match(workspace, /AdminPhotoBulkActions/);
  assert.match(workspace, /albumLabels=\{albumLabels\}/);
  assert.match(workspace, /photos=\{photos\}/);
  assert.match(workspace, /selectAllFilteredPhotos/);
  assert.match(workspace, /selection: true/);
  assert.match(workspace, /admin-photo-select-control/);
  assert.match(workspace, /photo\.deleteProtected/);
  assert.match(workspace, /renderPhoto\(photo, bulkBusy, albumLabels\)/);
  assert.match(workspace, /子分類／標籤與作者/);

  assert.match(bulkSource, /套用設定到所有篩選照片/);
  assert.match(bulkSource, /子分類／標籤動作/);
  assert.match(bulkSource, /buildAlbumLabelGroups\(albums, albumLabels\)/);
  assert.match(bulkSource, /chunkBulkItems\(selectedPhotos, 100\)/);
  assert.match(bulkSource, /chunkBulkItems\(updates, 500\)/);
});

test("new albums persist their selected photo order setting in PostgreSQL", async () => {
  const [repository, adminClient, bulkComponent, bulkCss] = await Promise.all([
    readFile(
      new URL("../src/server/albums/postgres-repository.mjs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/client/admin-client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/client/AdminPhotoBulkActions.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/admin-photo-bulk-actions.css", import.meta.url), "utf8"),
  ]);
  const createAlbumBody = repository.slice(
    repository.indexOf("async createAlbum"),
    repository.indexOf("async updateAlbum"),
  );
  assert.match(createAlbumBody, /BEGIN/);
  assert.match(createAlbumBody, /writeAlbumSettings/);
  assert.match(repository, /PHOTO_SORT_KEY_PREFIX/);
  assert.match(repository, /upsertSetting/);
  assert.match(adminClient, /persistAlbumPhotoSortChanges/);
  assert.match(bulkComponent, /method: "DELETE"/);
  assert.match(bulkComponent, /isWeddingPhotographerProtected/);
  assert.match(
    bulkCss,
    /\.admin-photo-selectable:has\(> \.admin-photo-card\[open\]\)\s*\{[\s\S]*grid-column:\s*1 \/ -1/,
  );
  assert.match(
    bulkCss,
    /\.admin-photo-select-control\s*\{[\s\S]*position:\s*absolute[\s\S]*width:\s*2\.35rem/,
  );
  assert.match(bulkCss, /min-height:\s*1\.18rem !important/);
  assert.match(bulkCss, /> \.admin-photo-card\s*\{[\s\S]*width:\s*100%/);
});
