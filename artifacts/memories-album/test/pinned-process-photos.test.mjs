import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import test from "node:test";
import {
  isValidPinnedPhotosByProcess,
  normalizePinnedPhotoIds,
  normalizePinnedPhotosByProcess,
} from "../src/pinned-photo-settings.mjs";
import { createAdminSettingsApi } from "../src/server/settings/api.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";

function jsonResponse() {
  return {
    status: null,
    body: null,
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      this.body = body;
    },
  };
}

function jsonRequest(body) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "PATCH";
  request.url = "/admin/api/settings";
  return request;
}

test("pinned photo settings keep at most three unique photo IDs per process", () => {
  assert.deepEqual(normalizePinnedPhotoIds(["a", "a", "b", "c", "d"]), [
    "a",
    "b",
    "c",
  ]);
  assert.deepEqual(
    normalizePinnedPhotosByProcess({ vows: ["a", "b"], empty: [] }),
    { vows: ["a", "b"] },
  );
  assert.equal(isValidPinnedPhotosByProcess({ vows: ["a", "b", "c"] }), true);
  assert.equal(isValidPinnedPhotosByProcess({ vows: ["a", "b", "c", "d"] }), false);
  assert.equal(isValidPinnedPhotosByProcess({ vows: ["a", "a"] }), false);
});

test("administrator settings accept a per-process pinned photo map", async () => {
  let stored = {};
  const api = createAdminSettingsApi({
    repository: {
      async setPinnedPhotoIdsByProcess(value) {
        stored = normalizePinnedPhotosByProcess(value);
        return { pinnedPhotoIdsByProcess: stored };
      },
    },
  });
  const response = jsonResponse();
  const handled = await api(
    jsonRequest({ pinnedPhotoIdsByProcess: { vows: ["one", "two"] } }),
    response,
    new URL("http://localhost/admin/api/settings"),
  );
  assert.equal(handled, true);
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    pinnedPhotoIdsByProcess: { vows: ["one", "two"] },
  });
  assert.deepEqual(stored, { vows: ["one", "two"] });
});

test("gallery transform places pinned photos before the single continuous photo grid", async () => {
  const source = await readFile(
    new URL("../src/client/App.jsx", import.meta.url),
    "utf8",
  );
  const gallery = processContentUiTransform().transform(
    source,
    "/workspace/src/client/App.jsx",
  ).code;
  assert.match(gallery, /PinnedPhotoStrip/);
  assert.match(gallery, /pinnedPhotoIdsByProcess/);
  assert.match(gallery, /regularFiltered/);
  assert.match(gallery, /lightboxPhotos/);
  assert.match(gallery, /mediaKey === "photos"/);
  assert.match(gallery, /<PinnedPhotoStrip[\s\S]*<PhotoGroupGrid/);
  assert.equal((gallery.match(/<PhotoGroupGrid/g) ?? []).length, 1);
  assert.match(gallery, /visible\.length < regularFiltered\.length/);
});

test("admin picker only offers public wedding photos from the selected process", async () => {
  const editor = await readFile(
    new URL("../src/client/ProcessContentEditor.jsx", import.meta.url),
    "utf8",
  );
  const picker = await readFile(
    new URL("../src/client/PinnedPhotoPicker.jsx", import.meta.url),
    "utf8",
  );
  assert.match(editor, /photo\.visibility === "public"/);
  assert.match(editor, /photo\.albumIds\?\.includes\("wedding"\)/);
  assert.match(editor, /photo\.categoryIds\?\.includes\(processKey\)/);
  assert.match(editor, /pinnedPhotoIdsByProcess/);
  assert.match(picker, /置頂圖（\{selected\.length\}/);
  assert.match(picker, /PINNED_PHOTO_LIMIT/);
});

test("pinned photos use existing JSON settings and require no migration", async () => {
  const repository = await readFile(
    new URL("../src/server/settings/repository.mjs", import.meta.url),
    "utf8",
  );
  assert.match(repository, /pinned_photos_by_process/);
  assert.match(repository, /memories_app_settings/);
  assert.doesNotMatch(repository, /ALTER TABLE|CREATE TABLE|DROP COLUMN/i);
});
