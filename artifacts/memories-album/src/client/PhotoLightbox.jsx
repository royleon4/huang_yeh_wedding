import { useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  adjacentPhotoIndex,
  clampZoom,
  isHorizontalSwipe,
} from "./lightbox-model.mjs";

function pointerDistance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

export default function PhotoLightbox({
  photos,
  selectedIndex,
  onSelectIndex,
  onClose,
  labels,
}) {
  const photo = photos[selectedIndex];
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const closeButtonRef = useRef(null);

  const canPrevious = selectedIndex > 0;
  const canNext = selectedIndex < photos.length - 1;
  const zoomPercent = Math.round(zoom * 100);

  const resetView = () => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    pointers.current.clear();
    gesture.current = null;
  };

  const selectIndex = (nextIndex) => {
    if (nextIndex === selectedIndex || nextIndex < 0) return;
    resetView();
    setLoading(true);
    onSelectIndex(nextIndex);
  };

  const moveBy = (direction) => {
    selectIndex(adjacentPhotoIndex(selectedIndex, photos.length, direction));
  };

  const setBoundedZoom = (nextValue) => {
    const bounded = clampZoom(nextValue);
    setZoom(bounded);
    if (bounded === MIN_ZOOM) setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    resetView();
    setLoading(true);
  }, [photo?.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") moveBy(-1);
      if (event.key === "ArrowRight") moveBy(1);
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setBoundedZoom(zoom + ZOOM_STEP);
      }
      if (event.key === "-") {
        event.preventDefault();
        setBoundedZoom(zoom - ZOOM_STEP);
      }
      if (event.key === "0") resetView();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [zoom, selectedIndex, photos.length, onClose]);

  useEffect(() => {
    for (const index of [selectedIndex - 1, selectedIndex + 1]) {
      const adjacent = photos[index];
      if (!adjacent?.mediaUrl) continue;
      const image = new Image();
      image.src = adjacent.mediaUrl;
    }
  }, [photos, selectedIndex]);

  const transform = useMemo(
    () => `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
    [offset, zoom],
  );

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const active = [...pointers.current.values()];
    if (active.length === 1) {
      gesture.current = {
        mode: zoom > MIN_ZOOM ? "pan" : "swipe",
        startX: event.clientX,
        startY: event.clientY,
        baseOffset: offset,
      };
    } else if (active.length === 2) {
      gesture.current = {
        mode: "pinch",
        initialDistance: pointerDistance(active[0], active[1]),
        initialZoom: zoom,
      };
    }
  };

  const onPointerMove = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const active = [...pointers.current.values()];

    if (active.length === 2 && gesture.current?.mode === "pinch") {
      const distance = pointerDistance(active[0], active[1]);
      const ratio = distance / Math.max(gesture.current.initialDistance, 1);
      setBoundedZoom(gesture.current.initialZoom * ratio);
      return;
    }

    if (active.length === 1 && gesture.current?.mode === "pan") {
      setOffset({
        x:
          gesture.current.baseOffset.x +
          event.clientX -
          gesture.current.startX,
        y:
          gesture.current.baseOffset.y +
          event.clientY -
          gesture.current.startY,
      });
    }
  };

  const onPointerEnd = (event) => {
    const currentGesture = gesture.current;
    pointers.current.delete(event.pointerId);

    if (
      currentGesture?.mode === "swipe" &&
      zoom === MIN_ZOOM &&
      isHorizontalSwipe({
        startX: currentGesture.startX,
        startY: currentGesture.startY,
        endX: event.clientX,
        endY: event.clientY,
      })
    ) {
      moveBy(event.clientX < currentGesture.startX ? 1 : -1);
    }

    const remaining = [...pointers.current.values()];
    if (remaining.length === 1 && zoom > MIN_ZOOM) {
      gesture.current = {
        mode: "pan",
        startX: remaining[0].x,
        startY: remaining[0].y,
        baseOffset: offset,
      };
    } else if (remaining.length === 0) {
      gesture.current = null;
    }
  };

  if (!photo) return null;

  return (
    <section
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${labels.photo} ${selectedIndex + 1}`}
    >
      <div className="photo-viewer-toolbar">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={labels.close}
        >
          ×
        </button>
        <div className="photo-viewer-zoom-controls" aria-label={labels.zoomControls}>
          <button
            type="button"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setBoundedZoom(zoom - ZOOM_STEP)}
            aria-label={labels.zoomOut}
          >
            −
          </button>
          <button type="button" onClick={resetView} aria-label={labels.resetZoom}>
            {zoomPercent}%
          </button>
          <button
            type="button"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setBoundedZoom(zoom + ZOOM_STEP)}
            aria-label={labels.zoomIn}
          >
            ＋
          </button>
        </div>
      </div>

      <button
        className="photo-viewer-arrow previous"
        type="button"
        disabled={!canPrevious}
        onClick={() => moveBy(-1)}
        aria-label={labels.previous}
      >
        ‹
      </button>

      <div
        className={`photo-viewer-stage ${zoom > MIN_ZOOM ? "is-zoomed" : ""}`}
        onDoubleClick={() => setBoundedZoom(zoom === MIN_ZOOM ? 2 : MIN_ZOOM)}
        onWheel={(event) => {
          event.preventDefault();
          setBoundedZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {loading && <div className="photo-viewer-loading">{labels.loading}</div>}
        <img
          src={photo.mediaUrl}
          alt={`${labels.photo} ${selectedIndex + 1}`}
          draggable="false"
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          style={{ transform }}
        />
      </div>

      <button
        className="photo-viewer-arrow next"
        type="button"
        disabled={!canNext}
        onClick={() => moveBy(1)}
        aria-label={labels.next}
      >
        ›
      </button>

      <footer className="photo-viewer-caption">
        <span>{selectedIndex + 1} / {photos.length}</span>
        <strong>
          {photo.source === "guest" ? labels.guest : photo.uploaderName}
        </strong>
        <small>{labels.zoomHint}</small>
      </footer>
    </section>
  );
}
