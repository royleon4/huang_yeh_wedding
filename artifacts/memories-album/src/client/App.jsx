import { useEffect, useMemo, useRef, useState } from "react";
import { MOCK_PHOTOS } from "./mock-data.mjs";
import {
  COLLECTION_DEFINITIONS,
  NAV_ITEMS,
  filterPhotos,
} from "./gallery-model.mjs";
import UploadModal from "./UploadModal.jsx";
import PhotoLightbox from "./PhotoLightbox.jsx";
import { useAccessibleDialog } from "./useAccessibleDialog.js";
import { fetchPhotoPage, mergeChronologicalPhotos } from "./photo-client.mjs";
import { adminApi } from "./admin-api.mjs";
import { useMemoriesState } from "./MemoriesState.jsx";

const COPY = {
  zh: {
    archive: "詠葉婚禮照片檔案館",
    subtitle: "一座安靜收藏笑聲、祝福與相遇的婚禮檔案館",
    date: "二〇二六年六月二十日",
    allProcesses: "全部流程",
    wedding: "婚禮流程",
    guest: "訪客上傳",
    life: "生活照",
    categories: "照片分類",
    weddingNote: "依照婚禮當天流程整理的正式照片與已分類訪客照片。",
    guestNote: "所有訪客上傳都會在這裡出現，原圖固定保存在「訪客上傳」資料夾。",
    lifeNote: "婚禮之外的日常片刻，以及訪客選擇歸入生活照的照片。",
    admin: "管理模式",
    leaveAdmin: "離開管理",
    addProcess: "新增流程",
    processEditor: "流程編輯",
    rename: "改名",
    remove: "刪除",
    moveLeft: "前移",
    moveRight: "後移",
    addTo: "加入此流程",
    removeFrom: "移除此流程",
    loadMore: "載入更多回憶",
    emptyTitle: "這個分類還在等待照片",
    emptyBody: "回憶會慢慢被收藏進來。",
    understood: "我知道了",
    comingSoon: "即將推出",
    comingBody:
      "人物分類與自拍找照片會在第二階段開放。現在不會要求自拍，也不會進行人臉辨識。",
    close: "關閉",
    previous: "上一張",
    next: "下一張",
    photo: "照片",
    loading: "正在整理回憶…",
    loadingOriginal: "正在載入原圖…",
    zoomIn: "放大",
    zoomOut: "縮小",
    resetZoom: "重設縮放",
    zoomControls: "照片縮放控制",
    zoomHint: "滾輪、雙擊或雙指縮放",
    photoErrorTitle: "原圖載入失敗",
    retry: "重新載入",
    errorTitle: "檔案館暫時無法開啟",
    errorBody: "請稍後再試，已收藏的照片不會受到影響。",
    offlineTitle: "目前沒有網路",
    offlineBody: "重新連線後，檔案館會繼續載入。",
    closedTitle: "檔案館目前暫停開放",
    closedBody: "管理員完成整理後會再次開放瀏覽。",
    language: "English",
    photosCount: "張照片",
    adminHint:
      "流程資料夾會與 Google Drive 同步；生活照與訪客上傳為獨立大分類。",
  },
  en: {
    archive: "The Leon & YehYeh Wedding Archive",
    subtitle:
      "A quiet archive of laughter, blessings, and the people who shared our day",
    date: "20 June 2026",
    allProcesses: "All moments",
    wedding: "Wedding moments",
    guest: "Guest uploads",
    life: "Life photos",
    categories: "Photo collections",
    weddingNote:
      "Official wedding photos and guest photos that were classified into a wedding moment.",
    guestNote:
      "Every guest upload appears here. Originals always remain in the Guest uploads Drive folder.",
    lifeNote:
      "Everyday memories outside the wedding, including guest uploads classified as life photos.",
    admin: "Admin view",
    leaveAdmin: "Leave admin",
    addProcess: "Add moment",
    processEditor: "Moment editor",
    rename: "Rename",
    remove: "Delete",
    moveLeft: "Move earlier",
    moveRight: "Move later",
    addTo: "Add to moment",
    removeFrom: "Remove from moment",
    loadMore: "Load more memories",
    emptyTitle: "This collection is waiting for photos",
    emptyBody: "Memories will be carefully added here.",
    understood: "Got it",
    comingSoon: "Coming soon",
    comingBody:
      "People and selfie search arrive in Phase 2. No selfie or face recognition is requested now.",
    close: "Close",
    previous: "Previous photo",
    next: "Next photo",
    photo: "Photo",
    loading: "Arranging the memories…",
    loadingOriginal: "Loading original photo…",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetZoom: "Reset zoom",
    zoomControls: "Photo zoom controls",
    zoomHint: "Use the wheel, double-click, or pinch to zoom",
    photoErrorTitle: "The full photo could not be loaded",
    retry: "Try again",
    errorTitle: "The archive is temporarily unavailable",
    errorBody: "Please try again later. Stored photos are not affected.",
    offlineTitle: "You are offline",
    offlineBody: "The archive will continue loading after you reconnect.",
    closedTitle: "The archive is temporarily closed",
    closedBody: "It will reopen after the administrators finish arranging it.",
    language: "中文",
    photosCount: "photos",
    adminHint:
      "Wedding moment folders synchronize with Google Drive; Life photos and Guest uploads are separate top-level collections.",
  },
};

