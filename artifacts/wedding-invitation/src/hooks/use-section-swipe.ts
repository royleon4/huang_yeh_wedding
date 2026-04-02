import { useEffect, useRef, useCallback } from "react";

const SWIPE_THRESHOLD = 50;
const LOCK_DURATION = 800;

const SECTION_IDS = [
  "section-hero",
  "section-story",
  "section-maps",
  "section-details",
  "section-gallery",
  "section-rsvp",
  "section-footer",
];

function isFormInput(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return (el as Element).closest("input, textarea, select") !== null;
}

export function useSectionSwipe() {
  const lockedRef = useRef(false);
  const touchStartYRef = useRef(0);

  const getCurrentSectionIndex = useCallback(() => {
    let best = 0;
    let bestDist = Infinity;

    SECTION_IDS.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const dist = Math.abs(midpoint - window.innerHeight / 2);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });

    return best;
  }, []);

  useEffect(() => {
    const isTouchDevice = () =>
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    if (!isTouchDevice()) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (lockedRef.current) return;
      if (isFormInput(e.target)) return;

      const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;
      if (Math.abs(deltaY) < SWIPE_THRESHOLD) return;

      const currentIndex = getCurrentSectionIndex();
      const direction = deltaY > 0 ? 1 : -1;
      const nextIndex = Math.max(
        0,
        Math.min(SECTION_IDS.length - 1, currentIndex + direction)
      );

      if (nextIndex === currentIndex) return;

      const targetEl = document.getElementById(SECTION_IDS[nextIndex]);
      if (!targetEl) return;

      lockedRef.current = true;
      targetEl.scrollIntoView({ behavior: "smooth" });

      setTimeout(() => {
        lockedRef.current = false;
      }, LOCK_DURATION);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [getCurrentSectionIndex]);
}
