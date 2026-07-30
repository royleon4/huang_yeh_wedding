export const DEFAULT_ALBUM_PHOTO_SORT_MODE = "time-asc";

export const ALBUM_PHOTO_SORT_MODES = Object.freeze([
  "random",
  "time-asc",
  "time-desc",
  "name-asc",
  "name-desc",
  "author-asc",
  "author-desc",
]);

const ALBUM_PHOTO_SORT_MODE_SET = new Set(ALBUM_PHOTO_SORT_MODES);
const collator = new Intl.Collator(["zh-Hant", "en"], {
  numeric: true,
  sensitivity: "base",
});

export function normalizeAlbumPhotoSortMode(value) {
  const normalized = String(value ?? "").trim();
  return ALBUM_PHOTO_SORT_MODE_SET.has(normalized)
    ? normalized
    : DEFAULT_ALBUM_PHOTO_SORT_MODE;
}

function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function photoName(photo) {
  return normalizedText(photo?.displayName || photo?.originalFilename);
}

function photoAuthor(photo) {
  return normalizedText(photo?.uploaderName);
}

function photoTime(photo) {
  const time = new Date(photo?.createdAt ?? photo?.capturedAt ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareText(left, right, direction) {
  const leftValue = normalizedText(left);
  const rightValue = normalizedText(right);
  if (!leftValue && !rightValue) return 0;
  if (!leftValue) return 1;
  if (!rightValue) return -1;
  return collator.compare(leftValue, rightValue) * direction;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableId(photo) {
  return String(photo?.id ?? photo?.driveFileId ?? photo?.originalFilename ?? "");
}

export function sortAlbumPhotos(
  photos,
  mode = DEFAULT_ALBUM_PHOTO_SORT_MODE,
  randomSeed = "album-photo-order",
) {
  const normalizedMode = normalizeAlbumPhotoSortMode(mode);
  const ordered = [...(photos ?? [])];
  const tieBreak = (left, right) => collator.compare(stableId(left), stableId(right));

  ordered.sort((left, right) => {
    let result = 0;
    switch (normalizedMode) {
      case "random":
        result =
          hashText(`${randomSeed}:${stableId(left)}`) -
          hashText(`${randomSeed}:${stableId(right)}`);
        break;
      case "time-desc":
        result = photoTime(right) - photoTime(left);
        break;
      case "name-asc":
        result = compareText(photoName(left), photoName(right), 1);
        break;
      case "name-desc":
        result = compareText(photoName(left), photoName(right), -1);
        break;
      case "author-asc":
        result = compareText(photoAuthor(left), photoAuthor(right), 1);
        break;
      case "author-desc":
        result = compareText(photoAuthor(left), photoAuthor(right), -1);
        break;
      case "time-asc":
      default:
        result = photoTime(left) - photoTime(right);
        break;
    }
    return result || tieBreak(left, right);
  });

  return ordered;
}
