import { useEffect, useRef, useState } from "react";
import { KiwiIcon, KiwiFruit } from "@/components/KiwiIcon";
import { NZMap } from "@/components/NZMap";
import { TWMap } from "@/components/TWMap";
import { AudioPlayer } from "@/components/AudioPlayer";
import { FloatingNav, SECTIONS_COUNT, SECTIONS } from "@/components/FloatingNav";

function useIntersectionObserver(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

function FloatingKiwis() {
  return (
    <div className="pointer-events-none select-none hidden sm:block">
      <div
        className="fixed top-[8%] left-[3%] opacity-20 animate-float"
        style={{ animationDelay: "0s" }}
      >
        <KiwiIcon size={40} />
      </div>
      <div
        className="fixed top-[15%] right-[4%] opacity-15 animate-float-slow"
        style={{ animationDelay: "1.5s" }}
      >
        <KiwiFruit size={28} />
      </div>
      <div
        className="fixed top-[45%] left-[2%] opacity-15 animate-float"
        style={{ animationDelay: "0.8s" }}
      >
        <KiwiIcon size={32} />
      </div>
      <div
        className="fixed top-[65%] right-[3%] opacity-20 animate-float-slow"
        style={{ animationDelay: "2s" }}
      >
        <KiwiFruit size={24} />
      </div>
      <div
        className="fixed top-[82%] left-[5%] opacity-10 animate-float"
        style={{ animationDelay: "1.2s" }}
      >
        <KiwiIcon size={36} />
      </div>
    </div>
  );
}

interface FloatingArrowsProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function FloatingArrows({ scrollContainerRef }: FloatingArrowsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateIndex = () => {
      const vw = container.clientWidth;
      if (vw === 0) return;
      const index = Math.round(container.scrollLeft / vw);
      setActiveIndex(Math.min(Math.max(index, 0), SECTIONS_COUNT - 1));
    };

    const observer = new ResizeObserver(updateIndex);
    observer.observe(container);
    container.addEventListener("scroll", updateIndex, { passive: true });
    updateIndex();
    return () => {
      container.removeEventListener("scroll", updateIndex);
      observer.disconnect();
    };
  }, [scrollContainerRef]);

  const scrollTo = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ left: index * container.clientWidth, behavior: "smooth" });
  };

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === SECTIONS_COUNT - 1;

  const prevLabel = !isFirst ? SECTIONS[activeIndex - 1].label : "";
  const nextLabel = !isLast ? SECTIONS[activeIndex + 1].label : "";

  const capsuleClass =
    "fixed top-4 z-50 flex flex-col items-center gap-1 bg-white/75 backdrop-blur-md shadow-lg border border-white/60 text-green-700 hover:bg-white/90 hover:text-green-900 transition-all duration-200 active:scale-95 rounded-2xl px-3 py-2";

  return (
    <>
      {!isFirst && (
        <button
          className={`${capsuleClass} left-3`}
          aria-label={`上一頁：${prevLabel}`}
          onClick={() => scrollTo(activeIndex - 1)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
            <path
              d="M11 4 L6 9 L11 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs font-medium text-green-800/80" style={{ writingMode: "vertical-rl" }}>{prevLabel}</span>
        </button>
      )}
      {!isLast && (
        <button
          className={`${capsuleClass} right-3 animate-heartbeat hover:[animation-play-state:paused]`}
          aria-label={`下一頁：${nextLabel}`}
          onClick={() => scrollTo(activeIndex + 1)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
            <path
              d="M7 4 L12 9 L7 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs font-medium text-green-800/80" style={{ writingMode: "vertical-rl" }}>{nextLabel}</span>
        </button>
      )}
    </>
  );
}

function HeroSection() {
  return (
    <section
      id="section-hero"
      className="relative w-screen h-screen flex-shrink-0 flex flex-col items-center justify-center overflow-hidden text-[17px] kiwi-pattern snap-start"
      style={{
        background:
          "linear-gradient(160deg, #f0f7e6 0%, #faf6d8 40%, #eef6e2 70%, #f8f4e0 100%)",
      }}
    >
      {/* Decorative kiwis */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-8 -left-8 opacity-10 animate-float-slow">
          <KiwiIcon size={180} />
        </div>
        <div
          className="absolute -bottom-10 -right-10 opacity-10 animate-float"
          style={{ animationDelay: "2s" }}
        >
          <KiwiIcon size={200} />
        </div>
        <div
          className="absolute top-1/4 -right-12 opacity-8 animate-float-slow"
          style={{ animationDelay: "1s" }}
        >
          <KiwiIcon size={140} />
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-2xl mx-auto w-full">
        {/* Announcement */}
        <p
          className="font-noto-serif-tc text-xs tracking-[0.4em] uppercase mb-4 opacity-0 animate-fade-in-up text-green-700"
          style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}
          data-testid="text-announcement"
        >
          謹訂於此佳期
        </p>

        {/* Names — single grid so columns share widths across both rows */}
        <div
          className="grid grid-cols-[1fr_auto_1fr] items-center mb-6 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.4s", animationFillMode: "forwards" }}
        >
          {/* Row 1: English names */}
          <h1
            className="font-playfair text-4xl sm:text-5xl leading-tight font-semibold italic text-right text-green-800"
            data-testid="text-names"
          >Leon</h1>
          <span className="font-playfair text-2xl sm:text-3xl not-italic text-yellow-600 px-3 sm:px-4 text-center">&amp;</span>
          <h1 className="font-playfair text-4xl sm:text-5xl leading-tight font-semibold italic text-left text-green-800">Yeh</h1>

          {/* Row 2: Chinese names */}
          <span
            className="font-zen-old-mincho font-semibold text-3xl sm:text-4xl text-right text-green-800"
            data-testid="text-chinese-names"
          >黃律詠</span>
          <span className="text-yellow-600 text-2xl sm:text-3xl px-3 sm:px-4 text-center">✦</span>
          <span className="font-zen-old-mincho font-semibold text-3xl sm:text-4xl text-left text-green-800">葉藝慧</span>
        </div>

        {/* Decorative divider */}
        <div
          className="flex items-center justify-center gap-4 mb-6 sm:mb-8 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.7s", animationFillMode: "forwards" }}
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-400 opacity-50" />
          <div className="flex items-center gap-2">
            <KiwiIcon size={24} />
            <span className="text-yellow-400 text-2xl drop-shadow">🐾</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-400 opacity-50" />
        </div>

        {/* Date card */}
        <div
          className="rounded-2xl px-4 py-4 sm:px-8 sm:py-5 mb-6 sm:mb-8 opacity-0 animate-fade-in-up backdrop-blur-sm invitation-shadow bg-white/60"
          style={{ animationDelay: "0.8s", animationFillMode: "forwards" }}
          data-testid="card-date"
        >
          <p className="font-playfair font-semibold tracking-wide text-2xl sm:text-4xl md:text-[42px] text-green-800">
            2026 · 06 · 20
          </p>
          <p className="font-noto-serif-tc mt-1 tracking-widest text-base sm:text-xl md:text-[25px] font-bold text-green-600">
            星期六 下午三點
          </p>
        </div>

        {/* Invitation paragraphs */}
        <div
          className="opacity-0 animate-fade-in-up mb-6 sm:mb-8 px-2"
          style={{ animationDelay: "1.0s", animationFillMode: "forwards" }}
        >
          <p className="font-noto-serif-tc text-sm sm:text-base leading-relaxed tracking-wide text-green-700 mb-4">
            歷經兩年的等待與磨合，這段跨越台與紐的愛情，即將要迎來新的篇章。
          </p>
          <p className="font-noto-serif-tc text-sm sm:text-base leading-relaxed tracking-wide text-green-700">
            在無聊的端午節假期，如果有空，我們歡迎每一位見證我們成長與愛情的親友。2026年6月20日，大家一齊同樂，我們都很期待分享自己重要的另一半給愛我們的親友，等你們噢！
          </p>
        </div>

      </div>
    </section>
  );
}

