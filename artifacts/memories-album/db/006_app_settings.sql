BEGIN;

CREATE TABLE IF NOT EXISTS memories_app_settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL DEFAULT 'null'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
