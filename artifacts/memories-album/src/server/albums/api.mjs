import { sendAdminJson } from "../admin/auth.mjs";

function publicAlbum(album) {
  return {
    id: album.id,
    titleZh: album.titleZh,
    titleEn: album.titleEn,
    descriptionZh: album.descriptionZh,
    descriptionEn: album.descriptionEn,
    displayOrder: album.displayOrder,
    showSummary: album.showSummary !== false,
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
