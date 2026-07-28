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

export class ImageValidationError extends Error {
  constructor(message, code = "INVALID_IMAGE") {
    super(message);
    this.name = "ImageValidationError";
    this.code = code;
  }
}

export function createImageProcessor() {
  return {
    async process({ bytes, mimeType }) {
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new ImageValidationError(
          "Unsupported image type",
          "UNSUPPORTED_IMAGE_TYPE",
        );
      }

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
        normalized = await originalPipeline.toBuffer({ resolveWithObject: true });
      } catch {
        throw new ImageValidationError("The image could not be normalized");
      }

      if (
        normalized.info.width < MIN_DIMENSION ||
        normalized.info.height < MIN_DIMENSION
      ) {
        throw new ImageValidationError("Image dimensions are too small");
      }

      const thumbnailBytes = await sharp(normalized.data, {
        failOn: "error",
        limitInputPixels: MAX_PIXELS,
      })
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();

      return {
        originalBytes: normalized.data,
        originalContentType,
        originalExtension,
        thumbnailBytes,
        thumbnailContentType: "image/webp",
        width: normalized.info.width,
        height: normalized.info.height,
      };
    },
  };
}
