import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { KiwiFruit } from "@/components/KiwiIcon";

type Lang = "zh" | "en";

const COPY = {
  zh: {
    pageTitle: "婚禮相簿",
    eyebrow: "我們的回憶",
    title: "Memories",
    subtitle: "一起重溫我們與大家分享的美好時刻",
    home: "回到婚禮首頁",
    toggleLanguage: "切換語言 / Toggle language",
    loading: "相片載入中…",
    error: "相片暫時無法載入",
    retry: "再試一次",
    empty: "相片還在準備中",
    emptySub: "美好回憶很快就會出現在這裡。",
    openPhoto: "開啟照片",
    photo: "婚禮照片",
    close: "關閉",
    previous: "上一張",
    next: "下一張",
  },
  en: {
    pageTitle: "Wedding Gallery",
    eyebrow: "OUR MEMORIES",
    title: "Memories",
    subtitle: "Relive the beautiful moments we shared with all of you",
    home: "Back to the wedding",
    toggleLanguage: "切換語言 / Toggle language",
    loading: "Loading photos…",
    error: "Photos are temporarily unavailable",
    retry: "Try again",
    empty: "Photos are coming soon",
    emptySub: "Our favourite memories will appear here shortly.",
    openPhoto: "Open photo",
    photo: "Wedding photo",
    close: "Close",
    previous: "Previous photo",
    next: "Next photo",
  },
} as const;

function getInitialLang(): Lang {
  return localStorage.getItem("weddingLang") === "en" ? "en" : "zh";
}

function photoUrl(filename: string) {
  return `/api/photos/image/${encodeURIComponent(filename)}`;
}

