import { useEffect, useRef } from "react";
import {
  masonryMeasuredHeight,
  masonryRowSpan,
  viewportWidthChanged,
} from "./gallery-enhancement-model.mjs";

let anchorSuppressedUntil = 0;

export function suspendMasonryAnchorRestoration(
  durationMs = 700,
  now = Date.now(),
) {
  anchorSuppressedUntil = Math.max(
    anchorSuppressedUntil,
    Number(now) + Math.max(0, Number(durationMs) || 0),
  );
}

export function masonryAnchorRestorationSuppressed(now = Date.now()) {
  return Number(now) < anchorSuppressedUntil;
}

function currentViewportWidth(windowRef) {
  return windowRef.visualViewport?.width ?? windowRef.innerWidth;
}

function measureCardHeight(windowRef, card) {
  const computed = windowRef.getComputedStyle(card);
  return masonryMeasuredHeight(
    card.scrollHeight,
    Number.parseFloat(computed.borderTopWidth),
    Number.parseFloat(computed.borderBottomWidth),
  );
}

function captureScrollAnchor(documentRef, windowRef, cards) {
  if (windowRef.scrollY <= 0) return null;

  const stickyControls = documentRef.querySelector(".process-section");
  const stickyRect = stickyControls?.getBoundingClientRect();
  const anchorLine = stickyRect && stickyRect.top <= 0 ? stickyRect.bottom : 0;
  const viewportBottom = windowRef.innerHeight;

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (rect.bottom > anchorLine && rect.top < viewportBottom) {
      return { card, top: rect.top };
    }
  }
  return null;
}

function restoreScrollAnchor(windowRef, anchor) {
  if (!anchor?.card?.isConnected) return;
  const nextTop = anchor.card.getBoundingClientRect().top;
  const delta = nextTop - anchor.top;
  if (Math.abs(delta) >= 0.5) windowRef.scrollBy(0, delta);
}

function layoutGrid({
  documentRef,
  windowRef,
  grid,
  resizeObserver,
  observedCards,
  requestedCards = null,
  preserveScroll = true,
}) {
  if (!grid?.isConnected) return;

  const computed = windowRef.getComputedStyle(grid);
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

  const anchor =
    preserveScroll && !masonryAnchorRestorationSuppressed()
      ? captureScrollAnchor(documentRef, windowRef, cards)
      : null;
  let changed = false;

  for (const card of targets) {
    const span = masonryRowSpan(
      measureCardHeight(windowRef, card),
      rowHeight,
      rowGap,
    );
    if (card.dataset.masonrySpan === String(span)) continue;
    card.dataset.masonrySpan = String(span);
    card.style.gridRowEnd = `span ${span}`;
    changed = true;
  }

  if (changed) restoreScrollAnchor(windowRef, anchor);
}

export default function useMasonryLayout() {
  const gridRef = useRef(null);

  useEffect(() => {
    const grid = gridRef.current;
    const documentRef = grid?.ownerDocument;
    const windowRef = documentRef?.defaultView;
    if (!grid || !documentRef || !windowRef) return undefined;

    let layoutFrame = null;
    let layoutAllPending = false;
    let preserveNextLayout = true;
    let lastViewportWidth = currentViewportWidth(windowRef);
    const pendingCards = new Set();
    const observedCards = new Set();
    let resizeObserver = null;

    const scheduleLayout = (cards = null, { preserveScroll = true } = {}) => {
      if (cards === null) {
        layoutAllPending = true;
        pendingCards.clear();
      } else if (!layoutAllPending) {
        for (const card of cards) pendingCards.add(card);
      }
      if (!preserveScroll || masonryAnchorRestorationSuppressed()) {
        preserveNextLayout = false;
      }
      if (layoutFrame !== null) return;

      layoutFrame = windowRef.requestAnimationFrame(() => {
        layoutFrame = null;
        const requestedCards = layoutAllPending ? null : [...pendingCards];
        const preserveScrollForRun = preserveNextLayout;
        layoutAllPending = false;
        preserveNextLayout = true;
        pendingCards.clear();
        layoutGrid({
          documentRef,
          windowRef,
          grid,
          resizeObserver,
          observedCards,
          requestedCards,
          preserveScroll: preserveScrollForRun,
        });
      });
    };

    resizeObserver =
      typeof windowRef.ResizeObserver === "function"
        ? new windowRef.ResizeObserver((entries) =>
            scheduleLayout(
              entries
                .map((entry) => entry.target)
                .filter((target) => target.classList.contains("photo-card")),
            ),
          )
        : null;

    const mutationObserver =
      typeof windowRef.MutationObserver === "function"
        ? new windowRef.MutationObserver(() => scheduleLayout())
        : null;

    const onGridLoad = (event) => {
      const element =
        event.target instanceof windowRef.Element ? event.target : null;
      const card = element?.closest(".photo-card");
      if (card?.parentElement === grid) scheduleLayout([card]);
    };

    const onViewportResize = () => {
      const nextWidth = currentViewportWidth(windowRef);
      if (!viewportWidthChanged(lastViewportWidth, nextWidth)) return;
      lastViewportWidth = nextWidth;
      scheduleLayout();
    };

    grid.addEventListener("load", onGridLoad, true);
    windowRef.addEventListener("resize", onViewportResize);
    windowRef.visualViewport?.addEventListener("resize", onViewportResize);
    mutationObserver?.observe(grid, { childList: true });
    scheduleLayout(null, { preserveScroll: false });

    return () => {
      grid.removeEventListener("load", onGridLoad, true);
      windowRef.removeEventListener("resize", onViewportResize);
      windowRef.visualViewport?.removeEventListener("resize", onViewportResize);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      pendingCards.clear();
      observedCards.clear();
      if (layoutFrame !== null) windowRef.cancelAnimationFrame(layoutFrame);
    };
  }, []);

  return gridRef;
}
