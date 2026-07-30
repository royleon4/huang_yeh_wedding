const WEDDING_PHOTOGRAPHER = "婚禮攝影";

function uniqueIds(values) {
  return [...new Set((values ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function sameIds(left, right) {
  const a = uniqueIds(left);
  const b = uniqueIds(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function isWeddingPhotographerProtected(photo) {
  return (
    Boolean(photo?.deleteProtected) ||
    String(photo?.uploaderName ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim() === WEDDING_PHOTOGRAPHER
  );
}

export function buildBulkClassificationUpdates({
  photos,
  albumMode = "keep",
  albumIds = [],
  categoryMode = "keep",
  categoryId = "",
}) {
  if (!["keep", "add", "replace"].includes(albumMode)) {
    throw new Error("Invalid album bulk action");
  }
  if (!["keep", "replace"].includes(categoryMode)) {
    throw new Error("Invalid category bulk action");
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

  const normalizedCategoryId = String(categoryId ?? "").trim();
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

      const currentCategories = uniqueIds(photo.categoryIds ?? photo.processIds);
      const nextCategories =
        categoryMode === "replace"
          ? normalizedCategoryId
            ? [normalizedCategoryId]
            : []
          : currentCategories;

      if (categoryMode === "replace" && normalizedCategoryId) {
        nextAlbums = uniqueIds([...nextAlbums, "wedding"]);
      }
      if (nextAlbums.length === 0) {
        const error = new Error("照片至少必須屬於一個相簿。");
        error.code = "ALBUM_REQUIRED";
        throw error;
      }

      const changes = {};
      if (!sameIds(currentAlbums, nextAlbums)) changes.albumIds = nextAlbums;
      if (!sameIds(currentCategories, nextCategories)) {
        changes.categoryIds = nextCategories;
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
