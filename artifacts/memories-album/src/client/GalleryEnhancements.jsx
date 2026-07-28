import { useEffect } from "react";

const PHOTO_DELETED_EVENT = "memories:photo-deleted";
const PHOTO_ID_PATTERN =
  /\/Memories\/api\/photos\/([0-9a-f-]{36})\/thumbnail(?:\?|$)/i;
const selectedPhotoIds = new Set();
let bulkDeleteBusy = false;

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

function adminToken() {
  return sessionStorage.getItem("memories-admin-token");
}

function adminCards() {
  return Array.from(
    document.querySelectorAll(".photo-card[data-admin-photo-id]"),
  );
}

function removePhotoCard(photoId) {
  adminCards()
    .filter((card) => card.dataset.adminPhotoId === photoId)
    .forEach((card) => card.remove());
}

function publishDeletedPhotos(photoIds) {
  if (photoIds.length === 0) return;
  window.dispatchEvent(
    new CustomEvent(PHOTO_DELETED_EVENT, {
      detail: { photoId: photoIds[0], photoIds },
    }),
  );
}

async function requestPhotoDeletion(photoId, token) {
  const response = await fetch(
    `/Memories/api/admin/photos/${encodeURIComponent(photoId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (response.ok || (response.status === 404 && payload.code === "NOT_FOUND")) {
    return payload;
  }
  const error = new Error(payload.error || `刪除失敗（${response.status}）`);
  error.code = payload.code;
  error.status = response.status;
  throw error;
}

function updateBulkToolbar() {
  const toolbar = document.querySelector(".admin-photo-bulk-toolbar");
  if (!toolbar) return;

  const cards = adminCards();
  const visibleIds = new Set(cards.map((card) => card.dataset.adminPhotoId));
  for (const photoId of selectedPhotoIds) {
    if (!visibleIds.has(photoId)) selectedPhotoIds.delete(photoId);
  }

  cards.forEach((card) => {
    const selected = selectedPhotoIds.has(card.dataset.adminPhotoId);
    const checkbox = card.querySelector(".admin-photo-selector input");
    if (checkbox) {
      checkbox.checked = selected;
      checkbox.disabled = bulkDeleteBusy;
    }
    if (selected) card.dataset.adminSelected = "true";
    else delete card.dataset.adminSelected;
  });

  document.querySelectorAll(".admin-delete-photo").forEach((button) => {
    button.disabled = bulkDeleteBusy;
  });

  const count = selectedPhotoIds.size;
  const status = toolbar.querySelector("[data-selection-count]");
  const selectAll = toolbar.querySelector("[data-select-visible]");
  const clear = toolbar.querySelector("[data-clear-selection]");
  const remove = toolbar.querySelector("[data-delete-selected]");
  if (status) status.textContent = `已選取 ${count} 張`;
  if (selectAll) {
    selectAll.disabled =
      bulkDeleteBusy || cards.length === 0 || count === cards.length;
  }
  if (clear) clear.disabled = bulkDeleteBusy || count === 0;
  if (remove) {
    remove.disabled = bulkDeleteBusy || count === 0;
    remove.textContent = bulkDeleteBusy ? "刪除中…" : `刪除已選（${count}）`;
  }
}

async function deletePhotoIds(photoIds, confirmation) {
  const ids = [...new Set(photoIds)].filter(Boolean);
  if (ids.length === 0 || !window.confirm(confirmation)) return;

  const token = adminToken();
  if (!token) {
    window.alert("管理員登入已失效，請重新登入。");
    clearAdminDeleteControls();
    return;
  }

  bulkDeleteBusy = true;
  updateBulkToolbar();
  const deleted = [];
  const failures = [];

  for (const photoId of ids) {
    try {
      await requestPhotoDeletion(photoId, token);
      deleted.push(photoId);
      selectedPhotoIds.delete(photoId);
      removePhotoCard(photoId);
    } catch (error) {
      failures.push({ photoId, error });
      if (error?.code === "UNAUTHORIZED" || error?.status === 401) {
        sessionStorage.removeItem("memories-admin-token");
        break;
      }
    }
  }

  bulkDeleteBusy = false;
  publishDeletedPhotos(deleted);
  attachAdminDeleteControls();
  updateBulkToolbar();

  if (failures.length > 0) {
    const firstMessage =
      failures[0].error instanceof Error
        ? failures[0].error.message
        : "照片刪除失敗";
    window.alert(
      `已刪除 ${deleted.length} 張，${failures.length} 張失敗。\n${firstMessage}`,
    );
  } else if (ids.length > 1) {
    window.alert(`已永久刪除 ${deleted.length} 張照片。`);
  }
}

function ensureBulkToolbar() {
  if (document.querySelector(".admin-photo-bulk-toolbar")) return;

  const toolbar = document.createElement("aside");
  toolbar.className = "admin-photo-bulk-toolbar";
  toolbar.setAttribute("aria-label", "管理員照片批次操作");
  toolbar.innerHTML = `
    <strong data-selection-count>已選取 0 張</strong>
    <button type="button" data-select-visible>全選目前照片</button>
    <button type="button" data-clear-selection>取消選取</button>
    <button type="button" class="danger" data-delete-selected disabled>刪除已選（0）</button>
    <button type="button" data-finish-photo-admin>結束照片管理</button>
  `;

  toolbar
    .querySelector("[data-select-visible]")
    .addEventListener("click", () => {
      adminCards().forEach((card) => {
        if (card.dataset.adminPhotoId) {
          selectedPhotoIds.add(card.dataset.adminPhotoId);
        }
      });
      updateBulkToolbar();
    });
  toolbar
    .querySelector("[data-clear-selection]")
    .addEventListener("click", () => {
      selectedPhotoIds.clear();
      updateBulkToolbar();
    });
  toolbar
    .querySelector("[data-delete-selected]")
    .addEventListener("click", () => {
      const count = selectedPhotoIds.size;
      void deletePhotoIds(
        [...selectedPhotoIds],
        `確定永久刪除已選取的 ${count} 張照片？原圖與縮圖都會從 Google Drive 移除。`,
      );
    });
  toolbar
    .querySelector("[data-finish-photo-admin]")
    .addEventListener("click", () => {
      sessionStorage.removeItem("memories-admin-token");
      clearAdminDeleteControls();
    });

  document.body.append(toolbar);
}

function clearAdminDeleteControls() {
  selectedPhotoIds.clear();
  document
    .querySelectorAll(".admin-delete-photo, .admin-photo-selector")
    .forEach((control) => control.remove());
  document
    .querySelectorAll(".photo-card[data-admin-delete-ready]")
    .forEach((card) => {
      delete card.dataset.adminDeleteReady;
      delete card.dataset.adminPhotoId;
      delete card.dataset.adminSelected;
    });
  document.querySelector(".admin-photo-bulk-toolbar")?.remove();
}

function attachAdminDeleteControls() {
  const token = adminToken();
  if (!token) {
    clearAdminDeleteControls();
    return;
  }

  ensureBulkToolbar();
  document.querySelectorAll(".photo-card").forEach((card) => {
    if (card.dataset.adminDeleteReady === "true") return;
    const photoId = photoIdFromCard(card);
    if (!photoId) return;

    card.dataset.adminDeleteReady = "true";
    card.dataset.adminPhotoId = photoId;

    const selector = document.createElement("label");
    selector.className = "admin-photo-selector";
    selector.setAttribute("aria-label", "選取這張照片進行批次刪除");
    selector.innerHTML = '<input type="checkbox"><span aria-hidden="true">✓</span>';
    selector.addEventListener("click", (event) => event.stopPropagation());
    selector.querySelector("input").addEventListener("change", (event) => {
      if (event.target.checked) selectedPhotoIds.add(photoId);
      else selectedPhotoIds.delete(photoId);
      updateBulkToolbar();
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-delete-photo";
    button.textContent = "刪除這張";
    button.setAttribute("aria-label", "從網站、Google Drive 與資料庫刪除這張照片");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void deletePhotoIds(
        [photoId],
        "確定永久刪除這張照片？原圖與縮圖都會從 Google Drive 移除。",
      );
    });

    card.prepend(selector);
    card.append(button);
  });
  updateBulkToolbar();
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
