BEGIN;

ALTER TABLE memories_photos
  ADD COLUMN IF NOT EXISTS display_name text;

UPDATE memories_photos
SET display_name = original_filename
WHERE display_name IS NULL;

CREATE OR REPLACE FUNCTION memories_fill_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.display_name IS NULL THEN
    NEW.display_name := NEW.original_filename;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS memories_fill_display_name ON memories_photos;
CREATE TRIGGER memories_fill_display_name
BEFORE INSERT OR UPDATE OF original_filename, display_name
ON memories_photos
FOR EACH ROW
EXECUTE FUNCTION memories_fill_display_name();

ALTER TABLE memories_photos
  ALTER COLUMN display_name SET NOT NULL;

CREATE TABLE IF NOT EXISTS memories_albums (
  id text PRIMARY KEY,
  title_zh text NOT NULL,
  title_en text NOT NULL DEFAULT '',
  description_zh text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  display_order integer NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO memories_albums (
  id, title_zh, title_en, description_zh, description_en,
  display_order, is_visible, is_system
)
VALUES
  ('wedding', '婚禮流程', 'Wedding moments', '', '', 1, true, true),
  ('guest', '訪客上傳', 'Guest uploads', '', '', 2, true, true),
  ('life', '生活照', 'Life photos', '', '', 3, true, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS memories_photo_albums (
  photo_id uuid NOT NULL REFERENCES memories_photos(id) ON DELETE CASCADE,
  album_id text NOT NULL REFERENCES memories_albums(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, album_id)
);

INSERT INTO memories_photo_albums (photo_id, album_id)
SELECT id, collection
FROM memories_photos
WHERE collection IN ('wedding', 'guest', 'life')
ON CONFLICT DO NOTHING;

INSERT INTO memories_photo_albums (photo_id, album_id)
SELECT id, 'guest'
FROM memories_photos
WHERE uploader_type = 'guest'
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS memories_photo_albums_album_idx
  ON memories_photo_albums (album_id, photo_id);

COMMIT;
