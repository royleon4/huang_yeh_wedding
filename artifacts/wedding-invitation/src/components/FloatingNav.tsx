import { useEffect, useState } from "react";

export const SECTIONS = [
  {
    id: "section-hero",
    label: "首頁",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    id: "section-story",
    label: "愛情故事",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    id: "section-details",
    label: "婚禮詳情",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "section-gallery",
    label: "相片牆",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: "section-rsvp",
    label: "出席確認",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    id: "section-footer",
    label: "結語",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

export const NAV_HEIGHT = 68;
export const SECTIONS_COUNT = SECTIONS.length;

interface FloatingNavProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onNavClick?: () => void;
}

export function FloatingNav({ scrollContainerRef, onNavClick }: FloatingNavProps) {
  const [activeIndex, setActiveIndex] = useState(0);

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

  const scrollTo = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ left: index * container.clientWidth, behavior: "smooth" });
    onNavClick?.();
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 px-4 pointer-events-none"
      role="navigation"
      aria-label="快速導覽"
    >
      <div className="flex flex-row items-center justify-center gap-1 bg-white/75 backdrop-blur-md shadow-xl border border-white/60 px-3 py-2 rounded-full pointer-events-auto">
        {SECTIONS.map((section, i) => (
          <button
            key={section.id}
            onClick={() => scrollTo(i)}
            title={section.label}
            aria-label={section.label}
            className={`
              relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300
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
    </div>
  );
}
