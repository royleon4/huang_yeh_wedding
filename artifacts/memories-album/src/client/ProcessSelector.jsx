import { useEffect, useState } from "react";
import ProcessWheel from "./ProcessWheel.jsx";

const DEFAULT_SETTINGS = {
  processWheelEnabled: false,
  processWheelVisibleCount: 6,
};

const SUBCATEGORY_SELECTED_EVENT = "memories:subcategory-selected";

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

  const selectSubcategory = (id) => {
    props.onSelect(id);
    document.dispatchEvent(new Event(SUBCATEGORY_SELECTED_EVENT));
  };
  const selectorProps = { ...props, onSelect: selectSubcategory };

  return settings.processWheelEnabled ? (
    <ProcessWheel
      {...selectorProps}
      visibleCount={settings.processWheelVisibleCount}
    />
  ) : (
    <TraditionalSelector {...selectorProps} />
  );
}
