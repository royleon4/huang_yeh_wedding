import { normalizeAlbumPhotoSortMode } from "../../../album-photo-order.mjs";
import { normalizeAlbumType } from "../../../album-types.mjs";
import { sendAdminJson } from "../admin/auth.mjs";

function normalizedFeaturedRange(album) {
  const minimum = Number(album.featuredPhotoMin);
  const maximum = Number(album.featuredPhotoMax);
  if (
    Number.isInteger(minimum) &&
    Number.isInteger(maximum) &&
    minimum >= 0 &&
    maximum >= minimum
  ) {
    return { minimum, maximum };
  }
  return { minimum: 1, maximum: 3 };
}

function publicAlbum(album) {
  const featuredRange = normalizedFeaturedRange(album);
  return {
    id: album.id,
    titleZh: album.titleZh,
    titleEn: album.titleEn,
    descriptionZh: album.descriptionZh,
    descriptionEn: album.descriptionEn,
    albumType: normalizeAlbumType(album.albumType),
    displayOrder: album.displayOrder,
    showSummary: album.showSummary !== false,
    photoSortMode: normalizeAlbumPhotoSortMode(album.photoSortMode),
    featuredPhotosEnabled: album.featuredPhotosEnabled === true,
    featuredPhotoMin: featuredRange.minimum,
    featuredPhotoMax: featuredRange.maximum,
  };
}

export function createAlbumApi({ repository }) {
  if (!repository) throw new Error("Album repository is required");

  return async function handleAlbumApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (request.method !== "GET" || url.pathname !== "/Memories/api/albums") {
      return false;
    }
    const albums = await repository.listPublicAlbums();
    sendAdminJson(response, 200, {
      albums: albums.map(publicAlbum),
    });
    return true;
  };
}
