BEGIN;

CREATE TABLE IF NOT EXISTS memories_process_content (
  process_key text PRIMARY KEY,
  label_zh text,
  label_en text,
  youtube_video_id text,
  youtube_autoplay boolean NOT NULL DEFAULT false,
  show_all_photos boolean NOT NULL DEFAULT true,
  content_html_zh text NOT NULL DEFAULT '',
  content_html_en text NOT NULL DEFAULT '',
  divider_padding_top integer NOT NULL DEFAULT 12
    CHECK (divider_padding_top BETWEEN 0 AND 96),
  divider_padding_bottom integer NOT NULL DEFAULT 12
    CHECK (divider_padding_bottom BETWEEN 0 AND 96),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO memories_process_content (
  process_key,
  label_zh,
  label_en,
  show_all_photos
) VALUES (
  'all',
  '全部流程',
  'All moments',
  true
)
ON CONFLICT (process_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS memories_process_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_key text NOT NULL,
  drive_file_id text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  is_image boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memories_process_attachments_process_idx
  ON memories_process_attachments (process_key, created_at DESC);

COMMIT;
