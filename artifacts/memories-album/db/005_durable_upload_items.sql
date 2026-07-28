BEGIN;

CREATE TABLE IF NOT EXISTS memories_upload_items (
  batch_id uuid NOT NULL REFERENCES memories_upload_batches(id) ON DELETE CASCADE,
  client_upload_id text NOT NULL,
  photo_id uuid,
  content_hash text,
  original_filename text,
  original_drive_file_id text,
  thumbnail_drive_file_id text,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, client_upload_id),
  CHECK (status IN ('pending', 'processing', 'ready', 'failed'))
);

ALTER TABLE memories_photos
  ADD COLUMN IF NOT EXISTS client_upload_id text;

CREATE UNIQUE INDEX IF NOT EXISTS memories_photos_batch_client_upload_idx
  ON memories_photos (batch_id, client_upload_id)
  WHERE batch_id IS NOT NULL AND client_upload_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS memories_upload_items_status_idx
  ON memories_upload_items (status, lease_expires_at, updated_at);

COMMIT;
