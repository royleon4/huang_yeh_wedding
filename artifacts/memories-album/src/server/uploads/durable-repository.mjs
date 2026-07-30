const DEFAULT_LEASE_MS = 2 * 60 * 1000;
const SESSION_PROGRESS_LEASE_MS = 5 * 60 * 1000;

function mapItem(row) {
  return {
    batchId: row.batch_id,
    clientUploadId: row.client_upload_id,
    photoId: row.photo_id,
    contentHash: row.content_hash,
    originalFilename: row.original_filename,
    originalDriveFileId: row.original_drive_file_id,
    thumbnailDriveFileId: row.thumbnail_drive_file_id,
    originalUploadSessionUri: row.original_upload_session_uri ?? null,
    originalUploadOffset: Number(row.original_upload_offset ?? 0),
    originalUploadSessionUpdatedAt: row.original_upload_session_updated_at
      ? new Date(row.original_upload_session_updated_at).toISOString()
      : null,
    status: row.status,
    attemptCount: Number(row.attempt_count ?? 0),
    leaseExpiresAt: row.lease_expires_at
      ? new Date(row.lease_expires_at).toISOString()
      : null,
    lastErrorCode: row.last_error_code,
  };
}

export class PostgresDurableUploadRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async claim({
    batchId,
    clientUploadId,
    contentHash,
    originalFilename,
    photoId,
    now = new Date(),
    leaseMs = DEFAULT_LEASE_MS,
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const existingPhoto = await client.query(
        `SELECT id
         FROM memories_photos
         WHERE batch_id = $1
           AND (client_upload_id = $2 OR content_hash = $3)
         ORDER BY created_at ASC
         LIMIT 1`,
        [batchId, clientUploadId, contentHash],
      );
      if (existingPhoto.rows[0]) {
        const existingPhotoId = existingPhoto.rows[0].id;
        await client.query(
          `UPDATE memories_photos
           SET client_upload_id = COALESCE(client_upload_id, $3), updated_at = now()
           WHERE id = $1 AND batch_id = $2`,
          [existingPhotoId, batchId, clientUploadId],
        );
        await client.query(
          `INSERT INTO memories_upload_items (
             batch_id, client_upload_id, photo_id, content_hash,
             original_filename, status, updated_at
           ) VALUES ($1,$2,$3,$4,$5,'ready',$6)
           ON CONFLICT (batch_id, client_upload_id) DO UPDATE SET
             photo_id = EXCLUDED.photo_id,
             content_hash = EXCLUDED.content_hash,
             original_filename = EXCLUDED.original_filename,
             status = 'ready',
             lease_expires_at = NULL,
             last_error_code = NULL,
             original_upload_session_uri = NULL,
             original_upload_offset = 0,
             original_upload_session_updated_at = NULL,
             updated_at = EXCLUDED.updated_at`,
          [
            batchId,
            clientUploadId,
            existingPhotoId,
            contentHash,
            originalFilename,
            now,
          ],
        );
        await client.query("COMMIT");
        return { state: "ready", photoId: existingPhotoId };
      }

      await client.query(
        `INSERT INTO memories_upload_items (
           batch_id, client_upload_id, photo_id, content_hash,
           original_filename, status, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,'pending',$6,$6)
         ON CONFLICT (batch_id, client_upload_id) DO NOTHING`,
        [batchId, clientUploadId, photoId, contentHash, originalFilename, now],
      );

      const locked = await client.query(
        `SELECT * FROM memories_upload_items
         WHERE batch_id = $1 AND client_upload_id = $2
         FOR UPDATE`,
        [batchId, clientUploadId],
      );
      const current = locked.rows[0];
      if (!current) throw new Error("Durable upload item could not be created");

      if (current.status === "ready" && current.photo_id) {
        await client.query("COMMIT");
        return { state: "ready", photoId: current.photo_id };
      }

      const nowTime = new Date(now).getTime();
      const leaseTime = current.lease_expires_at
        ? new Date(current.lease_expires_at).getTime()
        : 0;
      if (current.status === "processing" && leaseTime > nowTime) {
        await client.query("COMMIT");
        return {
          state: "busy",
          retryAfterMs: Math.max(500, leaseTime - nowTime),
        };
      }

      const leaseExpiresAt = new Date(nowTime + leaseMs);
      const claimed = await client.query(
        `UPDATE memories_upload_items
         SET photo_id = COALESCE(photo_id, $3),
             content_hash = $4,
             original_filename = $5,
             status = 'processing',
             attempt_count = attempt_count + 1,
             lease_expires_at = $6,
             last_error_code = NULL,
             updated_at = $7
         WHERE batch_id = $1 AND client_upload_id = $2
         RETURNING *`,
        [
          batchId,
          clientUploadId,
          photoId,
          contentHash,
          originalFilename,
          leaseExpiresAt,
          now,
        ],
      );
      await client.query("COMMIT");
      return { state: "claimed", item: mapItem(claimed.rows[0]) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordOriginalUploadSession({
    batchId,
    clientUploadId,
    sessionUri,
    uploadedBytes = 0,
  }) {
    const offset = Math.max(0, Number(uploadedBytes) || 0);
    const result = await this.pool.query(
      `UPDATE memories_upload_items
       SET original_upload_session_uri = $3,
           original_upload_offset = GREATEST(0, $4::bigint),
           original_upload_session_updated_at = now(),
           lease_expires_at = now() + ($5::bigint * interval '1 millisecond'),
           updated_at = now()
       WHERE batch_id = $1 AND client_upload_id = $2
       RETURNING *`,
      [
        batchId,
        clientUploadId,
        sessionUri,
        offset,
        SESSION_PROGRESS_LEASE_MS,
      ],
    );
    return result.rows[0] ? mapItem(result.rows[0]) : null;
  }

  async recordFiles({
    batchId,
    clientUploadId,
    originalDriveFileId = null,
    thumbnailDriveFileId = null,
  }) {
    const result = await this.pool.query(
      `UPDATE memories_upload_items
       SET original_drive_file_id = COALESCE($3, original_drive_file_id),
           thumbnail_drive_file_id = COALESCE($4, thumbnail_drive_file_id),
           original_upload_session_uri = CASE
             WHEN $3::text IS NOT NULL THEN NULL
             ELSE original_upload_session_uri
           END,
           original_upload_offset = CASE
             WHEN $3::text IS NOT NULL THEN 0
             ELSE original_upload_offset
           END,
           original_upload_session_updated_at = CASE
             WHEN $3::text IS NOT NULL THEN NULL
             ELSE original_upload_session_updated_at
           END,
           updated_at = now()
       WHERE batch_id = $1 AND client_upload_id = $2
       RETURNING *`,
      [batchId, clientUploadId, originalDriveFileId, thumbnailDriveFileId],
    );
    return result.rows[0] ? mapItem(result.rows[0]) : null;
  }

  async markReady({ batchId, clientUploadId, photoId }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE memories_photos
         SET client_upload_id = COALESCE(client_upload_id, $3), updated_at = now()
         WHERE id = $1 AND batch_id = $2`,
        [photoId, batchId, clientUploadId],
      );
      await client.query(
        `UPDATE memories_upload_items
         SET photo_id = $3,
             status = 'ready',
             lease_expires_at = NULL,
             last_error_code = NULL,
             original_upload_session_uri = NULL,
             original_upload_offset = 0,
             original_upload_session_updated_at = NULL,
             updated_at = now()
         WHERE batch_id = $1 AND client_upload_id = $2`,
        [batchId, clientUploadId, photoId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async markFailed({ batchId, clientUploadId, code = "UPLOAD_FAILED" }) {
    if (code === "UPLOAD_IN_PROGRESS") return;
    await this.pool.query(
      `UPDATE memories_upload_items
       SET status = CASE WHEN status = 'ready' THEN status ELSE 'failed' END,
           lease_expires_at = NULL,
           last_error_code = CASE WHEN status = 'ready' THEN last_error_code ELSE $3 END,
           updated_at = now()
       WHERE batch_id = $1 AND client_upload_id = $2`,
      [batchId, clientUploadId, code],
    );
  }
}
