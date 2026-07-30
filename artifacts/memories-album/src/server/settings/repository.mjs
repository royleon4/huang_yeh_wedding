import {
  DEFAULT_GALLERY_MEDIA_ORDER,
  normalizeGalleryMediaOrder,
} from "./media-order.mjs";
import { normalizePinnedPhotosByProcess } from "../../pinned-photo-settings.mjs";

const NAVIGATION_KEY = "primary_navigation_visible";
const GUEST_UPLOAD_CATEGORY_SELECTION_KEY =
  "guest_upload_category_selection_enabled";
const PROCESS_WHEEL_ENABLED_KEY = "process_wheel_enabled";
const PROCESS_WHEEL_VISIBLE_COUNT_KEY = "process_wheel_visible_count";
const GALLERY_MEDIA_ORDER_KEY = "gallery_media_order";
const PINNED_PHOTOS_BY_PROCESS_KEY = "pinned_photos_by_process";

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
    };
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
