import { useEffect, useMemo, useRef, useState } from "react";
import { MOCK_PHOTOS } from "./mock-data.mjs";
import {
  NAV_ITEMS,
  PROCESS_DEFINITIONS,
  filterPhotos,
  moveItem,
  pagePhotos,
} from "./gallery-model.mjs";
import UploadModal from "./UploadModal.jsx";

const COPY = {
  zh: {
    archive: "詠葉婚禮照片檔案館",
    subtitle: "一座安靜收藏笑聲、祝福與相遇的婚禮檔案館",
    date: "二〇二六年六月二十日",
    allProcesses: "全部流程",
    guest: "訪客上傳",
    guestNote: "訪客照片會保留在獨立分類，不會加入婚禮流程。",
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
    emptyTitle: "這個流程還在等待照片",
    emptyBody: "婚禮當天的回憶會慢慢被收藏進來。",
    uploadTitle: "把你的照片放進檔案館",
    understood: "我知道了",
    comingSoon: "即將推出",
    comingBody: "人物分類與自拍找照片會在第二階段開放。現在不會要求自拍，也不會進行人臉辨識。",
    close: "關閉",
    previous: "上一張",
    next: "下一張",
    photo: "婚禮照片",
    loading: "正在整理回憶…",
    retry: "重新載入",
    errorTitle: "檔案館暫時無法開啟",
    errorBody: "請稍後再試，已收藏的照片不會受到影響。",
    offlineTitle: "目前沒有網路",
    offlineBody: "重新連線後，檔案館會繼續載入。",
    closedTitle: "檔案館目前暫停開放",
    closedBody: "管理員完成整理後會再次開放瀏覽。",
    language: "English",
    collection: "婚禮流程",
    photosCount: "張照片",
    adminHint: "此為第一階段的管理介面雛形；正式權限與同步由管理員功能串接。",
  },
  en: {
    archive: "The Leon & YehYeh Wedding Archive",
    subtitle: "A quiet archive of laughter, blessings, and the people who shared our day",
    date: "20 June 2026",
    allProcesses: "All moments",
    guest: "Guest uploads",
    guestNote: "Guest photos stay in a separate collection and are not assigned to wedding moments.",
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
    emptyTitle: "This moment is waiting for photos",
    emptyBody: "Memories from the wedding day will be carefully added here.",
    uploadTitle: "Add your photos to the archive",
    understood: "Got it",
    comingSoon: "Coming soon",
    comingBody: "People and selfie search arrive in Phase 2. No selfie or face recognition is requested now.",
    close: "Close",
    previous: "Previous photo",
    next: "Next photo",
    photo: "Wedding photo",
    loading: "Arranging the memories…",
    retry: "Try again",
    errorTitle: "The archive is temporarily unavailable",
    errorBody: "Please try again later. Stored photos are not affected.",
    offlineTitle: "You are offline",
    offlineBody: "The archive will continue loading after you reconnect.",
    closedTitle: "The archive is temporarily closed",
    closedBody: "It will reopen after the administrators finish arranging it.",
    language: "中文",
    collection: "Wedding moments",
    photosCount: "photos",
    adminHint: "This is the Phase 1 administration presentation. Authentication and shared persistence land with the administrator ticket.",
  },
};

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
    all: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 3v18M16 3v18M3 9h18M3 15h18"/></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
    find: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
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
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="paper-modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <button ref={closeRef} className="icon-button modal-close" type="button" onClick={onClose} aria-label={closeLabel}>×</button>
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
      <span className="state-symbol" aria-hidden="true">{icon}</span>
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
  const [lang, setLang] = useState(() => localStorage.getItem("memories-language") === "en" ? "en" : "zh");
  const [processes, setProcesses] = useState(PROCESS_DEFINITIONS);
  const [activeFilter, setActiveFilter] = useState("all");
  const [adminMode, setAdminMode] = useState(false);
  const [pageSize, setPageSize] = useState(12);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [modal, setModal] = useState(null);
  const [remotePhotos, setRemotePhotos] = useState(null);
  const [galleryError, setGalleryError] = useState(false);
  const [photoAssignments, setPhotoAssignments] = useState(() => new Map(MOCK_PHOTOS.map((photo) => [photo.id, photo.processIds])));
  const openerRef = useRef(null);
  const touchStartX = useRef(null);
  const t = COPY[lang];

  useEffect(() => {
    if (runtimeState !== "ready") return undefined;
    let cancelled = false;
    fetchAllPhotos()
      .then((photos) => {
        if (cancelled) return;
        if (photos.length > 0 || !useMockFallback) setRemotePhotos(photos);
        setGalleryError(false);
      })
      .catch(() => {
        if (!cancelled && !useMockFallback) setGalleryError(true);
      });
    return () => { cancelled = true; };
  }, [runtimeState, useMockFallback]);

  const sourcePhotos = remotePhotos ?? (useMockFallback ? MOCK_PHOTOS : []);
  const photos = useMemo(() => sourcePhotos.map((photo) => ({ ...photo, processIds: photoAssignments.get(photo.id) ?? photo.processIds ?? [] })), [sourcePhotos, photoAssignments]);
  const filtered = useMemo(() => filterPhotos(photos, activeFilter), [photos, activeFilter]);
  const visible = useMemo(() => pagePhotos(filtered, pageSize, 0).items, [filtered, pageSize]);
  const selectedIndex = selectedPhotoId ? filtered.findIndex((photo) => photo.id === selectedPhotoId) : -1;
  const selectedPhoto = selectedIndex >= 0 ? filtered[selectedIndex] : null;
  const galleryLoading = runtimeState === "ready" && remotePhotos === null && !useMockFallback && !galleryError;

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    document.title = lang === "zh" ? "詠葉婚禮照片檔案館" : "The Leon & YehYeh Wedding Archive";
  }, [lang]);

  useEffect(() => {
    if (!selectedPhoto) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") setSelectedPhotoId(null);
      if (event.key === "ArrowLeft" && selectedIndex > 0) setSelectedPhotoId(filtered[selectedIndex - 1].id);
      if (event.key === "ArrowRight" && selectedIndex < filtered.length - 1) setSelectedPhotoId(filtered[selectedIndex + 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      openerRef.current?.focus();
    };
  }, [selectedPhoto, selectedIndex, filtered]);

  const switchLanguage = () => {
    const next = lang === "zh" ? "en" : "zh";
    setLang(next);
    localStorage.setItem("memories-language", next);
  };

  const chooseNav = (item) => {
    if (item.id === "all") {
      setActiveFilter("all");
      document.getElementById("archive-gallery")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (item.id === "upload") {
      setModal("upload");
      return;
    }
    setModal("coming");
  };

  const handleUploaded = (photo) => {
    setRemotePhotos((current) => {
      const base = current ?? (useMockFallback ? MOCK_PHOTOS : []);
      return [photo, ...base.filter((item) => item.id !== photo.id)];
    });
  };

  const renameProcess = (index) => {
    const current = processes[index];
    const nextName = window.prompt(lang === "zh" ? "新的流程名稱" : "New moment name", current[lang]);
    if (!nextName?.trim()) return;
    setProcesses((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [lang]: nextName.trim() } : item));
  };

  const addProcess = () => {
    const label = window.prompt(lang === "zh" ? "新增流程名稱" : "New moment name");
    if (!label?.trim()) return;
    const id = `custom-${Date.now()}`;
    setProcesses((items) => [...items, { id, zh: label.trim(), en: label.trim() }]);
    setActiveFilter(id);
  };

  const toggleAssignment = (photoId) => {
    if (["all", "guest"].includes(activeFilter)) return;
    setPhotoAssignments((current) => {
      const next = new Map(current);
      const assignments = next.get(photoId) ?? [];
      next.set(photoId, assignments.includes(activeFilter) ? assignments.filter((id) => id !== activeFilter) : [...assignments, activeFilter]);
      return next;
    });
  };

  const stateView = (() => {
    if (runtimeState === "loading" || galleryLoading) return <StateCard icon="◌" title={t.loading} body={t.subtitle} />;
    if (runtimeState === "error" || galleryError) return <StateCard icon="!" title={t.errorTitle} body={t.errorBody} action={<button className="button primary" onClick={() => window.location.assign("/Memories/")}>{t.retry}</button>} />;
    if (runtimeState === "offline") return <StateCard icon="⌁" title={t.offlineTitle} body={t.offlineBody} />;
    if (runtimeState === "closed") return <StateCard icon="—" title={t.closedTitle} body={t.closedBody} />;
    return null;
  })();

  return (
    <div className="archive-shell">
      <div className="paper-grain" aria-hidden="true" />
      <header className="archive-header">
        <div className="header-tools">
          <button className="quiet-button" type="button" onClick={() => setAdminMode((value) => !value)}>{adminMode ? t.leaveAdmin : t.admin}</button>
          <button className="quiet-button" type="button" onClick={switchLanguage} aria-label={t.language}><Icon name="globe" /> {t.language}</button>
        </div>
        <p className="eyebrow">LEON & YEHY · WEDDING ARCHIVE</p>
        <h1>{t.archive}</h1>
        <p className="archive-date">{t.date}</p>
        <p className="archive-subtitle">{t.subtitle}</p>
        <div className="botanical-rule" aria-hidden="true"><span>❧</span></div>
      </header>

      <nav className="primary-nav" aria-label={lang === "zh" ? "相簿導覽" : "Archive navigation"}>
        {NAV_ITEMS.map((item) => (
          <button key={item.id} type="button" className={`nav-card ${item.id === "all" && activeFilter === "all" ? "active" : ""}`} onClick={() => chooseNav(item)}>
            <Icon name={item.id} /><span>{item[lang]}</span>{!item.enabled && <small>{t.comingSoon}</small>}
          </button>
        ))}
      </nav>

      <main>
        <section className="process-section" aria-labelledby="process-heading">
          <div className="section-heading"><div><p className="eyebrow">ORDER OF THE DAY</p><h2 id="process-heading">{t.collection}</h2></div><p>{filtered.length} {t.photosCount}</p></div>
          <div className="process-strip" role="list" aria-label={t.collection}>
            <button type="button" className={`process-chip ${activeFilter === "all" ? "active" : ""}`} onClick={() => { setActiveFilter("all"); setPageSize(12); }}>{t.allProcesses}</button>
            {processes.map((process, index) => (
              <button key={process.id} type="button" className={`process-chip ${activeFilter === process.id ? "active" : ""}`} onClick={() => { setActiveFilter(process.id); setPageSize(12); }}><span>{String(index + 1).padStart(2, "0")}</span>{process[lang]}</button>
            ))}
            <button type="button" className={`process-chip guest ${activeFilter === "guest" ? "active" : ""}`} onClick={() => { setActiveFilter("guest"); setPageSize(12); }}>{t.guest}</button>
          </div>
          {activeFilter === "guest" && <p className="guest-note">{t.guestNote}</p>}
        </section>

        {adminMode && (
          <section className="admin-panel" aria-labelledby="admin-heading">
            <div><p className="eyebrow">ARCHIVE DESK</p><h2 id="admin-heading">{t.processEditor}</h2><p>{t.adminHint}</p></div>
            <button className="button primary" type="button" onClick={addProcess}>＋ {t.addProcess}</button>
            <div className="admin-process-list">
              {processes.map((process, index) => (
                <article key={process.id} className="admin-process-row"><span>{String(index + 1).padStart(2, "0")}</span><strong>{process[lang]}</strong><div>
                  <button type="button" disabled={index === 0} onClick={() => setProcesses((items) => moveItem(items, index, -1))} aria-label={t.moveLeft}>←</button>
                  <button type="button" disabled={index === processes.length - 1} onClick={() => setProcesses((items) => moveItem(items, index, 1))} aria-label={t.moveRight}>→</button>
                  <button type="button" onClick={() => renameProcess(index)}>{t.rename}</button>
                  <button type="button" onClick={() => { setProcesses((items) => items.filter((_, itemIndex) => itemIndex !== index)); if (activeFilter === process.id) setActiveFilter("all"); }}>{t.remove}</button>
                </div></article>
              ))}
            </div>
          </section>
        )}

        <section id="archive-gallery" className="gallery-section" aria-live="polite">
          {stateView ?? (filtered.length === 0 || runtimeState === "empty" ? <StateCard icon="✦" title={t.emptyTitle} body={t.emptyBody} /> : (
            <><div className="masonry-grid">{visible.map((photo, index) => {
              const assigned = activeFilter !== "all" && activeFilter !== "guest" && photo.processIds.includes(activeFilter);
              return <article className="photo-card" key={photo.id}>
                <button type="button" className="photo-open" onClick={(event) => { openerRef.current = event.currentTarget; setSelectedPhotoId(photo.id); }} aria-label={`${t.photo} ${index + 1}`}><img src={photo.thumbnailUrl} alt={`${t.photo} ${index + 1}`} loading="lazy" width={photo.width} height={photo.height} /><span className="photo-index">{String(index + 1).padStart(2, "0")}</span></button>
                <footer><span>{photo.source === "guest" ? t.guest : processes.find((process) => photo.processIds.includes(process.id))?.[lang] ?? t.allProcesses}</span><small>{photo.uploaderName}</small></footer>
                {adminMode && activeFilter !== "all" && activeFilter !== "guest" && <button className="assignment-button" type="button" onClick={() => toggleAssignment(photo.id)}>{assigned ? `− ${t.removeFrom}` : `＋ ${t.addTo}`}</button>}
              </article>;
            })}</div>{visible.length < filtered.length && <button className="load-more" type="button" onClick={() => setPageSize((size) => size + 12)}>{t.loadMore}<span>↓</span></button>}</>
          ))}
        </section>
      </main>

      <footer className="archive-footer"><span>LY</span><p>Leon & YehYeh · 20.06.2026</p><small>Collected with love in Tainan</small></footer>

      {modal === "upload" && <UploadModal lang={lang} onClose={() => setModal(null)} onUploaded={handleUploaded} />}
      {modal === "coming" && <Modal title={t.comingSoon} closeLabel={t.close} onClose={() => setModal(null)}><p>{t.comingBody}</p><button className="button primary" type="button" onClick={() => setModal(null)}>{t.understood}</button></Modal>}

      {selectedPhoto && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${t.photo} ${selectedIndex + 1}`} onMouseDown={(event) => event.target === event.currentTarget && setSelectedPhotoId(null)} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (touchStartX.current === null || end === undefined) return; const distance = end - touchStartX.current; if (distance < -55 && selectedIndex < filtered.length - 1) setSelectedPhotoId(filtered[selectedIndex + 1].id); if (distance > 55 && selectedIndex > 0) setSelectedPhotoId(filtered[selectedIndex - 1].id); touchStartX.current = null; }}>
          <button className="lightbox-close" type="button" onClick={() => setSelectedPhotoId(null)} aria-label={t.close}>×</button>
          <button className="lightbox-arrow previous" type="button" disabled={selectedIndex <= 0} onClick={() => setSelectedPhotoId(filtered[selectedIndex - 1].id)} aria-label={t.previous}>‹</button>
          <figure><img src={selectedPhoto.mediaUrl} alt={`${t.photo} ${selectedIndex + 1}`} /><figcaption><span>{selectedIndex + 1} / {filtered.length}</span><strong>{selectedPhoto.source === "guest" ? t.guest : selectedPhoto.uploaderName}</strong></figcaption></figure>
          <button className="lightbox-arrow next" type="button" disabled={selectedIndex >= filtered.length - 1} onClick={() => setSelectedPhotoId(filtered[selectedIndex + 1].id)} aria-label={t.next}>›</button>
        </div>
      )}
    </div>
  );
}