function LoveStorySection() {
  const { ref, isVisible } = useIntersectionObserver();
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [isLongDistanceOpen, setIsLongDistanceOpen] = useState(false);

  return (
    <section
      id="section-story"
      ref={ref}
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto py-12 md:py-20 px-4 sm:px-6"
      style={{
        background: "linear-gradient(180deg, #faf6d8 0%, #f5f8ee 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className={`text-center mb-8 md:mb-16 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <p className="font-noto-serif-tc text-xs tracking-[0.5em] text-green-600 uppercase mb-3">
            我們的故事
          </p>
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl italic text-green-800 mb-4">
            A Love Story
          </h2>
          <div className="flex justify-center">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
        </div>

        {/* Story with dog */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-12 items-center mb-8 md:mb-16">
          <div
            className={`transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}
          >
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-blue-50 to-yellow-50 rounded-full blur-xl opacity-70" />
                <img
                  src="/penguin-story.png"
                  alt="葉黃素夢"
                  className="relative animate-wiggle w-32 sm:w-40 md:w-48 h-auto object-contain"
                />
              </div>
            </div>
            <p className="text-center font-noto-serif-tc text-sm text-green-600 mt-3 tracking-wider">
              我們的小寶貝 · 葉黃素夢
            </p>
          </div>

          <div
            className={`transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}
          >
            <div className="space-y-4 sm:space-y-5">
              <div className="bg-white/70 rounded-2xl invitation-shadow overflow-hidden">
                <button
                  onClick={() => setIsStoryOpen(!isStoryOpen)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
                >
                  <span className="font-noto-serif-tc text-green-800 text-sm font-medium">
                    路邊撿回家的另一半：基督城的奇妙邂逅
                  </span>
                  <svg
                    className={`flex-shrink-0 ml-3 w-4 h-4 text-green-600 transition-transform duration-300 ${isStoryOpen ? "rotate-180" : "rotate-0"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`transition-all duration-500 ease-in-out overflow-hidden ${isStoryOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
                >
                  <p className="font-noto-serif-tc text-green-800 leading-relaxed text-sm px-4 sm:px-5 pb-4 sm:pb-5">
                    2024年的2月底，是一場令人略感疲憊的紐西蘭公路旅行的尾聲，抵達基督城（Christchurch）的那一晚迎來了轉折。透過司機 Joe 與鄭牧師的牽線，在一頓稀鬆平常的咖哩雞晚餐中，我遇見了 Leon。當時的我正因為旅途的心情低落，甚至打算隻身留在基督城睡麥當勞，卻沒想到這個「怪怪的」、在電話中說自己吃飽卻還是堅持赴約的紐西蘭大男孩，意外地闖進了我的生活。一句玩笑話「不然住你家地板？」開啟了聯繫的契機，原本預計只停留兩天的計畫，也因為這份特別的緣分，變成了長達兩週的深度停留。
                  </p>
                </div>
              </div>
              <div className="bg-white/70 rounded-2xl invitation-shadow overflow-hidden">
                <button
                  onClick={() => setIsLongDistanceOpen(!isLongDistanceOpen)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
                  aria-expanded={isLongDistanceOpen}
                  aria-controls="long-distance-content"
                >
                  <span className="font-noto-serif-tc text-green-800 text-sm font-medium">
                    交往契機與遠距離的酸甜
                  </span>
                  <svg
                    className={`flex-shrink-0 ml-3 w-4 h-4 text-green-600 transition-transform duration-300 ${isLongDistanceOpen ? "rotate-180" : "rotate-0"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  id="long-distance-content"
                  className={`transition-all duration-500 ease-in-out overflow-hidden ${isLongDistanceOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}
                >
                  <p className="font-noto-serif-tc text-green-800 leading-relaxed text-sm px-4 sm:px-5 pb-4 sm:pb-5">
                    那兩週的時光，是我們故事的序章。Leon 陪我買了一台車，並耐心地陪著我練車，他也因為想換教會，我陪他去了不同族群的教會，短短的兩週我們在基督城的街道與美景穿梭，透過深度的對話與真誠的相處替我們打下了穩固的愛情地基。2024的3月10日，在我準備啟程前往奧克蘭的前夕，我們決定正式交往。同年7月我回到了台灣，開啟了長達兩年的跨國遠距戀愛。在我們相愛的日子裡，有七成的時間相隔兩地，拜這個世代方便得交通所賜，我們也都當小飛人到彼此的身邊。無法陪伴彼此時，每一次的訊息與視訊，也成了支撐我們度過遠距離孤獨的動力，甚至我們會透過作畫來抒發思念。中間隔著廣闊的太平洋，還以為如同薄冰的關係會持續不了多久，感謝神因著信仰，我們知道愛情不只是一種感覺，也是一個承諾約定，當無法親自照顧對方，我們交託仰望主，這不是簡單兩個人的愛情，更是有主一同參與的奇跡，我們都很珍惜彼此，能夠遇到相愛的人需要付出時間、精力、心血這都不容易，所以我們也感謝陪伴給我們鼓勵的夥伴們，謝謝你們。
                  </p>
                </div>
              </div>
              <div className="bg-white/70 rounded-2xl p-4 sm:p-5 invitation-shadow border-l-4 border-yellow-400">
                <p className="font-great-vibes text-xl sm:text-2xl text-green-700 mb-1">
                  "From Kiwi Land to Home"
                </p>
                <p className="font-noto-serif-tc text-xs text-green-600">
                  從南半球的奇異果之鄉，到台灣的溫暖懷抱
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WeddingDetailsSection() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section
      id="section-details"
      ref={ref}
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto py-12 md:py-20 px-4 sm:px-6"
      style={{
        background:
          "linear-gradient(160deg, #2d5a1b 0%, #1a3a0f 50%, #2d5a1b 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className={`text-center mb-8 md:mb-12 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <p className="font-noto-serif-tc text-xs tracking-[0.5em] text-yellow-400/70 uppercase mb-3">
            婚禮詳情
          </p>
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl italic text-yellow-300 mb-4">
            Wedding Details
          </h2>
          <div className="flex justify-center">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {[
            {
              icon: "📅",
              title: "日期",
              subtitle: "Date",
              content: "2026年06月20日",
              sub: "星期六",
              delay: "delay-100",
            },
            {
              icon: "⏰",
              title: "時間",
              subtitle: "Time",
              content: "下午三點",
              sub: "3:00 PM",
              delay: "delay-200",
            },
            {
              icon: "📍",
              title: "地點",
              subtitle: "Venue",
              content: "德光長老教會",
              sub: "台南市東區崇德四街100號",
              delay: "delay-300",
            },
          ].map((item) => (
            <div
              key={item.title}
              className={`text-center bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-yellow-400/20 transition-all duration-1000 ${item.delay} ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
              data-testid={`card-detail-${item.title}`}
            >
              <div className="text-3xl sm:text-4xl mb-3">{item.icon}</div>
              <p className="font-noto-serif-tc text-yellow-400/70 text-xs tracking-widest mb-1">
                {item.subtitle}
              </p>
              <p className="font-noto-serif-tc text-yellow-200 text-sm sm:text-base font-medium">
                {item.title}
              </p>
              <div className="h-px bg-yellow-400/20 my-3" />
              <p className="font-playfair text-yellow-100 text-base sm:text-lg font-semibold">
                {item.content}
              </p>
              <p className="font-noto-serif-tc text-yellow-400/60 text-xs sm:text-sm mt-1">
                {item.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Dress code */}
        <div
          className={`mt-6 sm:mt-8 text-center bg-yellow-400/10 rounded-2xl p-4 sm:p-6 border border-yellow-400/20 transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <p className="font-noto-serif-tc text-yellow-300 text-sm tracking-wider mb-2">
            服裝建議
          </p>
          <p className="font-playfair text-yellow-200 text-lg sm:text-xl italic mb-2">
            Dress Code
          </p>
          <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
            <span className="bg-green-700/50 text-green-200 px-3 sm:px-4 py-1 rounded-full text-sm font-noto-serif-tc border border-green-500/30">
              綠色系
            </span>
            <span className="bg-yellow-700/30 text-yellow-200 px-3 sm:px-4 py-1 rounded-full text-sm font-noto-serif-tc border border-yellow-500/30">
              黃色系
            </span>
            <span className="text-yellow-300/70 text-sm font-noto-serif-tc self-center">
              歡迎融入奇異果元素 🥝
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoWallSection() {
  const { ref, isVisible } = useIntersectionObserver();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const API_BASE = import.meta.env.BASE_URL ? `${window.location.origin}` : "";

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/photos`);
        const data = await res.json();
        if (data.photos) setPhotos(data.photos);
      } catch (err) {
        console.error("Failed to load photos:", err);
      }
    };
    fetchPhotos();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("photos", file));
      const res = await fetch(`${API_BASE}/api/photos/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const result = await res.json();
        setPhotos((prev) => [...prev, ...result.uploaded]);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      (e.target as HTMLInputElement).value = "";
    }
  };

  return (
    <section
      id="section-gallery"
      ref={ref}
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto py-12 md:py-20 px-4 sm:px-6"
      style={{
        background: "linear-gradient(180deg, #f8f9e8 0%, #f2f8e6 100%)",
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div
          className={`text-center mb-8 md:mb-12 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <p className="font-noto-serif-tc text-xs tracking-[0.5em] text-green-600 uppercase mb-3">
            我們的相片
          </p>
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl italic text-green-800 mb-4">
            Photo Wall
          </h2>
          <div className="flex justify-center">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
          <p className="font-noto-serif-tc text-sm text-green-600 mt-4">
            分享你們與我們的美好瞬間
          </p>
        </div>

        {/* Photo grid or empty state */}
        {photos.length > 0 ? (
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          >
            {photos.map((filename, i) => (
              <div
                key={filename}
                className="aspect-square rounded-2xl overflow-hidden invitation-shadow transition-all duration-700"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <img
                  src={`${API_BASE}/api/photos/image/${filename}`}
                  alt={`照片 ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`flex flex-col items-center justify-center py-16 transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          >
            <div className="bg-white/70 rounded-3xl p-10 invitation-shadow text-center max-w-sm">
              <div className="text-5xl mb-4">📷</div>
              <p className="font-noto-serif-tc text-green-800 text-base mb-2">
                還沒有照片
              </p>
              <p className="font-noto-serif-tc text-green-600 text-sm">
                上傳你們與我們的美照，一起留下這份回憶
              </p>
            </div>
          </div>
        )}

        {/* Upload button */}
        <div
          className={`flex justify-center transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <label className="inline-flex items-center gap-2 cursor-pointer group">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            <span className="inline-block bg-green-700/90 hover:bg-green-800 text-white px-6 py-3 rounded-xl font-noto-serif-tc text-sm cursor-pointer transition-all shadow-md tracking-wider">
              {uploading ? "上傳中…" : "📷 上傳照片"}
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}

function RSVPSection() {
  const { ref, isVisible } = useIntersectionObserver();
  return (
    <section
      id="section-rsvp"
      ref={ref}
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto py-12 md:py-20 px-4 sm:px-6"
      style={{
        background: "linear-gradient(160deg, #faf6d8 0%, #f0f7e6 100%)",
      }}
    >
      <div className="max-w-xl mx-auto">
        <div
          className={`text-center mb-8 md:mb-12 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <p className="font-noto-serif-tc text-xs tracking-[0.5em] text-green-600 uppercase mb-3">
            出席確認
          </p>
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl italic text-green-800 mb-4">
            RSVP
          </h2>
          <div className="flex justify-center mb-4">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
          <p className="font-noto-serif-tc text-sm text-green-600">
            請於 2026年5月20日 前回覆
          </p>
        </div>

        <div
          className={`bg-white/80 rounded-3xl p-5 sm:p-8 invitation-shadow transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLSeMnqHLFAmMpdtUrwr0BGtEnQYoS3SM40odyPEYOtZQNX8LlQ/viewform?embedded=true"
            width="100%"
            height="1224"
            frameBorder="0"
          >
            載入中…
          </iframe>
        </div>
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer
      id="section-footer"
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto py-12 sm:py-16 px-4 sm:px-6 text-center flex flex-col justify-center"
      style={{
        background: "linear-gradient(160deg, #1a3a0f 0%, #0f2208 100%)",
      }}
    >
      <div className="max-w-2xl mx-auto w-full">
        {/* Penguin illustration */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute -inset-6 bg-blue-900/20 rounded-full blur-xl" />
            <img
              src="/penguin-footer.png"
              alt="葉黃素夢"
              className="relative w-24 sm:w-32 h-auto object-contain opacity-90"
            />
          </div>
        </div>

        <p className="font-noto-serif-tc text-green-400/60 text-xs tracking-widest mb-4">
          葉黃素夢 也很期待見到大家
        </p>

        {/* Divider with kiwis */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px flex-1 bg-green-700/40" />
          <KiwiIcon size={24} className="opacity-40" />
          <div className="h-px flex-1 bg-green-700/40" />
        </div>

        <h2 className="font-great-vibes text-3xl sm:text-5xl text-yellow-300/80 mb-3">
          Leon & Yeh
        </h2>
        <p className="font-noto-serif-tc text-green-400/50 text-xs tracking-widest mb-6">
          2026 · 06 · 20
        </p>

        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <NZMap size={40} className="mx-auto opacity-50" />
            <p className="font-noto-serif-tc text-green-500/40 text-xs mt-1">
              NZ
            </p>
          </div>
          <span className="text-yellow-400/40 text-2xl">💚</span>
          <div className="text-center">
            <TWMap size={32} className="mx-auto opacity-50" />
            <p className="font-noto-serif-tc text-green-500/40 text-xs mt-1">
              TW
            </p>
          </div>
        </div>

        <p className="font-noto-serif-tc text-green-600/30 text-xs mt-8 tracking-widest">
          From Kiwi Land with Love
        </p>
      </div>
    </footer>
  );
}

export default function Invitation() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
      }
    };

    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden">
      <AudioPlayer />
      <FloatingNav scrollContainerRef={scrollContainerRef} />
      <FloatingKiwis />
      <FloatingArrows scrollContainerRef={scrollContainerRef} />
      <div
        ref={scrollContainerRef}
        className="w-full h-full flex flex-row overflow-x-auto overflow-y-hidden snap-x snap-mandatory snap-container"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-y" }}
      >
        <HeroSection />
        <WeddingDetailsSection />
        <RSVPSection />
        <LoveStorySection />
        <PhotoWallSection />
        <FooterSection />
      </div>
    </div>
  );
}
