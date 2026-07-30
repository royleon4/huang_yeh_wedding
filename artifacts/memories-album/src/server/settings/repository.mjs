import {
  DEFAULT_GALLERY_MEDIA_ORDER,
  normalizeGalleryMediaOrder,
} from "./media-order.mjs";
import { normalizePinnedPhotosByProcess } from "../../pinned-photo-settings.mjs";
import {
  DEFAULT_DRIVE_UPLOAD_MODE,
  normalizeDriveUploadMode,
} from "./upload-mode.mjs";

const NAVIGATION_KEY = "primary_navigation_visible";
const GUEST_UPLOAD_CATEGORY_SELECTION_KEY =
  "guest_upload_category_selection_enabled";
const PROCESS_WHEEL_ENABLED_KEY = "process_wheel_enabled";
const PROCESS_WHEEL_VISIBLE_COUNT_KEY = "process_wheel_visible_count";
const GALLERY_MEDIA_ORDER_KEY = "gallery_media_order";
const PINNED_PHOTOS_BY_PROCESS_KEY = "pinned_photos_by_process";
const DRIVE_UPLOAD_MODE_KEY = "drive_upload_mode";

function booleanSetting(rows, key, fallback) {
  const row = rows.find((item) => item.key === key);
  return row ? row.value === true : fallback;
}

function integerSetting(rows, key, fallback) {
  const row = rows.find((item) => item.key === key);
  const value = Number(row?.value);
  return Number.isInteger(value) ? value : fallback;
}

function mediaOrderSetting(rows) {
  const row = rows.find((item) => item.key === GALLERY_MEDIA_ORDER_KEY);
  return normalizeGalleryMediaOrder(row?.value ?? DEFAULT_GALLERY_MEDIA_ORDER);
}

function pinnedPhotosSetting(rows) {
  const row = rows.find((item) => item.key === PINNED_PHOTOS_BY_PROCESS_KEY);
  return normalizePinnedPhotosByProcess(row?.value);
}

function driveUploadModeSetting(rows) {
  const row = rows.find((item) => item.key === DRIVE_UPLOAD_MODE_KEY);
  return normalizeDriveUploadMode(row?.value ?? DEFAULT_DRIVE_UPLOAD_MODE);
}

export class PostgresSettingsRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async getPublicSettings() {
    const result = await this.pool.query(
      `SELECT key, value
       FROM memories_app_settings
       WHERE key = ANY($1::text[])`,
      [[
        NAVIGATION_KEY,
        GUEST_UPLOAD_CATEGORY_SELECTION_KEY,
        PROCESS_WHEEL_ENABLED_KEY,
        PROCESS_WHEEL_VISIBLE_COUNT_KEY,
        GALLERY_MEDIA_ORDER_KEY,
        PINNED_PHOTOS_BY_PROCESS_KEY,
        DRIVE_UPLOAD_MODE_KEY,
      ]],
    );
    return {
      primaryNavigationVisible: booleanSetting(
        result.rows,
        NAVIGATION_KEY,
        false,
      ),
      guestUploadCategorySelectionEnabled: booleanSetting(
        result.rows,
        GUEST_UPLOAD_CATEGORY_SELECTION_KEY,
        true,
      ),
      processWheelEnabled: booleanSetting(
        result.rows,
        PROCESS_WHEEL_ENABLED_KEY,
        false,
      ),
      processWheelVisibleCount: integerSetting(
        result.rows,
        PROCESS_WHEEL_VISIBLE_COUNT_KEY,
        6,
      ),
      galleryMediaOrder: mediaOrderSetting(result.rows),
      pinnedPhotoIdsByProcess: pinnedPhotosSetting(result.rows),
      driveUploadMode: driveUploadModeSetting(result.rows),
    };
  }

  async getDriveUploadMode() {
    const result = await this.pool.query(
      `SELECT key, value
       FROM memories_app_settings
       WHERE key = $1
       LIMIT 1`,
      [DRIVE_UPLOAD_MODE_KEY],
    );
    return driveUploadModeSetting(result.rows);
  }

  async setPrimaryNavigationVisible(value) {
    return this.setBoolean(
      NAVIGATION_KEY,
      "primaryNavigationVisible",
      value,
    );
  }

  async setGuestUploadCategorySelectionEnabled(value) {
    return this.setBoolean(
      GUEST_UPLOAD_CATEGORY_SELECTION_KEY,
      "guestUploadCategorySelectionEnabled",
      value,
    );
  }

  async setProcessWheelEnabled(value) {
    return this.setBoolean(
      PROCESS_WHEEL_ENABLED_KEY,
      "processWheelEnabled",
      value,
    );
  }

  async setProcessWheelVisibleCount(value) {
    return this.setNumber(
      PROCESS_WHEEL_VISIBLE_COUNT_KEY,
      "processWheelVisibleCount",
      value,
    );
  }

  async setGalleryMediaOrder(value) {
    return this.setJson(
      GALLERY_MEDIA_ORDER_KEY,
      "galleryMediaOrder",
      normalizeGalleryMediaOrder(value),
    );
  }

  async setPinnedPhotoIdsByProcess(value) {
    return this.setJson(
      PINNED_PHOTOS_BY_PROCESS_KEY,
      "pinnedPhotoIdsByProcess",
      normalizePinnedPhotosByProcess(value),
    );
  }

  async setDriveUploadMode(value) {
    return this.setJson(
      DRIVE_UPLOAD_MODE_KEY,
      "driveUploadMode",
      normalizeDriveUploadMode(value),
    );
  }

  async setBoolean(key, responseKey, value) {
    return this.setJson(key, responseKey, value === true);
  }

  async setNumber(key, responseKey, value) {
    return this.setJson(key, responseKey, Number(value));
  }

  async setJson(key, responseKey, value) {
    await this.pool.query(
      `INSERT INTO memories_app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = now()`,
      [key, JSON.stringify(value)],
    );
    return { [responseKey]: value };
  }
}
