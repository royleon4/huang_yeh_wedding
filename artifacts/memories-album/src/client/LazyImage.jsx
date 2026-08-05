import { useEffect, useRef, useState } from "react";
import "./lazy-image.css";

export default function LazyImage({
  src,
  alt = "",
  eager = false,
  rootMargin = "600px 0px",
  fetchPriority = eager ? "high" : "auto",
  className = "",
  width,
  height,
  onLoad,
  onError,
  ...props
}) {
  const imageRef = useRef(null);
  const hasIntrinsicSize = Number(width) > 0 && Number(height) > 0;
  const [allowedToLoad, setAllowedToLoad] = useState(
    Boolean(eager || !hasIntrinsicSize),
  );
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAllowedToLoad(Boolean(eager || !hasIntrinsicSize));
    setLoaded(false);
    setFailed(false);
  }, [src, eager, hasIntrinsicSize]);

  useEffect(() => {
    if (allowedToLoad || !src) return undefined;
    const image = imageRef.current;
    if (!image) return undefined;

    if (typeof IntersectionObserver !== "function") {
      setAllowedToLoad(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setAllowedToLoad(true);
        observer.disconnect();
      },
      { rootMargin, threshold: 0.01 },
    );
    observer.observe(image);
    return () => observer.disconnect();
  }, [allowedToLoad, rootMargin, src]);

  const classes = [
    "lazy-image",
    loaded ? "is-loaded" : "",
    failed ? "is-failed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      {...props}
      ref={imageRef}
      src={allowedToLoad ? src : undefined}
      data-lazy-src={!allowedToLoad && src ? src : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={
        eager || (allowedToLoad && hasIntrinsicSize) ? "eager" : "lazy"
      }
      decoding="async"
      fetchPriority={fetchPriority}
      className={classes}
      aria-busy={Boolean(src) && allowedToLoad && !loaded && !failed}
      onLoad={(event) => {
        setLoaded(true);
        setFailed(false);
        onLoad?.(event);
      }}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
