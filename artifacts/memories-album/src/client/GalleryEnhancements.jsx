import { useEffect } from "react";
import {
  advanceAdminTitleTap,
  adminEntryDestination,
} from "./gallery-enhancement-model.mjs";

export default function GalleryEnhancements() {
  useEffect(() => {
    let titleTapState = { count: 0, lastTap: 0 };
    let adminNavigationStarted = false;

    const onDocumentClick = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (
        !element?.closest(".archive-header h1") ||
        adminNavigationStarted
      ) {
        return;
      }

      titleTapState = advanceAdminTitleTap(titleTapState, Date.now());
      if (!titleTapState.triggered) return;

      adminNavigationStarted = true;
      void adminEntryDestination().then((destination) => {
        window.location.assign(destination);
      });
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  return null;
}
