import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  createImageProcessor,
  ImageValidationError,
} from "../src/server/uploads/image-processor.mjs";

test("normalizes orientation, strips metadata, and creates a web thumbnail", async () => {
  const source = await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: { r: 20, g: 90, b: 60 },
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const result = await createImageProcessor().process({
    bytes: source,
    mimeType: "image/jpeg",
    filename: "oriented.jpg",
  });
  assert.equal(result.width, 80);
  assert.equal(result.height, 120);
  assert.equal(result.originalContentType, "image/jpeg");
  assert.equal(result.thumbnailContentType, "image/webp");

  const normalizedMetadata = await sharp(result.originalBytes).metadata();
  assert.equal(normalizedMetadata.orientation, undefined);
  const thumbnailMetadata = await sharp(result.thumbnailBytes).metadata();
  assert.equal(thumbnailMetadata.format, "webp");
});

test("rejects malformed input with a bounded validation error", async () => {
  await assert.rejects(
    createImageProcessor().process({
      bytes: Buffer.from("not-an-image"),
      mimeType: "image/jpeg",
      filename: "bad.jpg",
    }),
    (error) => error instanceof ImageValidationError,
  );
});
