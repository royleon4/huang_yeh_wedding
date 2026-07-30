import { useEffect, useRef } from "react";
import "./process-wheel.css";

const DEFAULT_VISIBLE_COUNT = 6;
const MIN_VISIBLE_COUNT = 3;
const MAX_VISIBLE_COUNT = 8;

function closestItem(container) {
  if (!container) return null;
  const center = container.getBoundingClientRect().left + container.clientWidth / 2;
  let closest = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const item of container.querySelectorAll("[data-wheel-id]")) {
    const rect = item.getBoundingClientRect();
    const nextDistance = Math.abs(rect.left + rect.width / 2 - center);
    if (nextDistance < distance) {
      closest = item;
      distance = nextDistance;
    }
  }
  return closest;
}

function normalizedVisibleCount(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_VISIBLE_COUNT;
  return Math.min(MAX_VISIBLE_COUNT, Math.max(MIN_VISIBLE_COUNT, parsed));
}

export default function ProcessWheel({
  items,
  activeId,
  onSelect,
  ariaLabel,
  variant = "process",
  visibleCount = DEFAULT_VISIBLE_COUNT,
}) {
  const wheelRef = useRef(null);
  const selectTimerRef = useRef(null);
  const frameRef = useRef(null);
  const mobileVisibleCount = normalizedVisibleCount(visibleCount);
  const mobileItemWidth = `calc(${100 / mobileVisibleCount}% - 0.46rem)`;

  const selectCenteredItem = () => {
    const item = closestItem(wheelRef.current);
    const id = item?.dataset.wheelId;
    if (id && id !== activeId) onSelect(id);
  };

  const scheduleSelection = () => {
    globalThis.clearTimeout(selectTimerRef.current);
    selectTimerRef.current = globalThis.setTimeout(selectCenteredItem, 90);
  };

  useEffect(() => {
    const wheel = wheelRef.current;
    const active = wheel?.querySelector(
      `[data-wheel-id="${CSS.escape(String(activeId))}"]`,
    );
    if (!wheel || !active) return;
    frameRef.current = globalThis.requestAnimationFrame(() => {
      const wheelRect = wheel.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const offset =
        activeRect.left + activeRect.width / 2 -
        (wheelRect.left + wheelRect.width / 2);
      if (Math.abs(offset) > 2) wheel.scrollBy({ left: offset, behavior: "smooth" });
    });
    return () => globalThis.cancelAnimationFrame(frameRef.current);
  }, [activeId, items]);

  useEffect(
    () => () => {
      globalThis.clearTimeout(selectTimerRef.current);
      globalThis.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const choose = (id, element) => {
    onSelect(id);
    element?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  const handleWheel = (event) => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    const canMoveBackward = wheel.scrollLeft > 1;
    const canMoveForward = wheel.scrollLeft < wheel.scrollWidth - wheel.clientWidth - 1;
    if ((delta < 0 && !canMoveBackward) || (delta > 0 && !canMoveForward)) return;
    event.preventDefault();
    wheel.scrollBy({ left: delta, behavior: "auto" });
    scheduleSelection();
  };

  const handleKeyDown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = Math.max(0, items.findIndex((item) => item.id === activeId));
    const nextIndex = Math.min(
      items.length - 1,
      Math.max(0, index + (event.key === "ArrowRight" ? 1 : -1)),
    );
    const next = items[nextIndex];
    const element = wheelRef.current?.querySelector(
      `[data-wheel-id="${CSS.escape(String(next.id))}"]`,
    );
    choose(next.id, element);
    element?.focus({ preventScroll: true });
  };

  if (!items.length) return null;

  return (
    <div
      className={`process-wheel-shell ${variant === "guest" ? "guest" : ""}`}
      style={{ "--wheel-mobile-item-width": mobileItemWidth }}
    >
      <div className="process-wheel-focus" aria-hidden="true" />
      <div
        ref={wheelRef}
        className="process-wheel"
        role="tablist"
        aria-label={ariaLabel}
        onScroll={scheduleSelection}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={`process-wheel-item ${active ? "active" : ""}`}
              data-wheel-id={item.id}
              onClick={(event) => choose(item.id, event.currentTarget)}
            >
              {item.number && <span>{item.number}</span>}
              <strong>{item.label}</strong>
            </button>
          );
        })}
      </div>
      <p className="process-wheel-hint" aria-hidden="true">
        ‹ 滑動選擇 ›
      </p>
    </div>
  );
}
