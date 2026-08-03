BEGIN;

ALTER TABLE memories_albums
  ADD COLUMN IF NOT EXISTS album_type text;

UPDATE memories_albums
SET album_type = 'album'
WHERE album_type IS NULL;

ALTER TABLE memories_albums
  ALTER COLUMN album_type SET DEFAULT 'album',
  ALTER COLUMN album_type SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE memories_albums
    ADD CONSTRAINT memories_albums_type_check
    CHECK (album_type IN ('album', 'message', 'blog'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS memories_albums_single_message_type
  ON memories_albums (album_type)
  WHERE album_type = 'message';

INSERT INTO memories_albums (
  id,
  title_zh,
  title_en,
  description_zh,
  description_en,
  display_order,
  is_visible,
  is_system,
  album_type,
  created_at,
  updated_at
)
SELECT
  'messages',
  '留言區',
  'Guestbook',
  '收藏每位訪客留下的祝福與留言。',
  'Messages and blessings shared by every guest.',
  COALESCE(MAX(display_order), 0) + 1,
  true,
  true,
  'message',
  now(),
  now()
FROM memories_albums
ON CONFLICT (id) DO UPDATE SET
  title_zh = EXCLUDED.title_zh,
  title_en = EXCLUDED.title_en,
  description_zh = EXCLUDED.description_zh,
  description_en = EXCLUDED.description_en,
  is_visible = true,
  is_system = true,
  album_type = 'message',
  updated_at = now();

CREATE TABLE IF NOT EXISTS memories_messages (
  id text PRIMARY KEY,
  album_id text NOT NULL REFERENCES memories_albums(id) ON DELETE RESTRICT,
  visitor_name text NOT NULL,
  body text NOT NULL,
  message_at timestamptz NOT NULL DEFAULT now(),
  visibility text NOT NULL DEFAULT 'public',
  source text NOT NULL DEFAULT 'guest',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memories_messages_name_check
    CHECK (char_length(visitor_name) BETWEEN 1 AND 80),
  CONSTRAINT memories_messages_body_check
    CHECK (char_length(body) BETWEEN 1 AND 1000),
  CONSTRAINT memories_messages_visibility_check
    CHECK (visibility IN ('public', 'hidden')),
  CONSTRAINT memories_messages_source_check
    CHECK (source IN ('guest', 'admin_import'))
);

CREATE INDEX IF NOT EXISTS memories_messages_public_order
  ON memories_messages (album_id, message_at DESC, id DESC)
  WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS memories_messages_admin_order
  ON memories_messages (album_id, message_at DESC, id DESC);

COMMIT;
