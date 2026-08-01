function adjustedSummary(payload, addedFailures) {
  if (!payload?.summary || addedFailures === 0) return payload?.summary;
  return {
    ...payload.summary,
    succeeded: Math.max(0, Number(payload.summary.succeeded ?? 0) - addedFailures),
    failed: Number(payload.summary.failed ?? 0) + addedFailures,
  };
}

const SUPPLEMENTARY_ALBUM_FIELDS = Object.freeze([
  "photoSortMode",
  "featuredPhotosEnabled",
  "featuredPhotoMin",
  "featuredPhotoMax",
]);

function supplementaryAlbumOperations(body) {
  const entries = [];
  for (const item of body?.albums?.update ?? []) {
    const values = item?.changes ?? {};
    const patch = Object.fromEntries(
      SUPPLEMENTARY_ALBUM_FIELDS.filter((field) =>
        Object.hasOwn(values, field),
      ).map((field) => [field, values[field]]),
    );
    if (Object.keys(patch).length === 0) continue;
    entries.push([`album:update:${String(item.id)}`, patch]);
  }
  for (const item of body?.albums?.create ?? []) {
    const values = item?.values ?? {};
    const patch = Object.fromEntries(
      SUPPLEMENTARY_ALBUM_FIELDS.filter((field) =>
        Object.hasOwn(values, field),
      ).map((field) => [field, values[field]]),
    );
    if (Object.keys(patch).length === 0) continue;
    entries.push([`album:create:${String(item.clientId)}`, patch]);
  }
  return new Map(entries);
}

function sameSavedValue(field, expected, actual) {
  if (field === "featuredPhotosEnabled") {
    return Boolean(actual) === Boolean(expected);
  }
  if (field === "featuredPhotoMin" || field === "featuredPhotoMax") {
    return Number(actual) === Number(expected);
  }
  return String(actual ?? "") === String(expected ?? "");
}

function verifySupplementaryAlbumSettings(saved, expectedPatch) {
  for (const [field, expected] of Object.entries(expectedPatch)) {
    if (!sameSavedValue(field, expected, saved?.album?.[field])) {
      const error = new Error(`相簿設定「${field}」未被伺服器保存`);
      error.code = "PERSISTENCE_MISMATCH";
      throw error;
    }
  }
}

export async function persistAlbumPhotoSortChanges(
  payload,
  body,
  { patchAlbum },
) {
  const requested = supplementaryAlbumOperations(body);
  if (requested.size === 0) return payload;
  if (typeof patchAlbum !== "function") {
    throw new Error("patchAlbum is required");
  }

  const results = [...(payload?.results ?? [])];
  let failed = 0;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const expectedPatch = requested.get(String(result?.key));
    if (result?.status !== "ok" || !expectedPatch || !result?.id) continue;
    try {
      const saved = await patchAlbum(String(result.id), expectedPatch);
      verifySupplementaryAlbumSettings(saved, expectedPatch);
      results[index] = {
        ...result,
        album: { ...(result.album ?? {}), ...saved.album },
      };
    } catch (error) {
      failed += 1;
      results[index] = {
        ...result,
        status: "error",
        error: error?.message || "相簿設定儲存失敗",
        code: error?.code || "ALBUM_SETTINGS_UPDATE_FAILED",
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
