import {
  LEGACY_ADMIN_PATH,
  MEMORIES_ADMIN_LOGIN_PATH,
  MEMORIES_ADMIN_PAGE_PATH,
  MEMORIES_ADMIN_PATH,
  MEMORIES_ADMIN_SESSION_PATH,
  canonicalAdminRequestPath,
} from "../admin-route-paths.mjs";

function timeoutError() {
  const error = new Error("伺服器回應逾時");
  error.code = "REQUEST_TIMEOUT";
  return error;
}

function canonicalPhotoPayload(photo) {
  if (!photo || typeof photo !== "object" || !photo.thumbnailUrl) return photo;
  return {
    ...photo,
    thumbnailUrl: canonicalAdminRequestPath(photo.thumbnailUrl),
  };
}

function canonicalAdminPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    ...payload,
    ...(payload.photo ? { photo: canonicalPhotoPayload(payload.photo) } : {}),
    ...(Array.isArray(payload.photos)
      ? { photos: payload.photos.map(canonicalPhotoPayload) }
      : {}),
  };
}

async function fetchAdminJson(
  path,
  {
    method = "GET",
    body,
    form,
    password,
    fetchImpl,
    signal,
  },
) {
  const response = await fetchImpl(canonicalAdminRequestPath(path), {
    method,
    credentials: "same-origin",
    signal,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-Memories-Admin": "1" } : {}),
      ...(password ? { Authorization: `Bearer ${password}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return canonicalAdminPayload(payload);
}

async function enrichPhotoUploaders(payload, options) {
  if (!Array.isArray(payload?.photos) || payload.photos.length === 0) return payload;
  const ids = payload.photos.map((photo) => photo.id).filter(Boolean);
  if (ids.length === 0) return payload;
  const uploaderPayload = await fetchAdminJson(
    `/admin/api/photo-uploaders?ids=${encodeURIComponent(ids.join(","))}`,
    { ...options, method: "GET", body: undefined, form: undefined },
  );
  const byId = new Map(
    (uploaderPayload.uploaders ?? []).map((uploader) => [uploader.id, uploader]),
  );
  return {
    ...payload,
    photos: payload.photos.map((photo) => ({
      ...photo,
      uploaderName: byId.get(photo.id)?.uploaderName ?? "",
      deleteProtected: Boolean(byId.get(photo.id)?.deleteProtected),
    })),
  };
}

function supplementaryFailurePayload(
  payload,
  results,
  failed,
) {
  if (failed === 0) return payload;
  return {
    ...payload,
    results,
    summary: payload.summary
      ? {
          ...payload.summary,
          succeeded: Math.max(0, Number(payload.summary.succeeded ?? 0) - failed),
          failed: Number(payload.summary.failed ?? 0) + failed,
        }
      : payload.summary,
  };
}

async function persistAlbumSummaryChanges(payload, body, options) {
  const summaryChanges = new Map(
    (body?.albums?.update ?? [])
      .filter((item) => Object.hasOwn(item?.changes ?? {}, "showSummary"))
      .map((item) => [String(item.id), item.changes.showSummary === true]),
  );
  if (summaryChanges.size === 0) return payload;

  const results = [...(payload.results ?? [])];
  let failed = 0;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (
      result?.status !== "ok" ||
      result?.type !== "album.update" ||
      !summaryChanges.has(String(result.id))
    ) {
      continue;
    }
    try {
      await fetchAdminJson(
        `/admin/api/albums/${encodeURIComponent(result.id)}`,
        {
          ...options,
          method: "PATCH",
          body: { showSummary: summaryChanges.get(String(result.id)) },
          form: undefined,
        },
      );
    } catch (error) {
      failed += 1;
      results[index] = {
        ...result,
        status: "error",
        error: error?.message || "相簿名稱與介紹顯示設定儲存失敗",
        code: error?.code || "ALBUM_SUMMARY_UPDATE_FAILED",
      };
    }
  }

  return supplementaryFailurePayload(payload, results, failed);
}

async function persistUploaderChanges(payload, body, options) {
  const uploaderChanges = new Map(
    (body?.photos?.update ?? [])
      .filter((item) => Object.hasOwn(item?.changes ?? {}, "uploaderName"))
      .map((item) => [String(item.id), item.changes.uploaderName]),
  );
  if (uploaderChanges.size === 0) return payload;

  const results = [...(payload.results ?? [])];
  let failed = 0;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (
      result?.status !== "ok" ||
      result?.type !== "photo.update" ||
      !uploaderChanges.has(String(result.id))
    ) {
      continue;
    }
    try {
      await fetchAdminJson(
        `/admin/api/photos/${encodeURIComponent(result.id)}/uploader`,
        {
          ...options,
          method: "PATCH",
          body: { uploaderName: uploaderChanges.get(String(result.id)) },
          form: undefined,
        },
      );
    } catch (error) {
      failed += 1;
      results[index] = {
        ...result,
        status: "error",
        error: error?.message || "上傳者儲存失敗",
        code: error?.code || "UPLOADER_UPDATE_FAILED",
      };
    }
  }

  return supplementaryFailurePayload(payload, results, failed);
}

export function adminSurface(pathname) {
  if (
    pathname === MEMORIES_ADMIN_LOGIN_PATH ||
    pathname === `${MEMORIES_ADMIN_LOGIN_PATH}/` ||
    pathname === `${LEGACY_ADMIN_PATH}/login` ||
    pathname === `${LEGACY_ADMIN_PATH}/login/`
  ) {
    return "login";
  }
  if (
    pathname === MEMORIES_ADMIN_PATH ||
    pathname === MEMORIES_ADMIN_PAGE_PATH ||
    pathname === LEGACY_ADMIN_PATH ||
    pathname === `${LEGACY_ADMIN_PATH}/`
  ) {
    return "admin";
  }
  return "memories";
}

export async function adminRequest(
  path,
  {
    method = "GET",
    body,
    form,
    password,
    timeoutMs = 15_000,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  const controller = new AbortController();
  let timer;
  const options = {
    method,
    body,
    form,
    password,
    fetchImpl,
    signal: controller.signal,
  };
  const request = (async () => {
    let payload = await fetchAdminJson(path, options);
    if (method === "GET" && /^\/admin\/api\/photos(?:\?|$)/.test(path)) {
      payload = await enrichPhotoUploaders(payload, options);
    }
    if (method === "PATCH" && path === "/admin/api/changes") {
      payload = await persistAlbumSummaryChanges(payload, body, options);
      payload = await persistUploaderChanges(payload, body, options);
    }
    return payload;
  })();
  const timeout = new Promise((_, reject) => {
    timer = globalThis.setTimeout(
      () => {
        controller.abort();
        reject(timeoutError());
      },
      Math.max(1, Number(timeoutMs) || 15_000),
    );
  });
  try {
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (error?.name === "AbortError") throw timeoutError();
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function loginAdministrator(
  password,
  {
    request = adminRequest,
    navigate = (destination) => globalThis.location.replace(destination),
  } = {},
) {
  const result = await request(MEMORIES_ADMIN_SESSION_PATH, {
    method: "POST",
    password,
  });
  if (!result?.authenticated) {
    const error = new Error("Administrator login failed");
    error.code = "UNAUTHORIZED";
    throw error;
  }
  navigate(MEMORIES_ADMIN_PAGE_PATH);
}

export async function logoutAdministrator({
  request = adminRequest,
  navigate = (destination) => globalThis.location.replace(destination),
} = {}) {
  await request(MEMORIES_ADMIN_SESSION_PATH, { method: "DELETE" });
  navigate("/Memories/");
}

export function adminErrorMessage(error) {
  if (error?.status === 401 || error?.code === "UNAUTHORIZED") {
    return "管理密碼錯誤，或登入已過期。";
  }
  if (error?.code === "REQUEST_TIMEOUT") {
    return "伺服器回應逾時，請再試一次。";
  }
  if (error?.status === 429 || error?.code === "RATE_LIMITED") {
    return "登入嘗試次數過多，請稍後再試。";
  }
  if (error?.status === 503) return "管理服務暫時無法使用，請稍後再試。";
  if (error instanceof TypeError) return "無法連線至伺服器，請檢查網路。";
  return error?.message || "操作失敗，請稍後再試。";
}
