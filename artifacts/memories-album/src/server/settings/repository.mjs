import {
  DEFAULT_GALLERY_MEDIA_ORDER,
  normalizeGalleryMediaOrder,
} from "./media-order.mjs";
import { normalizePinnedPhotosByProcess } from "../../pinned-photo-settings.mjs";
import { normalizeSiteCopy } from "../../site-copy.mjs";
import {
  DEFAULT_UPLOAD_SETTINGS,
  normalizeUploadDescription,
} from "../../upload-settings.mjs";
import {
  DEFAULT_GUEST_LATEST_PHOTO_COUNT,
  DEFAULT_GUEST_UPLOADER_LABELS_VISIBLE,
  mergeGuestUploaderLabelOrder,
  normalizeGuestLatestPhotoCount,
  normalizeGuestUploaderLabel,
  normalizeGuestUploaderLabelOrder,
} from "../../guest-label-settings.mjs";
import {
  DEFAULT_DRIVE_UPLOAD_MODE,
  normalizeDriveUploadMode,
} from "./upload-mode.mjs";

const NAVIGATION_KEY = "primary_navigation_visible";
const GUEST_UPLOAD_CATEGORY_SELECTION_KEY =
  "guest_upload_category_selection_enabled";
const GUEST_UPLOAD_MAX_PHOTOS_KEY = "guest_upload_max_photos";
const ADMIN_UPLOAD_MAX_PHOTOS_KEY = "admin_upload_max_photos";
const UPLOAD_DESCRIPTION_KEY = "upload_description";
const PROCESS_WHEEL_ENABLED_KEY = "process_wheel_enabled";
const PROCESS_WHEEL_VISIBLE_COUNT_KEY = "process_wheel_visible_count";
const GALLERY_MEDIA_ORDER_KEY = "gallery_media_order";
const PINNED_PHOTOS_BY_PROCESS_KEY = "pinned_photos_by_process";
const DRIVE_UPLOAD_MODE_KEY = "drive_upload_mode";
const SITE_COPY_KEY = "site_copy";
const GUEST_UPLOADER_LABELS_VISIBLE_KEY = "guest_uploader_labels_visible";
const GUEST_UPLOADER_LABEL_ORDER_KEY = "guest_uploader_label_order";
const GUEST_LATEST_PHOTO_COUNT_KEY = "guest_latest_photo_count";

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

function siteCopySetting(rows) {
  const row = rows.find((item) => item.key === SITE_COPY_KEY);
  return normalizeSiteCopy(row?.value);
}

function uploadDescriptionSetting(rows) {
  const row = rows.find((item) => item.key === UPLOAD_DESCRIPTION_KEY);
  return normalizeUploadDescription(row?.value);
}

function guestUploaderLabelOrderSetting(rows, currentLabels) {
  const row = rows.find((item) => item.key === GUEST_UPLOADER_LABEL_ORDER_KEY);
  return mergeGuestUploaderLabelOrder(row?.value, currentLabels);
}

