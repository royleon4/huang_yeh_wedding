export async function deletePhotoRecordPermanently(repository, id) {
  if (typeof repository?.deletePhotoPermanently === "function") {
    return repository.deletePhotoPermanently(id);
  }

  const pool = repository?.pool;
  if (!pool?.query) {
    throw new Error("The photo repository does not support permanent deletion");
  }
  const client =
    typeof pool.connect === "function" ? await pool.connect() : pool;
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
       WHERE photo_id = $1`,
      [id],
    );
    await client.query(`DELETE FROM memories_photo_processes WHERE photo_id = $1`, [id]);
    await client.query(`DELETE FROM memories_photo_albums WHERE photo_id = $1`, [id]);
    const result = await client.query(
      `DELETE FROM memories_photos WHERE id = $1 RETURNING id`,
      [id],
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
