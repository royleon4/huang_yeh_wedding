import { useEffect, useState } from "react";

export default function AbortableThumbnail({ src, alt = "", ...props }) {
  const [objectUrl, setObjectUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setObjectUrl("");
      setFailed(false);
      return undefined;
    }

    const controller = new AbortController();
    let nextObjectUrl = "";
    let disposed = false;
    setObjectUrl("");
    setFailed(false);

    void fetch(src, {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Thumbnail request failed: ${response.status}`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (disposed) return;
        nextObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(nextObjectUrl);
      })
      .catch((error) => {
        if (error?.name !== "AbortError" && !disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      controller.abort();
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [src]);

  return (
    <img
      {...props}
      src={objectUrl || undefined}
      alt={alt}
      decoding="async"
      data-thumbnail-loading={!objectUrl && !failed ? "true" : undefined}
      data-thumbnail-failed={failed ? "true" : undefined}
      aria-busy={!objectUrl && !failed}
    />
  );
}