export default function Memories() {
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const t = COPY[lang];
  const isLightboxOpen = lightboxIndex !== null;

  const loadPhotos = async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/photos");
      if (!response.ok)
        throw new Error(`Photo request failed: ${response.status}`);
      const data: unknown = await response.json();
      const filenames =
        typeof data === "object" &&
        data !== null &&
        "photos" in data &&
        Array.isArray(data.photos)
          ? data.photos.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
      setPhotos(filenames);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to load photos:", error);
      setStatus("error");
    }
  };

  useEffect(() => {
    void loadPhotos();
  }, []);

  useEffect(() => {
    const originalTitle = document.title;
    return () => {
      document.title = originalTitle;
    };
  }, []);

  useEffect(() => {
    document.title = `${t.pageTitle} | Leon & YehYeh`;
  }, [t.pageTitle]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    const pageContent = pageContentRef.current;
    document.body.style.overflow = "hidden";
    if (pageContent) pageContent.inert = true;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") {
        setLightboxIndex((index) =>
          index !== null && index > 0 ? index - 1 : index,
        );
      }
      if (event.key === "ArrowRight") {
        setLightboxIndex((index) =>
          index !== null && index < photos.length - 1 ? index + 1 : index,
        );
      }
      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not([disabled])",
          ) ?? [],
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (pageContent) pageContent.inert = false;
      window.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus();
    };
  }, [isLightboxOpen, photos.length]);

  const switchLanguage = () => {
    const nextLang = lang === "zh" ? "en" : "zh";
    setLang(nextLang);
    localStorage.setItem("weddingLang", nextLang);
  };

  const openLightbox = (index: number, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setLightboxIndex(index);
  };

  return (
    <main
      className="min-h-screen bg-[linear-gradient(160deg,#f0f7e6_0%,#faf6d8_42%,#eef6e2_100%)] px-4 pb-14 pt-5 sm:px-6"
      lang={lang === "zh" ? "zh-Hant" : "en"}
    >
      <div
        ref={pageContentRef}
        data-testid="memories-page-content"
        aria-hidden={isLightboxOpen || undefined}
      >
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between gap-3"
          aria-label={t.pageTitle}
        >
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 font-noto-serif-tc text-sm text-green-800 shadow-md backdrop-blur-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
          >
            <span aria-hidden="true">←</span>
            {t.home}
          </Link>
          <button
            type="button"
            onClick={switchLanguage}
            aria-label={t.toggleLanguage}
            className="min-h-11 rounded-full border border-white/70 bg-white/70 px-4 py-2 font-noto-serif-tc text-sm text-green-800 shadow-md backdrop-blur-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
          >
            {lang === "zh" ? "Eng" : "中文"}
          </button>
        </nav>

        <header className="mx-auto max-w-3xl pb-8 pt-10 text-center sm:pb-12 sm:pt-16">
          <KiwiFruit size={34} className="mx-auto mb-4" />
          <p className="font-noto-serif-tc text-xs font-semibold tracking-[0.35em] text-green-600">
            {t.eyebrow}
          </p>
          <h1 className="mt-3 font-playfair text-5xl font-semibold italic text-green-900 sm:text-7xl">
            {t.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-noto-serif-tc text-sm leading-relaxed text-green-700 sm:text-base">
            {t.subtitle}
          </p>
          <div className="mx-auto mt-5 h-0.5 w-28 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
        </header>

        <section className="mx-auto max-w-6xl" aria-live="polite">
          {status === "loading" && (
            <div className="flex min-h-56 items-center justify-center">
              <p className="font-noto-serif-tc text-green-700">{t.loading}</p>
            </div>
          )}

          {status === "error" && (
            <div className="mx-auto flex min-h-56 max-w-md flex-col items-center justify-center rounded-3xl bg-white/70 p-8 text-center shadow-xl">
              <p className="font-noto-serif-tc text-green-900">{t.error}</p>
              <button
                type="button"
                onClick={() => void loadPhotos()}
                className="mt-5 min-h-11 rounded-xl bg-green-800 px-5 py-2 text-sm text-white transition hover:bg-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800"
              >
                {t.retry}
              </button>
            </div>
          )}

          {status === "ready" && photos.length === 0 && (
            <div className="mx-auto flex min-h-56 max-w-md flex-col items-center justify-center rounded-3xl bg-white/70 p-8 text-center shadow-xl">
              <span className="text-5xl" aria-hidden="true">
                📷
              </span>
              <p className="mt-4 font-noto-serif-tc text-lg text-green-900">
                {t.empty}
              </p>
              <p className="mt-2 font-noto-serif-tc text-sm text-green-700">
                {t.emptySub}
              </p>
            </div>
          )}

          {status === "ready" && photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {photos.map((filename, index) => (
                <button
                  key={`${filename}-${index}`}
                  type="button"
                  onClick={(event) => openLightbox(index, event.currentTarget)}
                  aria-label={`${t.openPhoto} ${index + 1}`}
                  className="group aspect-square overflow-hidden rounded-xl bg-white shadow-md transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800 sm:rounded-2xl"
                >
                  <img
                    src={photoUrl(filename)}
                    alt={`${t.photo} ${index + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {lightboxIndex !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${t.photo} ${lightboxIndex + 1}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const startX = touchStartX.current;
            const endX = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (startX === null || endX === undefined) return;
            const distance = endX - startX;
            if (distance < -50 && lightboxIndex < photos.length - 1) {
              setLightboxIndex(lightboxIndex + 1);
            }
            if (distance > 50 && lightboxIndex > 0) {
              setLightboxIndex(lightboxIndex - 1);
            }
          }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxIndex(null);
            }}
            aria-label={t.close}
            className="absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6 sm:top-6"
          >
            ×
          </button>

          <button
            type="button"
            disabled={lightboxIndex === 0}
            onClick={(event) => {
              event.stopPropagation();
              setLightboxIndex((index) => (index !== null ? index - 1 : index));
            }}
            aria-label={t.previous}
            className="absolute left-2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 text-3xl text-white transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:invisible sm:left-6"
          >
            ‹
          </button>

          <img
            src={photoUrl(photos[lightboxIndex])}
            alt={`${t.photo} ${lightboxIndex + 1}`}
            className="max-h-[85vh] max-w-[88vw] rounded-lg object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />

          <button
            type="button"
            disabled={lightboxIndex === photos.length - 1}
            onClick={(event) => {
              event.stopPropagation();
              setLightboxIndex((index) => (index !== null ? index + 1 : index));
            }}
            aria-label={t.next}
            className="absolute right-2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 text-3xl text-white transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:invisible sm:right-6"
          >
            ›
          </button>

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 font-noto-serif-tc text-sm tracking-widest text-white/80">
            {lightboxIndex + 1} / {photos.length}
          </p>
        </div>
      )}
    </main>
  );
}
