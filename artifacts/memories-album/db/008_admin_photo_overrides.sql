BEGIN;

ALTER TABLE memories_photos
  ADD COLUMN IF NOT EXISTS captured_at_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS album_memberships_overridden boolean NOT NULL DEFAULT false;

COMMIT;
