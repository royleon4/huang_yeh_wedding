const NAVIGATION_KEY = "primary_navigation_visible";
const ALBUM_OPEN_KEY = "album_open";

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
      [[NAVIGATION_KEY, ALBUM_OPEN_KEY]],
    );
    const values = new Map(result.rows.map((row) => [row.key, row.value]));
    return {
      primaryNavigationVisible: values.get(NAVIGATION_KEY) === true,
      albumOpen: values.get(ALBUM_OPEN_KEY) !== false,
    };
  }

  async updateSettings(patch) {
    const entries = [];
    if (typeof patch.primaryNavigationVisible === "boolean") {
      entries.push([NAVIGATION_KEY, patch.primaryNavigationVisible]);
    }
    if (typeof patch.albumOpen === "boolean") {
      entries.push([ALBUM_OPEN_KEY, patch.albumOpen]);
    }
    for (const [key, value] of entries) {
      await this.pool.query(
        `INSERT INTO memories_app_settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_at = now()`,
        [key, JSON.stringify(value)],
      );
    }
    return this.getPublicSettings();
  }
}
