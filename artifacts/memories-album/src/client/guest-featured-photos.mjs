import { useEffect, useState } from "react";

export const DEFAULT_GUEST_FEATURED_MIN = 1;
export const DEFAULT_GUEST_FEATURED_MAX = 3;

export function normalizeGuestFeaturedRange(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const minimum = Number(source.guestRandomFeaturedPhotosMin);
  const maximum = Number(source.guestRandomFeaturedPhotosMax);
  if (
    Number.isInteger(minimum) &&
    Number.isInteger(maximum) &&
    minimum >= 0 &&
    maximum >= minimum
  ) {
    return { minimum, maximum };
  }
  return {
    minimum: DEFAULT_GUEST_FEATURED_MIN,
    maximum: DEFAULT_GUEST_FEATURED_MAX,
  };
}

export function isGuestFilter(activeCollection, activeFilter) {
  return activeCollection === "guest" && Boolean(activeFilter);
}

export function selectGuestFeaturedPhotoIds(
  photos,
  {
    activeCollection,
    activeFilter,
    enabled,
    minimum = DEFAULT_GUEST_FEATURED_MIN,
    maximum = DEFAULT_GUEST_FEATURED_MAX,
    random = Math.random,
  } = {},
) {
  const items = Array.isArray(photos) ? photos : [];
  if (!enabled || !isGuestFilter(activeCollection, activeFilter)) return [];
  if (items.length === 0) return [];

  const minCount = Math.max(0, Number.isInteger(minimum) ? minimum : 0);
  const maxCount = Math.max(
    minCount,
    Number.isInteger(maximum) ? maximum : minCount,
  );
  if (maxCount === 0) return [];

  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  const requestedCount =
    minCount + Math.floor(random() * (maxCount - minCount + 1));
  return shuffled
    .slice(0, Math.min(requestedCount, shuffled.length))
    .map((photo) => photo.id);
}

export function pageGuestFeaturedPhotos(photos, pageSize, featuredIds) {
  const items = Array.isArray(photos) ? photos : [];
  const limit = Math.max(0, Number(pageSize) || 0);
  const featuredSet = new Set(Array.isArray(featuredIds) ? featuredIds : []);
  const featured = items
    .filter((photo) => featuredSet.has(photo.id))
    .map((photo) => ({ ...photo, guestFeatured: true }));
  const regular = items
    .filter((photo) => !featuredSet.has(photo.id))
    .map((photo) => ({ ...photo, guestFeatured: false }));
  return [...featured, ...regular].slice(0, limit);
}

export function useGuestRandomFeaturedPhotosSettings() {
  const [settings, setSettings] = useState({
    enabled: false,
    minimum: DEFAULT_GUEST_FEATURED_MIN,
    maximum: DEFAULT_GUEST_FEATURED_MAX,
  });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/Memories/api/settings/guest-featured", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Guest featured-photo settings failed");
        return response.json();
      })
      .then((body) => {
        const range = normalizeGuestFeaturedRange(body);
        setSettings({
          enabled: body.guestRandomFeaturedPhotosEnabled === true,
          ...range,
        });
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setSettings({
            enabled: false,
            minimum: DEFAULT_GUEST_FEATURED_MIN,
            maximum: DEFAULT_GUEST_FEATURED_MAX,
          });
        }
      });
    return () => controller.abort();
  }, []);

  return settings;
}
