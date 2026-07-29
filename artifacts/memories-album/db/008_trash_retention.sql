BEGIN;

CREATE TABLE IF NOT EXISTS memories_trash_cleanup_jobs (
  photo_id uuid PRIMARY KEY REFERENCES memories_photos(id) ON DELETE CASCADE,
  eligible_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('pending', 'processing', 'retry'))
);

CREATE INDEX IF NOT EXISTS memories_trash_cleanup_jobs_due_idx
  ON memories_trash_cleanup_jobs (eligible_at, status, lease_expires_at);

COMMIT;
