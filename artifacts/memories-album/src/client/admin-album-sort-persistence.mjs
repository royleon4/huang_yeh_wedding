function adjustedSummary(payload, addedFailures) {
  if (!payload?.summary || addedFailures === 0) return payload?.summary;
  return {
    ...payload.summary,
    succeeded: Math.max(0, Number(payload.summary.succeeded ?? 0) - addedFailures),
    failed: Number(payload.summary.failed ?? 0) + addedFailures,
  };
}

function sortModeOperations(body) {
  const entries = [];
  for (const item of body?.albums?.update ?? []) {
    if (!Object.hasOwn(item?.changes ?? {}, "photoSortMode")) continue;
    entries.push([
      `album:update:${String(item.id)}`,
      String(item.changes.photoSortMode),
    ]);
  }
  for (const item of body?.albums?.create ?? []) {
    if (!Object.hasOwn(item?.values ?? {}, "photoSortMode")) continue;
    entries.push([
      `album:create:${String(item.clientId)}`,
      String(item.values.photoSortMode),
    ]);
  }
  return new Map(entries);
}

export async function persistAlbumPhotoSortChanges(
  payload,
  body,
  { patchAlbum },
) {
  const requested = sortModeOperations(body);
  if (requested.size === 0) return payload;
  if (typeof patchAlbum !== "function") {
    throw new Error("patchAlbum is required");
  }

  const results = [...(payload?.results ?? [])];
  let failed = 0;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const expected = requested.get(String(result?.key));
    if (result?.status !== "ok" || !expected || !result?.id) continue;
    try {
      const saved = await patchAlbum(String(result.id), {
        photoSortMode: expected,
      });
      if (String(saved?.album?.photoSortMode ?? "") !== expected) {
        const error = new Error("相片排列順序未被伺服器保存");
        error.code = "PERSISTENCE_MISMATCH";
        throw error;
      }
      results[index] = {
        ...result,
        album: { ...(result.album ?? {}), ...saved.album },
      };
    } catch (error) {
      failed += 1;
      results[index] = {
        ...result,
        status: "error",
        error: error?.message || "相片排列順序儲存失敗",
        code: error?.code || "ALBUM_PHOTO_SORT_UPDATE_FAILED",
      };
    }
  }

  return failed === 0
    ? { ...payload, results }
    : {
        ...payload,
        results,
        summary: adjustedSummary(payload, failed),
      };
}
