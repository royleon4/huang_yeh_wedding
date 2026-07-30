const NAVIGATION_KEY = "primary_navigation_visible";
const GUEST_UPLOAD_CATEGORY_SELECTION_KEY =
  "guest_upload_category_selection_enabled";
const PROCESS_WHEEL_ENABLED_KEY = "process_wheel_enabled";

function booleanSetting(rows, key, fallback) {
  const row = rows.find((item) => item.key === key);
  return row ? row.value === true : fallback;
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
}
