import { useEffect } from "react";
import {
  advanceAdminTitleTap,
  adminEntryDestination,
  masonryMeasuredHeight,
  masonryRowSpan,
  viewportWidthChanged,
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

function collectPhotoCards(node) {
  if (!(node instanceof Element)) return [];
  const cards = [];
  if (node.matches(".photo-card")) cards.push(node);
  cards.push(...node.querySelectorAll(".photo-card"));
  return cards;
}

function currentViewportWidth() {
  return window.visualViewport?.width ?? window.innerWidth;
}

function measureCardHeight(card) {
  const computed = window.getComputedStyle(card);
  return masonryMeasuredHeight(
    card.scrollHeight,
    Number.parseFloat(computed.borderTopWidth),
    Number.parseFloat(computed.borderBottomWidth),
  );
}

function captureScrollAnchor(cards) {
  if (window.scrollY <= 0) return null;

  const stickyControls = document.querySelector(".process-section");
  const stickyRect = stickyControls?.getBoundingClientRect();
  const anchorLine = stickyRect && stickyRect.top <= 0 ? stickyRect.bottom : 0;
  const viewportBottom = window.innerHeight;

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (rect.bottom > anchorLine && rect.top < viewportBottom) {
      return { card, top: rect.top };
    }
  }
  return null;
}

function restoreScrollAnchor(anchor) {
  if (!anchor?.card?.isConnected) return;
  const nextTop = anchor.card.getBoundingClientRect().top;
  const delta = nextTop - anchor.top;
  if (Math.abs(delta) >= 0.5) window.scrollBy(0, delta);
}

function layoutMasonryGrid(
  resizeObserver,
  observedCards,
  requestedCards = null,
  preserveScroll = true,
) {
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
    if (!observedCards.has(card)) {
      observedCards.add(card);
      resizeObserver?.observe(card);
    }
  }

  const targets = requestedCards
    ? requestedCards.filter((card) => currentCards.has(card))
    : cards;
  if (targets.length === 0) return;

  const anchor = preserveScroll ? captureScrollAnchor(cards) : null;
  let changed = false;

  for (const card of targets) {
    const span = masonryRowSpan(
      measureCardHeight(card),
      rowHeight,
      rowGap,
    );
    if (card.dataset.masonrySpan === String(span)) continue;
    card.dataset.masonrySpan = String(span);
    card.style.gridRowEnd = `span ${span}`;
    changed = true;
  }

  if (changed) restoreScrollAnchor(anchor);
}

export default function GalleryEnhancements() {
  useEffect(() => {
    let titleTapState = { count: 0, lastTap: 0 };
    let adminNavigationStarted = false;
    let layoutFrame = null;
    let layoutAllPending = false;
    let preserveNextLayout = true;
    let suppressAnchorUntil = 0;
    let lastViewportWidth = currentViewportWidth();
    const pendingCards = new Set();
    const observedCards = new Set();
    const archiveGallery = document.getElementById("archive-gallery");
    let resizeObserver = null;

    const scheduleLayout = (cards = null, { preserveScroll = true } = {}) => {
      if (cards === null) {
        layoutAllPending = true;
        pendingCards.clear();
      } else if (!layoutAllPending) {
        for (const card of cards) pendingCards.add(card);
      }
      if (!preserveScroll || Date.now() < suppressAnchorUntil) {
        preserveNextLayout = false;
      }
      if (layoutFrame !== null) return;

      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = null;
        const requestedCards = layoutAllPending ? null : [...pendingCards];
        const preserveScrollForRun = preserveNextLayout;
        layoutAllPending = false;
        preserveNextLayout = true;
        pendingCards.clear();
        layoutMasonryGrid(
          resizeObserver,
          observedCards,
          requestedCards,
          preserveScrollForRun,
        );
      });
    };

    resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver((entries) =>
            scheduleLayout(
              entries
                .map((entry) => entry.target)
                .filter((target) => target.classList.contains("photo-card")),
            ),
          )
        : null;

    const mutationObserver =
      typeof MutationObserver === "function" && archiveGallery
        ? new MutationObserver((mutations) => {
            const addedCards = new Set();
            for (const mutation of mutations) {
              for (const node of mutation.removedNodes) {
                for (const card of collectPhotoCards(node)) {
                  resizeObserver?.unobserve(card);
                  observedCards.delete(card);
                  pendingCards.delete(card);
                }
              }
              for (const node of mutation.addedNodes) {
                for (const card of collectPhotoCards(node)) addedCards.add(card);
              }
            }
            if (addedCards.size > 0) scheduleLayout([...addedCards]);
          })
        : null;

    const onDocumentLoad = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      const card = element?.closest(".photo-card");
      if (card?.closest(".masonry-grid")) scheduleLayout([card]);
    };

    const onViewportResize = () => {
      const nextWidth = currentViewportWidth();
      if (!viewportWidthChanged(lastViewportWidth, nextWidth)) return;
      lastViewportWidth = nextWidth;
      scheduleLayout();
    };

    const onDocumentClick = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;

      if (element.closest(".process-chip, .collection-tab")) {
        suppressAnchorUntil = Date.now() + 700;
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
    document.addEventListener("load", onDocumentLoad, true);
    window.addEventListener("resize", onViewportResize);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    mutationObserver?.observe(archiveGallery, {
      childList: true,
      subtree: true,
    });
    scheduleLayout();

    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("load", onDocumentLoad, true);
      window.removeEventListener("resize", onViewportResize);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      pendingCards.clear();
      observedCards.clear();
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
    };
  }, []);

  return null;
}
