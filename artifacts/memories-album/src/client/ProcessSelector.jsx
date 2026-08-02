import { useEffect } from "react";
import { processWheelLoopsForAlbum } from "../process-selector-settings.mjs";
import { getPublicBootstrap } from "./public-bootstrap.mjs";
import ProcessWheel from "./ProcessWheel.jsx";

let lastObservedSelectionKey = null;

// Kept as a compatibility export while the transformed route module still
// imports it. Label and route changes are handled by the selector's single
// post-selection scroll path instead of route-level positioning.
export function requestGalleryStartScroll() {}

export function scrollSelectedLabelToContentStart(
  documentNode = globalThis.document,
) {
  const selector = documentNode?.querySelector?.(".process-selector-sticky");
  if (!selector || typeof selector.scrollIntoView !== "function") return false;
  selector.scrollIntoView({
    behavior: "auto",
    block: "start",
    inline: "nearest",
  });
  return true;
}

function useSelectedLabelAutoScroll({ albumId, activeId, enabled }) {
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
}

function TraditionalSelector({ items, activeId, onSelect, ariaLabel, variant }) {
  return (
    <div className="process-strip" role="list" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`process-chip ${variant === "guest" ? "guest" : ""} ${
            activeId === item.id ? "active" : ""
          }`}
          onClick={() => onSelect(item.id)}
        >
          {item.number && <span>{item.number}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function ProcessSelector(props) {
  const settings = getPublicBootstrap().settings;
  const albumId =
    props.albumId ?? (props.variant === "guest" ? "guest" : "wedding");

  useSelectedLabelAutoScroll({
    albumId,
    activeId: props.activeId,
    enabled: settings.processLabelAutoScrollEnabled !== false,
  });

  if (settings.processWheelEnabled) {
    return (
      <ProcessWheel
        {...props}
        visibleCount={settings.processWheelVisibleCount}
        loop={processWheelLoopsForAlbum(settings, albumId)}
      />
    );
  }

  return <TraditionalSelector {...props} />;
}
