import { PostgresPhotoRepository } from "./postgres-repository.mjs";

function explicitAlbumIds(photo) {
  const defaultAlbum =
    photo.collection ?? (photo.source === "guest" ? "guest" : "wedding");
  return [...new Set(photo.albumIds ?? [defaultAlbum])].filter(Boolean);
}

/**
 * Album membership is authoritative and independent from upload provenance.
 * A guest-originated photo belongs to Guest uploads only when `guest` is an
 * explicit album membership. Drive reconciliation still owns only the
 * wedding-process relationship, while deliberate administrator saves may
 * replace all labels through updatePhotoForAdmin.
 */
export class AlbumScopedPhotoRepository extends PostgresPhotoRepository {
  async insertPhoto(photo) {
    const albumIds = explicitAlbumIds(photo);
    const stored = await super.insertPhoto({ ...photo, albumIds });
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

  async upsertDrivePhotoMetadata(file, options = {}) {
    const stored = await super.upsertDrivePhotoMetadata(file, options);
    if (!options.preserveLogicalClassification) return stored;
    return (await this.findPhotoForAdmin(stored.id)) ?? stored;
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
