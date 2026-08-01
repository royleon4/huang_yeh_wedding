import { processWheelLoopsForAlbum } from "../process-selector-settings.mjs";
import { getPublicBootstrap } from "./public-bootstrap.mjs";
import ProcessWheel from "./ProcessWheel.jsx";

function scrollToGalleryStart() {
  const gallery = document.getElementById("archive-gallery");
  if (!gallery) return;
  const stickyControls = document.querySelector(".process-section");
  const stickyHeight = stickyControls?.getBoundingClientRect().height ?? 0;
  const top =
    window.scrollY + gallery.getBoundingClientRect().top - stickyHeight - 10;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export function requestGalleryStartScroll() {
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(scrollToGalleryStart),
  );
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
  const albumId = props.albumId ?? (props.variant === "guest" ? "guest" : "wedding");

  const selectWithTraditionalPositioning = (id) => {
    props.onSelect(id);
    requestGalleryStartScroll();
  };

  if (settings.processWheelEnabled) {
    return (
      <ProcessWheel
        {...props}
        onSelect={selectWithTraditionalPositioning}
        visibleCount={settings.processWheelVisibleCount}
        loop={processWheelLoopsForAlbum(settings, albumId)}
      />
    );
  }

  return (
    <TraditionalSelector
      {...props}
      onSelect={selectWithTraditionalPositioning}
    />
  );
}
