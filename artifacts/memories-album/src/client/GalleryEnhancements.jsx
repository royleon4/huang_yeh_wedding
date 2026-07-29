import { useEffect } from "react";
import {
  advanceAdminTitleTap,
  adminEntryDestination,
  masonryRowSpan,
} from "./gallery-enhancement-model.mjs";

function scrollToGalleryStart() {
  const gallery = document.getElementById("archive-gallery");
  if (!gallery) return;
  const stickyControls = document.querySelector(".process-section");
  const stickyHeight = stickyControls?.getBoundingClientRect().height ?? 0;
  const top =
    window.scrollY + gallery.getBoundingClientRect().top - stickyHeight - 10;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function layoutMasonryGrid(resizeObserver, observedCards) {
  const grid = document.querySelector(".masonry-grid");
  if (!grid) return;

  const computed = window.getComputedStyle(grid);
  const rowHeight = Number.parseFloat(computed.gridAutoRows) || 8;
  const rowGap = Number.parseFloat(computed.rowGap) || 0;
  const cards = [...grid.children].filter((element) =>
    element.classList.contains("photo-card"),
  );
  const currentCards = new Set(cards);

  for (const card of observedCards) {
    if (!currentCards.has(card)) {
      resizeObserver?.unobserve(card);
      observedCards.delete(card);
    }
  }

  for (const card of cards) {
    card.style.gridRowEnd = "auto";
  }
  for (const card of cards) {
    card.style.gridRowEnd = `span ${masonryRowSpan(
      card.getBoundingClientRect().height,
      rowHeight,
      rowGap,
    )}`;
    if (!observedCards.has(card)) {
      observedCards.add(card);
      resizeObserver?.observe(card);
    }
  }
}

export default function GalleryEnhancements() {
  useEffect(() => {
    let titleTapState = { count: 0, lastTap: 0 };
    let adminNavigationStarted = false;
    let layoutFrame = null;
    const observedCards = new Set();

    const scheduleLayout = () => {
      if (layoutFrame !== null) return;
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = null;
        layoutMasonryGrid(resizeObserver, observedCards);
      });
    };

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(scheduleLayout)
        : null;
    const mutationObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(scheduleLayout)
        : null;

    const onDocumentClick = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;

      if (element.closest(".process-chip, .collection-tab")) {
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(scrollToGalleryStart),
        );
      }

      if (!element.closest(".archive-header h1") || adminNavigationStarted) {
        return;
      }
      titleTapState = advanceAdminTitleTap(titleTapState, Date.now());
      if (!titleTapState.triggered) return;

      adminNavigationStarted = true;
      void adminEntryDestination().then((destination) => {
        window.location.assign(destination);
      });
    };

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("load", scheduleLayout, true);
    window.addEventListener("resize", scheduleLayout);
    mutationObserver?.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    scheduleLayout();

    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("load", scheduleLayout, true);
      window.removeEventListener("resize", scheduleLayout);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      observedCards.clear();
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
    };
  }, []);

  return null;
}
