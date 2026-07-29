import { adminApi, adminLoginMessage } from "./admin-api.mjs";

export const ADMIN_TOKEN_STORAGE_KEY = "memories-admin-token";

export function backgroundLoadMessage(error) {
  if (error?.code === "REQUEST_TIMEOUT") {
    return "已登入；分類與設定載入逾時，可稍後按「重新讀取分類」。";
  }
  return "已登入；分類或設定目前無法載入，管理功能仍可開啟。";
}

export async function performAdminLogin({
  token,
  request = adminApi,
  storage = globalThis.sessionStorage,
  refresh = async () => {},
  schedule = (callback) => globalThis.setTimeout(callback, 0),
  setAuthenticated = () => {},
  setBusy = () => {},
  setMessage = () => {},
} = {}) {
  if (!token) {
    return { authenticated: false, background: Promise.resolve() };
  }

  setBusy(true);
  setMessage("");

  try {
    await request("/Memories/api/admin/session", {
      token,
      method: "POST",
      timeoutMs: 10000,
    });

    storage?.setItem?.(ADMIN_TOKEN_STORAGE_KEY, token);
    setAuthenticated(true);
    setBusy(false);

    let resolveBackground;
    const background = new Promise((resolve) => {
      resolveBackground = resolve;
    });

    schedule(() => {
      void Promise.resolve()
        .then(() => refresh())
        .catch((error) => {
          setMessage(backgroundLoadMessage(error));
        })
        .finally(() => resolveBackground());
    });

    return { authenticated: true, background };
  } catch (error) {
    storage?.removeItem?.(ADMIN_TOKEN_STORAGE_KEY);
    setMessage(adminLoginMessage(error));
    setAuthenticated(false);
    setBusy(false);
    return {
      authenticated: false,
      background: Promise.resolve(),
      error,
    };
  }
}
