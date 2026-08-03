function mapRow(row) {
  return {
    id: row.id,
    albumId: row.album_id,
    visitorName: row.visitor_name,
    body: row.body,
    messageAt: new Date(row.message_at).toISOString(),
    visibility: row.visibility,
    source: row.source,
  };
}

function boundedLimit(value, fallback = 200) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, 500)) : fallback;
}

export class PostgresMessageRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async listPublicMessages({ albumId = "messages", limit = 200 } = {}) {
    const result = await this.pool.query(
      `SELECT id, album_id, visitor_name, body, message_at, visibility, source
       FROM memories_messages
       WHERE album_id = $1 AND visibility = 'public'
       ORDER BY message_at DESC, id DESC
       LIMIT $2`,
      [albumId, boundedLimit(limit)],
    );
    return result.rows.map(mapRow);
  }

  async listAdminMessages({ albumId = "messages", limit = 500 } = {}) {
    const result = await this.pool.query(
      `SELECT id, album_id, visitor_name, body, message_at, visibility, source
       FROM memories_messages
       WHERE album_id = $1
       ORDER BY message_at DESC, id DESC
       LIMIT $2`,
      [albumId, boundedLimit(limit, 500)],
    );
    return result.rows.map(mapRow);
  }

  async createMessage(message) {
    const result = await this.pool.query(
      `INSERT INTO memories_messages (
         id, album_id, visitor_name, body, message_at, visibility, source,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING id, album_id, visitor_name, body, message_at, visibility, source`,
      [
        message.id,
        message.albumId,
        message.visitorName,
        message.body,
        message.messageAt,
        message.visibility ?? "public",
        message.source ?? "guest",
      ],
    );
    return mapRow(result.rows[0]);
  }

  async updateVisibility({ id, albumId = "messages", visibility }) {
    const result = await this.pool.query(
      `UPDATE memories_messages
       SET visibility = $3, updated_at = now()
       WHERE id = $1 AND album_id = $2
       RETURNING id, album_id, visitor_name, body, message_at, visibility, source`,
      [id, albumId, visibility],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async deleteMessage({ id, albumId = "messages" }) {
    const result = await this.pool.query(
      `DELETE FROM memories_messages
       WHERE id = $1 AND album_id = $2
       RETURNING id`,
      [id, albumId],
    );
    return result.rows[0]?.id ?? null;
  }

  async deleteAllMessages({ albumId = "messages" } = {}) {
    const result = await this.pool.query(
      `DELETE FROM memories_messages
       WHERE album_id = $1
       RETURNING id`,
      [albumId],
    );
    return Number.isInteger(result.rowCount) ? result.rowCount : result.rows.length;
  }

  async importMessages(messages) {
    const client =
      typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
    try {
      await client.query("BEGIN");
      const imported = [];
      for (const message of messages) {
        const result = await client.query(
          `INSERT INTO memories_messages (
             id, album_id, visitor_name, body, message_at, visibility, source,
             created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, 'public', 'admin_import', now(), now())
           RETURNING id, album_id, visitor_name, body, message_at, visibility, source`,
          [
            message.id,
            message.albumId,
            message.visitorName,
            message.body,
            message.messageAt,
          ],
        );
        imported.push(mapRow(result.rows[0]));
      }
      await client.query("COMMIT");
      return imported;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release?.();
    }
  }
}
