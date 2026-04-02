import { useEffect, useState } from "react";

const SECTIONS = [
  {
    id: "section-hero",
    label: "首頁",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M12 21.7C17.3 17 22 13 22 8.5a10 10 0 0 0-20 0C2 13 6.7 17 12 21.7z" />
        <circle cx="12" cy="8.5" r="3" />
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
    id: "section-maps",
    label: "地圖",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <circle cx="12" cy="10" r="3" />
        <path d="M12 21.7C17.3 17 22 13 22 10a10 10 0 0 0-20 0c0 3 4.7 7 10 11.7z" />
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

export function FloatingNav() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const ratios = new Array(SECTIONS.length).fill(0);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const i = SECTIONS.findIndex((s) => s.id === entry.target.id);
          if (i !== -1) {
            ratios[i] = entry.intersectionRatio;
          }
        });
        const best = ratios.indexOf(Math.max(...ratios));
        setActiveIndex(best);
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      }
    );

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className="fixed right-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 items-center"
      role="navigation"
      aria-label="快速導覽"
    >
      <div className="flex flex-col gap-1.5 bg-white/70 backdrop-blur-md rounded-full px-1.5 py-2 shadow-lg border border-white/60">
        {SECTIONS.map((section, i) => (
          <button
            key={section.id}
            onClick={() => scrollTo(section.id)}
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
