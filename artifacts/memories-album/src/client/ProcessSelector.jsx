import { processWheelLoopsForAlbum } from "../process-selector-settings.mjs";
import { getPublicBootstrap } from "./public-bootstrap.mjs";
import ProcessWheel from "./ProcessWheel.jsx";

// Kept as a compatibility export while the transformed route module still
// imports it. Label and route changes intentionally no longer move the page.
export function requestGalleryStartScroll() {}

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
