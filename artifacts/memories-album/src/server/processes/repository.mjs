export class PostgresProcessRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async listProcesses() {
    // Public wedding-process consumers remain Drive-backed. Local labels owned by
    // other albums are deliberately excluded from this compatibility method.
    await this.deactivateLegacyProcesses();
    const result = await this.pool.query(
      `SELECT id, album_id, label_zh, label_en, display_order, drive_folder_id,
              drive_folder_name, sync_state, last_synced_at,
              youtube_video_id, youtube_autoplay
       FROM memories_processes
       WHERE is_active = true
         AND album_id = 'wedding'
       ORDER BY display_order ASC, id ASC`,
    );
    return result.rows.map(mapRow);
  }

  async listLabels({ albumId = null } = {}) {
    await this.deactivateLegacyProcesses();
    const values = [];
    const conditions = ["is_active = true"];
    if (albumId) {
      values.push(String(albumId));
      conditions.push(`album_id = $${values.length}`);
    }
    const result = await this.pool.query(
      `SELECT id, album_id, label_zh, label_en, display_order, drive_folder_id,
              drive_folder_name, sync_state, last_synced_at,
              youtube_video_id, youtube_autoplay
       FROM memories_processes
       WHERE ${conditions.join(" AND ")}
       ORDER BY album_id ASC, display_order ASC, id ASC`,
      values,
    );
    return result.rows.map(mapRow);
  }

  async listEligibleLabelAlbums() {
    const result = await this.pool.query(
      `SELECT id, title_zh, title_en, album_type, display_order
       FROM memories_albums
       WHERE id <> 'guest'
         AND album_type = 'album'
       ORDER BY display_order ASC, id ASC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      titleZh: row.title_zh,
      titleEn: row.title_en,
      albumType: row.album_type,
      displayOrder: row.display_order,
    }));
  }

  async createAlbumLabel({ id, albumId, labelZh, labelEn = "" }) {
    const result = await this.pool.query(
      `INSERT INTO memories_processes (
         id, album_id, label_zh, label_en, display_order, is_active,
         drive_folder_id, drive_folder_name, sync_state, last_synced_at,
         created_at, updated_at
       )
       SELECT
         $1, album.id, $3, $4,
         COALESCE((
           SELECT MAX(existing.display_order) + 1
           FROM memories_processes existing
           WHERE existing.album_id = album.id
             AND existing.is_active = true
         ), 1),
         true, NULL, NULL, 'local', now(), now(), now()
       FROM memories_albums album
       WHERE album.id = $2
         AND album.id <> 'guest'
         AND album.album_type = 'album'
       RETURNING id, album_id, label_zh, label_en, display_order,
                 drive_folder_id, drive_folder_name, sync_state,
                 last_synced_at, is_active, youtube_video_id,
                 youtube_autoplay`,
      [id, albumId, labelZh, labelEn || labelZh],
    );
    if (!result.rows[0]) {
      const error = new Error("Album cannot contain photo labels");
      error.status = 422;
      error.code = "INVALID_LABEL_ALBUM";
      throw error;
    }
    return mapRow(result.rows[0]);
  }

  async updateAlbumLabel(id, { labelZh, labelEn = "" }) {
    const result = await this.pool.query(
      `UPDATE memories_processes
       SET label_zh = $2,
           label_en = $3,
           updated_at = now()
       WHERE id = $1
         AND album_id <> 'wedding'
         AND album_id <> 'guest'
         AND is_active = true
       RETURNING id, album_id, label_zh, label_en, display_order,
                 drive_folder_id, drive_folder_name, sync_state,
                 last_synced_at, is_active, youtube_video_id,
                 youtube_autoplay`,
      [id, labelZh, labelEn || labelZh],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async findProcessById(id) {
    const result = await this.pool.query(
      `SELECT id, album_id, label_zh, label_en, display_order, drive_folder_id,
              drive_folder_name, sync_state, last_synced_at, is_active,
              youtube_video_id, youtube_autoplay
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
        id, album_id, label_zh, label_en, display_order, is_active,
        drive_folder_id, drive_folder_name, sync_state, last_synced_at,
        created_at, updated_at
      ) VALUES ($1,'wedding',$2,$3,$4,true,$5,$6,'synced',now(),now(),now())
      ON CONFLICT (id) DO UPDATE SET
        album_id = 'wedding',
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
      RETURNING id, album_id, label_zh, label_en, display_order,
                drive_folder_id, drive_folder_name, sync_state,
                last_synced_at, is_active, youtube_video_id,
                youtube_autoplay`,
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
       WHERE id = $1
         AND album_id = 'wedding'
         AND is_active = true
       RETURNING id, album_id, label_zh, label_en, display_order,
                 drive_folder_id, drive_folder_name, sync_state,
                 last_synced_at, is_active, youtube_video_id,
                 youtube_autoplay`,
      [id, labelEn],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async updateProcessVideo(id, { youtubeVideoId = null, youtubeAutoplay = false }) {
    const result = await this.pool.query(
      `UPDATE memories_processes
       SET youtube_video_id = $2,
           youtube_autoplay = $3,
           updated_at = now()
       WHERE id = $1
         AND album_id = 'wedding'
         AND is_active = true
       RETURNING id, album_id, label_zh, label_en, display_order,
                 drive_folder_id, drive_folder_name, sync_state,
                 last_synced_at, is_active, youtube_video_id,
                 youtube_autoplay`,
      [id, youtubeVideoId, Boolean(youtubeAutoplay)],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async deactivateLegacyProcesses() {
    return this.#deactivateMatching(
      `is_active = true
       AND album_id = 'wedding'
       AND drive_folder_id IS NULL`,
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
       AND album_id = 'wedding'
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
         RETURNING id, album_id, label_zh, label_en, display_order,
                   drive_folder_id, drive_folder_name, sync_state,
                   last_synced_at, is_active, youtube_video_id,
                   youtube_autoplay`,
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
    albumId: row.album_id ?? "wedding",
    labelZh: row.label_zh,
    labelEn: row.label_en,
    displayOrder: row.display_order,
    driveFolderId: row.drive_folder_id,
    driveFolderName: row.drive_folder_name,
    syncState: row.sync_state,
    isActive: row.is_active !== false,
    youtubeVideoId: row.youtube_video_id ?? null,
    youtubeAutoplay: Boolean(row.youtube_autoplay),
    lastSyncedAt: row.last_synced_at
      ? new Date(row.last_synced_at).toISOString()
      : null,
  };
}
