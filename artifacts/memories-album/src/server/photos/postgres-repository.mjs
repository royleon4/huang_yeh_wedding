import { randomUUID } from "node:crypto";
import { decodePhotoCursor, encodePhotoCursor } from "./cursor.mjs";
import { trashRestoreDeadline } from "./trash-cleanup-service.mjs";

export class PostgresPhotoRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async createUploadBatch(batch) {
    const result = await this.pool.query(
      `INSERT INTO memories_upload_batches (
        id, uploader_type, uploader_name, management_token_hash,
        status, classification, classification_process_id, created_at, updated_at
      ) VALUES ($1, 'guest', $2, $3, 'open', $4, $5, $6, $6)
      RETURNING id, uploader_type, uploader_name, status, classification,
                classification_process_id, created_at, updated_at`,
      [
        batch.id,
        batch.uploaderName,
        batch.tokenHash,
        batch.classification ?? "guest",
        batch.classificationProcessId ?? null,
        batch.createdAt,
      ],
    );
    return mapBatchRow(result.rows[0]);
  }

  async findUploadBatchByToken(id, tokenHash) {
    const result = await this.pool.query(
      `SELECT id, uploader_type, uploader_name, status, classification,
              classification_process_id, created_at, updated_at
       FROM memories_upload_batches
       WHERE id = $1
         AND management_token_hash = $2
         AND uploader_type = 'guest'
         AND status = 'open'`,
      [id, tokenHash],
    );
    return result.rows[0] ? mapBatchRow(result.rows[0]) : null;
  }

  async findUploadBatchForManagement(id) {
    const result = await this.pool.query(
      `SELECT id, uploader_type, uploader_name, management_token_hash, status,
              classification, classification_process_id, created_at, updated_at
       FROM memories_upload_batches
       WHERE id = $1 AND uploader_type = 'guest'
       LIMIT 1`,
      [id],
    );
    return result.rows[0]
      ? {
          ...mapBatchRow(result.rows[0]),
          tokenHash: result.rows[0].management_token_hash,
        }
      : null;
  }

  async rotateUploadBatchToken({
    id,
    expectedTokenHash,
    tokenHash,
    updatedAt,
  }) {
    const result = await this.pool.query(
      `UPDATE memories_upload_batches
       SET management_token_hash = $3, updated_at = $4
       WHERE id = $1
         AND management_token_hash = $2
         AND uploader_type = 'guest'
         AND status = 'open'
       RETURNING id, uploader_type, uploader_name, status, classification,
                 classification_process_id, created_at, updated_at`,
      [id, expectedTokenHash, tokenHash, updatedAt],
    );
    return result.rows[0] ? mapBatchRow(result.rows[0]) : null;
  }

  async listAdminUploadBatches({ limit = 50 } = {}) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const result = await this.pool.query(
      `SELECT b.id, b.uploader_type, b.uploader_name, b.status,
              b.classification, b.classification_process_id,
              b.created_at, b.updated_at,
              COUNT(p.id)::integer AS photo_count,
              COUNT(p.id) FILTER (WHERE p.visibility = 'public')::integer
                AS visible_photo_count,
              COALESCE((
                SELECT jsonb_object_agg(status, item_count)
                FROM (
                  SELECT status, COUNT(*)::integer AS item_count
                  FROM memories_upload_items
                  WHERE batch_id = b.id
                  GROUP BY status
                ) upload_states
              ), '{}'::jsonb) AS upload_status_counts
       FROM memories_upload_batches b
       LEFT JOIN memories_photos p ON p.batch_id = b.id
       GROUP BY b.id
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT $1`,
      [boundedLimit],
    );
    return result.rows.map((row) => ({
      ...mapBatchRow(row),
      photoCount: Number(row.photo_count),
      visiblePhotoCount: Number(row.visible_photo_count),
      uploadStatusCounts: row.upload_status_counts ?? {},
    }));
  }

  async setUploadBatchStatus({ id, status, updatedAt }) {
    const result = await this.pool.query(
      `UPDATE memories_upload_batches
       SET status = $2, updated_at = $3
       WHERE id = $1 AND uploader_type = 'guest'
       RETURNING id, uploader_type, uploader_name, status, classification,
                 classification_process_id, created_at, updated_at`,
      [id, status, updatedAt],
    );
    return result.rows[0] ? mapBatchRow(result.rows[0]) : null;
  }

  async regenerateUploadBatchToken({ id, tokenHash, updatedAt }) {
    const result = await this.pool.query(
      `UPDATE memories_upload_batches
       SET management_token_hash = $2, status = 'open', updated_at = $3
       WHERE id = $1 AND uploader_type = 'guest'
       RETURNING id, uploader_type, uploader_name, status, classification,
                 classification_process_id, created_at, updated_at`,
      [id, tokenHash, updatedAt],
    );
    return result.rows[0] ? mapBatchRow(result.rows[0]) : null;
  }

  async listBatchPhotos(batchId) {
    const result = await this.pool.query(
      `SELECT p.*,
        COALESCE(array_agg(mpp.process_id) FILTER (WHERE mpp.process_id IS NOT NULL), '{}') AS process_ids
       FROM memories_photos p
       LEFT JOIN memories_photo_processes mpp ON mpp.photo_id = p.id
       WHERE p.batch_id = $1 AND p.visibility = 'public'
       GROUP BY p.id
       ORDER BY p.created_at ASC, p.id ASC`,
      [batchId],
    );
    return result.rows.map((row) => mapPhotoRow(row, row.process_ids));
  }

  async trashBatchPhoto({ batchId, photoId, trashedAt }) {
    return this.#trashPhotoForRetention({ batchId, photoId, trashedAt });
  }

  async trashPhotoForRetention({ photoId, trashedAt }) {
    return this.#trashPhotoForRetention({ photoId, trashedAt });
  }

  async #trashPhotoForRetention({ batchId = null, photoId, trashedAt }) {
    const client =
      typeof this.pool.connect === "function"
        ? await this.pool.connect()
        : this.pool;
    const restoreUntil = trashRestoreDeadline(trashedAt);
    try {
      await client.query("BEGIN");
      const values = batchId
        ? [photoId, trashedAt, batchId]
        : [photoId, trashedAt];
      const batchCondition = batchId ? "AND batch_id = $3" : "";
      const result = await client.query(
        `UPDATE memories_photos
         SET visibility = 'trashed', trashed_at = $2, updated_at = $2
         WHERE id = $1 AND visibility <> 'trashed' ${batchCondition}
         RETURNING *`,
        values,
      );
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        `INSERT INTO memories_trash_cleanup_jobs (
           photo_id, eligible_at, status, attempt_count, lease_expires_at,
           last_error_code, created_at, updated_at
         ) VALUES ($1, $2, 'pending', 0, NULL, NULL, $3, $3)
         ON CONFLICT (photo_id) DO UPDATE SET
           eligible_at = EXCLUDED.eligible_at,
           status = 'pending',
           attempt_count = 0,
           lease_expires_at = NULL,
           last_error_code = NULL,
           updated_at = EXCLUDED.updated_at`,
        [photoId, restoreUntil, trashedAt],
      );
      await client.query("COMMIT");
      return {
        photo: mapPhotoRow(result.rows[0], []),
        restoreUntil,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release?.();
    }
  }

  async listTrashedPhotos({ limit = 100 } = {}) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 100, 100));
    const result = await this.pool.query(
      `SELECT p.*, j.eligible_at, j.status AS cleanup_status,
              j.attempt_count AS cleanup_attempt_count,
              COALESCE(
                array_agg(mpp.process_id)
                  FILTER (WHERE mpp.process_id IS NOT NULL),
                '{}'
              ) AS process_ids
       FROM memories_photos p
       JOIN memories_trash_cleanup_jobs j ON j.photo_id = p.id
       LEFT JOIN memories_photo_processes mpp ON mpp.photo_id = p.id
       WHERE p.visibility = 'trashed'
       GROUP BY p.id, j.photo_id
       ORDER BY p.trashed_at DESC, p.id DESC
       LIMIT $1`,
      [boundedLimit],
    );
    return result.rows.map((row) => ({
      ...mapPhotoRow(row, row.process_ids),
      trashedAt: new Date(row.trashed_at).toISOString(),
      restoreUntil: new Date(row.eligible_at).toISOString(),
      cleanupStatus: row.cleanup_status,
      cleanupAttemptCount: Number(row.cleanup_attempt_count),
    }));
  }

  async findTrashedPhotoForAdmin(photoId) {
    const result = await this.pool.query(
      `SELECT p.*, j.eligible_at, j.status AS cleanup_status,
              j.attempt_count AS cleanup_attempt_count,
              COALESCE(
                array_agg(mpp.process_id)
                  FILTER (WHERE mpp.process_id IS NOT NULL),
                '{}'
              ) AS process_ids
       FROM memories_photos p
       JOIN memories_trash_cleanup_jobs j ON j.photo_id = p.id
       LEFT JOIN memories_photo_processes mpp ON mpp.photo_id = p.id
       WHERE p.id = $1 AND p.visibility = 'trashed'
       GROUP BY p.id, j.photo_id`,
      [photoId],
    );
    const row = result.rows[0];
    return row
      ? {
          ...mapPhotoRow(row, row.process_ids),
          trashedAt: new Date(row.trashed_at).toISOString(),
          restoreUntil: new Date(row.eligible_at).toISOString(),
          cleanupStatus: row.cleanup_status,
          cleanupAttemptCount: Number(row.cleanup_attempt_count),
        }
      : null;
  }

  async restoreTrashedPhoto({ photoId, now }) {
    const client =
      typeof this.pool.connect === "function"
        ? await this.pool.connect()
        : this.pool;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE memories_photos p
         SET visibility = 'public', trashed_at = NULL, updated_at = $2
         FROM memories_trash_cleanup_jobs j
         WHERE p.id = $1
           AND p.visibility = 'trashed'
           AND j.photo_id = p.id
           AND j.eligible_at > $2
         RETURNING p.*`,
        [photoId, now],
      );
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        "DELETE FROM memories_trash_cleanup_jobs WHERE photo_id = $1",
        [photoId],
      );
      const processes = await client.query(
        "SELECT process_id FROM memories_photo_processes WHERE photo_id = $1",
        [photoId],
      );
      await client.query("COMMIT");
      return mapPhotoRow(
        result.rows[0],
        processes.rows.map((row) => row.process_id),
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release?.();
    }
  }

  async claimExpiredTrash({
    now,
    limit = 20,
    leaseExpiresAt = new Date(new Date(now).getTime() + 300_000).toISOString(),
  }) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const result = await this.pool.query(
      `WITH eligible AS (
         SELECT j.photo_id
         FROM memories_trash_cleanup_jobs j
         JOIN memories_photos p ON p.id = j.photo_id
         WHERE p.visibility = 'trashed'
           AND j.eligible_at <= $1
           AND (
             j.status IN ('pending', 'retry')
             OR (j.status = 'processing' AND j.lease_expires_at <= $1)
           )
         ORDER BY j.eligible_at ASC, j.photo_id ASC
         FOR UPDATE OF j SKIP LOCKED
         LIMIT $2
       )
       UPDATE memories_trash_cleanup_jobs j
       SET status = 'processing',
           attempt_count = j.attempt_count + 1,
           lease_expires_at = $3,
           updated_at = $1
       FROM eligible e, memories_photos p
       WHERE j.photo_id = e.photo_id AND p.id = j.photo_id
       RETURNING p.*, j.eligible_at`,
      [now, boundedLimit, leaseExpiresAt],
    );
    return result.rows.map((row) => ({
      ...mapPhotoRow(row, []),
      trashedAt: new Date(row.trashed_at).toISOString(),
      restoreUntil: new Date(row.eligible_at).toISOString(),
    }));
  }

  async retryTrashCleanup({ photoId, errorCode, updatedAt }) {
    const result = await this.pool.query(
      `UPDATE memories_trash_cleanup_jobs
       SET status = 'retry', lease_expires_at = NULL,
           last_error_code = $2, updated_at = $3
       WHERE photo_id = $1
       RETURNING photo_id`,
      [photoId, errorCode, updatedAt],
    );
    return result.rows[0] ?? null;
  }

  async completeTrashCleanup(photoId) {
    const client =
      typeof this.pool.connect === "function"
        ? await this.pool.connect()
        : this.pool;
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM memories_upload_items WHERE photo_id = $1",
        [photoId],
      );
      const result = await client.query(
        `DELETE FROM memories_photos
         WHERE id = $1 AND visibility = 'trashed'
         RETURNING id`,
        [photoId],
      );
      await client.query("COMMIT");
      return Boolean(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release?.();
    }
  }

  async insertPhoto(photo) {
    const client =
      typeof this.pool.connect === "function"
        ? await this.pool.connect()
        : this.pool;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO memories_photos (
          id, batch_id, drive_file_id, thumbnail_drive_file_id,
          original_filename, mime_type, byte_size, width, height,
          content_hash, content_version, uploader_type, uploader_name,
          visibility, processing_state, drive_parent_folder_id, collection,
          created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18
        ) RETURNING *`,
        [
          photo.id,
          photo.batchId ?? null,
          photo.driveFileId,
          photo.thumbnailDriveFileId ?? null,
          photo.originalFilename,
          photo.mimeType,
          photo.byteSize,
          photo.width ?? null,
          photo.height ?? null,
          photo.contentHash,
          photo.contentVersion ?? 1,
          photo.source,
          photo.uploaderName ?? null,
          photo.visibility ?? "public",
          photo.processingState ?? "ready",
          photo.driveParentFolderId ?? null,
          photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
          photo.createdAt ?? new Date().toISOString(),
        ],
      );
      const processIds = [...new Set(photo.processIds ?? [])].filter(Boolean);
      for (const processId of processIds) {
        await client.query(
          `INSERT INTO memories_photo_processes (photo_id, process_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [photo.id, processId],
        );
      }
      await client.query("COMMIT");
      return mapPhotoRow(result.rows[0], processIds);
    } catch (error) {
      await client.query("ROLLBACK");
      if (error?.code === "23505") {
        const duplicate = new Error("Duplicate photo");
        duplicate.code = "DUPLICATE_PHOTO";
        throw duplicate;
      }
      throw error;
    } finally {
      client.release?.();
    }
  }

  async upsertDrivePhotoMetadata(
    file,
    {
      source = "official",
      parentFolderId = null,
      collection = source === "guest" ? "guest" : "wedding",
      preserveLogicalClassification = false,
    } = {},
  ) {
    const createdAt =
      file.imageMediaMetadata?.time ||
      file.createdTime ||
      file.modifiedTime ||
      new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO memories_photos (
        id, drive_file_id, original_filename, mime_type, byte_size,
        content_hash, content_version, uploader_type, uploader_name,
        visibility, processing_state, drive_parent_folder_id, collection,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,'public','ready',$9,$10,$11,$11)
      ON CONFLICT (drive_file_id) DO UPDATE SET
        original_filename = EXCLUDED.original_filename,
        mime_type = EXCLUDED.mime_type,
        byte_size = EXCLUDED.byte_size,
        drive_parent_folder_id = EXCLUDED.drive_parent_folder_id,
        created_at = EXCLUDED.created_at,
        collection = CASE
          WHEN $12::boolean THEN memories_photos.collection
          ELSE EXCLUDED.collection
        END,
        updated_at = now()
      RETURNING *`,
      [
        randomUUID(),
        file.id,
        file.name || "Google Drive photo",
        file.mimeType || "image/jpeg",
        Number(file.size || 0),
        `drive:${file.id}`,
        source,
        source === "guest" ? "Google Drive guest" : "婚禮攝影",
        parentFolderId,
        collection,
        new Date(createdAt).toISOString(),
        preserveLogicalClassification,
      ],
    );
    return mapPhotoRow(result.rows[0], []);
  }

  async listPhotosMissingThumbnails({ limit = 12 } = {}) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 12, 50));
    const result = await this.pool.query(
      `SELECT p.*
       FROM memories_photos p
       WHERE p.thumbnail_drive_file_id IS NULL
         AND p.drive_file_id IS NOT NULL
         AND p.processing_state = 'ready'
         AND p.visibility <> 'trashed'
       ORDER BY p.created_at ASC, p.id ASC
       LIMIT $1`,
      [boundedLimit],
    );
    return result.rows.map((row) => mapPhotoRow(row, []));
  }

  async attachThumbnail(photoId, thumbnailDriveFileId) {
    const result = await this.pool.query(
      `UPDATE memories_photos
       SET thumbnail_drive_file_id = COALESCE(thumbnail_drive_file_id, $2),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [photoId, thumbnailDriveFileId],
    );
    if (!result.rows[0]) {
      const error = new Error("Photo not found while attaching thumbnail");
      error.code = "PHOTO_NOT_FOUND";
      throw error;
    }
    return mapPhotoRow(result.rows[0], []);
  }

  async listPublicPhotos({
    cursor = null,
    limit = 24,
    processId = null,
    source = null,
    collection = null,
  } = {}) {
    const decoded = decodePhotoCursor(cursor);
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 24, 100));
    const values = [];
    const conditions = ["p.visibility = 'public'"];

    if (decoded) {
      values.push(decoded.createdAt, decoded.id);
      conditions.push(
        `(p.created_at, p.id) > ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
      );
    }
    if (source) {
      values.push(source);
      conditions.push(`p.uploader_type = $${values.length}`);
    }
    if (collection === "guest") {
      conditions.push("p.uploader_type = 'guest'");
    } else if (collection === "wedding" || collection === "life") {
      values.push(collection);
      conditions.push(`p.collection = $${values.length}`);
    }
    if (processId) {
      values.push(processId);
      conditions.push(`EXISTS (
        SELECT 1 FROM memories_photo_processes mpp
        WHERE mpp.photo_id = p.id AND mpp.process_id = $${values.length}
      )`);
    }
    values.push(boundedLimit + 1);

    const result = await this.pool.query(
      `SELECT p.*,
        COALESCE(array_agg(mpp.process_id) FILTER (WHERE mpp.process_id IS NOT NULL), '{}') AS process_ids
       FROM memories_photos p
       LEFT JOIN memories_photo_processes mpp ON mpp.photo_id = p.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY p.id
       ORDER BY p.created_at ASC, p.id ASC
       LIMIT $${values.length}`,
      values,
    );

    const hasMore = result.rows.length > boundedLimit;
    const items = result.rows
      .slice(0, boundedLimit)
      .map((row) => mapPhotoRow(row, row.process_ids));
    return {
      items,
      nextCursor: hasMore ? encodePhotoCursor(items.at(-1)) : null,
    };
  }

  async findPublicPhoto(id) {
    const result = await this.pool.query(
      `SELECT p.*,
        COALESCE(array_agg(mpp.process_id) FILTER (WHERE mpp.process_id IS NOT NULL), '{}') AS process_ids
       FROM memories_photos p
       LEFT JOIN memories_photo_processes mpp ON mpp.photo_id = p.id
       WHERE p.id = $1 AND p.visibility = 'public'
       GROUP BY p.id`,
      [id],
    );
    return result.rows[0]
      ? mapPhotoRow(result.rows[0], result.rows[0].process_ids)
      : null;
  }

  async updateDriveParentByDriveFile(driveFileId, parentFolderId) {
    await this.pool.query(
      `UPDATE memories_photos
       SET drive_parent_folder_id = $2, updated_at = now()
       WHERE drive_file_id = $1`,
      [driveFileId, parentFolderId],
    );
  }

  async replacePhotoProcessByDriveFile(
    driveFileId,
    processId,
    parentFolderId,
    collection = "wedding",
  ) {
    const client =
      typeof this.pool.connect === "function"
        ? await this.pool.connect()
        : this.pool;
    try {
      await client.query("BEGIN");
      const photoResult = await client.query(
        `UPDATE memories_photos
         SET drive_parent_folder_id = $2, collection = $3, updated_at = now()
         WHERE drive_file_id = $1
         RETURNING id`,
        [driveFileId, parentFolderId, collection],
      );
      if (photoResult.rows[0]) {
        const photoId = photoResult.rows[0].id;
        await client.query(
          `DELETE FROM memories_photo_processes WHERE photo_id = $1`,
          [photoId],
        );
        if (processId) {
          await client.query(
            `INSERT INTO memories_photo_processes (photo_id, process_id)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [photoId, processId],
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release?.();
    }
  }
}

function mapBatchRow(row) {
  return {
    id: row.id,
    uploaderType: row.uploader_type,
    uploaderName: row.uploader_name,
    status: row.status,
    classification: row.classification ?? "guest",
    classificationProcessId: row.classification_process_id ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapPhotoRow(row, processIds = []) {
  return {
    id: row.id,
    batchId: row.batch_id,
    driveFileId: row.drive_file_id,
    thumbnailDriveFileId: row.thumbnail_drive_file_id,
    driveParentFolderId: row.drive_parent_folder_id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    width: row.width,
    height: row.height,
    contentHash: row.content_hash,
    contentVersion: row.content_version,
    source: row.uploader_type,
    uploaderName: row.uploader_name,
    collection:
      row.collection ?? (row.uploader_type === "guest" ? "guest" : "wedding"),
    visibility: row.visibility,
    processingState: row.processing_state,
    processIds: [...processIds],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
