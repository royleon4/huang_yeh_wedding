export const MEMORIES_BASE_PATH = "/Memories";
export const MEMORIES_LOWERCASE_PATH = "/memories";
export const MEMORIES_API_PATH = `${MEMORIES_BASE_PATH}/api`;

export const LEGACY_ADMIN_PATH = "/admin";
export const LEGACY_ADMIN_API_PATH = `${LEGACY_ADMIN_PATH}/api`;
export const LEGACY_ADMIN_SESSION_PATH = `${LEGACY_ADMIN_API_PATH}/session`;

export const MEMORIES_ADMIN_PATH = `${MEMORIES_BASE_PATH}/admin`;
export const MEMORIES_ADMIN_PAGE_PATH = `${MEMORIES_ADMIN_PATH}/`;
export const MEMORIES_ADMIN_LOGIN_PATH = `${MEMORIES_ADMIN_PATH}/login`;
export const MEMORIES_ADMIN_API_PATH = `${MEMORIES_ADMIN_PATH}/api`;
export const MEMORIES_ADMIN_SESSION_PATH = `${MEMORIES_ADMIN_API_PATH}/session`;

export function canonicalAdminRequestPath(path) {
  const value = String(path ?? "");
  if (value === LEGACY_ADMIN_PATH || value === `${LEGACY_ADMIN_PATH}/`) {
    return MEMORIES_ADMIN_PAGE_PATH;
  }
  if (value.startsWith(`${LEGACY_ADMIN_PATH}/`)) {
    return `${MEMORIES_BASE_PATH}${value}`;
  }
  return value;
}

export function internalAdminUrl(url) {
  const translated = new URL(url);
  const pathname = translated.pathname;

  if (
    pathname === MEMORIES_ADMIN_LOGIN_PATH ||
    pathname === `${MEMORIES_ADMIN_LOGIN_PATH}/`
  ) {
    translated.pathname = `${LEGACY_ADMIN_PATH}/login`;
    return translated;
  }
  if (
    pathname === MEMORIES_ADMIN_API_PATH ||
    pathname.startsWith(`${MEMORIES_ADMIN_API_PATH}/`)
  ) {
    translated.pathname = pathname.slice(MEMORIES_BASE_PATH.length);
    return translated;
  }
  if (pathname === MEMORIES_ADMIN_PATH) {
    translated.pathname = `${LEGACY_ADMIN_PATH}/`;
    return translated;
  }
  if (pathname === MEMORIES_ADMIN_PAGE_PATH) {
    translated.pathname = LEGACY_ADMIN_PATH;
    return translated;
  }
  if (pathname.startsWith(`${MEMORIES_ADMIN_PATH}/`)) {
    translated.pathname = LEGACY_ADMIN_PATH;
  }
  return translated;
}
