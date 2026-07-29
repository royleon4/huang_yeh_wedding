import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { PublicMediaService } from "../src/server/photos/public-media-service.mjs";
import { createImageProcessor } from "../src/server/uploads/image-processor.mjs";

test("public media strips metadata and deduplicates concurrent sanitization", async () => {
  const source = await sharp({
    create: {
      width: 200,
      height: 120,
      channels: 3,
      background: { r: 20, g: 90, b: 60 },
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD0: { Artist: "Private" } } })
    .toBuffer();
  let downloads = 0;
  const service = new PublicMediaService({
    drive: {
      async download() {
        downloads += 1;
        return { body: source, contentType: "image/jpeg" };
      },
    },
    imageProcessor: createImageProcessor(),
  });
  const photo = {
    driveFileId: "drive-file",
    mimeType: "image/jpeg",
  };

  const [left, right] = await Promise.all([
    service.getSanitizedMedia(photo),
    service.getSanitizedMedia(photo),
  ]);
  assert.equal(downloads, 1);
  assert.equal(left, right);
  const metadata = await sharp(left.body).metadata();
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
});

test("public media bounds cross-photo sanitization concurrency", async () => {
  let active = 0;
  let maximumActive = 0;
  const service = new PublicMediaService({
    drive: {
      async download() {
        return { body: Buffer.from("image"), contentType: "image/jpeg" };
      },
    },
    imageProcessor: {
      async sanitizePublicMedia({ bytes }) {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return { bytes, contentType: "image/jpeg" };
      },
    },
    maxConcurrent: 2,
  });

  await Promise.all(
    ["one", "two", "three", "four"].map((driveFileId) =>
      service.getSanitizedMedia({ driveFileId, contentVersion: 1 }),
    ),
  );
  assert.equal(maximumActive, 2);
});

test("public media rejects an oversized source before image decoding", async () => {
  let processed = false;
  const service = new PublicMediaService({
    drive: {
      async download() {
        return {
          body: Buffer.from("oversized"),
          contentType: "image/jpeg",
        };
      },
    },
    imageProcessor: {
      async sanitizePublicMedia() {
        processed = true;
      },
    },
    maxSourceBytes: 4,
  });

  await assert.rejects(
    service.getSanitizedMedia({
      driveFileId: "oversized",
      contentVersion: 1,
    }),
    (error) => error?.code === "PUBLIC_MEDIA_TOO_LARGE",
  );
  assert.equal(processed, false);
});
