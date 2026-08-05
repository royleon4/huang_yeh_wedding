import assert from "node:assert/strict";
import test from "node:test";
import { parseObjectPath } from "./objectPath.ts";

test("object paths require both bucket and safe object segments", () => {
  assert.deepEqual(parseObjectPath("/bucket/folder/photo.jpg"), {
    bucketName: "bucket",
    objectName: "folder/photo.jpg",
  });
  assert.deepEqual(parseObjectPath("bucket/photo.jpg"), {
    bucketName: "bucket",
    objectName: "photo.jpg",
  });

  for (const value of [
    "",
    "/bucket",
    "//photo.jpg",
    "/bucket/",
    "/bucket/../secret",
    "/bucket/folder//photo.jpg",
  ]) {
    assert.throws(
      () => parseObjectPath(value),
      /bucket and a non-empty object name/,
    );
  }
});
