BEGIN;

CREATE TABLE IF NOT EXISTS memories_admin_login_failures (
  client_key_hash text PRIMARY KEY CHECK (length(client_key_hash) = 64),
  failure_count integer NOT NULL CHECK (failure_count > 0),
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memories_admin_login_failures_reset_idx
  ON memories_admin_login_failures (reset_at);

COMMIT;
