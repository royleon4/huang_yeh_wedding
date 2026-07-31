import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBulkUploaderRequest,
  successfulBulkUploaderResults,
} from "../src/client/admin-photo-bulk-actions.mjs";
import {
  normalizePhotoIds,
  updatePhotoUploaders,
} from "../src/server/photos/uploader-admin-api.mjs";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";

test("bulk uploader request normalizes one name for unique selected photos", () => {
  assert.deepEqual(
    buildBulkUploaderRequest({
      photos: [{ id: firstId }, { id: secondId }, { id: firstId }],
      uploaderName: "  小安   與小明  ",
    }),
    {
      ids: [firstId, secondId],
      uploaderName: "小安 與小明",
    },
  );

  assert.throws(
    () => buildBulkUploaderRequest({ photos: [], uploaderName: "小安" }),
    (error) => error.code === "PHOTO_REQUIRED",
  );
  assert.throws(
    () =>
      buildBulkUploaderRequest({
        photos: [{ id: firstId }],
        uploaderName: "   ",
      }),
    (error) => error.code === "INVALID_UPLOADER_NAME",
  );
});

test("bulk uploader endpoint updates all available photos in one query", async () => {
  const calls = [];
  const repository = {
    pool: {
      async query(sql, values) {
        calls.push({ sql, values });
        return { rows: [{ id: firstId }, { id: secondId }] };
      },
    },
  };

  const result = await updatePhotoUploaders(
    repository,
    [firstId, secondId],
    "  婚禮攝影  ",
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /id = ANY\(\$1::uuid\[\]\)/);
  assert.deepEqual(calls[0].values, [[firstId, secondId], "婚禮攝影"]);
  assert.deepEqual(result, {
    uploaders: [
      {
        id: firstId,
        uploaderName: "婚禮攝影",
        deleteProtected: true,
      },
      {
        id: secondId,
        uploaderName: "婚禮攝影",
        deleteProtected: true,
      },
    ],
    missingIds: [],
  });
});

test("bulk uploader results report missing photos without losing successful updates", async () => {
  const repository = {
    pool: {
      async query() {
        return { rows: [{ id: firstId }] };
      },
    },
  };
  const payload = await updatePhotoUploaders(
    repository,
    [firstId, secondId],
    "小安",
  );
  assert.deepEqual(payload.missingIds, [secondId]);
  assert.deepEqual(successfulBulkUploaderResults(payload), [
    {
      id: firstId,
      uploaderName: "小安",
      deleteProtected: false,
    },
  ]);
});

test("bulk uploader validation accepts only bounded UUID selections", () => {
  assert.deepEqual(normalizePhotoIds([firstId, firstId, secondId]), [
    firstId,
    secondId,
  ]);
  assert.throws(
    () => normalizePhotoIds(["not-a-photo-id"]),
    (error) => error.code === "INVALID_PHOTO_IDS",
  );
});

test("administrator photo batch card exposes responsive uploader-name editing", async () => {
  const [component, styles, api] = await Promise.all([
    readFile(new URL("../src/client/AdminPhotoBulkActions.jsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/client/admin-photo-bulk-actions.css", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/server/photos/uploader-admin-api.mjs", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(component, /批次更改上傳者／作者/);
  assert.match(component, /\/admin\/api\/photo-uploaders/);
  assert.match(component, /更改 \{selectedPhotos\.length \|\| ""\} 張上傳者/);
  assert.match(styles, /\.admin-photo-bulk-uploader/);
  assert.match(
    styles,
    /@media \(max-width: 800px\)[\s\S]*\.admin-photo-bulk-uploader[\s\S]*grid-template-columns: 1fr/,
  );
  assert.match(api, /request\.method === "PATCH" && collectionPath/);
  assert.match(api, /UPDATE memories_photos[\s\S]*uploader_name = \$2/);
});
