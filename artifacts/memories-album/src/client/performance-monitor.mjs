const snapshot = {
  lcp: null,
  cls: 0,
  inp: null,
  navigation: null,
};

function rounded(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function publish() {
  globalThis.__MEMORIES_WEB_VITALS__ = {
    lcp: rounded(snapshot.lcp),
    cls: rounded(snapshot.cls, 4),
    inp: rounded(snapshot.inp),
    navigation: snapshot.navigation,
  };

  const params = new URLSearchParams(globalThis.location?.search ?? "");
  if (params.get("performance") === "1") {
    console.info("[Memories performance]", globalThis.__MEMORIES_WEB_VITALS__);
  }
}

function observe(type, callback) {
  if (typeof PerformanceObserver !== "function") return null;
  try {
    const observer = new PerformanceObserver((list) => callback(list.getEntries()));
    observer.observe({ type, buffered: true });
    return observer;
  } catch {
    return null;
  }
}

function captureNavigation() {
  const navigation = performance.getEntriesByType?.("navigation")?.[0];
  if (!navigation) return;
  snapshot.navigation = {
    responseStart: rounded(navigation.responseStart),
    domContentLoaded: rounded(navigation.domContentLoadedEventEnd),
    load: rounded(navigation.loadEventEnd),
    transferSize: Number(navigation.transferSize || 0),
    encodedBodySize: Number(navigation.encodedBodySize || 0),
  };
}

export function startPerformanceMonitoring() {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return () => {};
  }

  captureNavigation();
  publish();

  const observers = [
    observe("largest-contentful-paint", (entries) => {
      const entry = entries.at(-1);
      if (!entry) return;
      snapshot.lcp = entry.startTime;
      publish();
    }),
    observe("layout-shift", (entries) => {
      for (const entry of entries) {
        if (!entry.hadRecentInput) snapshot.cls += entry.value;
      }
      publish();
    }),
    observe("event", (entries) => {
      for (const entry of entries) {
        if (!entry.interactionId || entry.duration < 16) continue;
        snapshot.inp = Math.max(snapshot.inp ?? 0, entry.duration);
      }
      publish();
    }),
  ].filter(Boolean);

  const onLoad = () => {
    captureNavigation();
    publish();
  };
  window.addEventListener("load", onLoad, { once: true });

  return () => {
    window.removeEventListener("load", onLoad);
    for (const observer of observers) observer.disconnect();
  };
}
