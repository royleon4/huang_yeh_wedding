const NAVIGATION_KEY = "primary_navigation_visible";
const GUEST_UPLOAD_CATEGORY_SELECTION_KEY =
  "guest_upload_category_selection_enabled";
const PROCESS_WHEEL_ENABLED_KEY = "process_wheel_enabled";
const PROCESS_WHEEL_VISIBLE_COUNT_KEY = "process_wheel_visible_count";

function booleanSetting(rows, key, fallback) {
  const row = rows.find((item) => item.key === key);
  return row ? row.value === true : fallback;
}

function integerSetting(rows, key, fallback) {
  const row = rows.find((item) => item.key === key);
  const value = Number(row?.value);
  return Number.isInteger(value) ? value : fallback;
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

  async setBoolean(key, responseKey, value) {
    const enabled = value === true;
    await this.pool.query(
      `INSERT INTO memories_app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = now()`,
      [key, JSON.stringify(enabled)],
    );
    return { [responseKey]: enabled };
  }

  async setNumber(key, responseKey, value) {
    const number = Number(value);
    await this.pool.query(
      `INSERT INTO memories_app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = now()`,
      [key, JSON.stringify(number)],
    );
    return { [responseKey]: number };
  }
}
