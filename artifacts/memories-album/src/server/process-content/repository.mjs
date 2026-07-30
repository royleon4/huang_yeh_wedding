export const ALL_PROCESS_KEY = "all";

const EMPTY_CONTENT = Object.freeze({
  contentHtmlZh: "",
  contentHtmlEn: "",
  dividerPaddingTop: 12,
  dividerPaddingBottom: 12,
});

export class PostgresProcessContentRepository {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async listContent() {
    const result = await this.pool.query(
      `SELECT process_key, label_zh, label_en, youtube_video_id,
              youtube_autoplay, show_all_photos, content_html_zh,
              content_html_en, divider_padding_top,
              divider_padding_bottom, updated_at
       FROM memories_process_content
       ORDER BY CASE WHEN process_key = 'all' THEN 0 ELSE 1 END,
                process_key ASC`,
    );
    return result.rows.map(mapContentRow);
  }

  async findContent(processKey) {
    const result = await this.pool.query(
      `SELECT process_key, label_zh, label_en, youtube_video_id,
              youtube_autoplay, show_all_photos, content_html_zh,
              content_html_en, divider_padding_top,
              divider_padding_bottom, updated_at
       FROM memories_process_content
       WHERE process_key = $1
       LIMIT 1`,
      [processKey],
    );
    return result.rows[0]
      ? mapContentRow(result.rows[0])
      : { processKey, ...EMPTY_CONTENT };
  }

  async updateContent(processKey, values) {
    const current = await this.findContent(processKey);
    const next = {
      labelZh: values.labelZh ?? current.labelZh ?? null,
      labelEn: values.labelEn ?? current.labelEn ?? null,
      youtubeVideoId:
        values.youtubeVideoId === undefined
          ? current.youtubeVideoId ?? null
          : values.youtubeVideoId,
      youtubeAutoplay:
        values.youtubeAutoplay === undefined
          ? Boolean(current.youtubeAutoplay)
          : Boolean(values.youtubeAutoplay),
      showAllPhotos:
        values.showAllPhotos === undefined
          ? current.showAllPhotos !== false
          : Boolean(values.showAllPhotos),
      contentHtmlZh: values.contentHtmlZh ?? current.contentHtmlZh ?? "",
      contentHtmlEn: values.contentHtmlEn ?? current.contentHtmlEn ?? "",
      dividerPaddingTop:
        values.dividerPaddingTop ?? current.dividerPaddingTop ?? 12,
      dividerPaddingBottom:
        values.dividerPaddingBottom ?? current.dividerPaddingBottom ?? 12,
    };
    const result = await this.pool.query(
      `INSERT INTO memories_process_content (
         process_key, label_zh, label_en, youtube_video_id,
         youtube_autoplay, show_all_photos, content_html_zh,
         content_html_en, divider_padding_top,
         divider_padding_bottom, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
       ON CONFLICT (process_key) DO UPDATE SET
         label_zh = EXCLUDED.label_zh,
         label_en = EXCLUDED.label_en,
         youtube_video_id = EXCLUDED.youtube_video_id,
         youtube_autoplay = EXCLUDED.youtube_autoplay,
         show_all_photos = EXCLUDED.show_all_photos,
         content_html_zh = EXCLUDED.content_html_zh,
         content_html_en = EXCLUDED.content_html_en,
         divider_padding_top = EXCLUDED.divider_padding_top,
         divider_padding_bottom = EXCLUDED.divider_padding_bottom,
         updated_at = now()
       RETURNING process_key, label_zh, label_en, youtube_video_id,
                 youtube_autoplay, show_all_photos, content_html_zh,
                 content_html_en, divider_padding_top,
                 divider_padding_bottom, updated_at`,
      [
        processKey,
        next.labelZh,
        next.labelEn,
        next.youtubeVideoId,
        next.youtubeAutoplay,
        next.showAllPhotos,
        next.contentHtmlZh,
        next.contentHtmlEn,
        next.dividerPaddingTop,
        next.dividerPaddingBottom,
      ],
    );
    return mapContentRow(result.rows[0]);
  }

  async createAttachment(attachment) {
    const result = await this.pool.query(
      `INSERT INTO memories_process_attachments (
         id, process_key, drive_file_id, original_filename,
         mime_type, byte_size, is_image, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       RETURNING id, process_key, drive_file_id, original_filename,
                 mime_type, byte_size, is_image, created_at`,
      [
        attachment.id,
        attachment.processKey,
        attachment.driveFileId,
        attachment.originalFilename,
        attachment.mimeType,
        attachment.byteSize,
        Boolean(attachment.isImage),
      ],
    );
    return mapAttachmentRow(result.rows[0]);
  }

  async findAttachment(id) {
    const result = await this.pool.query(
      `SELECT id, process_key, drive_file_id, original_filename,
              mime_type, byte_size, is_image, created_at
       FROM memories_process_attachments
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    return result.rows[0] ? mapAttachmentRow(result.rows[0]) : null;
  }

  async listAttachments(processKey) {
    const result = await this.pool.query(
      `SELECT id, process_key, drive_file_id, original_filename,
              mime_type, byte_size, is_image, created_at
       FROM memories_process_attachments
       WHERE process_key = $1
       ORDER BY created_at DESC, id DESC`,
      [processKey],
    );
    return result.rows.map(mapAttachmentRow);
  }

  async deleteAttachment(id) {
    const result = await this.pool.query(
      `DELETE FROM memories_process_attachments
       WHERE id = $1
       RETURNING id, process_key, drive_file_id, original_filename,
                 mime_type, byte_size, is_image, created_at`,
      [id],
    );
    return result.rows[0] ? mapAttachmentRow(result.rows[0]) : null;
  }
}

function mapContentRow(row) {
  return {
    processKey: row.process_key,
    labelZh: row.label_zh ?? null,
    labelEn: row.label_en ?? null,
    youtubeVideoId: row.youtube_video_id ?? null,
    youtubeAutoplay: Boolean(row.youtube_autoplay),
    showAllPhotos: row.show_all_photos !== false,
    contentHtmlZh: row.content_html_zh ?? "",
    contentHtmlEn: row.content_html_en ?? "",
    dividerPaddingTop: Number(row.divider_padding_top ?? 12),
    dividerPaddingBottom: Number(row.divider_padding_bottom ?? 12),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function mapAttachmentRow(row) {
  return {
    id: row.id,
    processKey: row.process_key,
    driveFileId: row.drive_file_id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size ?? 0),
    isImage: Boolean(row.is_image),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}
