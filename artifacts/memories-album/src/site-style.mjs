import {
  EMPTY_IMAGE_SETTING_METADATA,
  imageSettingMetadata,
  imageSettingUrl,
  normalizeImageSettingMetadata,
  normalizeStoredImageSetting,
  validateImageSettingFile,
} from "./image-setting.mjs";

export const HERO_BACKGROUND_PUBLIC_PATH =
  "/Memories/api/settings/site-style/hero-background";
export const HERO_BACKGROUND_ADMIN_PATH =
  "/admin/api/settings/site-style/hero-background";
export const HERO_BACKGROUND_ACCEPTED_CONTENT_TYPES = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
export const HERO_BACKGROUND_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const HERO_BACKGROUND_OUTPUT_CONTENT_TYPE = "image/webp";
export const HERO_BACKGROUND_OUTPUT_WIDTH = 1600;
export const HERO_BACKGROUND_OUTPUT_HEIGHT = 900;
export const HERO_BACKGROUND_RECOMMENDED_SIZE = "1600 × 900";

export const DEFAULT_SITE_STYLE = Object.freeze({
  paperColor: "#f3eee2",
  paperDeepColor: "#e9e0d0",
  inkColor: "#223b31",
  mutedColor: "#6e776f",
  primaryColor: "#355f4d",
  primarySoftColor: "#dbe2d5",
  detailColor: "#b59657",
  accentColor: "#b96e5d",
  heroTitleColor: "#223b31",
  heroDateColor: "#b96e5d",
  heroSubtitleColor: "#6e776f",
  heroOverlayColor: "#f3eee2",
  heroOverlayOpacity: 0.7,
  bottomNavBackgroundColor: "#fcf8f0",
  bottomNavTextColor: "#6e776f",
  bottomNavActiveBackgroundColor: "#dbe2d5",
});

export const SITE_STYLE_COLOR_FIELDS = Object.freeze([
  "paperColor",
  "paperDeepColor",
  "inkColor",
  "mutedColor",
  "primaryColor",
  "primarySoftColor",
  "detailColor",
  "accentColor",
  "heroTitleColor",
  "heroDateColor",
  "heroSubtitleColor",
  "heroOverlayColor",
  "bottomNavBackgroundColor",
  "bottomNavTextColor",
  "bottomNavActiveBackgroundColor",
]);

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const HERO_EXPECTED_ASSET = Object.freeze({
  contentType: HERO_BACKGROUND_OUTPUT_CONTENT_TYPE,
  width: HERO_BACKGROUND_OUTPUT_WIDTH,
  height: HERO_BACKGROUND_OUTPUT_HEIGHT,
});

function normalizeColor(value, fallback) {
  const color = String(value ?? "").trim().toLowerCase();
  return COLOR_PATTERN.test(color) ? color : fallback;
}

function normalizeOpacity(value) {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SITE_STYLE.heroOverlayOpacity;
  }
  const opacity = Number(value);
  if (!Number.isFinite(opacity)) return DEFAULT_SITE_STYLE.heroOverlayOpacity;
  return Math.round(Math.min(0.95, Math.max(0, opacity)) * 100) / 100;
}

export function normalizeSiteStyle(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalized = {};
  for (const key of SITE_STYLE_COLOR_FIELDS) {
    normalized[key] = normalizeColor(source[key], DEFAULT_SITE_STYLE[key]);
  }
  normalized.heroOverlayOpacity = normalizeOpacity(source.heroOverlayOpacity);
  return normalized;
}

export function isValidSiteStyle(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (
    SITE_STYLE_COLOR_FIELDS.some(
      (key) => !COLOR_PATTERN.test(String(value[key] ?? "").trim()),
    )
  ) {
    return false;
  }
  const opacity = value.heroOverlayOpacity;
  return (
    typeof opacity === "number" &&
    Number.isFinite(opacity) &&
    opacity >= 0 &&
    opacity <= 0.95
  );
}

export function normalizeStoredHeroBackground(value) {
  return normalizeStoredImageSetting(value, HERO_EXPECTED_ASSET);
}

export function normalizeHeroBackgroundMetadata(value) {
  return normalizeImageSettingMetadata(value, HERO_EXPECTED_ASSET);
}

export function heroBackgroundMetadata(value) {
  return imageSettingMetadata(value, HERO_EXPECTED_ASSET);
}

export function validateHeroBackgroundFile(file) {
  return validateImageSettingFile(file, {
    acceptedContentTypes: HERO_BACKGROUND_ACCEPTED_CONTENT_TYPES,
    maxBytes: HERO_BACKGROUND_MAX_UPLOAD_BYTES,
  });
}

export function heroBackgroundUrl(version = null) {
  return imageSettingUrl(HERO_BACKGROUND_PUBLIC_PATH, version);
}

function hexToRgbChannels(hex) {
  const value = normalizeColor(hex, "#000000").slice(1);
  return [0, 2, 4]
    .map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
    .join(" ");
}

export function siteStyleCssVariables(
  style,
  heroBackground = EMPTY_IMAGE_SETTING_METADATA,
) {
  const value = normalizeSiteStyle(style);
  const background = heroBackground?.configured
    ? `url("${heroBackgroundUrl(heroBackground.version)}")`
    : "none";
  const overlayChannels = hexToRgbChannels(value.heroOverlayColor);
  const overlayLayer = `linear-gradient(rgb(${overlayChannels} / ${value.heroOverlayOpacity}), rgb(${overlayChannels} / ${value.heroOverlayOpacity}))`;
  return {
    "--paper": value.paperColor,
    "--paper-deep": value.paperDeepColor,
    "--ink": value.inkColor,
    "--muted": value.mutedColor,
    "--leaf": value.primaryColor,
    "--leaf-soft": value.primarySoftColor,
    "--gold": value.detailColor,
    "--coral": value.accentColor,
    "--line": `rgb(${hexToRgbChannels(value.inkColor)} / 20%)`,
    "--memories-hero-title-color": value.heroTitleColor,
    "--memories-hero-date-color": value.heroDateColor,
    "--memories-hero-subtitle-color": value.heroSubtitleColor,
    "--memories-hero-overlay-color": value.heroOverlayColor,
    "--memories-hero-overlay-opacity": String(value.heroOverlayOpacity),
    "--memories-hero-overlay-layer": overlayLayer,
    "--memories-hero-background-image": background,
    "--memories-bottom-nav-background": value.bottomNavBackgroundColor,
    "--memories-bottom-nav-text": value.bottomNavTextColor,
    "--memories-bottom-nav-active-background": value.bottomNavActiveBackgroundColor,
  };
}

export function applySiteStyle(
  value,
  root = globalThis.document?.documentElement,
) {
  if (!root?.style) return;
  const style = normalizeSiteStyle(value?.siteStyle ?? value);
  const heroBackground = normalizeHeroBackgroundMetadata(
    value?.heroBackground ?? EMPTY_IMAGE_SETTING_METADATA,
  );
  for (const [name, cssValue] of Object.entries(
    siteStyleCssVariables(style, heroBackground),
  )) {
    root.style.setProperty(name, cssValue);
  }
  if (root.dataset) {
    root.dataset.memoriesHeroBackground = heroBackground.configured
      ? "true"
      : "false";
  }
}
