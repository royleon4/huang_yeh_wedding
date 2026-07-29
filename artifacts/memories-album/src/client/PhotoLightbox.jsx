import { useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  adjacentPhotoIndex,
  clampPanOffset,
  clampZoom,
  isHorizontalSwipe,
} from "./lightbox-model.mjs";
import { useAccessibleDialog } from "./useAccessibleDialog.js";

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
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const closeButtonRef = useRef(null);
  const viewerRef = useRef(null);
  const stageRef = useRef(null);
  const imageRef = useRef(null);

  const canPrevious = selectedIndex > 0;
  const canNext = selectedIndex < photos.length - 1;
  const zoomPercent = Math.round(zoom * 100);

  const resetView = () => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    pointers.current.clear();
    gesture.current = null;
  };

  const clampOffset = (nextOffset, nextZoom = zoom) =>
    clampPanOffset({
      offset: nextOffset,
      zoom: nextZoom,
      imageWidth: imageRef.current?.offsetWidth ?? 0,
      imageHeight: imageRef.current?.offsetHeight ?? 0,
      stageWidth: stageRef.current?.clientWidth ?? 0,
      stageHeight: stageRef.current?.clientHeight ?? 0,
    });

  const selectIndex = (nextIndex) => {
    if (nextIndex === selectedIndex || nextIndex < 0) return;
    resetView();
    setLoading(true);
    setLoadError(false);
    onSelectIndex(nextIndex);
  };

  const moveBy = (direction) => {
    selectIndex(adjacentPhotoIndex(selectedIndex, photos.length, direction));
  };

  const setBoundedZoom = (nextValue) => {
    const bounded = clampZoom(nextValue);
    setZoom(bounded);
    setOffset((current) => clampOffset(current, bounded));
  };

  useEffect(() => {
    resetView();
    setLoading(true);
    setLoadError(false);
  }, [photo?.id]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      setZoom((current) => {
        const bounded = clampZoom(
          current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP),
        );
        setOffset((currentOffset) => clampOffset(currentOffset, bounded));
        return bounded;
      });
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  useAccessibleDialog({
    containerRef: viewerRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  useEffect(() => {
    const onKeyDown = (event) => {
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
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [zoom, selectedIndex, photos.length, onClose]);

  useEffect(() => {
    const onResize = () => setOffset((current) => clampOffset(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [zoom]);

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
      setOffset(
        clampOffset({
          x:
            gesture.current.baseOffset.x +
            event.clientX -
            gesture.current.startX,
          y:
            gesture.current.baseOffset.y +
            event.clientY -
            gesture.current.startY,
        }),
      );
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
      ref={viewerRef}
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${labels.photo} ${selectedIndex + 1}`}
      tabIndex="-1"
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
        <div
          className="photo-viewer-zoom-controls"
          aria-label={labels.zoomControls}
        >
          <button
            type="button"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setBoundedZoom(zoom - ZOOM_STEP)}
            aria-label={labels.zoomOut}
          >
            −
          </button>
          <button
            type="button"
            onClick={resetView}
            aria-label={labels.resetZoom}
          >
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
        ref={stageRef}
        className={`photo-viewer-stage ${zoom > MIN_ZOOM ? "is-zoomed" : ""}`}
        onDoubleClick={() => setBoundedZoom(zoom === MIN_ZOOM ? 2 : MIN_ZOOM)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {loading && !loadError && (
          <div className="photo-viewer-loading">{labels.loading}</div>
        )}
        {loadError ? (
          <div className="photo-viewer-error" role="alert">
            <p>{labels.errorTitle}</p>
            <button
              type="button"
              onClick={() => {
                setLoadError(false);
                setLoading(true);
                setRetryKey((value) => value + 1);
              }}
            >
              {labels.retry}
            </button>
          </div>
        ) : (
          <img
            ref={imageRef}
            key={`${photo.id}-${retryKey}`}
            src={photo.mediaUrl}
            alt={`${labels.photo} ${selectedIndex + 1}`}
            draggable="false"
            onLoad={() => {
              setLoading(false);
              setLoadError(false);
              setOffset((current) => clampOffset(current));
            }}
            onError={() => {
              setLoading(false);
              setLoadError(true);
            }}
            style={{ transform }}
          />
        )}
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
        <span>
          {selectedIndex + 1} / {photos.length}
        </span>
        <strong>
          {photo.source === "guest" ? labels.guest : photo.uploaderName}
        </strong>
        <small>{labels.zoomHint}</small>
      </footer>
    </section>
  );
}
