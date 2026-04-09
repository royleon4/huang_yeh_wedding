import { createContext, useContext, useEffect, useRef, useState } from "react";
import { KiwiIcon, KiwiFruit } from "@/components/KiwiIcon";
import { NZMap } from "@/components/NZMap";
import { TWMap } from "@/components/TWMap";
import { AudioPlayer } from "@/components/AudioPlayer";
import { FloatingNav } from "@/components/FloatingNav";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

type Lang = "zh" | "en";

const ZH = {
  nav: { "section-hero": "首頁", "section-details": "婚禮詳情", "section-rsvp": "出席確認", "section-story": "愛情故事", "section-gallery": "相片牆", "section-footer": "結語" },
  prev: "上一頁", next: "下一頁",
  heroAnnouncement: "謹訂於此佳期",
  heroDate: "星期六 下午三點",
  heroPara1: "歷經兩年的等待與磨合，這段跨越台與紐的愛情，即將要迎來新的篇章。",
  heroPara2: "在無聊的端午節假期，如果有空，我們歡迎每一位見證我們成長與愛情的親友。2026年6月20日，大家一齊同樂，我們都很期待分享自己重要的另一半給愛我們的親友，等你們噢！",
  storyLabel: "我們的故事",
  storyH2: "A Love Story",
  dogCaption: "我們的小寶貝 · 葉黃素夢",
  story1Title: "路邊撿回家的另一半：基督城的奇妙邂逅",
  story1Body: [
    "2024年的2月底，是一場令人略感疲憊的紐西蘭公路旅行的尾聲，抵達基督城（Christchurch）的那一晚迎來了轉折。透過司機 Joe 與鄭牧師的牽線，在一頓稀鬆平常的咖哩雞晚餐中，我遇見了 Leon。",
    "當時的我正因為旅途的心情低落，甚至打算隻身留在基督城睡麥當勞，卻沒想到這個「怪怪的」、在電話中說自己吃飽卻還是堅持赴約的紐西蘭大男孩，意外地闖進了我的生活。",
    "一句玩笑話「不然住你家地板？」開啟了聯繫的契機，原本預計只停留兩天的計畫，也因為這份特別的緣分，變成了長達兩週的深度停留。",
  ],
  story2Title: "交往契機與遠距離的酸甜",
  story2Body: [
    "那兩週的時光，是我們故事的序章。Leon 陪我買了一台車，並耐心地陪著我練車，他也因為想換教會，我陪他去了不同族群的教會，短短的兩週我們在基督城的街道與美景穿梭，透過深度的對話與真誠的相處替我們打下了穩固的愛情地基。",
    "2024的3月10日，在我準備啟程前往奧克蘭的前夕，我們決定正式交往。同年7月我回到了台灣，開啟了長達兩年的跨國遠距戀愛。",
    "在我們相愛的日子裡，有七成的時間相隔兩地，拜這個世代方便得交通所賜，我們也都當小飛人到彼此的身邊。無法陪伴彼此時，每一次的訊息與視訊，也成了支撐我們度過遠距離孤獨的動力，甚至我們會透過作畫來抒發思念。",
    "中間隔著廣闊的太平洋，還以為如同薄冰的關係會持續不了多久，感謝神因著信仰，我們知道愛情不只是一種感覺，也是一個承諾約定，當無法親自照顧對方，我們交託仰望主，這不是簡單兩個人的愛情，更是有主一同參與的奇跡，我們都很珍惜彼此，能夠遇到相愛的人需要付出時間、精力、心血這都不容易，所以我們也感謝陪伴給我們鼓勵的夥伴們，謝謝你們。",
  ],
  quoteZh: "從南半球的奇異果之鄉，到台灣的溫暖懷抱",
  detailsLabel: "婚禮詳情",
  detailsH2: "Wedding Details",
  detailItems: [
    { icon: "📅", label: "日期 · 時間", sub: "Date & Time", content: "2026年\n6月20日", note: "星期六 · 下午 3:00 – 4:15" },
    { icon: "📍", label: "地點", sub: "Venue", content: "德光長老教會", note: "台南市東區崇德四街100號", mapQuery: "台南市東區崇德四街100號" },
  ],
  banquetLabel: "家宴",
  banquetTime: "晚上 5:30 – 9:00\n（可自由離開）",
  banquetVenue: "台糖長榮酒店（台南）吃遍天下自助餐廳",
  banquetAddress: "台南市東區中華東路三段336巷1號2樓",
  dressLabel: "服裝建議",
  dressGreen: "綠色系", dressYellow: "黃色系", dressKiwi: "歡迎融入奇異果元素 🥝",
  galleryLabel: "我們的相片",
  galleryH2: "Photo Wall",
  gallerySubtitle: "分享你們與我們的美好瞬間",
  galleryEmpty: "還沒有照片",
  galleryEmptySub: "上傳你們與我們的美照，一起留下這份回憶",
  galleryUploading: "上傳中…",
  galleryUpload: "📷 上傳照片",
  lightboxClose: "關閉",
  lightboxPrev: "上一張",
  lightboxNext: "下一張",
  navAriaLabel: "快速導覽",
  rsvpLabel: "出席確認",
  rsvpH2: "RSVP",
  rsvpDeadline: "請於 2026年5月10日 前回覆",
  footerDog: "葉黃素夢 也很期待見到大家",
  addToCalendar: "加入行事曆",
  calCeremonyTitle: "黃葉婚禮典禮",
  calCeremonyLocation: "德光長老教會, 台南市東區崇德四街100號",
  calCeremonyDesc: "Leon 黃律詠 & YehYeh 葉藝慧 婚禮典禮\n2026年06月20日 下午3點\n德光長老教會\n台南市東區崇德四街100號",
  calBanquetTitle: "黃葉家宴",
  calBanquetLocation: "台糖長榮酒店（台南）吃遍天下自助餐廳, 台南市東區中華東路三段336巷1號2樓",
  calBanquetDesc: "Leon 黃律詠 & YehYeh 葉藝慧 婚禮家宴\n2026年06月20日 晚上5:30 – 9:00（可自由離開）\n台糖長榮酒店（台南）吃遍天下自助餐廳\n台南市東區中華東路三段336巷1號2樓",
  transportLabel: "交通與停車",
  transportCeremonyTitle: "典禮 · 德光長老教會",
  transportBanquetTitle: "家宴 · 台糖長榮酒店",
  transportCeremonyItems: [
    { icon: "🅿️", name: "路邊停車格", desc: "崇德四街、崇德路沿線", fee: "約 NT$20 / 小時" },
    { icon: "🏛️", name: "榮譽街公有停車場", desc: "東區榮譽街 2 號 131 巷，汽車約 300 格", fee: "NT$20 / 小時，機車免費" },
    { icon: "🏛️", name: "臺南文化中心立體停車場", desc: "步行約 10 分鐘", fee: "" },
    { icon: "🌿", name: "巴克禮公園停車場", desc: "步行約 15 分鐘", fee: "" },
  ],
  transportBanquetItems: [
    { icon: "🏨", name: "長榮桂冠酒店停車場 B2–B4", desc: "參加家宴可折抵 4 小時免費，僅限汽車。入場告知守衛參加婚宴，取停車卡，離場時交還兌換", fee: "4 小時免費（汽車限定）" },
    { icon: "🛵", name: "附近路邊機車停車格", desc: "酒店周邊中華東路三段、富農街一帶", fee: "" },
    { icon: "📞", name: "飯店總機", desc: "06-289-9988", fee: "" },
  ],
  countdownDone: "已過",
  countdownPrefix: "倒數",
  countdownDay: "天",
  countdownHour: "小時",
  countdownMin: "分鐘",
  countdownSec: "秒",
};

