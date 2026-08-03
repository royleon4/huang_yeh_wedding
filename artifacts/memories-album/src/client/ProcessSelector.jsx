import { useEffect, useRef } from "react";
import { processWheelLoopsForAlbum } from "../process-selector-settings.mjs";
import "./album-content-navigation.mjs";
import { getPublicBootstrap } from "./public-bootstrap.mjs";
import { requestActiveContentScroll } from "./gallery-navigation.mjs";
import ProcessWheel from "./ProcessWheel.jsx";
import { suspendMasonryAnchorRestoration } from "./useMasonryLayout.mjs";

export { requestGalleryStartScroll } from "./gallery-navigation.mjs";

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
          onClick={() =>
            onSelect(item.id, { source: "click", userInitiated: true })
          }
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
  const pendingSelectionRef = useRef(null);
  const albumId =
    props.albumId ?? (props.variant === "guest" ? "guest" : "wedding");

  const positionCommittedContent = () => {
    suspendMasonryAnchorRestoration();
    requestActiveContentScroll();
  };

  useEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending || pending.id !== String(props.activeId)) return;
    pendingSelectionRef.current = null;
    positionCommittedContent();
  }, [props.activeId]);

  const selectWithPositioning = (id, context) => {
    const selectionId = String(id);
    pendingSelectionRef.current = { id: selectionId };
    suspendMasonryAnchorRestoration();
    props.onSelect(id, context);

    if (selectionId === String(props.activeId)) {
      pendingSelectionRef.current = null;
      positionCommittedContent();
    }
  };

  if (settings.processWheelEnabled) {
    return (
      <ProcessWheel
        {...props}
        onSelect={selectWithPositioning}
        visibleCount={settings.processWheelVisibleCount}
        loop={processWheelLoopsForAlbum(settings, albumId)}
      />
    );
  }

  return <TraditionalSelector {...props} onSelect={selectWithPositioning} />;
}
