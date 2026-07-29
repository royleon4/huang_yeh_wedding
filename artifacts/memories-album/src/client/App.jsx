import { useEffect, useMemo, useRef, useState } from "react";
import { MOCK_PHOTOS } from "./mock-data.mjs";
import {
  COLLECTION_DEFINITIONS,
  NAV_ITEMS,
  PROCESS_DEFINITIONS,
  filterPhotos,
  normalizePublicAlbums,
  pagePhotos,
} from "./gallery-model.mjs";
import UploadModal from "./UploadModal.jsx";
import PhotoLightbox from "./PhotoLightbox.jsx";
import BottomCollectionNav from "./BottomCollectionNav.jsx";

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
    retry: "重新載入",
    errorTitle: "檔案館暫時無法開啟",
    errorBody: "請稍後再試，已收藏的照片不會受到影響。",
    offlineTitle: "目前沒有網路",
    offlineBody: "重新連線後，檔案館會繼續載入。",
    closedTitle: "檔案館目前暫停開放",
    closedBody: "管理員完成整理後會再次開放瀏覽。",
    language: "English",
    photosCount: "張照片",
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
    retry: "Try again",
    errorTitle: "The archive is temporarily unavailable",
    errorBody: "Please try again later. Stored photos are not affected.",
    offlineTitle: "You are offline",
    offlineBody: "The archive will continue loading after you reconnect.",
    closedTitle: "The archive is temporarily closed",
    closedBody: "It will reopen after the administrators finish arranging it.",
    language: "中文",
    photosCount: "photos",
  },
};

const SYSTEM_COLLECTION_NOTES = {
  wedding: { zh: "weddingNote", en: "weddingNote" },
  guest: { zh: "guestNote", en: "guestNote" },
  life: { zh: "lifeNote", en: "lifeNote" },
};

function fallbackAlbums() {
  return COLLECTION_DEFINITIONS.map((album, index) => ({
    id: album.id,
    zh: album.zh,
    en: album.en,
    descriptionZh: "",
    descriptionEn: "",
    displayOrder: index + 1,
  }));
}

