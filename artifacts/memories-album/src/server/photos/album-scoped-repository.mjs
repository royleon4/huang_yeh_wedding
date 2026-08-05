import { randomUUID } from "node:crypto";
import { PostgresPhotoRepository } from "./postgres-repository.mjs";

function defaultAlbumId(photo) {
  return photo.collection ?? (photo.source === "guest" ? "guest" : "wedding");
}

function visitorUploadNeedsGuestCopy(photo) {
  return (
    photo.source === "guest" &&
    Boolean(photo.batchId) &&
    defaultAlbumId(photo) !== "guest"
  );
}

function explicitAlbumIds(photo) {
  const selected = photo.albumIds ?? [defaultAlbumId(photo)];
  return [
    ...new Set([
      ...selected,
      ...(visitorUploadNeedsGuestCopy(photo) ? ["guest"] : []),
    ]),
  ].filter(Boolean);
}

function safeDateIso(raw) {
  const timestamp = new Date(raw ?? "");
  return Number.isFinite(timestamp.getTime())
    ? timestamp.toISOString()
    : new Date().toISOString();
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * Album membership is authoritative and independent from upload provenance.
 * A visitor upload batch also keeps one logical copy in Guest uploads when the
 * visitor selected another album. Drive reconciliation still owns only the
 * wedding-process relationship, while deliberate administrator saves may
 * replace all labels through updatePhotoForAdmin.
 */
export class AlbumScopedPhotoRepository extends PostgresPhotoRepository {
  async insertPhoto(photo) {
    const albumIds = explicitAlbumIds(photo);
    const stored = await super.insertPhoto({
      ...photo,
      albumIds,
      albumMembershipsOverridden:
        photo.albumMembershipsOverridden ?? visitorUploadNeedsGuestCopy(photo),
    });
    return { ...stored, albumIds };
  }

  async listPublicPhotos(options = {}) {
    if (options.collection === "guest" && !options.albumId) {
      const { collection: _collection, ...rest } = options;
      return super.listPublicPhotos({
        ...rest,
        collection: null,
        albumId: "guest",
      });
    }
    return super.listPublicPhotos(options);
  }

  async #relinkOfficialDrivePhoto(file, options = {}) {
    const source = options.source ?? "official";
    const size = positiveInteger(file?.size);
    const filename = String(file?.name ?? "").trim();
    if (source !== "official" || !file?.id || !filename || !size) return null;

    const existing = await this.pool.query(
      `SELECT id
       FROM memories_photos
       WHERE drive_file_id = $1
       LIMIT 1`,
      [file.id],
    );
    if (existing.rows[0]) return null;

    const candidates = await this.pool.query(
      `SELECT id
       FROM memories_photos
       WHERE uploader_type = 'official'
         AND visibility <> 'trashed'
         AND drive_file_id <> $1
         AND lower(original_filename) = lower($2)
         AND byte_size = $3
       ORDER BY updated_at DESC, id ASC
       LIMIT 2`,
      [file.id, filename, size],
    );
    if (candidates.rows.length !== 1) return null;

    const width = positiveInteger(file.imageMediaMetadata?.width);
    const height = positiveInteger(file.imageMediaMetadata?.height);
    const collection = options.collection ?? "wedding";
    const parentFolderId = options.parentFolderId ?? null;

    try {
      const relinked = await this.pool.query(
        `UPDATE memories_photos
         SET drive_file_id = $2,
             thumbnail_drive_file_id = NULL,
             original_filename = $3,
             display_name = CASE
               WHEN display_name IS NULL OR display_name = original_filename THEN $3
               ELSE display_name
             END,
             mime_type = $4,
             byte_size = $5,
             width = COALESCE($6, width),
             height = COALESCE($7, height),
             content_hash = $8,
             content_version = content_version + 1,
             drive_parent_folder_id = $9,
             collection = CASE
               WHEN album_memberships_overridden THEN collection
               ELSE $10
             END,
             updated_at = now()
         WHERE id = $1
         RETURNING id`,
        [
          candidates.rows[0].id,
          file.id,
          filename,
          file.mimeType || "image/jpeg",
          size,
          width,
          height,
          `drive:${file.id}`,
          parentFolderId,
          collection,
        ],
      );
      return relinked.rows[0]?.id ?? null;
    } catch (error) {
      // Another runtime may have discovered the same Drive file first. The
      // ordinary upsert below will use that already-linked row safely.
      if (error?.code === "23505") return null;
      throw error;
    }
  }

  async #updateDriveImageAttributes(file) {
    const width = positiveInteger(file?.imageMediaMetadata?.width);
    const height = positiveInteger(file?.imageMediaMetadata?.height);
    if (!file?.id || (!width && !height)) return;
    await this.pool.query(
      `UPDATE memories_photos
       SET width = COALESCE($2, width),
           height = COALESCE($3, height),
           updated_at = CASE
             WHEN width IS DISTINCT FROM COALESCE($2, width)
               OR height IS DISTINCT FROM COALESCE($3, height)
             THEN now()
             ELSE updated_at
           END
       WHERE drive_file_id = $1`,
      [file.id, width, height],
    );
  }

  async upsertDrivePhotoMetadata(file, options = {}) {
    await this.#relinkOfficialDrivePhoto(file, options);

    if (!options.preserveLogicalClassification) {
      const stored = await super.upsertDrivePhotoMetadata(file, options);
      await this.#updateDriveImageAttributes(file);
      return (await this.findPhotoForAdmin(stored.id)) ?? stored;
    }

    const source = options.source ?? "guest";
    const collection = options.collection ?? "guest";
    const parentFolderId = options.parentFolderId ?? null;
    const rawDate =
      file.imageMediaMetadata?.time ??
      file.createdTime ??
      file.modifiedTime ??
      null;
    const createdAt = safeDateIso(rawDate);
    const result = await this.pool.query(
      `INSERT INTO memories_photos (
        id, drive_file_id, original_filename, display_name, mime_type, byte_size,
        content_hash, content_version, uploader_type, uploader_name,
        visibility, processing_state, drive_parent_folder_id, collection,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$3,$4,$5,$6,1,$7,$8,'public','ready',$9,$10,$11,$11)
      ON CONFLICT (drive_file_id) DO UPDATE SET
        original_filename = EXCLUDED.original_filename,
        mime_type = EXCLUDED.mime_type,
        byte_size = EXCLUDED.byte_size,
        drive_parent_folder_id = EXCLUDED.drive_parent_folder_id,
        created_at = CASE
          WHEN memories_photos.captured_at_overridden
            THEN memories_photos.created_at
          ELSE EXCLUDED.created_at
        END,
        updated_at = now()
      RETURNING id`,
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
        createdAt,
      ],
    );
    const photoId = result.rows[0].id;
    const memberships = await this.pool.query(
      `SELECT album_id
       FROM memories_photo_albums
       WHERE photo_id = $1
       ORDER BY album_id`,
      [photoId],
    );
    if (memberships.rows.length === 0) {
      await this.pool.query(
        `INSERT INTO memories_photo_albums (photo_id, album_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [photoId, collection],
      );
    }
    await this.#updateDriveImageAttributes(file);
    return (await this.findPhotoForAdmin(photoId)) ?? { id: photoId };
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
         SET drive_parent_folder_id = $2,
             collection = CASE
               WHEN album_memberships_overridden THEN collection
               ELSE $3
             END,
             updated_at = now()
         WHERE drive_file_id = $1
         RETURNING id, album_memberships_overridden`,
        [driveFileId, parentFolderId, collection],
      );
      if (photoResult.rows[0]) {
        const photoId = photoResult.rows[0].id;
        await client.query(
          `DELETE FROM memories_photo_processes relationship
           USING memories_processes label
           WHERE relationship.photo_id = $1
             AND label.id = relationship.process_id
             AND label.album_id = 'wedding'`,
          [photoId],
        );
        if (processId) {
          await client.query(
            `INSERT INTO memories_photo_processes (photo_id, process_id)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [photoId, processId],
          );
        }
        if (!photoResult.rows[0].album_memberships_overridden) {
          await client.query(
            `DELETE FROM memories_photo_albums
             WHERE photo_id = $1 AND album_id IN ('wedding', 'guest', 'life')`,
            [photoId],
          );
          await client.query(
            `INSERT INTO memories_photo_albums (photo_id, album_id)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [photoId, collection],
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
