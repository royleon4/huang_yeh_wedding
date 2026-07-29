export class PostgresProcessRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async listProcesses() {
    // Old bundled process rows never had a Drive folder id. Drive is now the
    // canonical source, so hide those legacy rows immediately even when Drive
    // is temporarily unavailable. This prevents duplicate/ghost categories.
    await this.deactivateLegacyProcesses();
    const result = await this.pool.query(
      `SELECT id, label_zh, label_en, display_order, drive_folder_id,
              drive_folder_name, sync_state, last_synced_at
       FROM memories_processes
       WHERE is_active = true
       ORDER BY display_order ASC, id ASC`,
    );
    return result.rows.map(mapRow);
  }

  async findProcessById(id) {
    const result = await this.pool.query(
      `SELECT id, label_zh, label_en, display_order, drive_folder_id,
              drive_folder_name, sync_state, last_synced_at, is_active
       FROM memories_processes
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async upsertDriveProcess(process) {
    const existing = await this.pool.query(
      `SELECT id FROM memories_processes WHERE drive_folder_id = $1 LIMIT 1`,
      [process.driveFolderId],
    );
    const effectiveId = existing.rows[0]?.id ?? process.id;
    const result = await this.pool.query(
      `INSERT INTO memories_processes (
        id, label_zh, label_en, display_order, is_active,
        drive_folder_id, drive_folder_name, sync_state, last_synced_at,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,true,$5,$6,'synced',now(),now(),now())
      ON CONFLICT (id) DO UPDATE SET
        label_zh = EXCLUDED.label_zh,
        label_en = CASE
          WHEN memories_processes.label_en = memories_processes.label_zh
            OR memories_processes.label_en = ''
          THEN EXCLUDED.label_en
          ELSE memories_processes.label_en
        END,
        display_order = EXCLUDED.display_order,
        is_active = true,
        drive_folder_id = EXCLUDED.drive_folder_id,
        drive_folder_name = EXCLUDED.drive_folder_name,
        sync_state = 'synced',
        last_synced_at = now(),
        updated_at = now()
      RETURNING *`,
      [
        effectiveId,
        process.labelZh,
        process.labelEn ?? process.labelZh,
        process.displayOrder,
        process.driveFolderId,
        process.driveFolderName,
      ],
    );
    return mapRow(result.rows[0]);
  }

  async updateProcessLabelEn(id, labelEn) {
    const result = await this.pool.query(
      `UPDATE memories_processes
       SET label_en = $2, updated_at = now()
       WHERE id = $1 AND is_active = true
       RETURNING id, label_zh, label_en, display_order, drive_folder_id,
                 drive_folder_name, sync_state, last_synced_at, is_active`,
      [id, labelEn],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async deactivateLegacyProcesses() {
    return this.#deactivateMatching(
      `is_active = true AND drive_folder_id IS NULL`,
      [],
      "legacy",
    );
  }

  async deactivateProcess(id, syncState = "deleted") {
    const deactivated = await this.#deactivateMatching(
      `id = $1`,
      [id],
      syncState,
    );
    return deactivated[0] ?? null;
  }

  async deactivateMissingDriveProcesses(activeFolderIds) {
    const ids = Array.from(activeFolderIds ?? []);
    return this.#deactivateMatching(
      `is_active = true
       AND (drive_folder_id IS NULL OR NOT (drive_folder_id = ANY($1::text[])))`,
      [ids],
      "missing",
    );
  }

  async #deactivateMatching(condition, values, syncState) {
    const client =
      typeof this.pool.connect === "function"
        ? await this.pool.connect()
        : this.pool;
    try {
      await client.query("BEGIN");
      const stateParameter = values.length + 1;
      const result = await client.query(
        `UPDATE memories_processes
         SET is_active = false,
             sync_state = $${stateParameter},
             updated_at = now()
         WHERE ${condition}
         RETURNING id, label_zh, label_en, display_order, drive_folder_id,
                   drive_folder_name, sync_state, last_synced_at, is_active`,
        [...values, syncState],
      );
      const processIds = result.rows.map((row) => row.id);
      if (processIds.length > 0) {
        await client.query(
          `DELETE FROM memories_photo_processes
           WHERE process_id = ANY($1::text[])`,
          [processIds],
        );
      }
      await client.query("COMMIT");
      return result.rows.map(mapRow);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release?.();
    }
  }
}

function mapRow(row) {
  return {
    id: row.id,
    labelZh: row.label_zh,
    labelEn: row.label_en,
    displayOrder: row.display_order,
    driveFolderId: row.drive_folder_id,
    driveFolderName: row.drive_folder_name,
    syncState: row.sync_state,
    isActive: row.is_active !== false,
    lastSyncedAt: row.last_synced_at
      ? new Date(row.last_synced_at).toISOString()
      : null,
  };
}