export class PostgresSettingsRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async listGuestUploaderLabels() {
    const result = await this.pool.query(
      `SELECT p.uploader_name,
              MIN(p.created_at) AS first_seen,
              MIN(p.id::text) AS stable_id
       FROM memories_photos p
       INNER JOIN memories_photo_albums mpa
         ON mpa.photo_id = p.id AND mpa.album_id = 'guest'
       WHERE p.visibility <> 'trashed'
         AND p.uploader_name IS NOT NULL
         AND btrim(p.uploader_name) <> ''
       GROUP BY p.uploader_name
       ORDER BY MIN(p.created_at) ASC, MIN(p.id::text) ASC`,
    );
    return normalizeGuestUploaderLabelOrder(
      result.rows.map((row) => normalizeGuestUploaderLabel(row.uploader_name)),
    );
  }

  async getPublicSettings() {
    const [result, currentLabels] = await Promise.all([
      this.pool.query(
        `SELECT key, value
         FROM memories_app_settings
         WHERE key = ANY($1::text[])`,
        [[
          NAVIGATION_KEY,
          GUEST_UPLOAD_CATEGORY_SELECTION_KEY,
          GUEST_UPLOAD_MAX_PHOTOS_KEY,
          ADMIN_UPLOAD_MAX_PHOTOS_KEY,
          UPLOAD_DESCRIPTION_KEY,
          PROCESS_WHEEL_ENABLED_KEY,
          PROCESS_WHEEL_VISIBLE_COUNT_KEY,
          GALLERY_MEDIA_ORDER_KEY,
          PINNED_PHOTOS_BY_PROCESS_KEY,
          DRIVE_UPLOAD_MODE_KEY,
          SITE_COPY_KEY,
          GUEST_UPLOADER_LABELS_VISIBLE_KEY,
          GUEST_UPLOADER_LABEL_ORDER_KEY,
          GUEST_LATEST_PHOTO_COUNT_KEY,
        ]],
      ),
      this.listGuestUploaderLabels(),
    ]);
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
      guestUploadMaxPhotos: integerSetting(
        result.rows,
        GUEST_UPLOAD_MAX_PHOTOS_KEY,
        DEFAULT_UPLOAD_SETTINGS.guestUploadMaxPhotos,
      ),
      adminUploadMaxPhotos: integerSetting(
        result.rows,
        ADMIN_UPLOAD_MAX_PHOTOS_KEY,
        DEFAULT_UPLOAD_SETTINGS.adminUploadMaxPhotos,
      ),
      uploadDescription: uploadDescriptionSetting(result.rows),
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
      siteCopy: siteCopySetting(result.rows),
      guestUploaderLabelsVisible: booleanSetting(
        result.rows,
        GUEST_UPLOADER_LABELS_VISIBLE_KEY,
        DEFAULT_GUEST_UPLOADER_LABELS_VISIBLE,
      ),
      guestUploaderLabelOrder: guestUploaderLabelOrderSetting(
        result.rows,
        currentLabels,
      ),
      guestLatestPhotoCount: normalizeGuestLatestPhotoCount(
        integerSetting(
          result.rows,
          GUEST_LATEST_PHOTO_COUNT_KEY,
          DEFAULT_GUEST_LATEST_PHOTO_COUNT,
        ),
      ),
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

  async setGuestUploadMaxPhotos(value) {
    return this.setNumber(
      GUEST_UPLOAD_MAX_PHOTOS_KEY,
      "guestUploadMaxPhotos",
      value,
    );
  }

  async setAdminUploadMaxPhotos(value) {
    return this.setNumber(
      ADMIN_UPLOAD_MAX_PHOTOS_KEY,
      "adminUploadMaxPhotos",
      value,
    );
  }

  async setUploadDescription(value) {
    return this.setJson(
      UPLOAD_DESCRIPTION_KEY,
      "uploadDescription",
      normalizeUploadDescription(value),
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

  async setSiteCopy(value) {
    return this.setJson(SITE_COPY_KEY, "siteCopy", normalizeSiteCopy(value));
  }

  async setGuestUploaderLabelsVisible(value) {
    return this.setBoolean(
      GUEST_UPLOADER_LABELS_VISIBLE_KEY,
      "guestUploaderLabelsVisible",
      value,
    );
  }

  async setGuestUploaderLabelOrder(value) {
    return this.setJson(
      GUEST_UPLOADER_LABEL_ORDER_KEY,
      "guestUploaderLabelOrder",
      normalizeGuestUploaderLabelOrder(value),
    );
  }

  async setGuestLatestPhotoCount(value) {
    return this.setNumber(
      GUEST_LATEST_PHOTO_COUNT_KEY,
      "guestLatestPhotoCount",
      normalizeGuestLatestPhotoCount(value),
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
