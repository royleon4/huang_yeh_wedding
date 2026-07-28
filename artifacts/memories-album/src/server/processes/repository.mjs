export class PostgresProcessRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async listProcesses() {
    const result = await this.pool.query(
      `SELECT id, label_zh, label_en, display_order, drive_folder_id,
              drive_folder_name, sync_state, last_synced_at
       FROM memories_processes
       WHERE is_active = true
       ORDER BY display_order ASC, id ASC`,
    );
    return result.rows.map(mapRow);
  }

  async upsertDriveProcess(process) {
    const result = await this.pool.query(
      `INSERT INTO memories_processes (
        id, label_zh, label_en, display_order, is_active,
        drive_folder_id, drive_folder_name, sync_state, last_synced_at,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,true,$5,$6,'synced',now(),now(),now())
      ON CONFLICT (id) DO UPDATE SET
        label_zh = EXCLUDED.label_zh,
        label_en = EXCLUDED.label_en,
        display_order = EXCLUDED.display_order,
        is_active = true,
        drive_folder_id = EXCLUDED.drive_folder_id,
        drive_folder_name = EXCLUDED.drive_folder_name,
        sync_state = 'synced',
        last_synced_at = now(),
        updated_at = now()
      RETURNING *`,
      [
        process.id,
        process.labelZh,
        process.labelEn ?? process.labelZh,
        process.displayOrder,
        process.driveFolderId,
        process.driveFolderName,
      ],
    );
    return mapRow(result.rows[0]);
  }

  async deactivateMissingDriveProcesses(activeFolderIds) {
    const ids = Array.from(activeFolderIds ?? []);
    await this.pool.query(
      `UPDATE memories_processes
       SET is_active = false, sync_state = 'missing', updated_at = now()
       WHERE drive_folder_id IS NOT NULL
         AND NOT (drive_folder_id = ANY($1::text[]))`,
      [ids],
    );
  }

  async replacePhotoProcessByDriveFile(driveFileId, processId, parentFolderId) {
    await this.pool.query("BEGIN");
    try {
      const photoResult = await this.pool.query(
        `UPDATE memories_photos
         SET drive_parent_folder_id = $2, updated_at = now()
         WHERE drive_file_id = $1
         RETURNING id`,
        [driveFileId, parentFolderId],
      );
      if (photoResult.rows[0]) {
        const photoId = photoResult.rows[0].id;
        await this.pool.query(
          `DELETE FROM memories_photo_processes WHERE photo_id = $1`,
          [photoId],
        );
        if (processId) {
          await this.pool.query(
            `INSERT INTO memories_photo_processes (photo_id, process_id)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [photoId, processId],
          );
        }
      }
      await this.pool.query("COMMIT");
    } catch (error) {
      await this.pool.query("ROLLBACK");
      throw error;
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
    lastSyncedAt: row.last_synced_at
      ? new Date(row.last_synced_at).toISOString()
      : null,
  };
}
