import { decodePhotoCursor, encodePhotoCursor } from "./cursor.mjs";

export class PostgresPhotoRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async createUploadBatch(batch) {
    const result = await this.pool.query(
      `INSERT INTO memories_upload_batches (
        id, uploader_type, uploader_name, management_token_hash,
        status, created_at, updated_at
      ) VALUES ($1, 'guest', $2, $3, 'open', $4, $4)
      RETURNING id, uploader_type, uploader_name, status, created_at, updated_at`,
      [batch.id, batch.uploaderName, batch.tokenHash, batch.createdAt],
    );
    return mapBatchRow(result.rows[0]);
  }

  async findUploadBatchByToken(id, tokenHash) {
    const result = await this.pool.query(
      `SELECT id, uploader_type, uploader_name, status, created_at, updated_at
       FROM memories_upload_batches
       WHERE id = $1
         AND management_token_hash = $2
         AND uploader_type = 'guest'
         AND status = 'open'`,
      [id, tokenHash],
    );
    return result.rows[0] ? mapBatchRow(result.rows[0]) : null;
  }

  async insertPhoto(photo) {
    try {
      const result = await this.pool.query(
        `INSERT INTO memories_photos (
          id, batch_id, drive_file_id, thumbnail_drive_file_id,
          original_filename, mime_type, byte_size, width, height,
          content_hash, content_version, uploader_type, uploader_name,
          visibility, processing_state, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16
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
          photo.createdAt ?? new Date().toISOString(),
        ],
      );
      return mapPhotoRow(result.rows[0], photo.processIds ?? []);
    } catch (error) {
      if (error?.code === "23505") {
        const duplicate = new Error("Duplicate photo");
        duplicate.code = "DUPLICATE_PHOTO";
        throw duplicate;
      }
      throw error;
    }
  }

  async listPublicPhotos({
    cursor = null,
    limit = 24,
    processId = null,
    source = null,
  } = {}) {
    const decoded = decodePhotoCursor(cursor);
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 24, 100));
    const values = [];
    const conditions = ["p.visibility = 'public'"];

    if (decoded) {
      values.push(decoded.createdAt, decoded.id);
      conditions.push(
        `(p.created_at, p.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
      );
    }
    if (source) {
      values.push(source);
      conditions.push(`p.uploader_type = $${values.length}`);
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
       ORDER BY p.created_at DESC, p.id DESC
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
}

function mapBatchRow(row) {
  return {
    id: row.id,
    uploaderType: row.uploader_type,
    uploaderName: row.uploader_name,
    status: row.status,
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
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    width: row.width,
    height: row.height,
    contentHash: row.content_hash,
    contentVersion: row.content_version,
    source: row.uploader_type,
    uploaderName: row.uploader_name,
    visibility: row.visibility,
    processingState: row.processing_state,
    processIds: [...processIds],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
