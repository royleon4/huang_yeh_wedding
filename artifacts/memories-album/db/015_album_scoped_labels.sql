BEGIN;

ALTER TABLE memories_processes
  ADD COLUMN IF NOT EXISTS album_id text;

UPDATE memories_processes
SET album_id = 'wedding'
WHERE album_id IS NULL;

ALTER TABLE memories_processes
  ALTER COLUMN album_id SET DEFAULT 'wedding',
  ALTER COLUMN album_id SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE memories_processes
    ADD CONSTRAINT memories_processes_album_id_fkey
    FOREIGN KEY (album_id)
    REFERENCES memories_albums(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE memories_processes
    ADD CONSTRAINT memories_processes_non_guest_album_check
    CHECK (album_id <> 'guest');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS memories_processes_album_order_idx
  ON memories_processes (album_id, display_order, id)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION memories_validate_photo_label_album()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  required_album_id text;
BEGIN
  SELECT album_id
  INTO required_album_id
  FROM memories_processes
  WHERE id = NEW.process_id
    AND is_active = true;

  IF required_album_id IS NULL THEN
    RAISE EXCEPTION 'Photo label is unavailable'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM memories_photo_albums
    WHERE photo_id = NEW.photo_id
      AND album_id = required_album_id
  ) THEN
    RAISE EXCEPTION 'Photo label requires membership in album %', required_album_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS memories_validate_photo_label_album
  ON memories_photo_processes;

CREATE CONSTRAINT TRIGGER memories_validate_photo_label_album
AFTER INSERT OR UPDATE OF photo_id, process_id
ON memories_photo_processes
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION memories_validate_photo_label_album();

COMMIT;
