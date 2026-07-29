import { useEffect, useRef } from "react";
import { nextDialogFocusIndex } from "./dialog-model.mjs";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function visibleFocusableElements(container) {
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (element) =>
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
}

function makeBackgroundInert(dialog) {
  const changed = [];
  let current = dialog;
  while (current?.parentElement) {
    const parent = current.parentElement;
    for (const sibling of parent.children) {
      if (sibling === current) continue;
      changed.push({
        element: sibling,
        inert: sibling.inert,
        ariaHidden: sibling.getAttribute("aria-hidden"),
      });
      sibling.inert = true;
      sibling.setAttribute("aria-hidden", "true");
    }
    if (parent === document.body) break;
    current = parent;
  }
  return () => {
    for (const item of changed) {
      item.element.inert = item.inert;
      if (item.ariaHidden === null) {
        item.element.removeAttribute("aria-hidden");
      } else {
        item.element.setAttribute("aria-hidden", item.ariaHidden);
      }
    }
  };
}

export function useAccessibleDialog({
  containerRef,
  initialFocusRef,
  onClose,
  enabled = true,
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!enabled) return undefined;
    const dialog = containerRef.current;
    if (!dialog) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const restoreBackground = makeBackgroundInert(dialog);
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const target =
        initialFocusRef?.current ??
        visibleFocusableElements(dialog)[0] ??
        dialog;
      target.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focusInitial);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = visibleFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const current = focusable.indexOf(document.activeElement);
      const next = nextDialogFocusIndex({
        current,
        count: focusable.length,
        reverse: event.shiftKey,
      });
      event.preventDefault();
      focusable[next].focus({ preventScroll: true });
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreBackground();
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [containerRef, enabled, initialFocusRef]);
}
