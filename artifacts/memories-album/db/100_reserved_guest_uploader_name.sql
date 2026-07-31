ALTER TABLE memories_upload_batches
  ADD CONSTRAINT memories_upload_batches_reserved_guest_name_check
  CHECK (
    uploader_type <> 'guest'
    OR btrim(regexp_replace(uploader_name, '[[:space:]]+', ' ', 'g')) <> '婚禮攝影'
  ) NOT VALID;
