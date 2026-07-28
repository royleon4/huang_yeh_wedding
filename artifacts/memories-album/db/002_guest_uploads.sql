BEGIN;

ALTER TABLE memories_upload_batches
  ADD COLUMN IF NOT EXISTS management_token_hash text;

ALTER TABLE memories_upload_batches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

CREATE UNIQUE INDEX IF NOT EXISTS memories_upload_batches_token_hash_idx
  ON memories_upload_batches (management_token_hash)
  WHERE management_token_hash IS NOT NULL;

COMMIT;
