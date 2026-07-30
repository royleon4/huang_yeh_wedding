import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_GALLERY_MEDIA_ORDER,
  normalizeGalleryMediaOrder,
  photoMediaKey,
  sortPhotosByMediaOrder,
} from "../src/gallery-media-order.mjs";

test("default media order keeps wedding photographer photos before every other author", () => {
  const photos = [
    { id: "guest-a", uploaderName: "小安" },
    { id: "official-a", uploaderName: "婚禮攝影" },
    { id: "guest-b", uploaderName: "管理員" },
    { id: "official-b", uploaderName: "  婚禮攝影  " },
  ];
  assert.deepEqual(
    sortPhotosByMediaOrder(photos, DEFAULT_GALLERY_MEDIA_ORDER).map(
      (photo) => photo.id,
    ),
    ["official-a", "official-b", "guest-a", "guest-b"],
  );
  assert.equal(photoMediaKey(photos[1]), "weddingPhotos");
  assert.equal(photoMediaKey(photos[0]), "guestPhotos");
});

test("administrator order can move guest photos before wedding photographer photos", () => {
  const photos = [
    { id: "official", uploaderName: "婚禮攝影" },
    { id: "guest", uploaderName: "小安" },
  ];
  assert.deepEqual(
    sortPhotosByMediaOrder(photos, [
      "video",
      "text",
      "guestPhotos",
      "weddingPhotos",
    ]).map((photo) => photo.id),
    ["guest", "official"],
  );
});

test("invalid media order safely returns the documented default", () => {
  assert.deepEqual(normalizeGalleryMediaOrder(["video"]), [
    "video",
    "text",
    "weddingPhotos",
    "guestPhotos",
  ]);
});

test("general settings contains media order and visitor upload controls", async () => {
  const [general, orderSettings, saveBar] = await Promise.all([
    readFile(new URL("../src/client/GeneralSettings.jsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/client/GalleryMediaOrderSettings.jsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/client/admin-save-bar.css", import.meta.url), "utf8"),
  ]);
  assert.match(general, /GalleryMediaOrderSettings/);
  assert.match(general, /AdminFeatureSettings/);
  assert.match(orderSettings, /婚禮攝影照片/);
  assert.match(orderSettings, /訪客上傳照片/);
  assert.match(orderSettings, /galleryMediaOrder/);
  assert.doesNotMatch(saveBar, /position:\s*fixed/);
  assert.match(saveBar, /position:\s*sticky/);
  assert.match(saveBar, /@media \(max-width: 560px\)[\s\S]*position:\s*static/);
});
