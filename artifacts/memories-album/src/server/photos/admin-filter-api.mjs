import { sendAdminJson } from "../admin/auth.mjs";
import { requireAdmin } from "../admin/request.mjs";
import { decodePhotoCursor, encodePhotoCursor } from "./cursor.mjs";

function normalized(value, maxCharacters = 160) {
  const text = String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(text).length <= maxCharacters ? text : text.slice(0, maxCharacters);
}

function boundedLimit(value) {
  return Math.max(1, Math.min(Number(value) || 50, 100));
}

function adminPhotoPayload(photo) {
  return {
    id: photo.id,
    displayName: photo.displayName ?? photo.display_name ?? photo.originalFilename ?? photo.original_filename,
    originalFilename: photo.originalFilename ?? photo.original_filename,
    source: photo.source ?? photo.uploaderType ?? photo.uploader_type,
    uploaderName: photo.uploaderName ?? photo.uploader_name ?? "",
    visibility: photo.visibility,
    albumIds: [...(photo.albumIds ?? photo.album_ids ?? [])],
    categoryIds: [...(photo.processIds ?? photo.process_ids ?? [])],
    capturedAt: photo.createdAt ?? photo.created_at,
    width: photo.width ?? null,
    height: photo.height ?? null,
    thumbnailUrl: `/admin/api/photos/${photo.id}/thumbnail`,
  };
}

async function listPostgresPhotos(repository, filters) {
  const cursor = decodePhotoCursor(filters.cursor);
  const limit = boundedLimit(filters.limit);
  const conditions = ["p.visibility <> 'trashed'"];
  const values = [];

  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(
      `(p.created_at, p.id) > ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
    );
  }
  if (filters.albumId) {
    values.push(filters.albumId);
    conditions.push(`EXISTS (
      SELECT 1 FROM memories_photo_albums mpa_filter
      WHERE mpa_filter.photo_id = p.id
        AND mpa_filter.album_id = $${values.length}
    )`);
  }
  if (filters.categoryId) {
    values.push(filters.categoryId);
    conditions.push(`EXISTS (
      SELECT 1 FROM memories_photo_processes mpp_filter
      WHERE mpp_filter.photo_id = p.id
        AND mpp_filter.process_id = $${values.length}
    )`);
  }
  if (filters.uploaderName) {
    values.push(filters.uploaderName);
    conditions.push(`p.uploader_name = $${values.length}`);
  }
  values.push(limit + 1);

  const result = await repository.pool.query(
    `SELECT p.*,
       COALESCE((
         SELECT array_agg(mpp.process_id ORDER BY mpp.process_id)
         FROM memories_photo_processes mpp
         WHERE mpp.photo_id = p.id
       ), '{}') AS process_ids,
       COALESCE((
         SELECT array_agg(mpa.album_id ORDER BY mpa.album_id)
         FROM memories_photo_albums mpa
         WHERE mpa.photo_id = p.id
       ), '{}') AS album_ids
     FROM memories_photos p
     WHERE ${conditions.join(" AND ")}
     ORDER BY p.created_at ASC, p.id ASC
     LIMIT $${values.length}`,
    values,
  );

  const hasMore = result.rows.length > limit;
  const rows = result.rows.slice(0, limit);
  return {
    photos: rows.map(adminPhotoPayload),
    nextCursor: hasMore
      ? encodePhotoCursor({
          id: rows.at(-1).id,
          createdAt: rows.at(-1).created_at,
        })
      : null,
  };
}

async function listMemoryPhotos(repository, filters) {
  const page = await repository.listAdminPhotos({ limit: 100 });
  const filtered = page.items
    .filter((photo) => !filters.albumId || photo.albumIds?.includes(filters.albumId))
    .filter(
      (photo) =>
        !filters.categoryId || photo.processIds?.includes(filters.categoryId),
    )
    .filter(
      (photo) =>
        !filters.uploaderName || photo.uploaderName === filters.uploaderName,
    );
  const limit = boundedLimit(filters.limit);
  return {
    photos: filtered.slice(0, limit).map(adminPhotoPayload),
    nextCursor: null,
  };
}

async function listAuthors(repository) {
  if (repository.pool?.query) {
    const result = await repository.pool.query(
      `SELECT DISTINCT uploader_name
       FROM memories_photos
       WHERE visibility <> 'trashed'
         AND NULLIF(BTRIM(uploader_name), '') IS NOT NULL
       ORDER BY uploader_name ASC`,
    );
    return result.rows.map((row) => row.uploader_name);
  }
  const page = await repository.listAdminPhotos({ limit: 100 });
  return [
    ...new Set(
      page.items
        .map((photo) => normalized(photo.uploaderName, 80))
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right, "zh-Hant"));
}

export function createAdminPhotoFilterApi({ repository, adminToken }) {
  if (!repository?.listAdminPhotos) {
    throw new Error("Photo repository is required for administrator filters");
  }

  return async function handleAdminPhotoFilterApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const authorsPath = url.pathname === "/admin/api/photo-authors";
    const photosPath = url.pathname === "/admin/api/photos";
    const filters = {
      albumId: normalized(url.searchParams.get("albumId")),
      categoryId: normalized(url.searchParams.get("categoryId")),
      uploaderName: normalized(url.searchParams.get("uploaderName"), 80),
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
    };
    const filteredRequest = Boolean(
      filters.albumId || filters.categoryId || filters.uploaderName,
    );

    if (
      request.method !== "GET" ||
      (!authorsPath && !(photosPath && filteredRequest))
    ) {
      return false;
    }
    if (!requireAdmin(request, response, adminToken)) return true;

    if (authorsPath) {
      sendAdminJson(response, 200, { authors: await listAuthors(repository) });
      return true;
    }

    const page = repository.pool?.query
      ? await listPostgresPhotos(repository, filters)
      : await listMemoryPhotos(repository, filters);
    sendAdminJson(response, 200, page);
    return true;
  };
}
