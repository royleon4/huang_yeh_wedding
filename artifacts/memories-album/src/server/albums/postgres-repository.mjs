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
  };
}

export class PostgresAlbumRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async listAdminAlbums() {
    const result = await this.pool.query(
      `SELECT id, title_zh, title_en, description_zh, description_en,
              display_order, is_visible, is_system
       FROM memories_albums
       ORDER BY display_order ASC, id ASC`,
    );
    return result.rows.map(mapRow);
  }

  async listPublicAlbums() {
    const result = await this.pool.query(
      `SELECT id, title_zh, title_en, description_zh, description_en,
              display_order, is_visible, is_system
       FROM memories_albums
       WHERE is_visible = true
       ORDER BY display_order ASC, id ASC`,
    );
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
    return mapRow(result.rows[0]);
  }

  async updateAlbum(album) {
    const result = await this.pool.query(
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
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
}
