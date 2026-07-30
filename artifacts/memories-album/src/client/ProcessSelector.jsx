import { useEffect, useState } from "react";
import ProcessWheel from "./ProcessWheel.jsx";

const DEFAULT_SETTINGS = {
  processWheelEnabled: false,
  processWheelVisibleCount: 6,
};

let settingsPromise;

async function processSelectorSettings() {
  settingsPromise ??= fetch("/Memories/api/settings", {
    headers: { Accept: "application/json" },
  })
    .then((response) => (response.ok ? response.json() : {}))
    .then((settings) => ({
      processWheelEnabled: settings.processWheelEnabled === true,
      processWheelVisibleCount: Number.isInteger(settings.processWheelVisibleCount)
        ? settings.processWheelVisibleCount
        : DEFAULT_SETTINGS.processWheelVisibleCount,
    }))
    .catch(() => DEFAULT_SETTINGS);
  return settingsPromise;
}

function scrollToGalleryStart() {
  const gallery = document.getElementById("archive-gallery");
  if (!gallery) return;
  const stickyControls = document.querySelector(".process-section");
  const stickyHeight = stickyControls?.getBoundingClientRect().height ?? 0;
  const top =
    window.scrollY + gallery.getBoundingClientRect().top - stickyHeight - 10;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function requestGalleryStartScroll() {
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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void processSelectorSettings().then((nextSettings) => {
      if (!cancelled) setSettings(nextSettings);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (settings.processWheelEnabled) {
    const selectWithTraditionalPositioning = (id) => {
      props.onSelect(id);
      requestGalleryStartScroll();
    };
    return (
      <ProcessWheel
        {...props}
        onSelect={selectWithTraditionalPositioning}
        visibleCount={settings.processWheelVisibleCount}
      />
    );
  }

  return <TraditionalSelector {...props} />;
}