const EN = {
  nav: { "section-hero": "Home", "section-details": "Details", "section-rsvp": "RSVP", "section-story": "Our Story", "section-gallery": "Gallery", "section-footer": "Closing" },
  prev: "Prev", next: "Next",
  heroAnnouncement: "You Are Invited",
  heroDate: "Saturday, 3:00 PM",
  heroPara1: "After two years of waiting and growing together, this love story spanning Taiwan and New Zealand is about to begin a beautiful new chapter.",
  heroPara2: "During the Dragon Boat Festival holiday, we warmly welcome every dear friend who has witnessed our growth and love. Join us on June 20, 2026 — we can't wait to share the most important person in our lives with you. See you there!",
  storyLabel: "OUR STORY",
  storyH2: "A Love Story",
  dogCaption: "Our Little One · Suomi",
  story1Title: "Found by the Roadside: A Miraculous Encounter in Christchurch",
  story1Body: [
    "At the end of February 2024, a somewhat exhausting road trip through New Zealand reached its turning point upon arriving in Christchurch. Through the connections of driver Joe and Pastor Cheng, over a casual curry chicken dinner, I met Leon.",
    "At the time, my spirits were low from the journey — I had even considered staying alone in Christchurch and sleeping at McDonald's. But this \"quirky\" New Zealand guy, who claimed on the phone he'd already eaten yet still insisted on showing up, somehow wandered into my life.",
    "A joking remark — \"What if I just sleep on your floor?\" — opened the door to connection. What was supposed to be a two-day stop turned into two full weeks, thanks to this unexpected bond.",
  ],
  story2Title: "How We Got Together & The Bittersweet of Long Distance",
  story2Body: [
    "Those two weeks were the prologue to our story. Leon patiently helped me buy and practice driving a car; I accompanied him to different churches as he explored new communities. In just two weeks we wandered Christchurch's streets and scenery, building the foundation of our love through deep conversations and genuine time together.",
    "On March 10, 2024 — the eve of my departure for Auckland — we made it official. In July of that year I returned to Taiwan, beginning nearly two years of long-distance love across the Pacific.",
    "For about seventy percent of our relationship we've been apart, yet thanks to the convenience of modern travel we've taken turns flying to each other's sides. When we couldn't be together, every message and video call became the fuel that carried us through the loneliness of distance — we even painted pictures to express how much we missed each other.",
    "With the vast Pacific between us, we wondered if something so fragile could really last. By the grace of God and our shared faith, we know that love is not just a feeling but a promise. When we couldn't care for each other in person, we entrusted ourselves to the Lord — this is not simply the love of two people, but a miracle in which He participates. We cherish each other deeply, and we are grateful to every friend who has encouraged us along the way. Thank you.",
  ],
  quoteZh: "From Kiwi Land in the Southern Hemisphere to the Warmth of Home",
  detailsLabel: "DETAILS",
  detailsH2: "Wedding Details",
  detailItems: [
    { icon: "📅", label: "Date & Time", sub: "Date & Time", content: "2026\nJune 20", note: "Saturday · 3:00 – 4:15 PM" },
    { icon: "📍", label: "Venue", sub: "Venue", content: "De-Guang Presbyterian Church", note: "No. 100, Chongde 4th St., East Dist., Tainan", mapQuery: "台南市東區崇德四街100號" },
  ],
  banquetLabel: "Evening Banquet",
  banquetTime: "5:30 – 9:00 PM\n(feel free to leave anytime)",
  banquetVenue: "Evergreen Laurel Hotel Tainan — \"Eat Around the World\" Buffet",
  banquetAddress: "No. 1, Lane 336, Sec. 3, Zhonghua E. Rd., East Dist., Tainan, 2F",
  dressLabel: "Dress Code",
  dressGreen: "Green tones", dressYellow: "Yellow tones", dressKiwi: "Kiwi elements welcome 🥝",
  galleryLabel: "OUR PHOTOS",
  galleryH2: "Photo Wall",
  gallerySubtitle: "Share your precious moments with us",
  galleryEmpty: "No photos yet",
  galleryEmptySub: "Upload your favourite photos to share this memory together",
  galleryUploading: "Uploading…",
  galleryUpload: "📷 Upload Photos",
  lightboxClose: "Close",
  lightboxPrev: "Previous",
  lightboxNext: "Next",
  navAriaLabel: "Quick Navigation",
  rsvpLabel: "RSVP",
  rsvpH2: "RSVP",
  rsvpDeadline: "Please respond by May 10, 2026",
  footerDog: "Suomi can't wait to see you all",
  addToCalendar: "Add to Calendar",
  calCeremonyTitle: "黃葉婚禮典禮",
  calCeremonyLocation: "De-Guang Presbyterian Church, No. 100, Chongde 4th St., East Dist., Tainan",
  calCeremonyDesc: "Leon & YehYeh Wedding Ceremony\nJune 20, 2026 · 3:00 PM\nDe-Guang Presbyterian Church\nNo. 100, Chongde 4th St., East Dist., Tainan",
  calBanquetTitle: "黃葉家宴",
  calBanquetLocation: "Evergreen Laurel Hotel Tainan — Eat Around the World Buffet",
  calBanquetDesc: "Leon & YehYeh Wedding Banquet\nJune 20, 2026 · 5:30 – 9:00 PM (feel free to leave anytime)\nEvergreen Laurel Hotel Tainan\nNo. 1, Lane 336, Sec. 3, Zhonghua E. Rd., East Dist., Tainan, 2F",
  transportLabel: "Getting There",
  transportCeremonyTitle: "Ceremony · De-Guang Presbyterian Church",
  transportBanquetTitle: "Banquet · Evergreen Laurel Hotel",
  transportCeremonyItems: [
    { icon: "🅿️", name: "Street Parking", desc: "Along Chongde 4th St. & Chongde Rd.", fee: "Approx. NT$20 / hr" },
    { icon: "🏛️", name: "Rongyue St. Public Car Park", desc: "No. 2, Lane 131, Rongyue St., East Dist. — 300+ spaces", fee: "NT$20 / hr (cars), free (motorcycles)" },
    { icon: "🏛️", name: "Tainan Cultural Center Car Park", desc: "Approx. 10 min walk", fee: "" },
    { icon: "🌿", name: "Bakerlee Park Car Park", desc: "Approx. 15 min walk", fee: "" },
  ],
  transportBanquetItems: [
    { icon: "🏨", name: "Evergreen Laurel Hotel Car Park B2–B4", desc: "Banquet guests get 4 hours free (cars only). Tell the guard you're attending the banquet, collect a parking card, return it when leaving to redeem.", fee: "4 hrs free (cars only)" },
    { icon: "🛵", name: "Nearby Motorcycle Parking", desc: "Street bays along Zhonghua E. Rd. Sec. 3 & Funong St.", fee: "" },
    { icon: "📞", name: "Hotel Front Desk", desc: "06-289-9988", fee: "" },
  ],
  countdownDone: "已過",
  countdownPrefix: "In",
  countdownDay: "Days",
  countdownHour: "Hours",
  countdownMin: "Minutes",
  countdownSec: "Seconds",
};

const LanguageCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "zh", setLang: () => {} });
const useT = () => { const { lang } = useContext(LanguageCtx); return lang === "zh" ? ZH : EN; };

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

const WEDDING_TARGET = new Date("2026-06-20T15:00:00+08:00").getTime();

function useCountdown() {
  const calc = () => {
    const diff = WEDDING_TARGET - Date.now();
    if (diff <= 0) return { done: true, value: 0, unit: "sec" as const };
    const totalSec = Math.floor(diff / 1000);
    const totalMin = Math.floor(diff / 60000);
    const totalHour = Math.floor(diff / 3600000);
    const totalDay = Math.floor(diff / 86400000);
    if (totalDay >= 1) return { done: false, value: totalDay, unit: "day" as const };
    if (totalHour >= 1) return { done: false, value: totalHour, unit: "hour" as const };
    if (totalMin >= 1) return { done: false, value: totalMin, unit: "min" as const };
    return { done: false, value: totalSec, unit: "sec" as const };
  };

  const [state, setState] = useState(calc);

  useEffect(() => {
    const id = setInterval(() => setState(calc()), 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}

function CountdownWidget() {
  const t = useT();
  const { lang } = useContext(LanguageCtx);
  const { done, value, unit } = useCountdown();
  const labelMap: Record<string, string> = {
    day: t.countdownDay,
    hour: t.countdownHour,
    min: t.countdownMin,
    sec: t.countdownSec,
  };
  const label = lang === "en" && value === 1
    ? labelMap[unit].replace(/s$/i, "")
    : labelMap[unit];
  return (
    <div
      className="animate-fade-in-up"
      style={{ opacity: 0, animationDelay: "0.9s", animationFillMode: "forwards" }}
    >
      <div className="inline-flex items-end justify-center gap-2 rounded-2xl px-5 pt-1 pb-1.5 backdrop-blur-sm invitation-shadow bg-white/50 border border-green-200/60">
        {done ? (
          <span className="font-noto-serif-tc text-sm font-semibold text-green-600 tracking-widest">
            {t.countdownDone}
          </span>
        ) : (
          <>
            <span className="font-noto-serif-tc text-xs font-medium text-green-500 tracking-wider pb-0.5">
              {t.countdownPrefix}
            </span>
            <span className="font-playfair font-bold text-4xl sm:text-5xl text-green-800 leading-[0.85] tabular-nums">
              {value}
            </span>
            <span className="font-noto-serif-tc text-sm sm:text-base font-semibold text-green-600 tracking-widest pb-0.5">
              {label}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function makeICS({ summary, location, description, dtStart, dtEnd, tzid }: {
  summary: string; location: string; description: string;
  dtStart: string; dtEnd: string; tzid: string;
}): string {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Leon & YehYeh Wedding//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART;TZID=${tzid}:${dtStart}`,
    `DTEND;TZID=${tzid}:${dtEnd}`,
    `SUMMARY:${esc(summary)}`,
    `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(description)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function openInCalendar(
  icsContent: string,
  gcal: { title: string; start: string; end: string; location: string; details: string }
): void {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;
  if (isIOS) {
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } else {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: gcal.title,
      details: gcal.details,
      location: gcal.location,
    });
    const gcalUrl = `https://calendar.google.com/calendar/render?${params.toString()}&dates=${gcal.start}/${gcal.end}&ctz=Asia/Taipei`;
    window.open(gcalUrl, "_blank", "noopener,noreferrer");
  }
}

function FloatingParticles() {
  type ParticleType = "heart" | "kiwifruit" | "kiwi";
  const [particles, setParticles] = useState<
    { id: number; type: ParticleType; x: number; size: number; duration: number }[]
  >([]);
  const counterRef = useRef(0);
  const removalTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    let spawnTimeoutId: ReturnType<typeof setTimeout>;
    const TYPES: ParticleType[] = ["heart", "kiwifruit", "kiwi"];

    const spawn = () => {
      const id = ++counterRef.current;
      const type = TYPES[Math.floor(Math.random() * 3)];
      const x = 8 + Math.random() * 84;
      const size = 16 + Math.random() * 12;
      const duration = 4 + Math.random() * 3;

      setParticles((prev) => {
        if (prev.length >= 12) return prev;
        return [...prev, { id, type, x, size, duration }];
      });

      const removalId = setTimeout(() => {
        removalTimeoutsRef.current.delete(removalId);
        setParticles((prev) => prev.filter((p) => p.id !== id));
      }, duration * 1000 + 300);
      removalTimeoutsRef.current.add(removalId);
    };

    const scheduleNext = () => {
      const delay = 1500 + Math.random() * 1500;
      spawnTimeoutId = setTimeout(() => {
        spawn();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => {
      clearTimeout(spawnTimeoutId);
      removalTimeoutsRef.current.forEach(clearTimeout);
      removalTimeoutsRef.current.clear();
    };
  }, []);

  return (
    <div className="pointer-events-none select-none">
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "fixed",
            bottom: 0,
            left: `${p.x}%`,
            zIndex: 39,
            animation: `floatUpFade ${p.duration}s ease-out forwards`,
          }}
        >
          {p.type === "heart" && (
            <svg width={p.size} height={p.size} viewBox="0 0 24 24" fill="#4ade80">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          )}
          {p.type === "kiwifruit" && <KiwiFruit size={p.size} />}
          {p.type === "kiwi" && <KiwiIcon size={p.size} />}
        </div>
      ))}
    </div>
  );
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


function HeroSection() {
  const t = useT();
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

      {/* Main content — reduced mobile sizing ensures nothing clips on small phones */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-2xl mx-auto w-full">
        {/* Announcement */}
        <p
          className="font-noto-serif-tc text-sm tracking-[0.4em] uppercase mb-3 sm:mb-4 animate-fade-in-up text-green-700"
          style={{ opacity: 0, animationDelay: "0.2s", animationFillMode: "forwards" }}
          data-testid="text-announcement"
        >
          {t.heroAnnouncement}
        </p>

        {/* Names — single grid so columns share widths across both rows */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-4 sm:mb-6">
          {/* Row 1: English names */}
          <h1
            className="font-playfair text-3xl sm:text-5xl leading-tight font-semibold italic text-right text-green-800 animate-fade-in-up"
            style={{ opacity: 0, animationDelay: "0.4s", animationFillMode: "forwards" }}
            data-testid="text-names"
          >Leon</h1>
          <span
            className="font-playfair text-xl sm:text-3xl not-italic text-yellow-600 px-2 sm:px-4 text-center animate-fade-in-up"
            style={{ opacity: 0, animationDelay: "0.4s", animationFillMode: "forwards" }}
          >&amp;</span>
          <span
            className="font-playfair text-xl sm:text-3xl leading-tight font-semibold italic text-left text-green-800 animate-fade-in-up"
            style={{ opacity: 0, animationDelay: "0.4s", animationFillMode: "forwards" }}
          >YehYeh</span>

          {/* Row 2: Chinese names */}
          <span
            className="font-zen-old-mincho font-semibold text-2xl sm:text-4xl text-right text-green-800 animate-fade-in-up"
            style={{ opacity: 0, animationDelay: "0.6s", animationFillMode: "forwards" }}
            data-testid="text-chinese-names"
          >黃律詠</span>
          <span
            className="text-yellow-600 text-xl sm:text-3xl px-2 sm:px-4 text-center animate-fade-in-up"
            style={{ opacity: 0, animationDelay: "0.6s", animationFillMode: "forwards" }}
          >✦</span>
          <span
            className="font-zen-old-mincho font-semibold text-2xl sm:text-4xl text-left text-green-800 animate-fade-in-up"
            style={{ opacity: 0, animationDelay: "0.6s", animationFillMode: "forwards" }}
          >葉藝慧</span>
        </div>

        {/* Decorative divider */}
        <div
          className="flex items-center justify-center gap-4 mb-4 sm:mb-6 animate-fade-in-up"
          style={{ opacity: 0, animationDelay: "0.7s", animationFillMode: "forwards" }}
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-400 opacity-50" />
          <div className="flex items-center gap-2">
            <KiwiIcon size={20} />
            <span className="text-yellow-400 text-xl drop-shadow">🐾</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-400 opacity-50" />
        </div>

        {/* Date card */}
        <div
          className="rounded-2xl px-4 py-3 sm:px-8 sm:py-5 mb-1 animate-fade-in-up backdrop-blur-sm invitation-shadow bg-white/60"
          style={{ opacity: 0, animationDelay: "0.8s", animationFillMode: "forwards" }}
          data-testid="card-date"
        >
          <p className="font-playfair font-semibold tracking-wide text-2xl sm:text-4xl md:text-[42px] text-green-800">
            2026 · 06 · 20
          </p>
          <p className="font-noto-serif-tc mt-1 tracking-widest text-sm sm:text-xl md:text-[25px] font-bold text-green-600">
            {t.heroDate}
          </p>
        </div>

        {/* Countdown */}
        <div className="mb-2 sm:mb-3">
          <CountdownWidget />
        </div>

        {/* Invitation paragraphs */}
        <div
          className="animate-fade-in-up mb-4 sm:mb-6 px-2"
          style={{ opacity: 0, animationDelay: "1.1s", animationFillMode: "forwards" }}
        >
          <p className="font-noto-serif-tc text-xs sm:text-sm leading-relaxed tracking-wide text-green-700 mb-3">
            {t.heroPara1}
          </p>
          <p className="font-noto-serif-tc text-xs sm:text-sm leading-relaxed tracking-wide text-green-700">
            {t.heroPara2}
          </p>
        </div>

      </div>
    </section>
  );
}

function LoveStorySection() {
  const t = useT();
  const { lang } = useContext(LanguageCtx);
  const { ref, isVisible } = useIntersectionObserver();
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [isLongDistanceOpen, setIsLongDistanceOpen] = useState(false);

  return (
    <section
      id="section-story"
      ref={ref}
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto overscroll-y-none section-pt section-pb px-4 sm:px-6"
      style={{
        background: "linear-gradient(180deg, #faf6d8 0%, #f5f8ee 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className={`text-center mb-8 md:mb-16 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {lang === "zh" ? (
            <h2 className="font-zen-old-mincho text-2xl sm:text-3xl md:text-4xl font-semibold text-green-800 mb-4">
              {t.storyLabel}
            </h2>
          ) : (
            <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl italic text-green-800 mb-4">
              {t.storyH2}
            </h2>
          )}
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
              {t.dogCaption}
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
                    {t.story1Title}
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
                    {t.story1Body}
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
                    {t.story2Title}
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
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
                    {t.story2Body.map((para, i) => (
                      <p key={i} className="font-noto-serif-tc text-green-800 leading-relaxed text-sm">
                        {para}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-white/70 rounded-2xl p-4 sm:p-5 invitation-shadow border-l-4 border-yellow-400">
                <p className="font-great-vibes text-xl sm:text-2xl text-green-700 mb-1">
                  "From Kiwi Land to Home"
                </p>
                <p className="font-noto-serif-tc text-xs text-green-600">
                  {t.quoteZh}
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
  const t = useT();
  const { lang } = useContext(LanguageCtx);
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section
      id="section-details"
      ref={ref}
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto overscroll-y-none section-pt section-pb px-4 sm:px-6"
      style={{
        background:
          "linear-gradient(160deg, #2d5a1b 0%, #1a3a0f 50%, #2d5a1b 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className={`text-center mb-8 md:mb-12 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {lang === "zh" ? (
            <h2 className="font-zen-old-mincho text-2xl sm:text-3xl md:text-4xl font-semibold text-yellow-300 mb-4">
              {t.detailsLabel}
            </h2>
          ) : (
            <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl italic text-yellow-300 mb-4">
              {t.detailsH2}
            </h2>
          )}
          <div className="flex justify-center">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 items-stretch">
          {t.detailItems.map((item, i) => {
            const isDateCard = i === 0;
            const handleDateClick = isDateCard ? () => {
              openInCalendar(
                makeICS({ summary: t.calCeremonyTitle, location: t.calCeremonyLocation, description: t.calCeremonyDesc, dtStart: "20260620T150000", dtEnd: "20260620T161500", tzid: "Asia/Taipei" }),
                { title: t.calCeremonyTitle, start: "20260620T150000", end: "20260620T161500", location: t.calCeremonyLocation, details: t.calCeremonyDesc }
              );
            } : undefined;
            return (
              <div
                key={item.label}
                className={`flex flex-col text-center bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-yellow-400/20 transition-all duration-1000 ${["delay-100","delay-200","delay-300"][i] ?? ""} ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"} ${isDateCard ? "cursor-pointer hover:bg-white/20 active:scale-[0.97]" : ""}`}
                onClick={handleDateClick}
                onKeyDown={isDateCard ? (e) => { if (e.key === "Enter" || e.key === " ") handleDateClick?.(); } : undefined}
                tabIndex={isDateCard ? 0 : undefined}
                role={isDateCard ? "button" : undefined}
                data-testid={`card-detail-${item.label}`}
              >
                <div className="text-3xl sm:text-4xl mb-3">{item.icon}</div>
                <p className="font-noto-serif-tc text-yellow-200 text-sm sm:text-base font-medium">
                  {item.label}
                </p>
                <div className="h-px bg-yellow-400/20 my-3" />
                <p className="font-playfair text-yellow-100 text-base sm:text-lg font-semibold whitespace-pre-line">
                  {item.content}
                </p>
                <p className="font-noto-serif-tc text-yellow-400/60 text-xs sm:text-sm mt-auto pt-1">
                  {item.mapQuery ? (
                    <a
                      href={`https://maps.google.com/maps?q=${encodeURIComponent(item.mapQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-yellow-300 transition-colors"
                    >
                      {item.note}
                    </a>
                  ) : (
                    item.note
                  )}
                </p>
                {isDateCard && (
                  <p className="font-noto-serif-tc text-yellow-400/50 text-xs mt-2">
                    📅 {t.addToCalendar}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Banquet divider */}
        <div
          className={`flex items-center gap-3 mt-6 sm:mt-8 transition-all duration-1000 delay-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
        >
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent" />
          <span className="text-yellow-300 text-lg">🍽️</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent" />
        </div>

        {/* Banquet info */}
        <div
          className={`mt-4 bg-yellow-400/10 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-yellow-400/30 transition-all duration-1000 delay-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <p className="font-zen-old-mincho text-yellow-300 text-lg sm:text-xl font-semibold text-center mb-4 tracking-widest">
            {t.banquetLabel}
          </p>
          <div className="space-y-3">
            <div
              className="flex items-start gap-3 cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity"
              role="button"
              tabIndex={0}
              onClick={() => openInCalendar(
                makeICS({ summary: t.calBanquetTitle, location: t.calBanquetLocation, description: t.calBanquetDesc, dtStart: "20260620T173000", dtEnd: "20260620T210000", tzid: "Asia/Taipei" }),
                { title: t.calBanquetTitle, start: "20260620T173000", end: "20260620T210000", location: t.calBanquetLocation, details: t.calBanquetDesc }
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  openInCalendar(
                    makeICS({ summary: t.calBanquetTitle, location: t.calBanquetLocation, description: t.calBanquetDesc, dtStart: "20260620T173000", dtEnd: "20260620T210000", tzid: "Asia/Taipei" }),
                    { title: t.calBanquetTitle, start: "20260620T173000", end: "20260620T210000", location: t.calBanquetLocation, details: t.calBanquetDesc }
                  );
                }
              }}
            >
              <span className="text-xl shrink-0 mt-0.5">⏰</span>
              <div>
                <p className="font-noto-serif-tc text-yellow-100 text-sm sm:text-base font-semibold whitespace-pre-line">
                  {t.banquetTime}
                </p>
                <p className="font-noto-serif-tc text-yellow-400/50 text-xs mt-0.5">
                  📅 {t.addToCalendar}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">🍽️</span>
              <div>
                <p className="font-noto-serif-tc text-yellow-100 text-sm sm:text-base font-semibold leading-snug">
                  {t.banquetVenue}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">📍</span>
              <div>
                <p className="font-noto-serif-tc text-yellow-400/80 text-xs sm:text-sm leading-relaxed">
                  <a
                    href={`https://maps.google.com/maps?q=${encodeURIComponent("台南市東區中華東路三段336巷1號2樓")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-yellow-300 transition-colors"
                  >
                    {t.banquetAddress}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dress code */}
        <div
          className={`mt-6 sm:mt-8 text-center bg-yellow-400/10 rounded-2xl p-4 sm:p-6 border border-yellow-400/20 transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <p className="font-noto-serif-tc text-yellow-300 text-sm tracking-wider mb-2">
            {t.dressLabel}
          </p>
          <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
            <span className="bg-green-700/50 text-green-200 px-3 sm:px-4 py-1 rounded-full text-sm font-noto-serif-tc border border-green-500/30">
              {t.dressGreen}
            </span>
            <span className="bg-yellow-700/30 text-yellow-200 px-3 sm:px-4 py-1 rounded-full text-sm font-noto-serif-tc border border-yellow-500/30">
              {t.dressYellow}
            </span>
            <span className="text-yellow-300/70 text-sm font-noto-serif-tc self-center">
              {t.dressKiwi}
            </span>
          </div>
        </div>

        {/* Transport & Parking */}
        <div
          className={`mt-6 sm:mt-8 transition-all duration-1000 delay-500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent" />
            <span className="text-yellow-300 text-base">🚗</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent" />
          </div>

          <p className="font-zen-old-mincho text-yellow-300 text-base sm:text-lg font-semibold text-center tracking-widest mb-4">
            {t.transportLabel}
          </p>

          <Accordion
            type="multiple"
            defaultValue={["ceremony", "banquet"]}
            className="space-y-3"
          >
            {/* Ceremony parking */}
            <AccordionItem
              value="ceremony"
              className="bg-white/10 backdrop-blur-sm rounded-2xl border border-yellow-400/20 overflow-hidden border-b-0"
            >
              <AccordionTrigger className="px-4 sm:px-5 py-3 hover:no-underline hover:bg-white/10 transition-colors [&[data-state=open]>svg]:rotate-180 [&>svg]:text-yellow-300/70">
                <span className="font-noto-serif-tc text-yellow-200 text-xs sm:text-sm font-semibold tracking-wide text-left">
                  {t.transportCeremonyTitle}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 sm:px-5 pb-4 pt-0">
                <div className="space-y-3">
                  {t.transportCeremonyItems.map((item) => (
                    <div key={item.name} className="flex items-start gap-2">
                      <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                      <div className="min-w-0">
                        <p className="font-noto-serif-tc text-yellow-100 text-xs sm:text-sm font-medium leading-snug">
                          {item.name}
                        </p>
                        {item.desc && (
                          <p className="font-noto-serif-tc text-yellow-400/60 text-xs leading-relaxed mt-0.5">
                            {item.desc}
                          </p>
                        )}
                        {item.fee && (
                          <p className="font-noto-serif-tc text-green-300/70 text-xs mt-0.5">
                            {item.fee}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Banquet parking */}
            <AccordionItem
              value="banquet"
              className="bg-white/10 backdrop-blur-sm rounded-2xl border border-yellow-400/20 overflow-hidden border-b-0"
            >
              <AccordionTrigger className="px-4 sm:px-5 py-3 hover:no-underline hover:bg-white/10 transition-colors [&[data-state=open]>svg]:rotate-180 [&>svg]:text-yellow-300/70">
                <span className="font-noto-serif-tc text-yellow-200 text-xs sm:text-sm font-semibold tracking-wide text-left">
                  {t.transportBanquetTitle}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 sm:px-5 pb-4 pt-0">
                <div className="space-y-3">
                  {t.transportBanquetItems.map((item) => (
                    <div key={item.name} className="flex items-start gap-2">
                      <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                      <div className="min-w-0">
                        <p className="font-noto-serif-tc text-yellow-100 text-xs sm:text-sm font-medium leading-snug">
                          {item.name}
                        </p>
                        {item.desc && (
                          <p className="font-noto-serif-tc text-yellow-400/60 text-xs leading-relaxed mt-0.5">
                            {item.desc}
                          </p>
                        )}
                        {item.fee && (
                          <p className="font-noto-serif-tc text-green-300/70 text-xs mt-0.5">
                            {item.fee}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function PhotoWallSection() {
  const t = useT();
  const { lang } = useContext(LanguageCtx);
  const { ref, isVisible } = useIntersectionObserver();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
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

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photos.length]);

  useEffect(() => {
    if (lightboxIndex !== null && lightboxIndex >= photos.length) {
      setLightboxIndex(photos.length > 0 ? photos.length - 1 : null);
    }
  }, [photos.length, lightboxIndex]);

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
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto overscroll-y-none section-pt section-pb px-4 sm:px-6"
      style={{
        background: "linear-gradient(180deg, #f8f9e8 0%, #f2f8e6 100%)",
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div
          className={`text-center mb-8 md:mb-12 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {lang === "zh" ? (
            <h2 className="font-zen-old-mincho text-2xl sm:text-3xl md:text-4xl font-semibold text-green-800 mb-4">
              {t.galleryLabel}
            </h2>
          ) : (
            <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl italic text-green-800 mb-4">
              {t.galleryH2}
            </h2>
          )}
          <div className="flex justify-center">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
          <p className="font-noto-serif-tc text-sm text-green-600 mt-4">
            {t.gallerySubtitle}
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
                className="aspect-square rounded-2xl overflow-hidden invitation-shadow transition-all duration-700 cursor-pointer"
                style={{ transitionDelay: `${i * 60}ms` }}
                onClick={() => setLightboxIndex(i)}
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
                {t.galleryEmpty}
              </p>
              <p className="font-noto-serif-tc text-green-600 text-sm">
                {t.galleryEmptySub}
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
              {uploading ? t.galleryUploading : t.galleryUpload}
            </span>
          </label>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (dx < -50 && lightboxIndex < photos.length - 1) setLightboxIndex(lightboxIndex + 1);
            if (dx > 50 && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
          }}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-xl transition-all z-10"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            aria-label={t.lightboxClose}
          >✕</button>

          {/* Prev arrow */}
          {lightboxIndex > 0 && (
            <button
              className="absolute left-3 sm:left-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-2xl transition-all z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              aria-label={t.lightboxPrev}
            >‹</button>
          )}

          {/* Next arrow */}
          {lightboxIndex < photos.length - 1 && (
            <button
              className="absolute right-3 sm:right-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-2xl transition-all z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              aria-label={t.lightboxNext}
            >›</button>
          )}

          {/* Image */}
          <img
            src={`${API_BASE}/api/photos/image/${photos[lightboxIndex]}`}
            alt={`照片 ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            style={{ animation: "lightboxScale 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Page counter */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-noto-serif-tc tracking-widest select-none">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </section>
  );
}

function RSVPSection() {
  const t = useT();
  const { lang } = useContext(LanguageCtx);
  const { ref, isVisible } = useIntersectionObserver();

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (typeof e.origin === "string" && e.origin.includes("google.com")) {
        const section = document.getElementById("section-rsvp");
        if (section) section.scrollTop = 0;
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  return (
    <section
      id="section-rsvp"
      ref={ref}
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto overscroll-y-none section-pt section-pb px-4 sm:px-6"
      style={{
        background: "linear-gradient(160deg, #faf6d8 0%, #f0f7e6 100%)",
      }}
    >
      <div className="max-w-xl mx-auto">
        <div
          className={`text-center mb-8 md:mb-12 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {lang === "zh" ? (
            <h2 className="font-zen-old-mincho text-2xl sm:text-3xl md:text-4xl font-semibold text-green-800 mb-4">
              {t.rsvpLabel}
            </h2>
          ) : (
            <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl italic text-green-800 mb-4">
              {t.rsvpH2}
            </h2>
          )}
          <div className="flex justify-center mb-4">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
          <p className="font-noto-serif-tc text-sm text-green-600">
            {t.rsvpDeadline}
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
  const t = useT();
  return (
    <footer
      id="section-footer"
      className="w-screen h-screen flex-shrink-0 snap-start overflow-y-auto overscroll-y-none section-pt section-pb px-4 sm:px-6 text-center flex flex-col justify-center"
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
          {t.footerDog}
        </p>

        {/* Divider with kiwis */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px flex-1 bg-green-700/40" />
          <KiwiIcon size={24} className="opacity-40" />
          <div className="h-px flex-1 bg-green-700/40" />
        </div>

        <h2 className="font-great-vibes text-3xl sm:text-5xl text-yellow-300/80 mb-3">
          Leon & YehYeh
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

const FONT_MIN = -5;
const FONT_MAX = 8;

interface FontSizeControlsProps {
  step: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min: number;
  max: number;
}

function FontSizeControls({ step, onIncrease, onDecrease, min, max }: FontSizeControlsProps) {
  const { lang, setLang } = useContext(LanguageCtx);
  return (
    <div className="fixed bottom-4 left-3 z-50">
      <div className="flex items-center bg-white/40 backdrop-blur-md shadow-lg border border-white/60 rounded-full overflow-hidden">
        <button
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          aria-label="切換語言 / Toggle language"
          className="px-3 py-2 font-noto-serif-tc text-xs text-green-700 hover:bg-white/90 hover:text-green-900 transition-all active:scale-95"
        >
          {lang === "zh" ? "Eng" : "中文"}
        </button>
        <div className="w-px h-4 bg-green-300/60" />
        <button
          onClick={onDecrease}
          disabled={step <= min}
          aria-label="縮小字體"
          className="px-3 py-2 font-noto-serif-tc text-xs text-green-700 hover:bg-white/90 hover:text-green-900 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          A−
        </button>
        <div className="w-px h-4 bg-green-300/60" />
        <button
          onClick={onIncrease}
          disabled={step >= max}
          aria-label="放大字體"
          className="px-3 py-2 font-noto-serif-tc text-xs text-green-700 hover:bg-white/90 hover:text-green-900 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          A+
        </button>
      </div>
    </div>
  );
}

function getInitialFontStep(): number {
  const params = new URLSearchParams(window.location.search);
  const param = params.get("fontsize");
  if (param !== null) {
    const n = parseInt(param, 10);
    if (!isNaN(n)) return Math.min(Math.max(n, FONT_MIN), FONT_MAX);
  }
  const stored = localStorage.getItem("weddingFontStep");
  if (stored !== null) {
    const n = parseInt(stored, 10);
    if (!isNaN(n)) return Math.min(Math.max(n, FONT_MIN), FONT_MAX);
  }
  return 0;
}

function getInitialLang(): Lang {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path.endsWith("/en")) return "en";
  if (path.endsWith("/zh")) return "zh";
  const stored = localStorage.getItem("weddingLang");
  return stored === "en" ? "en" : "zh";
}

const PARTICLE_SECTIONS = new Set([0, 4]);

export default function Invitation() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [fontStep, setFontStep] = useState<number>(getInitialFontStep);
  const [lang, setLangState] = useState<Lang>(getInitialLang);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const setLang = (l: Lang) => { setLangState(l); localStorage.setItem("weddingLang", l); };
  const t = lang === "zh" ? ZH : EN;

  useEffect(() => {
    document.documentElement.style.fontSize =
      fontStep === 0 ? "" : `${16 + fontStep}px`;
    localStorage.setItem("weddingFontStep", String(fontStep));
  }, [fontStep]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateIndex = () => {
      const vw = container.clientWidth;
      if (vw === 0) return;
      setActiveSectionIndex(Math.round(container.scrollLeft / vw));
    };

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

    container.addEventListener("scroll", updateIndex, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("scroll", updateIndex);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const showParticles = PARTICLE_SECTIONS.has(activeSectionIndex);

  return (
    <LanguageCtx.Provider value={{ lang, setLang }}>
      <div className="w-screen h-screen overflow-hidden">
        <AudioPlayer />
        <FloatingNav scrollContainerRef={scrollContainerRef} labels={t.nav} navAriaLabel={t.navAriaLabel} />
        <div
          className="pointer-events-none"
          style={{ opacity: showParticles ? 1 : 0, transition: "opacity 0.6s ease" }}
        >
          <FloatingParticles />
        </div>
        <FloatingKiwis />
        <FontSizeControls
          step={fontStep}
          min={FONT_MIN}
          max={FONT_MAX}
          onIncrease={() => setFontStep((s) => Math.min(s + 1, FONT_MAX))}
          onDecrease={() => setFontStep((s) => Math.max(s - 1, FONT_MIN))}
        />
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
    </LanguageCtx.Provider>
  );
}
