import { processWheelLoopsForAlbum } from "../process-selector-settings.mjs";
import { getPublicBootstrap } from "./public-bootstrap.mjs";
import { requestGalleryStartScroll } from "./gallery-navigation.mjs";
import ProcessWheel from "./ProcessWheel.jsx";
import { suspendMasonryAnchorRestoration } from "./useMasonryLayout.mjs";

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
  const albumId =
    props.albumId ?? (props.variant === "guest" ? "guest" : "wedding");

  const selectWithPositioning = (id, context) => {
    suspendMasonryAnchorRestoration();
    props.onSelect(id, context);
    requestGalleryStartScroll();
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
