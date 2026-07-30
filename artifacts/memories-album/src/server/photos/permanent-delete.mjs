function uniquePhotoIds(ids) {
  return [...new Set((ids ?? []).map((id) => String(id ?? "").trim()).filter(Boolean))];
}

function mapDeletionRow(row) {
  return {
    id: row.id,
    driveFileId: row.drive_file_id,
    thumbnailDriveFileId: row.thumbnail_drive_file_id,
    contentHash: row.content_hash,
    contentVersion: row.content_version,
    uploaderName: row.uploader_name,
    albumIds: [...(row.album_ids ?? [])],
    processIds: [...(row.process_ids ?? [])],
  };
}

export async function findPhotoRecordsForPermanentDeletion(repository, id) {
  if (typeof repository?.findPhotoFamilyForAdmin === "function") {
    const photos = await repository.findPhotoFamilyForAdmin(id);
    return Array.isArray(photos) ? photos : [];
  }

  const selected = await repository?.findPhotoForAdmin?.(id);
  if (!selected) return [];

  const pool = repository?.pool;
  if (!pool?.query || !selected.contentHash) return [selected];

  const result = await pool.query(
    `SELECT p.id, p.drive_file_id, p.thumbnail_drive_file_id,
            p.content_hash, p.content_version, p.uploader_name,
            COALESCE((
              SELECT array_agg(mpa.album_id ORDER BY mpa.album_id)
              FROM memories_photo_albums mpa
              WHERE mpa.photo_id = p.id
            ), '{}') AS album_ids,
            COALESCE((
              SELECT array_agg(mpp.process_id ORDER BY mpp.process_id)
              FROM memories_photo_processes mpp
              WHERE mpp.photo_id = p.id
            ), '{}') AS process_ids
       FROM memories_photos p
      WHERE p.visibility <> 'trashed'
        AND (
          p.id = $1
          OR (p.content_hash = $2 AND p.content_version = $3)
        )
      ORDER BY CASE WHEN p.id = $1 THEN 0 ELSE 1 END, p.id`,
    [id, selected.contentHash, Number(selected.contentVersion ?? 1)],
  );

  return result.rows.length > 0 ? result.rows.map(mapDeletionRow) : [selected];
}

export async function deletePhotoRecordsPermanently(repository, ids) {
  const photoIds = uniquePhotoIds(ids);
  if (photoIds.length === 0) return [];

  if (typeof repository?.deletePhotosPermanently === "function") {
    const deleted = await repository.deletePhotosPermanently(photoIds);
    if (Array.isArray(deleted)) return uniquePhotoIds(deleted);
    return deleted ? photoIds : [];
  }

  const pool = repository?.pool;
  if (!pool?.query) {
    if (typeof repository?.deletePhotoPermanently !== "function") {
      throw new Error("The photo repository does not support permanent deletion");
    }
    const deleted = [];
    for (const photoId of photoIds) {
      if (await repository.deletePhotoPermanently(photoId)) deleted.push(photoId);
    }
    return deleted;
  }

  const client = typeof pool.connect === "function" ? await pool.connect() : pool;
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE memories_upload_items
          SET photo_id = NULL,
              original_drive_file_id = NULL,
              thumbnail_drive_file_id = NULL,
              status = 'failed',
              lease_expires_at = NULL,
              last_error_code = 'ADMIN_DELETED',
              updated_at = now()
        WHERE photo_id = ANY($1::uuid[])`,
      [photoIds],
    );
    await client.query(
      `DELETE FROM memories_photo_processes WHERE photo_id = ANY($1::uuid[])`,
      [photoIds],
    );
    await client.query(
      `DELETE FROM memories_photo_albums WHERE photo_id = ANY($1::uuid[])`,
      [photoIds],
    );
    const result = await client.query(
      `DELETE FROM memories_photos
        WHERE id = ANY($1::uuid[])
        RETURNING id`,
      [photoIds],
    );
    await client.query("COMMIT");
    return result.rows.map((row) => String(row.id));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release?.();
  }
}

export async function removeDeletedPhotoIdsFromPinnedSettings(repository, ids) {
  const photoIds = new Set(uniquePhotoIds(ids));
  if (photoIds.size === 0) return;

  if (typeof repository?.removePinnedPhotoIds === "function") {
    await repository.removePinnedPhotoIds([...photoIds]);
    return;
  }

  const pool = repository?.pool;
  if (!pool?.query) return;

  const key = "pinned_photos_by_process";
  const result = await pool.query(
    `SELECT value FROM memories_app_settings WHERE key = $1`,
    [key],
  );
  const current = result.rows[0]?.value;
  if (!current || typeof current !== "object" || Array.isArray(current)) return;

  const next = {};
  let changed = false;
  for (const [processKey, values] of Object.entries(current)) {
    const original = Array.isArray(values) ? values : [];
    const remaining = original.filter((id) => !photoIds.has(String(id)));
    if (remaining.length !== original.length) changed = true;
    if (remaining.length > 0) next[processKey] = remaining;
  }
  if (!changed) return;

  await pool.query(
    `UPDATE memories_app_settings
        SET value = $2::jsonb, updated_at = now()
      WHERE key = $1`,
    [key, JSON.stringify(next)],
  );
}

export async function deletePhotoRecordPermanently(repository, id) {
  return (await deletePhotoRecordsPermanently(repository, [id])).includes(String(id));
}
