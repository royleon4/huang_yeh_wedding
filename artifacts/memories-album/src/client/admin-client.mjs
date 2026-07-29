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
  const request = (async () => {
    const response = await fetchImpl(canonicalAdminRequestPath(path), {
      method,
      credentials: "same-origin",
      signal: controller.signal,
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
      const error = new Error(
        payload.error || `Request failed (${response.status})`,
      );
      error.status = response.status;
      error.code = payload.code;
      throw error;
    }
    return canonicalAdminPayload(payload);
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
