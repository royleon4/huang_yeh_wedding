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

async function readMetadata(bytes) {
  let metadata;
  try {
    metadata = await sharp(bytes, {
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

async function createThumbnailBuffer(bytes) {
  try {
    return await sharp(bytes, {
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
    async sanitizePublicMedia({ bytes, mimeType }) {
      assertSupportedMimeType(mimeType);
      const metadata = await readMetadata(bytes);
      const image = sharp(bytes, {
        failOn: "error",
        limitInputPixels: MAX_PIXELS,
        sequentialRead: true,
      }).rotate();
      let pipeline;
      let contentType;
      if (metadata.format === "png") {
        pipeline = image.png({ compressionLevel: 9, adaptiveFiltering: true });
        contentType = "image/png";
      } else if (metadata.format === "webp") {
        pipeline = image.webp({ quality: 92, effort: 4 });
        contentType = "image/webp";
      } else {
        pipeline = image.jpeg({ quality: 92, mozjpeg: true });
        contentType = "image/jpeg";
      }
      try {
        const result = await pipeline.toBuffer({ resolveWithObject: true });
        return {
          bytes: result.data,
          contentType,
          width: result.info.width,
          height: result.info.height,
        };
      } catch {
        throw new ImageValidationError(
          "The public image could not be sanitized",
        );
      }
    },

    async createDisplayVariant({ bytes, width }) {
      const boundedWidth = Math.max(160, Math.min(Number(width) || 960, 960));
      try {
        const result = await sharp(bytes, {
          failOn: "error",
          limitInputPixels: MAX_PIXELS,
          sequentialRead: true,
        })
          .rotate()
          .resize({
            width: boundedWidth,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 78, effort: 4 })
          .toBuffer({ resolveWithObject: true });
        return {
          bytes: result.data,
          contentType: "image/webp",
          width: result.info.width,
          height: result.info.height,
        };
      } catch {
        throw new ImageValidationError(
          "The responsive thumbnail could not be generated",
        );
      }
    },

    async createThumbnail({ bytes, mimeType }) {
      assertSupportedMimeType(mimeType);
      const metadata = await readMetadata(bytes);
      if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
        throw new ImageValidationError("Image dimensions are too small");
      }
      const thumbnail = await createThumbnailBuffer(bytes);
      return {
        thumbnailBytes: thumbnail.data,
        thumbnailContentType: "image/webp",
        thumbnailWidth: thumbnail.info.width,
        thumbnailHeight: thumbnail.info.height,
      };
    },

    async process({ bytes, mimeType }) {
      assertSupportedMimeType(mimeType);
      const metadata = await readMetadata(bytes);

      const input = sharp(bytes, {
        failOn: "error",
        limitInputPixels: MAX_PIXELS,
        sequentialRead: true,
      }).rotate();

      let originalPipeline;
      let originalContentType;
      let originalExtension;
      if (metadata.format === "png") {
        originalPipeline = input.clone().png({
          compressionLevel: 9,
          adaptiveFiltering: true,
        });
        originalContentType = "image/png";
        originalExtension = "png";
      } else if (metadata.format === "webp") {
        originalPipeline = input.clone().webp({ quality: 95, effort: 4 });
        originalContentType = "image/webp";
        originalExtension = "webp";
      } else {
        originalPipeline = input.clone().jpeg({ quality: 95, mozjpeg: true });
        originalContentType = "image/jpeg";
        originalExtension = "jpg";
      }

      let normalized;
      try {
        normalized = await originalPipeline.toBuffer({
          resolveWithObject: true,
        });
      } catch {
        throw new ImageValidationError("The image could not be normalized");
      }

      if (
        normalized.info.width < MIN_DIMENSION ||
        normalized.info.height < MIN_DIMENSION
      ) {
        throw new ImageValidationError("Image dimensions are too small");
      }

      const thumbnail = await createThumbnailBuffer(normalized.data);

      return {
        originalBytes: normalized.data,
        originalContentType,
        originalExtension,
        thumbnailBytes: thumbnail.data,
        thumbnailContentType: "image/webp",
        width: normalized.info.width,
        height: normalized.info.height,
      };
    },
  };
}
