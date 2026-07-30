function mapBatch(row) {
  return {
    id: row.id,
    uploaderType: row.uploader_type,
    uploaderName: row.uploader_name,
    tokenHash: row.management_token_hash,
    status: row.status,
    classification: row.classification ?? "guest",
    classificationProcessId: row.classification_process_id ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapPhoto(row) {
  return {
    id: row.id,
    source: row.uploader_type,
    uploaderName: row.uploader_name,
    collection:
      row.collection ?? (row.uploader_type === "guest" ? "guest" : "wedding"),
    albumIds: Array.isArray(row.album_ids) ? row.album_ids : [],
    processIds: Array.isArray(row.process_ids) ? row.process_ids : [],
    width: row.width,
    height: row.height,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapDeletionPhoto(row) {
  return {
    id: row.id,
    driveFileId: row.drive_file_id,
    thumbnailDriveFileId: row.thumbnail_drive_file_id,
    contentHash: row.content_hash,
    contentVersion: Number(row.content_version ?? 1),
    uploaderName: row.uploader_name,
  };
}

export class PostgresUploadManagementRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
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
    return result.rows[0] ? mapBatch(result.rows[0]) : null;
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
       RETURNING id, uploader_type, uploader_name, management_token_hash, status,
                 classification, classification_process_id, created_at, updated_at`,
      [id, expectedTokenHash, tokenHash, updatedAt],
    );
    return result.rows[0] ? mapBatch(result.rows[0]) : null;
  }

  async listBatchPhotos(batchId) {
    const result = await this.pool.query(
      `SELECT p.*,
        COALESCE(
          array_agg(DISTINCT mpp.process_id)
            FILTER (WHERE mpp.process_id IS NOT NULL),
          '{}'
        ) AS process_ids,
        COALESCE((
          SELECT array_agg(mpa.album_id ORDER BY mpa.album_id)
          FROM memories_photo_albums mpa
          WHERE mpa.photo_id = p.id
        ), '{}') AS album_ids
       FROM memories_photos p
       LEFT JOIN memories_photo_processes mpp ON mpp.photo_id = p.id
       WHERE p.batch_id = $1 AND p.visibility = 'public'
       GROUP BY p.id
       ORDER BY p.created_at ASC, p.id ASC`,
      [batchId],
    );
    return result.rows.map(mapPhoto);
  }

  async findBatchPhotoForPermanentDeletion({ batchId, photoId }) {
    const result = await this.pool.query(
      `SELECT id, drive_file_id, thumbnail_drive_file_id, content_hash,
              content_version, uploader_name
       FROM memories_photos
       WHERE id = $1
         AND batch_id = $2
         AND uploader_type = 'guest'
         AND visibility <> 'trashed'
       LIMIT 1`,
      [photoId, batchId],
    );
    return result.rows[0] ? mapDeletionPhoto(result.rows[0]) : null;
  }
}
