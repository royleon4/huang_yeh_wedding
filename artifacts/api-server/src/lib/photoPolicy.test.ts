import assert from "node:assert/strict";
import test from "node:test";
import {
  UnsupportedPhotoTypeError,
  contentTypeForStoredPhoto,
  createStoredPhotoName,
  isStoredPhotoName,
  normalizedPhotoContentType,
} from "./photoPolicy";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

test("photo policy maps supported MIME types to server-controlled extensions", () => {
  assert.equal(createStoredPhotoName("image/jpeg", () => UUID), `${UUID}.jpg`);
  assert.equal(createStoredPhotoName("IMAGE/HEIF", () => UUID), `${UUID}.heif`);
  assert.equal(normalizedPhotoContentType(" image/webp "), "image/webp");
  assert.throws(
    () => createStoredPhotoName("text/html", () => UUID),
    UnsupportedPhotoTypeError,
  );
});

test("stored photo names reject path traversal and unsupported suffixes", () => {
  assert.equal(isStoredPhotoName(`${UUID}.jpg`), true);
  assert.equal(isStoredPhotoName("1720000000000-legacy.webp"), true);
  for (const value of ["../photo.jpg", "folder/photo.jpg", "photo.svg", "photo.jpg.exe", ""]) {
    assert.equal(isStoredPhotoName(value), false);
  }
});

test("content type falls back to a safe suffix-derived value", () => {
  assert.equal(contentTypeForStoredPhoto("legacy.jpeg", "text/html"), "image/jpeg");
  assert.equal(contentTypeForStoredPhoto("legacy.heic", null), "image/heic");
  assert.equal(
    contentTypeForStoredPhoto("legacy.unknown", "text/html"),
    "application/octet-stream",
  );
});
