export const GUEST_ALBUM_ID = "guest";

export function albumSupportsPhotoLabels(album) {
  return Boolean(
    album &&
      album.id !== GUEST_ALBUM_ID &&
      String(album.albumType ?? "album") === "album",
  );
}

export function buildAlbumLabelGroups(albums, labels) {
  const normalizedLabels = Array.isArray(labels) ? labels : [];
  return (Array.isArray(albums) ? albums : [])
    .filter(albumSupportsPhotoLabels)
    .map((album) => ({
      album,
      labels: normalizedLabels
        .filter((label) => label?.albumId === album.id && label?.id)
        .sort(
          (left, right) =>
            Number(left.displayOrder ?? 0) - Number(right.displayOrder ?? 0) ||
            String(left.id).localeCompare(String(right.id)),
        ),
    }))
    .filter((group) => group.labels.length > 0);
}

export function findAlbumLabel(labels, labelId) {
  const id = String(labelId ?? "").trim();
  if (!id) return null;
  return (Array.isArray(labels) ? labels : []).find((label) => label?.id === id) ?? null;
}

export function validSelectedAlbumLabel(labels, labelId, selectedAlbumIds) {
  const label = findAlbumLabel(labels, labelId);
  if (!label || label.albumId === GUEST_ALBUM_ID) return null;
  const selected = new Set(Array.isArray(selectedAlbumIds) ? selectedAlbumIds : []);
  return selected.has(label.albumId) ? label : null;
}
