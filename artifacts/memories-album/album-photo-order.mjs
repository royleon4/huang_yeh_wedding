import {
  normalizeGalleryMediaOrder,
  photoMediaKey,
} from "./src/gallery-media-order.mjs";

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
const PHOTO_MEDIA_KEYS = new Set(["weddingPhotos", "guestPhotos"]);
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

function itemTime(value) {
  const time = new Date(value ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function photoTime(photo) {
  return itemTime(photo?.createdAt ?? photo?.capturedAt);
}

function messageTime(message) {
  return itemTime(message?.messageAt ?? message?.createdAt);
}

function compareText(left, right, direction) {
  const leftValue = normalizedText(left);
  const rightValue = normalizedText(right);
  if (!leftValue && !rightValue) return 0;
  if (!leftValue) return 1;
  if (!rightValue) return -1;
  return collator.compare(leftValue, rightValue) * direction;
}

function compareRankOrText(left, right, rankField, textValue, direction) {
  const leftRank = Number(left?.[rankField]);
  const rightRank = Number(right?.[rankField]);
  if (Number.isFinite(leftRank) && Number.isFinite(rightRank)) {
    return (leftRank - rightRank) * direction;
  }
  return compareText(textValue(left), textValue(right), direction);
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stablePhotoId(photo) {
  return String(photo?.id ?? photo?.driveFileId ?? photo?.originalFilename ?? "");
}

function stableMessageId(message) {
  return String(message?.id ?? "");
}

export function sortAlbumPhotos(
  photos,
  mode = DEFAULT_ALBUM_PHOTO_SORT_MODE,
  randomSeed = "album-photo-order",
) {
  const normalizedMode = normalizeAlbumPhotoSortMode(mode);
  const ordered = [...(photos ?? [])];
  const tieBreak = (left, right) =>
    collator.compare(stablePhotoId(left), stablePhotoId(right));

  ordered.sort((left, right) => {
    let result = 0;
    switch (normalizedMode) {
      case "random":
        result =
          hashText(`${randomSeed}:${stablePhotoId(left)}`) -
          hashText(`${randomSeed}:${stablePhotoId(right)}`);
        break;
      case "time-desc":
        result = photoTime(right) - photoTime(left);
        break;
      case "name-asc":
        result = compareRankOrText(
          left,
          right,
          "nameSortRank",
          (photo) => photo?.displayName || photo?.originalFilename,
          1,
        );
        break;
      case "name-desc":
        result = compareRankOrText(
          left,
          right,
          "nameSortRank",
          (photo) => photo?.displayName || photo?.originalFilename,
          -1,
        );
        break;
      case "author-asc":
        result = compareRankOrText(
          left,
          right,
          "authorSortRank",
          (photo) => photo?.uploaderName,
          1,
        );
        break;
      case "author-desc":
        result = compareRankOrText(
          left,
          right,
          "authorSortRank",
          (photo) => photo?.uploaderName,
          -1,
        );
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

export function sortAlbumMessages(
  messages,
  mode = DEFAULT_ALBUM_PHOTO_SORT_MODE,
  randomSeed = "album-message-order",
) {
  const normalizedMode = normalizeAlbumPhotoSortMode(mode);
  const ordered = [...(messages ?? [])];
  const tieBreak = (left, right) =>
    collator.compare(stableMessageId(left), stableMessageId(right));

  ordered.sort((left, right) => {
    let result = 0;
    switch (normalizedMode) {
      case "random":
        result =
          hashText(`${randomSeed}:${stableMessageId(left)}`) -
          hashText(`${randomSeed}:${stableMessageId(right)}`);
        break;
      case "time-desc":
        result = messageTime(right) - messageTime(left);
        break;
      case "name-asc":
        result = compareText(left?.body, right?.body, 1);
        break;
      case "name-desc":
        result = compareText(left?.body, right?.body, -1);
        break;
      case "author-asc":
        result = compareText(left?.visitorName, right?.visitorName, 1);
        break;
      case "author-desc":
        result = compareText(left?.visitorName, right?.visitorName, -1);
        break;
      case "time-asc":
      default:
        result = messageTime(left) - messageTime(right);
        break;
    }
    return result || tieBreak(left, right);
  });

  return ordered;
}

export function sortAlbumPhotosWithinMediaOrder(
  photos,
  mediaOrder,
  mode = DEFAULT_ALBUM_PHOTO_SORT_MODE,
  randomSeed = "album-photo-order",
) {
  const orderedMediaKeys = normalizeGalleryMediaOrder(mediaOrder).filter((key) =>
    PHOTO_MEDIA_KEYS.has(key),
  );
  const grouped = new Map(orderedMediaKeys.map((key) => [key, []]));
  const ungrouped = [];

  for (const photo of photos ?? []) {
    const key = photoMediaKey(photo);
    const group = grouped.get(key);
    if (group) group.push(photo);
    else ungrouped.push(photo);
  }

  return [
    ...orderedMediaKeys.flatMap((key) =>
      sortAlbumPhotos(grouped.get(key), mode, `${randomSeed}:${key}`),
    ),
    ...sortAlbumPhotos(ungrouped, mode, `${randomSeed}:ungrouped`),
  ];
}
