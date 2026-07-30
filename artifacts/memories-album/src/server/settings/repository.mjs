const NAVIGATION_KEY = "primary_navigation_visible";
const GUEST_UPLOAD_CATEGORY_SELECTION_KEY =
  "guest_upload_category_selection_enabled";

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
      [[NAVIGATION_KEY, GUEST_UPLOAD_CATEGORY_SELECTION_KEY]],
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
