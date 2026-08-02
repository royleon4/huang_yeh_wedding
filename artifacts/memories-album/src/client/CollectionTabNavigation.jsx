import { useEffect } from "react";
import { requestGalleryStartScroll } from "./gallery-navigation.mjs";
import { suspendMasonryAnchorRestoration } from "./useMasonryLayout.mjs";

export default function CollectionTabNavigation() {
  useEffect(() => {
    const onDocumentClick = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element?.closest(".collection-tab")) return;
      suspendMasonryAnchorRestoration();
      requestGalleryStartScroll();
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  return null;
}
