import sharp from "sharp";
import {
  HERO_BACKGROUND_ACCEPTED_CONTENT_TYPES,
  HERO_BACKGROUND_ADMIN_PATH,
  HERO_BACKGROUND_MAX_UPLOAD_BYTES,
  HERO_BACKGROUND_OUTPUT_CONTENT_TYPE,
  HERO_BACKGROUND_OUTPUT_HEIGHT,
  HERO_BACKGROUND_OUTPUT_WIDTH,
  HERO_BACKGROUND_PUBLIC_PATH,
  heroBackgroundMetadata,
  normalizeStoredHeroBackground,
} from "../../site-style.mjs";
import {
  createAdminImageAssetApi,
  createPublicImageAssetApi,
  storedImageAsset,
} from "../settings/image-asset-api.mjs";

function heroBackgroundError(reason) {
  const error = new Error(
    reason === "too-large"
      ? "Hero background is too large"
      : reason === "required"
        ? "Hero background file is required"
        : "The selected file is not a valid supported hero background",
  );
  error.status =
    reason === "too-large" ? 413 : reason === "unsupported-type" ? 415 : 422;
  error.code =
    reason === "too-large"
      ? "HERO_BACKGROUND_TOO_LARGE"
      : reason === "required"
        ? "HERO_BACKGROUND_REQUIRED"
        : reason === "unsupported-type"
          ? "UNSUPPORTED_HERO_BACKGROUND_TYPE"
          : "INVALID_HERO_BACKGROUND";
  return error;
}

async function normalizeHeroBackground(input) {
  try {
    const buffer = await sharp(input, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize(HERO_BACKGROUND_OUTPUT_WIDTH, HERO_BACKGROUND_OUTPUT_HEIGHT, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: false,
      })
      .webp({ quality: 84, effort: 5 })
      .toBuffer();
    return storedImageAsset(buffer, {
      contentType: HERO_BACKGROUND_OUTPUT_CONTENT_TYPE,
      width: HERO_BACKGROUND_OUTPUT_WIDTH,
      height: HERO_BACKGROUND_OUTPUT_HEIGHT,
    });
  } catch {
    throw heroBackgroundError("invalid");
  }
}

export function createHeroBackgroundApi({ repository }) {
  if (typeof repository?.getHeroBackground !== "function") {
    return async () => false;
  }
  return createPublicImageAssetApi({
    path: HERO_BACKGROUND_PUBLIC_PATH,
    load: () => repository.getHeroBackground(),
    normalizeStored: normalizeStoredHeroBackground,
  });
}

export function createAdminHeroBackgroundApi({ repository }) {
  if (
    typeof repository?.getHeroBackground !== "function" ||
    typeof repository?.setHeroBackground !== "function" ||
    typeof repository?.clearHeroBackground !== "function"
  ) {
    return async () => false;
  }
  return createAdminImageAssetApi({
    path: HERO_BACKGROUND_ADMIN_PATH,
    load: () => repository.getHeroBackground(),
    save: (value) => repository.setHeroBackground(value),
    clear: () => repository.clearHeroBackground(),
    normalizeStored: normalizeStoredHeroBackground,
    metadata: heroBackgroundMetadata,
    acceptedContentTypes: HERO_BACKGROUND_ACCEPTED_CONTENT_TYPES,
    maxUploadBytes: HERO_BACKGROUND_MAX_UPLOAD_BYTES,
    normalizeUpload: normalizeHeroBackground,
    errorFactory: heroBackgroundError,
    unsupportedMessage: "Hero background must be PNG, JPEG, or WebP",
    fallbackMessage: "Unable to save hero background",
  });
}
