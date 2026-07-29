export async function adminApi(
  path,
  { token, method = "GET", body, timeoutMs = 12000 } = {},
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
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
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("伺服器回應逾時");
      timeoutError.code = "REQUEST_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function adminLoginMessage(error) {
  if (error?.status === 401) return "管理密碼錯誤";
  if (error?.code === "ADMIN_TOKEN_NOT_CONFIGURED") {
    return "管理密碼尚未在伺服器設定";
  }
  if (error?.code === "REQUEST_TIMEOUT") {
    return "伺服器回應逾時，請再按一次進入管理";
  }
  if (error?.status === 503) {
    return "管理登入服務暫時無法使用，請稍後再試";
  }
  if (error instanceof TypeError) {
    return "無法連線至伺服器，請檢查網路後再試";
  }
  return "登入失敗，請稍後再試";
}
