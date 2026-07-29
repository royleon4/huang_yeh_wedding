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

test("creates bounded responsive WebP variants for mobile cards", async () => {
  const source = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 20, g: 90, b: 60 },
    },
  })
    .webp()
    .toBuffer();

  const result = await createImageProcessor().createDisplayVariant({
    bytes: source,
    width: 480,
  });
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(result.contentType, "image/webp");
  assert.equal(metadata.width, 480);
  assert.equal(metadata.height, 320);
});

test("sanitizes public media without retaining EXIF metadata", async () => {
  const source = await sharp({
    create: {
      width: 200,
      height: 120,
      channels: 3,
      background: { r: 20, g: 90, b: 60 },
    },
  })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: {
        IFD0: { Artist: "Private photographer" },
        IFD3: { GPSLatitudeRef: "N" },
      },
    })
    .toBuffer();

  const result = await createImageProcessor().sanitizePublicMedia({
    bytes: source,
    mimeType: "image/jpeg",
  });
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(result.contentType, "image/jpeg");
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.width, 120);
  assert.equal(metadata.height, 200);
});
