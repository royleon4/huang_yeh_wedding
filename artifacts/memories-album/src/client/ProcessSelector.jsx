import { useEffect, useState } from "react";
import ProcessWheel from "./ProcessWheel.jsx";

let settingsPromise;

async function processWheelEnabled() {
  settingsPromise ??= fetch("/Memories/api/settings", {
    headers: { Accept: "application/json" },
  })
    .then((response) => (response.ok ? response.json() : {}))
    .then((settings) => settings.processWheelEnabled === true)
    .catch(() => false);
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
  const [wheelEnabled, setWheelEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void processWheelEnabled().then((enabled) => {
      if (!cancelled) setWheelEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return wheelEnabled ? (
    <ProcessWheel {...props} />
  ) : (
    <TraditionalSelector {...props} />
  );
}
