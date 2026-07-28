BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE memories_uploader_type AS ENUM ('official', 'guest');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE memories_visibility AS ENUM ('public', 'hidden', 'trashed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE memories_processing_state AS ENUM ('pending', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS memories_upload_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_type memories_uploader_type NOT NULL,
  uploader_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memories_processes (
  id text PRIMARY KEY,
  label_zh text NOT NULL,
  label_en text NOT NULL,
  display_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memories_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES memories_upload_batches(id) ON DELETE SET NULL,
  drive_file_id text NOT NULL UNIQUE,
  thumbnail_drive_file_id text UNIQUE,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  content_hash text NOT NULL,
  content_version integer NOT NULL DEFAULT 1 CHECK (content_version > 0),
  uploader_type memories_uploader_type NOT NULL,
  uploader_name text,
  visibility memories_visibility NOT NULL DEFAULT 'public',
  processing_state memories_processing_state NOT NULL DEFAULT 'pending',
  trashed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_hash, content_version)
);

CREATE TABLE IF NOT EXISTS memories_photo_processes (
  photo_id uuid NOT NULL REFERENCES memories_photos(id) ON DELETE CASCADE,
  process_id text NOT NULL REFERENCES memories_processes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, process_id)
);

CREATE INDEX IF NOT EXISTS memories_photos_public_order_idx
  ON memories_photos (created_at DESC, id DESC)
  WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS memories_photos_batch_idx ON memories_photos (batch_id);
CREATE INDEX IF NOT EXISTS memories_photos_trashed_idx ON memories_photos (trashed_at) WHERE visibility = 'trashed';
CREATE INDEX IF NOT EXISTS memories_photo_processes_process_idx ON memories_photo_processes (process_id, photo_id);

INSERT INTO memories_processes (id, label_zh, label_en, display_order)
VALUES
  ('entrance', '進場', 'Entrance', 1),
  ('prayer', '祈禱', 'Prayer', 2),
  ('praise', '讚美', 'Praise', 3),
  ('scripture', '聖經', 'Scripture', 4),
  ('message', '勉勵', 'Message', 5),
  ('vows', '證婚', 'Vows', 6),
  ('parents', '謝親恩', 'Honouring Parents', 7),
  ('blessing', '祝福', 'Blessing', 8),
  ('response', '答禮', 'Response', 9),
  ('video', '影片', 'Film', 10),
  ('recessional', '退場', 'Recessional', 11),
  ('group-photo', '分組照相', 'Group Photos', 12)
ON CONFLICT (id) DO UPDATE SET
  label_zh = EXCLUDED.label_zh,
  label_en = EXCLUDED.label_en,
  display_order = EXCLUDED.display_order,
  updated_at = now();

COMMIT;
