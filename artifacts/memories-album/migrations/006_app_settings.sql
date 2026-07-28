BEGIN;

CREATE TABLE IF NOT EXISTS memories_app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO memories_app_settings (key, value)
VALUES ('primary_navigation_visible', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
