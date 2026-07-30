BEGIN;

-- Repair deployments where the process video migration was recorded or the
-- application was published before the production database received both
-- columns. Keep this migration idempotent so it is safe on already-correct
-- databases as well as partially updated schemas.
ALTER TABLE memories_processes
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS youtube_autoplay boolean;

UPDATE memories_processes
SET youtube_autoplay = false
WHERE youtube_autoplay IS NULL;

ALTER TABLE memories_processes
  ALTER COLUMN youtube_autoplay SET DEFAULT false,
  ALTER COLUMN youtube_autoplay SET NOT NULL;

COMMIT;
