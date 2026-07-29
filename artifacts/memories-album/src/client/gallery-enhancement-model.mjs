export const ADMIN_TITLE_TAP_COUNT = 5;
export const ADMIN_TITLE_TAP_WINDOW_MS = 3_500;

export function advanceAdminTitleTap(
  state,
  now,
  {
    requiredTaps = ADMIN_TITLE_TAP_COUNT,
    windowMs = ADMIN_TITLE_TAP_WINDOW_MS,
  } = {},
) {
  const previousCount = Number(state?.count) || 0;
  const previousTap = Number(state?.lastTap) || 0;
  const timestamp = Number(now) || 0;
  const withinWindow =
    previousTap > 0 && timestamp >= previousTap && timestamp - previousTap <= windowMs;
  const count = (withinWindow ? previousCount : 0) + 1;

  if (count >= requiredTaps) {
    return { count: 0, lastTap: 0, triggered: true };
  }
  return { count, lastTap: timestamp, triggered: false };
}

export function masonryRowSpan(height, rowHeight, rowGap) {
  const measuredHeight = Math.max(0, Number(height) || 0);
  const trackHeight = Math.max(1, Number(rowHeight) || 1);
  const gap = Math.max(0, Number(rowGap) || 0);
  return Math.max(1, Math.ceil((measuredHeight + gap) / (trackHeight + gap)));
}

export async function adminEntryDestination({
  fetchImpl = globalThis.fetch,
  timeoutMs = 3_000,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
} = {}) {
  const controller = new AbortController();
  let timer;
  const request = (async () => {
    const response = await fetchImpl("/admin/api/session", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return "/admin/login";
    const body = await response.json().catch(() => ({}));
    return body?.authenticated ? "/admin" : "/admin/login";
  })().catch(() => "/admin/login");

  const timeout = new Promise((resolve) => {
    timer = setTimeoutImpl(() => {
      controller.abort();
      resolve("/admin/login");
    }, Math.max(1, Number(timeoutMs) || 3_000));
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeoutImpl(timer);
  }
}
