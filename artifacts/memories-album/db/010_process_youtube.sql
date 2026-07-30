BEGIN;

ALTER TABLE memories_processes
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS youtube_autoplay boolean NOT NULL DEFAULT false;

COMMIT;
