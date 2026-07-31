BEGIN;

-- Guest originals can become visible through Google Drive reconciliation before
-- the original upload request finishes inserting its photo row. Resolve that
-- race from the durable upload item instead of exposing a synthetic person name.
CREATE OR REPLACE FUNCTION memories_resolve_guest_uploader_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_batch_id uuid;
  resolved_client_upload_id text;
  resolved_uploader_name text;
BEGIN
  IF NEW.uploader_type IS DISTINCT FROM 'guest'::memories_uploader_type THEN
    RETURN NEW;
  END IF;

  SELECT
    ui.batch_id,
    ui.client_upload_id,
    NULLIF(BTRIM(batch.uploader_name), '')
  INTO
    resolved_batch_id,
    resolved_client_upload_id,
    resolved_uploader_name
  FROM memories_upload_items ui
  JOIN memories_upload_batches batch ON batch.id = ui.batch_id
  WHERE ui.original_drive_file_id = NEW.drive_file_id
    AND batch.uploader_type = 'guest'
  ORDER BY
    CASE WHEN ui.status = 'ready' THEN 0 ELSE 1 END,
    ui.updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    NEW.batch_id := COALESCE(NEW.batch_id, resolved_batch_id);
    NEW.client_upload_id := COALESCE(
      NEW.client_upload_id,
      resolved_client_upload_id
    );
    IF resolved_uploader_name IS NOT NULL
      AND (
        NEW.uploader_name IS NULL
        OR BTRIM(NEW.uploader_name) = ''
        OR NEW.uploader_name IN ('Google Drive guest', '訪客上傳')
      )
    THEN
      NEW.uploader_name := resolved_uploader_name;
    END IF;
  ELSIF NEW.uploader_name IS NULL
    OR BTRIM(NEW.uploader_name) = ''
    OR NEW.uploader_name = 'Google Drive guest'
  THEN
    -- A file manually placed in the guest Drive folder has no verified person
    -- behind it. Use a neutral source label rather than inventing an uploader.
    NEW.uploader_name := '訪客上傳';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS memories_photos_resolve_guest_uploader
  ON memories_photos;
CREATE TRIGGER memories_photos_resolve_guest_uploader
BEFORE INSERT OR UPDATE ON memories_photos
FOR EACH ROW
EXECUTE FUNCTION memories_resolve_guest_uploader_metadata();

-- If Drive reconciliation inserted a guest photo first, link and rename that
-- row as soon as the upload worker records the original Drive file id.
CREATE OR REPLACE FUNCTION memories_apply_guest_upload_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_uploader_name text;
BEGIN
  IF NEW.original_drive_file_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(BTRIM(batch.uploader_name), '')
  INTO resolved_uploader_name
  FROM memories_upload_batches batch
  WHERE batch.id = NEW.batch_id
    AND batch.uploader_type = 'guest';

  IF resolved_uploader_name IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE memories_photos photo
  SET
    batch_id = COALESCE(photo.batch_id, NEW.batch_id),
    client_upload_id = COALESCE(
      photo.client_upload_id,
      NEW.client_upload_id
    ),
    uploader_name = CASE
      WHEN photo.uploader_name IS NULL
        OR BTRIM(photo.uploader_name) = ''
        OR photo.uploader_name IN ('Google Drive guest', '訪客上傳')
      THEN resolved_uploader_name
      ELSE photo.uploader_name
    END,
    updated_at = now()
  WHERE photo.drive_file_id = NEW.original_drive_file_id
    AND photo.uploader_type = 'guest'
    AND (
      photo.batch_id IS NULL
      OR photo.client_upload_id IS NULL
      OR photo.uploader_name IS NULL
      OR BTRIM(photo.uploader_name) = ''
      OR photo.uploader_name IN ('Google Drive guest', '訪客上傳')
    );

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS memories_upload_items_apply_guest_uploader
  ON memories_upload_items;
CREATE TRIGGER memories_upload_items_apply_guest_uploader
AFTER INSERT OR UPDATE OF
  original_drive_file_id,
  batch_id,
  client_upload_id
ON memories_upload_items
FOR EACH ROW
EXECUTE FUNCTION memories_apply_guest_upload_metadata();

-- Repair records already created by the old Drive fallback. Durable upload
-- provenance is authoritative and contains the original name entered by the
-- visitor. Prefer a ready item, then the most recently updated attempt.
WITH resolved_uploads AS (
  SELECT DISTINCT ON (ui.original_drive_file_id)
    ui.original_drive_file_id,
    ui.batch_id,
    ui.client_upload_id,
    NULLIF(BTRIM(batch.uploader_name), '') AS uploader_name
  FROM memories_upload_items ui
  JOIN memories_upload_batches batch ON batch.id = ui.batch_id
  WHERE ui.original_drive_file_id IS NOT NULL
    AND batch.uploader_type = 'guest'
  ORDER BY
    ui.original_drive_file_id,
    CASE WHEN ui.status = 'ready' THEN 0 ELSE 1 END,
    ui.updated_at DESC
)
UPDATE memories_photos photo
SET
  batch_id = COALESCE(photo.batch_id, resolved.batch_id),
  client_upload_id = COALESCE(
    photo.client_upload_id,
    resolved.client_upload_id
  ),
  uploader_name = CASE
    WHEN resolved.uploader_name IS NOT NULL
      AND (
        photo.uploader_name IS NULL
        OR BTRIM(photo.uploader_name) = ''
        OR photo.uploader_name IN ('Google Drive guest', '訪客上傳')
      )
    THEN resolved.uploader_name
    ELSE photo.uploader_name
  END,
  updated_at = now()
FROM resolved_uploads resolved
WHERE photo.drive_file_id = resolved.original_drive_file_id
  AND photo.uploader_type = 'guest'
  AND (
    photo.batch_id IS NULL
    OR photo.client_upload_id IS NULL
    OR photo.uploader_name IS NULL
    OR BTRIM(photo.uploader_name) = ''
    OR photo.uploader_name IN ('Google Drive guest', '訪客上傳')
  );

-- Old manually imported guest files cannot be attributed to a real person.
-- Replace the misleading English placeholder with an honest source label.
UPDATE memories_photos
SET uploader_name = '訪客上傳', updated_at = now()
WHERE uploader_type = 'guest'
  AND (
    uploader_name IS NULL
    OR BTRIM(uploader_name) = ''
    OR uploader_name = 'Google Drive guest'
  );

COMMIT;
