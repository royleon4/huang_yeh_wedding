import { useEffect, useRef, useState } from "react";

export const SECTIONS = [
  {
    id: "section-hero",
    label: "首頁",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    id: "section-details",
    label: "婚禮詳情",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "section-rsvp",
    label: "出席確認",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    id: "section-story",
    label: "愛情故事",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    id: "section-gallery",
    label: "相片牆",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: "section-footer",
    label: "結語",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

export const SECTIONS_COUNT = SECTIONS.length;

interface FloatingNavProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onNavClick?: () => void;
  labels?: Record<string, string>;
  navAriaLabel?: string;
}

export function FloatingNav({ scrollContainerRef, onNavClick, labels, navAriaLabel }: FloatingNavProps) {
  const isEn = labels?.["section-hero"] === "Home";
  const prevText = isEn ? "Prev" : "上一頁";
  const nextText = isEn ? "Next" : "下一頁";
  const [activeIndex, setActiveIndex] = useState(0);
  const navWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateActiveIndex = () => {
      const vw = container.clientWidth;
      if (vw === 0) return;
      const index = Math.round(container.scrollLeft / vw);
      setActiveIndex(Math.min(Math.max(index, 0), SECTIONS.length - 1));
    };

    const observer = new ResizeObserver(updateActiveIndex);
    observer.observe(container);

    container.addEventListener("scroll", updateActiveIndex, { passive: true });
    updateActiveIndex();
    return () => {
      container.removeEventListener("scroll", updateActiveIndex);
      observer.disconnect();
    };
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = navWrapperRef.current;
    if (!el) return;
    const updateNavH = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--nav-h", `${Math.ceil(h)}px`);
    };
    const ro = new ResizeObserver(updateNavH);
    ro.observe(el);
    updateNavH();
    return () => ro.disconnect();
  }, []);

  const scrollTo = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const targetSection = document.getElementById(SECTIONS[index].id);
    if (targetSection) targetSection.scrollTop = 0;
    container.scrollTo({ left: index * container.clientWidth, behavior: "smooth" });
    onNavClick?.();
  };

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === SECTIONS.length - 1;

  const prevLabel = !isFirst
    ? (labels?.[SECTIONS[activeIndex - 1].id] ?? SECTIONS[activeIndex - 1].label)
    : "";
  const nextLabel = !isLast
    ? (labels?.[SECTIONS[activeIndex + 1].id] ?? SECTIONS[activeIndex + 1].label)
    : "";

  const pillBase =
    "bg-white/75 backdrop-blur-md shadow-xl border border-white/60 rounded-full";

  return (
    <div
      ref={navWrapperRef}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-[0.75em] px-[1em] pointer-events-none"
      style={{ fontSize: '16px' }}
      role="navigation"
      aria-label={navAriaLabel ?? "快速導覽"}
    >
      <div className="flex flex-row items-center gap-[0.4em] pointer-events-auto">

        {/* Left pill: prev button or invisible spacer */}
        {!isFirst ? (
          <button
            onClick={() => scrollTo(activeIndex - 1)}
            aria-label={`${prevText}：${prevLabel}`}
            className={`${pillBase} flex flex-col items-center justify-center gap-[0.25em] text-green-700 transition-all duration-200 active:scale-95 hover:bg-white/90 hover:text-green-900 px-[0.6em] py-[0.45em]`}
            style={{ minWidth: "2.8em" }}
          >
            <svg width="1em" height="1em" viewBox="0 0 18 18" fill="none" className="shrink-0">
              <path d="M11 4 L6 9 L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
              className="text-[0.65em] font-medium text-green-800/80 leading-tight"
              style={{ writingMode: "vertical-rl", maxHeight: "4em", overflow: "hidden" }}
            >
              {prevLabel}
            </span>
          </button>
        ) : (
          <div className="invisible" style={{ minWidth: "2.8em" }} aria-hidden="true" />
        )}

        {/* Center pill: icon row */}
        <div className={`${pillBase} flex flex-row items-center justify-center gap-[0.15em] px-[0.5em] py-[0.4em]`}>
          {SECTIONS.map((section, i) => (
            <button
              key={section.id}
              onClick={() => scrollTo(i)}
              title={labels?.[section.id] ?? section.label}
              aria-label={labels?.[section.id] ?? section.label}
              style={{ fontSize: "1em" }}
              className={`
                relative flex items-center justify-center w-[2em] h-[2em] rounded-full transition-all duration-300
                ${
                  activeIndex === i
                    ? "bg-green-600 text-white shadow-md scale-110"
                    : "text-green-700/60 hover:bg-green-100 hover:text-green-700"
                }
              `}
            >
              {section.icon}
            </button>
          ))}
        </div>

        {/* Right pill: next button or invisible spacer */}
        {!isLast ? (
          <button
            onClick={() => scrollTo(activeIndex + 1)}
            aria-label={`${nextText}：${nextLabel}`}
            className={`${pillBase} flex flex-col items-center justify-center gap-[0.25em] text-green-700 transition-all duration-200 active:scale-95 hover:bg-white/90 hover:text-green-900 animate-heartbeat hover:[animation-play-state:paused] px-[0.6em] py-[0.45em]`}
            style={{ minWidth: "2.8em" }}
          >
            <svg width="1em" height="1em" viewBox="0 0 18 18" fill="none" className="shrink-0">
              <path d="M7 4 L12 9 L7 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
              className="text-[0.65em] font-medium text-green-800/80 leading-tight"
              style={{ writingMode: "vertical-rl", maxHeight: "4em", overflow: "hidden" }}
            >
              {nextLabel}
            </span>
          </button>
        ) : (
          <div className="invisible" style={{ minWidth: "2.8em" }} aria-hidden="true" />
        )}

      </div>
    </div>
  );
}