async function fetchAlbums() {
  const response = await fetch("/Memories/api/albums", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Album listing failed");
  const body = await response.json();
  return normalizePublicAlbums(body.albums);
}

async function fetchAllPhotos() {
  const photos = [];
  let cursor = null;
  let pages = 0;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`/Memories/api/photos?${query}`);
    if (!response.ok) throw new Error("Photo listing failed");
    const page = await response.json();
    photos.push(...(page.photos ?? []));
    cursor = page.nextCursor ?? null;
    pages += 1;
  } while (cursor && pages < 20);
  return photos;
}

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
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="paper-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
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
  const params = new URLSearchParams(window.location.search);
  const runtimeState = params.get("state") ?? "ready";
  const useMockFallback = import.meta.env.DEV || params.get("demo") === "1";
  const [lang, setLang] = useState(() =>
    localStorage.getItem("memories-language") === "en" ? "en" : "zh",
  );
  const [processes] = useState(PROCESS_DEFINITIONS);
  const [albums, setAlbums] = useState(fallbackAlbums);
  const [activeCollection, setActiveCollection] = useState("wedding");
  const [activeFilter, setActiveFilter] = useState("all");
  const [pageSize, setPageSize] = useState(12);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [modal, setModal] = useState(null);
  const [remotePhotos, setRemotePhotos] = useState(null);
  const [galleryError, setGalleryError] = useState(false);
  const openerRef = useRef(null);
  const t = COPY[lang];

  useEffect(() => {
    if (runtimeState !== "ready") return undefined;
    let cancelled = false;
    void fetchAlbums()
      .then((nextAlbums) => {
        if (cancelled) return;
        setAlbums(nextAlbums);
        setActiveCollection((current) =>
          nextAlbums.some((album) => album.id === current)
            ? current
            : (nextAlbums[0]?.id ?? ""),
        );
      })
      .catch(() => {
        // The three system albums remain available while storage recovers.
      });
    void fetchAllPhotos()
      .then((photos) => {
        if (cancelled) return;
        if (photos.length > 0 || !useMockFallback) setRemotePhotos(photos);
        setGalleryError(false);
      })
      .catch(() => {
        if (!cancelled && !useMockFallback) setGalleryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [runtimeState, useMockFallback]);

  const sourcePhotos = remotePhotos ?? (useMockFallback ? MOCK_PHOTOS : []);
  const photos = useMemo(
    () =>
      sourcePhotos.map((photo) => ({
        ...photo,
        collection:
          photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
        albumIds: photo.albumIds ?? [
          photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
          ...(photo.source === "guest" ? ["guest"] : []),
        ],
        processIds: photo.processIds ?? [],
      })),
    [sourcePhotos],
  );
  const filtered = useMemo(
    () => filterPhotos(photos, activeFilter, activeCollection),
    [photos, activeFilter, activeCollection],
  );
  const visible = useMemo(
    () => pagePhotos(filtered, pageSize, 0).items,
    [filtered, pageSize],
  );
  const selectedIndex = selectedPhotoId
    ? filtered.findIndex((photo) => photo.id === selectedPhotoId)
    : -1;
  const galleryLoading =
    runtimeState === "ready" &&
    remotePhotos === null &&
    !useMockFallback &&
    !galleryError;
  const activeCollectionDefinition =
    albums.find((item) => item.id === activeCollection) ?? albums[0];
  const configuredDescription =
    activeCollectionDefinition?.[
      lang === "zh" ? "descriptionZh" : "descriptionEn"
    ]?.trim();
  const fallbackNoteKey = SYSTEM_COLLECTION_NOTES[activeCollection]?.[lang];
  const collectionNote =
    configuredDescription || (fallbackNoteKey ? t[fallbackNoteKey] : "");

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    document.title =
      lang === "zh"
        ? "詠葉婚禮照片檔案館"
        : "The Leon & YehYeh Wedding Archive";
  }, [lang]);

  const switchLanguage = () => {
    const next = lang === "zh" ? "en" : "zh";
    setLang(next);
    localStorage.setItem("memories-language", next);
  };

  const chooseNav = (item) => {
    if (item.id === "all") {
      document
        .getElementById("archive-gallery")
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (item.id === "upload") {
      setModal("upload");
      return;
    }
    setModal("coming");
  };

  const chooseCollection = (collectionId) => {
    setActiveCollection(collectionId);
    setActiveFilter("all");
    setPageSize(12);
    setSelectedPhotoId(null);
  };

  const handleUploaded = (photo) => {
    setRemotePhotos((current) => {
      const base = current ?? (useMockFallback ? MOCK_PHOTOS : []);
      return [photo, ...base.filter((item) => item.id !== photo.id)];
    });
  };

  const closeLightbox = () => {
    setSelectedPhotoId(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  const stateView = (() => {
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
    if (runtimeState === "offline") {
      return <StateCard icon="⌁" title={t.offlineTitle} body={t.offlineBody} />;
    }
    if (runtimeState === "closed") {
      return <StateCard icon="—" title={t.closedTitle} body={t.closedBody} />;
    }
    return null;
  })();

  const photoCollectionLabel = (photo) => {
    if (activeCollection === "wedding") {
      return (
        processes.find((process) => photo.processIds.includes(process.id))?.[
          lang
        ] ?? t.allProcesses
      );
    }
    return activeCollectionDefinition?.[lang] ?? t.categories;
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
        <h1>{t.archive}</h1>
        <p className="archive-date">{t.date}</p>
        <p className="archive-subtitle">{t.subtitle}</p>
        <div className="botanical-rule" aria-hidden="true">
          <span>❧</span>
        </div>
      </header>

      <nav
        className="primary-nav"
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
            {albums.map((collection) => (
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
            <strong>
              {activeCollectionDefinition?.[lang] ?? t.categories}
            </strong>
            {collectionNote && <p>{collectionNote}</p>}
          </div>

          {activeCollection === "wedding" && (
            <div className="process-strip" role="list" aria-label={t.wedding}>
              <button
                type="button"
                className={`process-chip ${activeFilter === "all" ? "active" : ""}`}
                onClick={() => {
                  setActiveFilter("all");
                  setPageSize(12);
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
                    setPageSize(12);
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
                      <article className="photo-card" key={photo.id}>
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
                            alt={`${t.photo} ${index + 1}`}
                            loading="lazy"
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
                      </article>
                    );
                  })}
                </div>
                {visible.length < filtered.length && (
                  <button
                    className="load-more"
                    type="button"
                    onClick={() => setPageSize((size) => size + 12)}
                  >
                    {t.loadMore}
                    <span>↓</span>
                  </button>
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

      <BottomCollectionNav
        albums={albums}
        active={activeCollection}
        isEnglish={lang === "en"}
        onChoose={chooseCollection}
        onUpload={() => setModal("upload")}
      />

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
          }}
        />
      )}
    </div>
  );
}
