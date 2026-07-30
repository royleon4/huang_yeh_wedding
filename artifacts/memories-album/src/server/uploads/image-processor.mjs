import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);
const MAX_PIXELS = 120_000_000;
const MAX_DIMENSION = 30_000;
const MIN_DIMENSION = 64;
const THUMBNAIL_MAX_DIMENSION = 1600;
const THUMBNAIL_QUALITY = 82;

export class ImageValidationError extends Error {
  constructor(message, code = "INVALID_IMAGE") {
    super(message);
    this.name = "ImageValidationError";
    this.code = code;
  }
}

function assertSupportedMimeType(mimeType) {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new ImageValidationError(
      "Unsupported image type",
      "UNSUPPORTED_IMAGE_TYPE",
    );
  }
}

async function readMetadata(input) {
  let metadata;
  try {
    metadata = await sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new ImageValidationError("The selected file is not a valid image");
  }

  if (
    !ALLOWED_FORMATS.has(metadata.format) ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new ImageValidationError("Unsupported or unreadable image");
  }
  if (
    metadata.width > MAX_DIMENSION ||
    metadata.height > MAX_DIMENSION ||
    metadata.width * metadata.height > MAX_PIXELS
  ) {
    throw new ImageValidationError("Image dimensions are too large");
  }
  return metadata;
}

function assertMinimumDimensions(width, height) {
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new ImageValidationError("Image dimensions are too small");
  }
}

function normalizedPipeline(input, format) {
  const pipeline = sharp(input, {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
    sequentialRead: true,
  }).rotate();

  if (format === "png") {
    return {
      pipeline: pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }),
      contentType: "image/png",
      extension: "png",
    };
  }
  if (format === "webp") {
    return {
      pipeline: pipeline.webp({ quality: 95, effort: 4 }),
      contentType: "image/webp",
      extension: "webp",
    };
  }
  return {
    pipeline: pipeline.jpeg({ quality: 95, mozjpeg: true }),
    contentType: "image/jpeg",
    extension: "jpg",
  };
}

async function createThumbnailBuffer(input) {
  try {
    return await sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_DIMENSION,
        height: THUMBNAIL_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ImageValidationError("The thumbnail could not be generated");
  }
}

export function createImageProcessor() {
  return {
    async createThumbnail({ bytes, filePath, mimeType }) {
      assertSupportedMimeType(mimeType);
      const input = filePath ?? bytes;
      const metadata = await readMetadata(input);
      assertMinimumDimensions(metadata.width, metadata.height);
      const thumbnail = await createThumbnailBuffer(input);
      return {
        thumbnailBytes: thumbnail.data,
        thumbnailContentType: "image/webp",
        thumbnailWidth: thumbnail.info.width,
        thumbnailHeight: thumbnail.info.height,
      };
    },

    async processFile({ filePath, mimeType }) {
      assertSupportedMimeType(mimeType);
      const metadata = await readMetadata(filePath);
      assertMinimumDimensions(metadata.width, metadata.height);
      const normalized = normalizedPipeline(filePath, metadata.format);
      const originalPath = join(
        dirname(filePath),
        `${randomUUID()}.normalized.${normalized.extension}`,
      );

      let info;
      try {
        info = await normalized.pipeline.toFile(originalPath);
      } catch {
        throw new ImageValidationError("The image could not be normalized");
      }
      assertMinimumDimensions(info.width, info.height);
      const file = await stat(originalPath);
      return {
        originalPath,
        originalContentType: normalized.contentType,
        originalExtension: normalized.extension,
        originalByteSize: file.size,
        width: info.width,
        height: info.height,
      };
    },

    async process({ bytes, mimeType }) {
      assertSupportedMimeType(mimeType);
      const metadata = await readMetadata(bytes);
      const normalized = normalizedPipeline(bytes, metadata.format);

      let original;
      try {
        original = await normalized.pipeline.toBuffer({ resolveWithObject: true });
      } catch {
        throw new ImageValidationError("The image could not be normalized");
      }
      assertMinimumDimensions(original.info.width, original.info.height);
      const thumbnail = await createThumbnailBuffer(original.data);

      return {
        originalBytes: original.data,
        originalContentType: normalized.contentType,
        originalExtension: normalized.extension,
        thumbnailBytes: thumbnail.data,
        thumbnailContentType: "image/webp",
        width: original.info.width,
        height: original.info.height,
      };
    },
  };
}
