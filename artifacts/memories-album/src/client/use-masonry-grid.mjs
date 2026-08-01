import { useEffect, useRef } from "react";
import {
  masonryMeasuredHeight,
  masonryRowSpan,
  viewportWidthChanged,
} from "./gallery-enhancement-model.mjs";

function photoCards(grid) {
  return [...grid.children].filter((element) =>
    element.classList.contains("photo-card"),
  );
}

function measureCardHeight(card) {
  const computed = window.getComputedStyle(card);
  return masonryMeasuredHeight(
    card.scrollHeight,
    Number.parseFloat(computed.borderTopWidth),
    Number.parseFloat(computed.borderBottomWidth),
  );
}

function currentViewportWidth() {
  return window.visualViewport?.width ?? window.innerWidth;
}

export function useMasonryGrid(layoutIdentity) {
  const gridRef = useRef(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    let layoutFrame = null;
    let layoutAllPending = false;
    let lastViewportWidth = currentViewportWidth();
    const pendingCards = new Set();
    const observedCards = new Set();

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver((entries) => {
            for (const entry of entries) {
              if (entry.target.parentElement === grid) {
                pendingCards.add(entry.target);
              }
            }
            scheduleLayout();
          })
        : null;

    const syncObservedCards = () => {
      const currentCards = new Set(photoCards(grid));
      for (const card of observedCards) {
        if (currentCards.has(card)) continue;
        resizeObserver?.unobserve(card);
        observedCards.delete(card);
        pendingCards.delete(card);
      }
      for (const card of currentCards) {
        if (observedCards.has(card)) continue;
        observedCards.add(card);
        resizeObserver?.observe(card);
      }
      return [...currentCards];
    };

    const layout = () => {
      const cards = syncObservedCards();
      const computed = window.getComputedStyle(grid);
      const rowHeight = Number.parseFloat(computed.gridAutoRows) || 8;
      const rowGap = Number.parseFloat(computed.rowGap) || 0;
      const targets = layoutAllPending
        ? cards
        : [...pendingCards].filter((card) => card.parentElement === grid);

      layoutAllPending = false;
      pendingCards.clear();

      for (const card of targets) {
        const span = masonryRowSpan(
          measureCardHeight(card),
          rowHeight,
          rowGap,
        );
        if (card.dataset.masonrySpan === String(span)) continue;
        card.dataset.masonrySpan = String(span);
        card.style.gridRowEnd = `span ${span}`;
      }
    };

    function scheduleLayout({ all = false } = {}) {
      if (all) {
        layoutAllPending = true;
        pendingCards.clear();
      }
      if (layoutFrame !== null) return;
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = null;
        layout();
      });
    }

    const mutationObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => scheduleLayout({ all: true }))
        : null;

    const onLoad = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      const card = element?.closest(".photo-card");
      if (card?.parentElement !== grid) return;
      pendingCards.add(card);
      scheduleLayout();
    };

    const onViewportResize = () => {
      const nextWidth = currentViewportWidth();
      if (!viewportWidthChanged(lastViewportWidth, nextWidth)) return;
      lastViewportWidth = nextWidth;
      scheduleLayout({ all: true });
    };

    grid.addEventListener("load", onLoad, true);
    window.addEventListener("resize", onViewportResize);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    mutationObserver?.observe(grid, { childList: true });
    scheduleLayout({ all: true });

    return () => {
      grid.removeEventListener("load", onLoad, true);
      window.removeEventListener("resize", onViewportResize);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      observedCards.clear();
      pendingCards.clear();
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
    };
  }, [layoutIdentity]);

  return gridRef;
}
