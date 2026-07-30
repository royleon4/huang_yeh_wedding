const ALBUM_FIELDS = [
  "titleZh",
  "titleEn",
  "descriptionZh",
  "descriptionEn",
  "isVisible",
];
const CATEGORY_FIELDS = ["labelZh", "labelEn"];
const PHOTO_FIELDS = [
  "displayName",
  "uploaderName",
  "visibility",
  "albumIds",
  "categoryIds",
  "capturedAt",
];

function sameValue(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  }
  return left === right;
}

function changedFields(original, draft, fields) {
  const changes = {};
  for (const field of fields) {
    if (!sameValue(original?.[field], draft?.[field])) {
      changes[field] = draft?.[field];
    }
  }
  return changes;
}

function hasKeys(value) {
  return Object.keys(value).length > 0;
}

export function albumDraft(album) {
  return {
    titleZh: album.titleZh,
    titleEn: album.titleEn,
    descriptionZh: album.descriptionZh,
    descriptionEn: album.descriptionEn,
    isVisible: album.isVisible,
  };
}

export function categoryDraft(category) {
  return {
    labelZh: category.labelZh,
    labelEn: category.labelEn,
  };
}

export function photoDraft(photo) {
  return {
    displayName: photo.displayName,
    uploaderName: photo.uploaderName ?? "",
    deleteProtected: Boolean(photo.deleteProtected),
    visibility: photo.visibility,
    albumIds: [...photo.albumIds],
    categoryIds: [...photo.categoryIds],
    capturedAt: photo.capturedAt,
  };
}

export function mergeCategoryOrder(currentOrder, categories) {
  const canonical = categories.map((category) => category.id);
  const available = new Set(canonical);
  return [
    ...currentOrder.filter((id) => available.has(id)),
    ...canonical.filter((id) => !currentOrder.includes(id)),
  ];
}

export function buildAdminChangeSet({
  albums,
  albumDrafts,
  newAlbum,
  categories,
  categoryDrafts,
  categoryOrder,
  newCategory,
  photos,
  photoDrafts,
}) {
  const albumUpdates = albums
    .map((album) => ({
      id: album.id,
      changes: changedFields(
        album,
        albumDrafts[album.id] ?? albumDraft(album),
        ALBUM_FIELDS,
      ),
    }))
    .filter((entry) => hasKeys(entry.changes));

  const categoryUpdates = categories
    .map((category) => ({
      id: category.id,
      changes: changedFields(
        category,
        categoryDrafts[category.id] ?? categoryDraft(category),
        CATEGORY_FIELDS,
      ),
    }))
    .filter((entry) => hasKeys(entry.changes));

  const photoUpdates = photos
    .map((photo) => ({
      id: photo.id,
      changes: changedFields(
        { ...photo, uploaderName: photo.uploaderName ?? "" },
        photoDrafts[photo.id] ?? photoDraft(photo),
        PHOTO_FIELDS,
      ),
    }))
    .filter((entry) => hasKeys(entry.changes));

  const canonicalOrder = categories.map((category) => category.id);
  const effectiveOrder = mergeCategoryOrder(categoryOrder, categories);
  const reordered = effectiveOrder.some(
    (id, index) => id !== canonicalOrder[index],
  );

  const albumCreates = String(newAlbum.titleZh ?? "").trim()
    ? [{ clientId: "new-album", values: { ...newAlbum } }]
    : [];
  const categoryCreates = String(newCategory.labelZh ?? "").trim()
    ? [{ clientId: "new-category", values: { ...newCategory } }]
    : [];

  const payload = {
    albums: { create: albumCreates, update: albumUpdates },
    categories: {
      create: categoryCreates,
      update: categoryUpdates,
      ...(reordered ? { reorder: effectiveOrder } : {}),
    },
    photos: { update: photoUpdates },
  };

  const count =
    albumCreates.length +
    albumUpdates.length +
    categoryCreates.length +
    categoryUpdates.length +
    (reordered ? 1 : 0) +
    photoUpdates.length;

  return { payload, count, reordered };
}

export function successfulResultKeys(results) {
  return new Set(
    (results ?? [])
      .filter((result) => result?.status === "ok" && result?.key)
      .map((result) => result.key),
  );
}
