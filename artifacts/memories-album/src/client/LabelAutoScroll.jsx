import { useEffect } from "react";

let lastObservedSelectionKey = null;

export function preferredLabelScrollBehavior(
  windowNode = globalThis.window,
) {
  const reduceMotion = windowNode
    ?.matchMedia?.("(prefers-reduced-motion: reduce)")
    ?.matches;
  return reduceMotion ? "auto" : "smooth";
}

export function scrollSelectedLabelToContentStart(
  documentNode = globalThis.document,
  windowNode = globalThis.window,
) {
  const selector = documentNode?.querySelector?.(".process-selector-sticky");
  if (!selector || typeof selector.scrollIntoView !== "function") return false;
  selector.scrollIntoView({
    behavior: preferredLabelScrollBehavior(windowNode),
    block: "start",
    inline: "nearest",
  });
  return true;
}

export default function LabelAutoScroll({ albumId, activeId, enabled }) {
  useEffect(() => {
    const selectionKey = `${String(albumId ?? "")}:${String(activeId ?? "")}`;
    if (lastObservedSelectionKey === null) {
      lastObservedSelectionKey = selectionKey;
      return;
    }
    if (lastObservedSelectionKey === selectionKey) return;
    lastObservedSelectionKey = selectionKey;
    if (!enabled) return;
    scrollSelectedLabelToContentStart();
  }, [activeId, albumId, enabled]);

  return null;
}
