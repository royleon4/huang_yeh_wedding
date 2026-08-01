import { useEffect, useState } from "react";
import { LATEST_GUEST_FILTER_ID } from "../guest-label-settings.mjs";

export function isGuestNameFilter(activeCollection, activeFilter) {
  return (
    activeCollection === "guest" &&
    Boolean(activeFilter) &&
    activeFilter !== "all" &&
    activeFilter !== LATEST_GUEST_FILTER_ID
  );
}

export function selectGuestFeaturedPhotoIds(
  photos,
  {
    activeCollection,
    activeFilter,
    enabled,
    random = Math.random,
  } = {},
) {
  const items = Array.isArray(photos) ? photos : [];
  if (!enabled || !isGuestNameFilter(activeCollection, activeFilter)) {
    return [];
  }
  if (items.length === 0) return [];

  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  const requestedCount = 1 + Math.floor(random() * 3);
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

export function useGuestRandomFeaturedPhotosEnabled() {
  const [enabled, setEnabled] = useState(false);

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
        setEnabled(body.guestRandomFeaturedPhotosEnabled === true);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setEnabled(false);
      });
    return () => controller.abort();
  }, []);

  return enabled;
}
