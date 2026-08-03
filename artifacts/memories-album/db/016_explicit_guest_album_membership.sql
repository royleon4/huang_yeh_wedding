BEGIN;

-- Remove only the legacy automatic Guest uploads membership. Administrator
-- selections are preserved because those rows mark album memberships as
-- overridden. Photos whose primary classification is Guest uploads remain.
DELETE FROM memories_photo_albums membership
USING memories_photos photo
WHERE membership.photo_id = photo.id
  AND membership.album_id = 'guest'
  AND photo.collection IS DISTINCT FROM 'guest'
  AND photo.album_memberships_overridden = false;

CREATE OR REPLACE FUNCTION memories_require_explicit_guest_album_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  photo_collection text;
  memberships_overridden boolean;
BEGIN
  IF NEW.album_id <> 'guest' THEN
    RETURN NEW;
  END IF;

  SELECT collection, album_memberships_overridden
  INTO photo_collection, memberships_overridden
  FROM memories_photos
  WHERE id = NEW.photo_id;

  -- A normal upload receives only its selected primary album. Guest uploads is
  -- accepted automatically only when it is that selected album. Administrator
  -- writes may still explicitly include Guest uploads alongside another album.
  IF photo_collection IS DISTINCT FROM 'guest'
     AND NOT COALESCE(memberships_overridden, false) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS memories_require_explicit_guest_album_membership
  ON memories_photo_albums;

CREATE TRIGGER memories_require_explicit_guest_album_membership
BEFORE INSERT ON memories_photo_albums
FOR EACH ROW
EXECUTE FUNCTION memories_require_explicit_guest_album_membership();

COMMIT;
