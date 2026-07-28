import { randomUUID } from "node:crypto";
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

  async insertPhoto(photo) {
    const client =
      typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
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
    collection: row.collection ?? (row.uploader_type === "guest" ? "guest" : "wedding"),
    visibility: row.visibility,
    processingState: row.processing_state,
    processIds: [...processIds],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
