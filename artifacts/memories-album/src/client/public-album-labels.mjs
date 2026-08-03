function normalizedAlbumId(value) {
  const id = String(value ?? "").trim();
  return id || "wedding";
}

export function labelsForAlbum(labels, albumId) {
  const owner = normalizedAlbumId(albumId);
  return (Array.isArray(labels) ? labels : [])
    .filter((label) => normalizedAlbumId(label?.albumId) === owner)
    .sort(
      (left, right) =>
        Number(left?.displayOrder ?? 0) - Number(right?.displayOrder ?? 0) ||
        String(left?.id ?? "").localeCompare(String(right?.id ?? "")),
    );
}

export function allAlbumLabel(album, language = "zh") {
  const isEnglish = language === "en";
  const title = String(
    album?.[isEnglish ? "en" : "zh"] ??
      album?.[isEnglish ? "titleEn" : "titleZh"] ??
      "",
  ).trim();
  if (isEnglish) return title ? `All ${title}` : "All photos";
  return title ? `全部${title}` : "全部相片";
}

export function filterPhotosByAlbumLabel(
  photos,
  filterId,
  albumId,
) {
  const source = Array.isArray(photos) ? photos : [];
  if (!filterId || filterId === "all" || albumId === "guest") return source;
  return source.filter((photo) =>
    Array.isArray(photo?.processIds) && photo.processIds.includes(filterId),
  );
}
