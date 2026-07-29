import { useEffect } from "react";

function scrollToGalleryStart() {
  const gallery = document.getElementById("archive-gallery");
  if (!gallery) return;
  const stickyControls = document.querySelector(".process-section");
  const stickyHeight = stickyControls?.getBoundingClientRect().height ?? 0;
  const top =
    window.scrollY + gallery.getBoundingClientRect().top - stickyHeight - 10;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export default function GalleryEnhancements() {
  useEffect(() => {
    const onDocumentClick = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element?.closest(".process-chip, .collection-tab")) return;
      requestAnimationFrame(() => requestAnimationFrame(scrollToGalleryStart));
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  return null;
}
