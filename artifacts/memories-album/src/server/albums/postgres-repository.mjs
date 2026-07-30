import {
  DEFAULT_ALBUM_PHOTO_SORT_MODE,
  normalizeAlbumPhotoSortMode,
} from "../../../album-photo-order.mjs";

const SUMMARY_KEY_PREFIX = "album_summary_visible:";
const PHOTO_SORT_KEY_PREFIX = "album_photo_sort:";

function mapRow(row) {
  return {
    id: row.id,
    titleZh: row.title_zh,
    titleEn: row.title_en,
    descriptionZh: row.description_zh,
    descriptionEn: row.description_en,
    displayOrder: row.display_order,
    isVisible: row.is_visible,
    isSystem: row.is_system,
    showSummary: row.show_summary !== false,
    photoSortMode: normalizeAlbumPhotoSortMode(
      row.photo_sort_mode ?? DEFAULT_ALBUM_PHOTO_SORT_MODE,
    ),
  };
}

function albumSelect(where = "") {
  return `SELECT a.id, a.title_zh, a.title_en, a.description_zh, a.description_en,
                 a.display_order, a.is_visible, a.is_system,
                 COALESCE((
                   SELECT setting.value = 'true'::jsonb
                   FROM memories_app_settings setting
                   WHERE setting.key = '${SUMMARY_KEY_PREFIX}' || a.id
                 ), true) AS show_summary,
                 COALESCE((
                   SELECT setting.value #>> '{}'
                   FROM memories_app_settings setting
                   WHERE setting.key = '${PHOTO_SORT_KEY_PREFIX}' || a.id
                 ), '${DEFAULT_ALBUM_PHOTO_SORT_MODE}') AS photo_sort_mode
          FROM memories_albums a
          ${where}
          ORDER BY a.display_order ASC, a.id ASC`;
}

async function upsertSetting(client, key, value) {
  await client.query(
    `INSERT INTO memories_app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export class PostgresAlbumRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async listAdminAlbums() {
    const result = await this.pool.query(albumSelect());
    return result.rows.map(mapRow);
  }

  async listPublicAlbums() {
    const result = await this.pool.query(albumSelect("WHERE a.is_visible = true"));
    return result.rows.map(mapRow);
  }

  async createAlbum(album) {
    const result = await this.pool.query(
      `INSERT INTO memories_albums (
         id, title_zh, title_en, description_zh, description_en,
         display_order, is_visible, is_system, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5,
         COALESCE((SELECT MAX(display_order) + 1 FROM memories_albums), 1),
         $6, false, now(), now()
       )
       RETURNING id, title_zh, title_en, description_zh, description_en,
                 display_order, is_visible, is_system`,
      [
        album.id,
        album.titleZh,
        album.titleEn,
        album.descriptionZh,
        album.descriptionEn,
        album.isVisible !== false,
      ],
    );
    return mapRow({
      ...result.rows[0],
      show_summary: album.showSummary !== false,
      photo_sort_mode: normalizeAlbumPhotoSortMode(album.photoSortMode),
    });
  }

  async updateAlbum(album) {
    const client =
      typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE memories_albums
         SET title_zh = $2,
             title_en = $3,
             description_zh = $4,
             description_en = $5,
             is_visible = $6,
             updated_at = now()
         WHERE id = $1
         RETURNING id, title_zh, title_en, description_zh, description_en,
                   display_order, is_visible, is_system`,
        [
          album.id,
          album.titleZh,
          album.titleEn,
          album.descriptionZh,
          album.descriptionEn,
          album.isVisible,
        ],
      );
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }
      const showSummary = album.showSummary !== false;
      const photoSortMode = normalizeAlbumPhotoSortMode(album.photoSortMode);
      await upsertSetting(client, `${SUMMARY_KEY_PREFIX}${album.id}`, showSummary);
      await upsertSetting(client, `${PHOTO_SORT_KEY_PREFIX}${album.id}`, photoSortMode);
      await client.query("COMMIT");
      return mapRow({
        ...result.rows[0],
        show_summary: showSummary,
        photo_sort_mode: photoSortMode,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release?.();
    }
  }
}
