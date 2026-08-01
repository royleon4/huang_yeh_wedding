import { useEffect, useMemo, useRef, useState } from "react";
import {
  logicalAdjacentIndex,
  renderedWheelItems,
} from "./process-wheel-model.mjs";
import "./process-wheel.css";

const DEFAULT_VISIBLE_COUNT = 6;
const MIN_VISIBLE_COUNT = 3;
const MAX_VISIBLE_COUNT = 8;
const PROGRAMMATIC_SCROLL_TIMEOUT_MS = 1200;

function itemCenterOffset(container, item) {
  if (!container || !item) return 0;
  const containerRect = container.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  return (
    itemRect.left +
    itemRect.width / 2 -
    (containerRect.left + containerRect.width / 2)
  );
}

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

function realWheelKey(id) {
  return `real-${String(id)}`;
}

export default function ProcessWheel({
  items,
  activeId,
  onSelect,
  ariaLabel,
  variant = "process",
  visibleCount = DEFAULT_VISIBLE_COUNT,
  loop = false,
}) {
  const wheelRef = useRef(null);
  const selectTimerRef = useRef(null);
  const frameRef = useRef(null);
  const programmaticTargetRef = useRef(null);
  const programmaticTimerRef = useRef(null);
  const [activeVisualKey, setActiveVisualKey] = useState(() =>
    realWheelKey(activeId),
  );
  const mobileVisibleCount = normalizedVisibleCount(visibleCount);
  const mobileItemWidth = `calc(${100 / mobileVisibleCount}% - 0.46rem)`;
  const wheelItems = useMemo(
    () => renderedWheelItems(items, loop),
    [items, loop],
  );

  const cancelProgrammaticScroll = () => {
    globalThis.clearTimeout(programmaticTimerRef.current);
    programmaticTimerRef.current = null;
    programmaticTargetRef.current = null;
  };

  const jumpCloneToRealItem = (element) => {
    const wheel = wheelRef.current;
    const clone = element?.dataset.wheelClone;
    if (!wheel || !clone) return element;
    const real = wheel.querySelector(
      `[data-wheel-real-id="${CSS.escape(element.dataset.wheelId)}"]`,
    );
    if (!real) return element;
    wheel.scrollTo({
      left: wheel.scrollLeft + itemCenterOffset(wheel, real),
      behavior: "auto",
    });
    return real;
  };

  const selectCenteredItem = () => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    const targetKey = programmaticTargetRef.current;
    if (targetKey) {
      const target = wheel.querySelector(
        `[data-wheel-key="${CSS.escape(targetKey)}"]`,
      );
      if (!target || Math.abs(itemCenterOffset(wheel, target)) > 3) return;
      cancelProgrammaticScroll();
    }

    const centered = closestItem(wheel);
    const item = jumpCloneToRealItem(centered);
    const id = item?.dataset.wheelId;
    const visualKey = item?.dataset.wheelKey;
    if (visualKey) setActiveVisualKey(String(visualKey));
    if (id && id !== activeId) onSelect(id);
  };

  const scheduleSelection = () => {
    globalThis.clearTimeout(selectTimerRef.current);
    selectTimerRef.current = globalThis.setTimeout(selectCenteredItem, 90);
  };

  const startProgrammaticScroll = (element, behavior = "smooth") => {
    const wheel = wheelRef.current;
    if (!wheel || !element) return;

    globalThis.clearTimeout(selectTimerRef.current);
    globalThis.clearTimeout(programmaticTimerRef.current);
    const targetKey = String(element.dataset.wheelKey);
    const offset = itemCenterOffset(wheel, element);
    programmaticTargetRef.current = targetKey;
    setActiveVisualKey(targetKey);

    if (Math.abs(offset) <= 2) {
      scheduleSelection();
      return;
    }

    wheel.scrollTo({
      left: wheel.scrollLeft + offset,
      behavior,
    });
    programmaticTimerRef.current = globalThis.setTimeout(() => {
      if (programmaticTargetRef.current !== targetKey) return;
      cancelProgrammaticScroll();
      scheduleSelection();
    }, PROGRAMMATIC_SCROLL_TIMEOUT_MS);
  };

  useEffect(() => {
    const wheel = wheelRef.current;
    const pendingTargetKey = programmaticTargetRef.current;
    const pendingTarget = pendingTargetKey
      ? wheel?.querySelector(
          `[data-wheel-key="${CSS.escape(pendingTargetKey)}"]`,
        )
      : null;
    const active =
      pendingTarget?.dataset.wheelId === String(activeId)
        ? pendingTarget
        : wheel?.querySelector(
            `[data-wheel-real-id="${CSS.escape(String(activeId))}"]`,
          );
    if (!wheel || !active) return;
    frameRef.current = globalThis.requestAnimationFrame(() => {
      const targetKey = String(active.dataset.wheelKey);
      setActiveVisualKey(targetKey);
      const offset = itemCenterOffset(wheel, active);
      if (Math.abs(offset) <= 2) {
        if (programmaticTargetRef.current === targetKey) {
          scheduleSelection();
        }
        return;
      }
      if (programmaticTargetRef.current !== targetKey) {
        startProgrammaticScroll(active);
      }
    });
    return () => globalThis.cancelAnimationFrame(frameRef.current);
  }, [activeId, items, loop]);

  useEffect(
    () => () => {
      globalThis.clearTimeout(selectTimerRef.current);
      globalThis.clearTimeout(programmaticTimerRef.current);
      globalThis.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const choose = (id, element) => {
    startProgrammaticScroll(element);
    onSelect(id);
  };

  const handleWheel = (event) => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    if (!delta) return;
    const canMoveBackward = wheel.scrollLeft > 1;
    const canMoveForward =
      wheel.scrollLeft < wheel.scrollWidth - wheel.clientWidth - 1;
    if ((delta < 0 && !canMoveBackward) || (delta > 0 && !canMoveForward)) {
      return;
    }
    event.preventDefault();
    cancelProgrammaticScroll();
    wheel.scrollBy({ left: delta, behavior: "auto" });
    scheduleSelection();
  };

  const handleKeyDown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const currentIndex = Math.max(
      0,
      items.findIndex((item) => item.id === activeId),
    );
    const nextIndex = logicalAdjacentIndex(
      currentIndex,
      items.length,
      event.key === "ArrowRight" ? 1 : -1,
      loop,
    );
    const next = items[nextIndex];
    if (!next) return;
    const element = wheelRef.current?.querySelector(
      `[data-wheel-real-id="${CSS.escape(String(next.id))}"]`,
    );
    choose(next.id, element);
    element?.focus({ preventScroll: true });
  };

  if (!items.length) return null;

  return (
    <div
      className={`process-wheel-shell ${variant === "guest" ? "guest" : ""}`}
      style={{ "--wheel-mobile-item-width": mobileItemWidth }}
      data-wheel-loop={loop && items.length > 1 ? "true" : "false"}
    >
      <div className="process-wheel-focus" aria-hidden="true" />
      <div
        ref={wheelRef}
        className="process-wheel"
        role="tablist"
        aria-label={ariaLabel}
        onPointerDown={cancelProgrammaticScroll}
        onScroll={scheduleSelection}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      >
        {wheelItems.map(({ item, key, clone }) => {
          const logicallyActive = item.id === activeId;
          const visuallyActive = key === activeVisualKey;
          const className = `process-wheel-item ${
            visuallyActive ? "active" : ""
          } ${clone ? "process-wheel-clone" : ""}`;
          return (
            <button
              key={key}
              type="button"
              role={clone ? undefined : "tab"}
              aria-selected={clone ? undefined : logicallyActive}
              aria-label={clone ? item.label : undefined}
              tabIndex={clone ? -1 : logicallyActive ? 0 : -1}
              className={className}
              data-wheel-id={item.id}
              data-wheel-key={key}
              data-wheel-clone={clone || undefined}
              data-wheel-real-id={clone ? undefined : item.id}
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
