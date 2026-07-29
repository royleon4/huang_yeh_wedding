export async function adminApi(path, { token, method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
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
}

export function adminLoginMessage(error) {
  if (error?.status === 401) return "管理密碼錯誤";
  if (error?.status === 503) {
    return "伺服器或 Google Drive 尚未就緒，請稍後再試";
  }
  if (error instanceof TypeError) {
    return "無法連線至伺服器，請檢查網路後再試";
  }
  return "登入失敗，請稍後再試";
}
