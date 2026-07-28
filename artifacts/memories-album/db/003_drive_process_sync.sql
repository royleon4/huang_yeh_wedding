BEGIN;

ALTER TABLE memories_processes
  ADD COLUMN IF NOT EXISTS drive_folder_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS drive_folder_name text,
  ADD COLUMN IF NOT EXISTS sync_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE memories_photos
  ADD COLUMN IF NOT EXISTS drive_parent_folder_id text;

CREATE TABLE IF NOT EXISTS memories_drive_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  folders_seen integer NOT NULL DEFAULT 0,
  photos_seen integer NOT NULL DEFAULT 0,
  error_code text
);

CREATE INDEX IF NOT EXISTS memories_processes_drive_folder_idx
  ON memories_processes (drive_folder_id)
  WHERE drive_folder_id IS NOT NULL;

COMMIT;