function Icon({ name }) {
  const paths = {
    all: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 3v18M16 3v18M3 9h18M3 15h18" />
      </>
    ),
    people: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M5 20h14" />
      </>
    ),
    find: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4M11 8v6M8 11h6" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Modal({ title, children, closeLabel, onClose }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useAccessibleDialog({
    containerRef: dialogRef,
    initialFocusRef: closeRef,
    onClose,
  });
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="paper-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex="-1"
      >
        <button
          ref={closeRef}
          className="icon-button modal-close"
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
        >
          ×
        </button>
        <p className="eyebrow">MEMORIES · 20 JUN 2026</p>
        <h2 id="dialog-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}

function StateCard({ icon, title, body, action }) {
  return (
    <section className="state-card" aria-live="polite">
      <span className="state-symbol" aria-hidden="true">
        {icon}
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}

export default function App() {
  const {
    activeCollection,
    adminAuthenticated,
    albumOpen,
    lang,
    markPhotosChanged,
    modal,
    openUpload,
    photoRevision,
    primaryNavigationVisible,
    processes,
    recordArchiveTitleTap,
    selectCollection,
    setAdminAuthenticated,
    setAlbumOpen,
    setLanguage,
    setModal,
  } = useMemoriesState();
  const params = new URLSearchParams(window.location.search);
  const runtimeState = params.get("state") ?? "ready";
  const useMockFallback = import.meta.env.DEV || params.get("demo") === "1";
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [remotePhotos, setRemotePhotos] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [galleryError, setGalleryError] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine !== false);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [selectedAdminPhotoIds, setSelectedAdminPhotoIds] = useState(
    () => new Set(),
  );
  const [bulkTrashBusy, setBulkTrashBusy] = useState(false);
  const openerRef = useRef(null);
  const galleryRef = useRef(null);
  const processSectionRef = useRef(null);
  const previousCollectionRef = useRef(activeCollection);
  const photoRequestGenerationRef = useRef(0);
  const loadMoreControllerRef = useRef(null);
  const t = COPY[lang];

  useEffect(() => {
    const generation = photoRequestGenerationRef.current + 1;
    photoRequestGenerationRef.current = generation;
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    setLoadingMore(false);
    if (runtimeState !== "ready") return undefined;
    const controller = new AbortController();
    setRemotePhotos(null);
    setNextCursor(null);
    setGalleryError(false);
    const processId =
      activeCollection === "wedding" && activeFilter !== "all"
        ? activeFilter
        : null;
    fetchPhotoPage(
      { collection: activeCollection, processId, limit: 12 },
      { signal: controller.signal },
    )
      .then((page) => {
        if (
          controller.signal.aborted ||
          generation !== photoRequestGenerationRef.current
        ) {
          return;
        }
        if (page.photos.length > 0 || !useMockFallback) {
          setRemotePhotos(mergeChronologicalPhotos(page.photos));
        }
        setNextCursor(page.nextCursor);
        setGalleryError(false);
      })
      .catch((error) => {
        if (
          controller.signal.aborted ||
          generation !== photoRequestGenerationRef.current
        ) {
          return;
        }
        if (error?.code === "ALBUM_CLOSED") {
          setAlbumOpen(false);
          setGalleryError(false);
        } else if (!useMockFallback) {
          setGalleryError(true);
        }
      });
    return () => controller.abort();
  }, [
    activeCollection,
    activeFilter,
    runtimeState,
    useMockFallback,
    connectionRevision,
    photoRevision,
    adminAuthenticated,
  ]);

  useEffect(() => {
    const online = () => {
      setIsOnline(true);
      setConnectionRevision((value) => value + 1);
    };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  const sourcePhotos = remotePhotos ?? (useMockFallback ? MOCK_PHOTOS : []);
  const photos = useMemo(
    () =>
      sourcePhotos.map((photo) => ({
        ...photo,
        collection:
          photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
        processIds: photo.processIds ?? [],
      })),
    [sourcePhotos],
  );
  const filtered = useMemo(
    () => filterPhotos(photos, activeFilter, activeCollection),
    [photos, activeFilter, activeCollection],
  );
  const visible = filtered;
  const selectedIndex = selectedPhotoId
    ? filtered.findIndex((photo) => photo.id === selectedPhotoId)
    : -1;
  const galleryLoading =
    runtimeState === "ready" &&
    remotePhotos === null &&
    !useMockFallback &&
    !galleryError;
  const activeCollectionDefinition =
    COLLECTION_DEFINITIONS.find((item) => item.id === activeCollection) ??
    COLLECTION_DEFINITIONS[0];
  const collectionNote =
    activeCollection === "guest"
      ? t.guestNote
      : activeCollection === "life"
        ? t.lifeNote
        : t.weddingNote;

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    document.title =
      lang === "zh"
        ? "詠葉婚禮照片檔案館"
        : "The Leon & YehYeh Wedding Archive";
  }, [lang]);

  const queueGalleryScroll = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const gallery = galleryRef.current;
        if (!gallery) return;
        const stickyHeight =
          processSectionRef.current?.getBoundingClientRect().height ?? 0;
        const top =
          window.scrollY +
          gallery.getBoundingClientRect().top -
          stickyHeight -
          10;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
    });
  };

  useEffect(() => {
    if (previousCollectionRef.current === activeCollection) return;
    previousCollectionRef.current = activeCollection;
    setActiveFilter("all");
    setSelectedPhotoId(null);
    queueGalleryScroll();
  }, [activeCollection]);

  useEffect(() => {
    if (
      activeFilter !== "all" &&
      !processes.some((process) => process.id === activeFilter)
    ) {
      setActiveFilter("all");
    }
  }, [activeFilter, processes]);

  useEffect(() => {
    setSelectedAdminPhotoIds((current) => {
      const visibleIds = new Set(
        adminAuthenticated ? visible.map((photo) => photo.id) : [],
      );
      const next = new Set(
        [...current].filter((photoId) => visibleIds.has(photoId)),
      );
      return next.size === current.size ? current : next;
    });
  }, [adminAuthenticated, visible]);

  const switchLanguage = () => {
    const next = lang === "zh" ? "en" : "zh";
    setLanguage(next);
  };

  const chooseNav = (item) => {
    if (!albumOpen && item.id === "upload") return;
    if (item.id === "all") {
      document
        .getElementById("archive-gallery")
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (item.id === "upload") {
      openUpload();
      return;
    }
    setModal("coming");
  };

  const chooseCollection = (collectionId) => {
    selectCollection(collectionId);
  };

  const loadMorePhotos = async () => {
    if (!nextCursor || loadingMore) return;
    const generation = photoRequestGenerationRef.current;
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    setGalleryError(false);
    const processId =
      activeCollection === "wedding" && activeFilter !== "all"
        ? activeFilter
        : null;
    try {
      const page = await fetchPhotoPage(
        {
          collection: activeCollection,
          processId,
          limit: 12,
          cursor: nextCursor,
        },
        { signal: controller.signal },
      );
      if (
        controller.signal.aborted ||
        generation !== photoRequestGenerationRef.current
      ) {
        return;
      }
      setRemotePhotos((current) => {
        const existing = current ?? [];
        return mergeChronologicalPhotos(existing, page.photos);
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (
        controller.signal.aborted ||
        generation !== photoRequestGenerationRef.current
      ) {
        return;
      }
      if (error?.code === "ALBUM_CLOSED") setAlbumOpen(false);
      else setGalleryError(true);
    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        setLoadingMore(false);
      }
    }
  };

  const handleUploaded = (photo) => {
    setRemotePhotos((current) => {
      const base = current ?? (useMockFallback ? MOCK_PHOTOS : []);
      return mergeChronologicalPhotos(base, [photo]);
    });
  };

  const trashPhotos = async (photoIds, confirmation) => {
    const ids = [...new Set(photoIds)].filter(Boolean);
    if (ids.length === 0 || !window.confirm(confirmation)) return;

    if (ids.length === 1) setDeletingPhotoId(ids[0]);
    else setBulkTrashBusy(true);
    const trashed = [];
    const failures = [];
    try {
      for (const photoId of ids) {
        try {
          await adminApi(
            `/Memories/api/admin/photos/${encodeURIComponent(photoId)}`,
            { method: "DELETE" },
          );
          trashed.push(photoId);
        } catch (error) {
          failures.push(error);
          if (error?.code === "UNAUTHORIZED" || error?.status === 401) {
            setAdminAuthenticated(false);
            break;
          }
        }
      }

      if (trashed.length > 0) {
        const trashedIds = new Set(trashed);
        setRemotePhotos(
          (current) =>
            current?.filter((photo) => !trashedIds.has(photo.id)) ?? current,
        );
        setSelectedAdminPhotoIds((current) => {
          const next = new Set(current);
          trashed.forEach((photoId) => next.delete(photoId));
          return next;
        });
        markPhotosChanged();
      }

      if (failures.length > 0) {
        const firstMessage =
          failures[0] instanceof Error ? failures[0].message : "移至垃圾桶失敗";
        window.alert(
          `已移至垃圾桶 ${trashed.length} 張，${failures.length} 張失敗。\n${firstMessage}`,
        );
      } else if (ids.length > 1) {
        window.alert(`已將 ${trashed.length} 張照片移至七天垃圾桶。`);
      }
    } finally {
      setDeletingPhotoId(null);
      setBulkTrashBusy(false);
    }
  };

  const trashPhoto = (photoId) =>
    trashPhotos(
      [photoId],
      "確定將這張照片移至垃圾桶？照片會立即從相簿隱藏，七天內可由管理員還原。",
    );

  const toggleAdminPhoto = (photoId, selected) => {
    setSelectedAdminPhotoIds((current) => {
      const next = new Set(current);
      if (selected) next.add(photoId);
      else next.delete(photoId);
      return next;
    });
  };

  const finishPhotoManagement = async () => {
    try {
      await adminApi("/Memories/api/admin/session", { method: "DELETE" });
    } catch {
      // Local state still exits management when the network is unavailable.
    } finally {
      setSelectedAdminPhotoIds(new Set());
      setAdminAuthenticated(false);
    }
  };

  const closeLightbox = () => {
    setSelectedPhotoId(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  const stateView = (() => {
    if (runtimeState === "offline" || !isOnline) {
      return <StateCard icon="⌁" title={t.offlineTitle} body={t.offlineBody} />;
    }
    if (runtimeState === "loading" || galleryLoading) {
      return <StateCard icon="◌" title={t.loading} body={t.subtitle} />;
    }
    if (runtimeState === "error" || galleryError) {
      return (
        <StateCard
          icon="!"
          title={t.errorTitle}
          body={t.errorBody}
          action={
            <button
              className="button primary"
              onClick={() => window.location.assign("/Memories/")}
            >
              {t.retry}
            </button>
          }
        />
      );
    }
    if (runtimeState === "closed" || (!albumOpen && !adminAuthenticated)) {
      return <StateCard icon="—" title={t.closedTitle} body={t.closedBody} />;
    }
    return null;
  })();

  const photoCollectionLabel = (photo) => {
    if (activeCollection === "guest") return t.guest;
    if (activeCollection === "life") return t.life;
    return (
      processes.find((process) => photo.processIds.includes(process.id))?.[
        lang
      ] ?? t.allProcesses
    );
  };

  return (
    <div className="archive-shell">
      <div className="paper-grain" aria-hidden="true" />
      <header className="archive-header">
        <div className="header-tools">
          <button
            className="quiet-button"
            type="button"
            onClick={switchLanguage}
            aria-label={t.language}
          >
            <Icon name="globe" /> {t.language}
          </button>
        </div>
        <p className="eyebrow">LEON & YEHY · WEDDING ARCHIVE</p>
        <h1
          onClick={recordArchiveTitleTap}
          aria-label={`${t.archive}. Administrator access is hidden.`}
        >
          {t.archive}
        </h1>
        <p className="archive-date">{t.date}</p>
        <p className="archive-subtitle">{t.subtitle}</p>
        <div className="botanical-rule" aria-hidden="true">
          <span>❧</span>
        </div>
      </header>

      <nav
        className={`primary-nav ${primaryNavigationVisible ? "" : "is-hidden"}`}
        aria-label={lang === "zh" ? "相簿導覽" : "Archive navigation"}
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-card ${item.id === "all" ? "active" : ""}`}
            onClick={() => chooseNav(item)}
          >
            <Icon name={item.id} />
            <span>{item[lang]}</span>
            {!item.enabled && <small>{t.comingSoon}</small>}
          </button>
        ))}
      </nav>

      <main>
        <section
          ref={processSectionRef}
          className="process-section"
          aria-labelledby="collection-heading"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">PHOTO COLLECTIONS</p>
              <h2 id="collection-heading">{t.categories}</h2>
            </div>
            <p>
              {filtered.length} {t.photosCount}
            </p>
          </div>

          <div
            className="collection-tabs"
            role="list"
            aria-label={t.categories}
          >
            {COLLECTION_DEFINITIONS.map((collection) => (
              <button
                key={collection.id}
                type="button"
                className={`collection-tab ${
                  activeCollection === collection.id ? "active" : ""
                }`}
                onClick={() => chooseCollection(collection.id)}
              >
                {collection[lang]}
              </button>
            ))}
          </div>

          <div className="collection-summary">
            <strong>{activeCollectionDefinition[lang]}</strong>
            <p>{collectionNote}</p>
          </div>

          {activeCollection === "wedding" && (
            <div className="process-strip" role="list" aria-label={t.wedding}>
              <button
                type="button"
                className={`process-chip ${activeFilter === "all" ? "active" : ""}`}
                onClick={() => {
                  setActiveFilter("all");
                  queueGalleryScroll();
                }}
              >
                {t.allProcesses}
              </button>
              {processes.map((process, index) => (
                <button
                  key={process.id}
                  type="button"
                  className={`process-chip ${
                    activeFilter === process.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveFilter(process.id);
                    queueGalleryScroll();
                  }}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {process[lang]}
                </button>
              ))}
            </div>
          )}
        </section>

        <section
          ref={galleryRef}
          id="archive-gallery"
          className="gallery-section"
          aria-live="polite"
        >
          {stateView ??
            (filtered.length === 0 || runtimeState === "empty" ? (
              <StateCard icon="✦" title={t.emptyTitle} body={t.emptyBody} />
            ) : (
              <>
                <div className="masonry-grid">
                  {visible.map((photo, index) => {
                    return (
                      <article
                        className={`photo-card ${
                          adminAuthenticated ? "admin-photo-manage" : ""
                        }`}
                        data-admin-selected={
                          selectedAdminPhotoIds.has(photo.id)
                            ? "true"
                            : undefined
                        }
                        key={photo.id}
                      >
                        {adminAuthenticated && (
                          <label
                            className={`admin-photo-selector ${
                              bulkTrashBusy ? "is-disabled" : ""
                            }`}
                            aria-label="選取這張照片進行批次管理"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAdminPhotoIds.has(photo.id)}
                              disabled={bulkTrashBusy}
                              onChange={(event) =>
                                toggleAdminPhoto(photo.id, event.target.checked)
                              }
                            />
                            <span aria-hidden="true">✓</span>
                          </label>
                        )}
                        <button
                          type="button"
                          className="photo-open"
                          onClick={(event) => {
                            openerRef.current = event.currentTarget;
                            setSelectedPhotoId(photo.id);
                          }}
                          aria-label={`${t.photo} ${index + 1}`}
                        >
                          <img
                            src={photo.thumbnailUrl}
                            srcSet={photo.thumbnailSrcSet}
                            sizes="(max-width: 560px) 50vw, (max-width: 900px) 33vw, 25vw"
                            alt={`${t.photo} ${index + 1}`}
                            loading={index < 4 ? "eager" : "lazy"}
                            fetchPriority={index === 0 ? "high" : "auto"}
                            decoding="async"
                            width={photo.width}
                            height={photo.height}
                          />
                          <span className="photo-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </button>
                        <footer>
                          <span>{photoCollectionLabel(photo)}</span>
                          <small>{photo.uploaderName}</small>
                        </footer>
                        {adminAuthenticated && (
                          <button
                            className="admin-delete-photo"
                            type="button"
                            disabled={deletingPhotoId === photo.id}
                            onClick={() => void trashPhoto(photo.id)}
                            aria-label="將這張照片移至七天垃圾桶"
                          >
                            {deletingPhotoId === photo.id
                              ? "移動中…"
                              : "移至垃圾桶"}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
                {nextCursor && (
                  <button
                    className="load-more"
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMorePhotos()}
                  >
                    {loadingMore ? t.loading : t.loadMore}
                    <span>↓</span>
                  </button>
                )}
                {adminAuthenticated && visible.length > 0 && (
                  <aside
                    className="admin-photo-bulk-toolbar"
                    aria-label="管理員照片批次操作"
                  >
                    <strong aria-live="polite">
                      已選取 {selectedAdminPhotoIds.size} 張
                    </strong>
                    <button
                      type="button"
                      disabled={
                        bulkTrashBusy ||
                        selectedAdminPhotoIds.size === visible.length
                      }
                      onClick={() =>
                        setSelectedAdminPhotoIds(
                          new Set(visible.map((photo) => photo.id)),
                        )
                      }
                    >
                      全選已載入照片
                    </button>
                    <button
                      type="button"
                      disabled={
                        bulkTrashBusy || selectedAdminPhotoIds.size === 0
                      }
                      onClick={() => setSelectedAdminPhotoIds(new Set())}
                    >
                      取消選取
                    </button>
                    <button
                      className="danger"
                      type="button"
                      disabled={
                        bulkTrashBusy || selectedAdminPhotoIds.size === 0
                      }
                      onClick={() =>
                        void trashPhotos(
                          [...selectedAdminPhotoIds],
                          `確定將選取的 ${selectedAdminPhotoIds.size} 張照片移至垃圾桶？照片會立即隱藏，七天內可由管理員還原。`,
                        )
                      }
                    >
                      {bulkTrashBusy
                        ? "移動中…"
                        : `移至垃圾桶（${selectedAdminPhotoIds.size}）`}
                    </button>
                    <button
                      type="button"
                      disabled={bulkTrashBusy}
                      onClick={() => void finishPhotoManagement()}
                    >
                      結束照片管理
                    </button>
                  </aside>
                )}
              </>
            ))}
        </section>
      </main>

      <footer className="archive-footer">
        <span>LY</span>
        <p>Leon & YehYeh · 20.06.2026</p>
        <small>Collected with love in Tainan</small>
      </footer>

      {modal === "upload" && (
        <UploadModal
          lang={lang}
          processes={processes}
          onClose={() => setModal(null)}
          onUploaded={handleUploaded}
        />
      )}
      {modal === "coming" && (
        <Modal
          title={t.comingSoon}
          closeLabel={t.close}
          onClose={() => setModal(null)}
        >
          <p>{t.comingBody}</p>
          <button
            className="button primary"
            type="button"
            onClick={() => setModal(null)}
          >
            {t.understood}
          </button>
        </Modal>
      )}

      {selectedIndex >= 0 && (
        <PhotoLightbox
          photos={filtered}
          selectedIndex={selectedIndex}
          onSelectIndex={(index) =>
            setSelectedPhotoId(filtered[index]?.id ?? null)
          }
          onClose={closeLightbox}
          labels={{
            close: t.close,
            previous: t.previous,
            next: t.next,
            photo: t.photo,
            guest: t.guest,
            loading: t.loadingOriginal,
            zoomIn: t.zoomIn,
            zoomOut: t.zoomOut,
            resetZoom: t.resetZoom,
            zoomControls: t.zoomControls,
            zoomHint: t.zoomHint,
            errorTitle: t.photoErrorTitle,
            retry: t.retry,
          }}
        />
      )}
    </div>
  );
}
