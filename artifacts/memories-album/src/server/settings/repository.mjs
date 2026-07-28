const NAVIGATION_KEY = "primary_navigation_visible";

export class PostgresSettingsRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async getPublicSettings() {
    const result = await this.pool.query(
      `SELECT value FROM memories_app_settings WHERE key = $1`,
      [NAVIGATION_KEY],
    );
    return {
      primaryNavigationVisible: result.rows[0]?.value === true,
    };
  }

  async setPrimaryNavigationVisible(value) {
    const visible = value === true;
    await this.pool.query(
      `INSERT INTO memories_app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = now()`,
      [NAVIGATION_KEY, JSON.stringify(visible)],
    );
    return { primaryNavigationVisible: visible };
  }
}
