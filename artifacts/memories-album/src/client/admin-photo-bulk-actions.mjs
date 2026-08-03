const WEDDING_PHOTOGRAPHER = "婚禮攝影";
const MAX_UPLOADER_NAME_CHARACTERS = 80;

function uniqueIds(values) {
  return [
    ...new Set(
      (values ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ];
}

function sameIds(left, right) {
  const a = uniqueIds(left);
  const b = uniqueIds(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function normalizeUploaderName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function chunkBulkItems(items, size) {
  const source = Array.isArray(items) ? items : [];
  const chunkSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let index = 0; index < source.length; index += chunkSize) {
    chunks.push(source.slice(index, index + chunkSize));
  }
  return chunks;
}

export function isWeddingPhotographerProtected(photo) {
  return (
    Boolean(photo?.deleteProtected) ||
    normalizeUploaderName(photo?.uploaderName) === WEDDING_PHOTOGRAPHER
  );
}

export function buildBulkUploaderRequest({ photos, uploaderName }) {
  const ids = uniqueIds((photos ?? []).map((photo) => photo?.id));
  if (ids.length === 0) {
    const error = new Error("請先選取至少一張照片。");
    error.code = "PHOTO_REQUIRED";
    throw error;
  }

  const normalizedName = normalizeUploaderName(uploaderName);
  if (
    !normalizedName ||
    Array.from(normalizedName).length > MAX_UPLOADER_NAME_CHARACTERS
  ) {
    const error = new Error("上傳者必填，且不可超過 80 個字元。");
    error.code = "INVALID_UPLOADER_NAME";
    throw error;
  }

  return { ids, uploaderName: normalizedName };
}

export function successfulBulkUploaderResults(payload) {
  return (payload?.uploaders ?? [])
    .filter((uploader) => uploader?.id)
    .map((uploader) => ({
      id: String(uploader.id),
      uploaderName: normalizeUploaderName(uploader.uploaderName),
      deleteProtected: Boolean(uploader.deleteProtected),
    }));
}

export function buildBulkClassificationUpdates({
  photos,
  albumMode = "keep",
  albumIds = [],
  labelMode,
  labelId,
  selectedLabel = null,
  categoryMode,
  categoryId,
}) {
  if (!["keep", "add", "replace"].includes(albumMode)) {
    throw new Error("Invalid album bulk action");
  }

  const effectiveLabelMode = labelMode ?? categoryMode ?? "keep";
  if (!["keep", "replace"].includes(effectiveLabelMode)) {
    throw new Error("Invalid label bulk action");
  }

  const requestedAlbums = uniqueIds(albumIds);
  if (albumMode === "replace" && requestedAlbums.length === 0) {
    const error = new Error("更改相簿時至少要選擇一個相簿。");
    error.code = "ALBUM_REQUIRED";
    throw error;
  }
  if (albumMode === "add" && requestedAlbums.length === 0) {
    const error = new Error("增加相簿時至少要選擇一個相簿。");
    error.code = "ALBUM_REQUIRED";
    throw error;
  }

  const normalizedLabelId = String(labelId ?? categoryId ?? "").trim();
  const ownerAlbumId = normalizedLabelId
    ? String(selectedLabel?.albumId ?? "wedding").trim()
    : "";

  if (
    effectiveLabelMode === "replace" &&
    normalizedLabelId &&
    (!selectedLabel?.id || String(selectedLabel.id) !== normalizedLabelId) &&
    labelMode !== undefined
  ) {
    const error = new Error("所選子分類／標籤不存在。");
    error.code = "INVALID_LABEL";
    throw error;
  }

  return (photos ?? [])
    .filter((photo) => photo?.id)
    .map((photo) => {
      const currentAlbums = uniqueIds(photo.albumIds);
      let nextAlbums = currentAlbums;
      if (albumMode === "add") {
        nextAlbums = uniqueIds([...currentAlbums, ...requestedAlbums]);
      } else if (albumMode === "replace") {
        nextAlbums = requestedAlbums;
      }

      const currentLabels = uniqueIds(photo.categoryIds ?? photo.processIds);
      const nextLabels =
        effectiveLabelMode === "replace"
          ? normalizedLabelId
            ? [normalizedLabelId]
            : []
          : currentLabels;

      if (effectiveLabelMode === "replace" && ownerAlbumId) {
        nextAlbums = uniqueIds([...nextAlbums, ownerAlbumId]);
      }
      if (nextAlbums.length === 0) {
        const error = new Error("照片至少必須屬於一個相簿。");
        error.code = "ALBUM_REQUIRED";
        throw error;
      }

      const changes = {};
      if (!sameIds(currentAlbums, nextAlbums)) changes.albumIds = nextAlbums;
      if (!sameIds(currentLabels, nextLabels)) {
        changes.categoryIds = nextLabels;
      }
      return Object.keys(changes).length > 0
        ? { id: String(photo.id), changes }
        : null;
    })
    .filter(Boolean);
}

export function successfulBulkPhotoResults(payload) {
  return (payload?.results ?? [])
    .filter(
      (result) =>
        result?.status === "ok" &&
        result?.type === "photo.update" &&
        result?.id &&
        result?.photo,
    )
    .map((result) => ({ id: String(result.id), photo: result.photo }));
}
