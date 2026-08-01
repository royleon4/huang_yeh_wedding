import { useCallback, useLayoutEffect, useRef } from "react";
import { processWheelLoopsForAlbum } from "../process-selector-settings.mjs";
import { getPublicBootstrap } from "./public-bootstrap.mjs";
import ProcessWheel from "./ProcessWheel.jsx";

let activePositionRequester = null;
let pendingExternalPositionRequest = false;

function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function centerTraditionalActiveLabel(host, behavior) {
  const strip = host?.querySelector(".process-strip");
  if (!strip) return;
  const active = [...strip.querySelectorAll("[data-selector-id]")].find(
    (item) => item.dataset.selectorId === host.dataset.activeLabel,
  );
  if (!active) return;
  const left =
    active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
  strip.scrollTo({ left: Math.max(0, left), behavior });
}

function positionActiveLabelContent(host) {
  const gallery = document.getElementById("archive-gallery");
  const stickyControls =
    host?.closest(".process-section") ?? document.querySelector(".process-section");
  if (!host || !gallery || !stickyControls) return;

  // The controls are independently scrollable on short screens. Always expose
  // the label selector before measuring the sticky area and positioning content.
  stickyControls.scrollTop = stickyControls.scrollHeight;

  const behavior = prefersReducedMotion() ? "auto" : "smooth";
  centerTraditionalActiveLabel(host, behavior);

  const stickyHeight = stickyControls.getBoundingClientRect().height;
  const top =
    window.scrollY + gallery.getBoundingClientRect().top - stickyHeight - 10;
  window.scrollTo({ top: Math.max(0, top), behavior });
}

export function requestGalleryStartScroll() {
  if (activePositionRequester) {
    activePositionRequester();
    return;
  }
  pendingExternalPositionRequest = true;
}

function TraditionalSelector({ items, activeId, onSelect, ariaLabel, variant }) {
  return (
    <div className="process-strip" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-selector-id={item.id}
            className={`process-chip ${variant === "guest" ? "guest" : ""} ${
              active ? "active" : ""
            }`}
            onClick={() => onSelect(item.id)}
          >
            {item.number && <span>{item.number}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ProcessSelector(props) {
  const settings = getPublicBootstrap().settings;
  const albumId =
    props.albumId ?? (props.variant === "guest" ? "guest" : "wedding");
  const hostRef = useRef(null);
  const frameRef = useRef([]);
  const previousActiveIdRef = useRef(props.activeId);

  const cancelScheduledPosition = useCallback(() => {
    for (const frame of frameRef.current) {
      globalThis.cancelAnimationFrame(frame);
    }
    frameRef.current = [];
  }, []);

  const scheduleActivePosition = useCallback(() => {
    cancelScheduledPosition();
    const firstFrame = globalThis.requestAnimationFrame(() => {
      const host = hostRef.current;
      if (!host) return;
      // React has committed the selected label. One more frame lets the new
      // video, article, empty state, or photo grid establish its start point.
      const secondFrame = globalThis.requestAnimationFrame(() => {
        positionActiveLabelContent(hostRef.current);
        frameRef.current = [];
      });
      frameRef.current.push(secondFrame);
    });
    frameRef.current.push(firstFrame);
  }, [cancelScheduledPosition]);

  useLayoutEffect(() => {
    activePositionRequester = scheduleActivePosition;
    if (pendingExternalPositionRequest) {
      pendingExternalPositionRequest = false;
      scheduleActivePosition();
    }
    return () => {
      if (activePositionRequester === scheduleActivePosition) {
        activePositionRequester = null;
      }
      cancelScheduledPosition();
    };
  }, [cancelScheduledPosition, scheduleActivePosition]);

  useLayoutEffect(() => {
    if (previousActiveIdRef.current === props.activeId) return;
    previousActiveIdRef.current = props.activeId;
    scheduleActivePosition();
  }, [props.activeId, scheduleActivePosition]);

  const selectLabel = (id) => {
    // Click, touch-swipe, mouse-wheel, and keyboard changes all converge here.
    // Positioning happens only after activeId is committed, so every path uses
    // the same rendered label and content measurements.
    props.onSelect(id);
  };

  const selector = settings.processWheelEnabled ? (
    <ProcessWheel
      {...props}
      onSelect={selectLabel}
      visibleCount={settings.processWheelVisibleCount}
      loop={processWheelLoopsForAlbum(settings, albumId)}
    />
  ) : (
    <TraditionalSelector {...props} onSelect={selectLabel} />
  );

  return (
    <div
      ref={hostRef}
      className="process-selector-host"
      data-active-label={props.activeId}
    >
      {selector}
    </div>
  );
}
