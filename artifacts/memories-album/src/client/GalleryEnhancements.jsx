import { useEffect } from "react";

const PHOTO_DELETED_EVENT = "memories:photo-deleted";
const PHOTO_ID_PATTERN =
  /\/Memories\/api\/photos\/([0-9a-f-]{36})\/thumbnail(?:\?|$)/i;

function scrollToGalleryStart() {
  const gallery = document.getElementById("archive-gallery");
  if (!gallery) return;
  const stickyControls = document.querySelector(".process-section");
  const stickyHeight = stickyControls?.getBoundingClientRect().height ?? 0;
  const top =
    window.scrollY + gallery.getBoundingClientRect().top - stickyHeight - 10;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function queueGalleryScroll() {
  requestAnimationFrame(() => {
    requestAnimationFrame(scrollToGalleryStart);
  });
}

function photoIdFromCard(card) {
  const source = card
    .querySelector('.photo-open img[src*="/Memories/api/photos/"]')
    ?.getAttribute("src");
  return source?.match(PHOTO_ID_PATTERN)?.[1] ?? null;
}

function clearAdminDeleteControls() {
  document.querySelectorAll(".admin-delete-photo").forEach((button) => {
    button.remove();
  });
  document.querySelectorAll(".photo-card[data-admin-delete-ready]").forEach((card) => {
    delete card.dataset.adminDeleteReady;
  });
}

function attachAdminDeleteControls() {
  const adminIsOpen = Boolean(document.querySelector(".process-sync-admin"));
  const token = sessionStorage.getItem("memories-admin-token");
  if (!adminIsOpen || !token) {
    clearAdminDeleteControls();
    return;
  }

  document.querySelectorAll(".photo-card").forEach((card) => {
    if (card.dataset.adminDeleteReady === "true") return;
    const photoId = photoIdFromCard(card);
    if (!photoId) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-delete-photo";
    button.textContent = "刪除照片";
    button.setAttribute("aria-label", "從網站、Google Drive 與資料庫刪除這張照片");

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm("確定永久刪除這張照片？原圖與縮圖都會從 Google Drive 移除。")) {
        return;
      }

      const currentToken = sessionStorage.getItem("memories-admin-token");
      if (!currentToken) {
        window.alert("管理員登入已失效，請重新登入。");
        return;
      }

      button.disabled = true;
      button.textContent = "刪除中…";
      try {
        const response = await fetch(
          `/Memories/api/admin/photos/${encodeURIComponent(photoId)}`,
          {
            method: "DELETE",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${currentToken}`,
            },
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(payload.error || `刪除失敗（${response.status}）`);
          error.code = payload.code;
          throw error;
        }
        card.remove();
        window.dispatchEvent(
          new CustomEvent(PHOTO_DELETED_EVENT, { detail: { photoId } }),
        );
      } catch (error) {
        if (error?.code === "UNAUTHORIZED") {
          sessionStorage.removeItem("memories-admin-token");
        }
        window.alert(error instanceof Error ? error.message : "照片刪除失敗");
        button.disabled = false;
        button.textContent = "刪除照片";
      }
    });

    card.dataset.adminDeleteReady = "true";
    card.append(button);
  });
}

export default function GalleryEnhancements() {
  useEffect(() => {
    const onDocumentClick = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element?.closest(".process-chip, .collection-tab")) return;
      queueGalleryScroll();
    };

    const observer = new MutationObserver(() => {
      attachAdminDeleteControls();
    });

    document.addEventListener("click", onDocumentClick);
    observer.observe(document.body, { childList: true, subtree: true });
    attachAdminDeleteControls();

    return () => {
      document.removeEventListener("click", onDocumentClick);
      observer.disconnect();
      clearAdminDeleteControls();
    };
  }, []);

  return null;
}
