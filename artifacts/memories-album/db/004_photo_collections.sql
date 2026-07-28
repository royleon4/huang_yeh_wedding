BEGIN;

ALTER TABLE memories_upload_batches
  ADD COLUMN IF NOT EXISTS classification text NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS classification_process_id text REFERENCES memories_processes(id) ON DELETE SET NULL;

ALTER TABLE memories_photos
  ADD COLUMN IF NOT EXISTS collection text NOT NULL DEFAULT 'wedding';

UPDATE memories_photos
SET collection = 'guest'
WHERE uploader_type = 'guest'
  AND collection = 'wedding'
  AND NOT EXISTS (
    SELECT 1
    FROM memories_photo_processes mpp
    WHERE mpp.photo_id = memories_photos.id
  );

DO $$ BEGIN
  ALTER TABLE memories_upload_batches
    ADD CONSTRAINT memories_upload_batches_classification_check
    CHECK (classification IN ('guest', 'wedding', 'life'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE memories_photos
    ADD CONSTRAINT memories_photos_collection_check
    CHECK (collection IN ('guest', 'wedding', 'life'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS memories_photos_collection_idx
  ON memories_photos (collection, created_at DESC, id DESC)
  WHERE visibility = 'public';

COMMIT;
