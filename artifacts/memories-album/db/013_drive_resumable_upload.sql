BEGIN;

ALTER TABLE memories_upload_items
  ADD COLUMN IF NOT EXISTS original_upload_session_uri text,
  ADD COLUMN IF NOT EXISTS original_upload_offset bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_upload_session_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'memories_upload_items_original_upload_offset_nonnegative'
  ) THEN
    ALTER TABLE memories_upload_items
      ADD CONSTRAINT memories_upload_items_original_upload_offset_nonnegative
      CHECK (original_upload_offset >= 0);
  END IF;
END
$$;

COMMIT;
