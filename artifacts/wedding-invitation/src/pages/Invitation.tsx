import { useEffect, useRef, useState } from "react";
import { KiwiIcon, KiwiFruit } from "@/components/KiwiIcon";
import { DogWithBow } from "@/components/DogIcon";
import { NZMap } from "@/components/NZMap";
import { TWMap } from "@/components/TWMap";

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
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

function FloatingKiwis() {
  return (
    <div className="pointer-events-none select-none">
      <div className="fixed top-[8%] left-[3%] opacity-20 animate-float" style={{ animationDelay: "0s" }}>
        <KiwiIcon size={60} />
      </div>
      <div className="fixed top-[15%] right-[4%] opacity-15 animate-float-slow" style={{ animationDelay: "1.5s" }}>
        <KiwiFruit size={40} />
      </div>
      <div className="fixed top-[45%] left-[2%] opacity-15 animate-float" style={{ animationDelay: "0.8s" }}>
        <KiwiIcon size={45} />
      </div>
      <div className="fixed top-[65%] right-[3%] opacity-20 animate-float-slow" style={{ animationDelay: "2s" }}>
        <KiwiFruit size={35} />
      </div>
      <div className="fixed top-[82%] left-[5%] opacity-10 animate-float" style={{ animationDelay: "1.2s" }}>
        <KiwiIcon size={50} />
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden kiwi-pattern text-[17px]"
      style={{
        background: "linear-gradient(160deg, #f0f7e6 0%, #faf6d8 40%, #eef6e2 70%, #f8f4e0 100%)"
      }}
    >
      {/* Background decorative kiwis */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-8 -left-8 opacity-10 animate-float-slow">
          <KiwiIcon size={180} />
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-10 animate-float" style={{ animationDelay: "2s" }}>
          <KiwiIcon size={200} />
        </div>
        <div className="absolute top-1/4 -right-12 opacity-8 animate-float-slow" style={{ animationDelay: "1s" }}>
          <KiwiIcon size={140} />
        </div>
      </div>
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        {/* Decorative top element */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-green-600 opacity-40" />
          <div className="animate-float">
            <KiwiIcon size={50} />
          </div>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-green-600 opacity-40" />
        </div>

        {/* Announcement */}
        <p
          className="font-noto-serif-tc text-sm tracking-[0.4em] text-green-700 uppercase mb-4 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}
          data-testid="text-announcement"
        >
          謹訂於此佳期
        </p>

        {/* Names */}
        <div
          className="mb-4 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.4s", animationFillMode: "forwards" }}
        >
          <h1 className="font-great-vibes text-7xl md:text-8xl text-green-800 leading-tight" data-testid="text-names">Leon</h1>
          <div className="flex items-center justify-center gap-3 my-2">
            <div className="h-px w-12 bg-yellow-500 opacity-60" />
            <span className="font-playfair text-yellow-600 text-xl">&amp;</span>
            <div className="h-px w-12 bg-yellow-500 opacity-60" />
          </div>
          <h1 className="font-great-vibes text-7xl md:text-8xl text-green-800 leading-tight">Yeh</h1>
        </div>

        {/* Chinese names */}
        <p
          className="font-noto-serif-tc text-2xl text-green-700 tracking-[0.3em] mb-6 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.6s", animationFillMode: "forwards" }}
          data-testid="text-chinese-names"
        >
          黃 ✦ 葉
        </p>

        {/* Decorative divider */}
        <div
          className="flex items-center justify-center gap-4 mb-8 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.7s", animationFillMode: "forwards" }}
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-50" />
          <span className="text-yellow-500 text-2xl">🐾</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-50" />
        </div>

        {/* Date */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-2xl px-8 py-5 invitation-shadow mb-8 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.8s", animationFillMode: "forwards" }}
          data-testid="card-date"
        >
          <p className="font-playfair font-semibold text-green-800 tracking-wide text-[42px]">2026 · 06 · 20</p>
          <p className="font-noto-serif-tc text-green-600 mt-1 tracking-widest text-[25px] font-bold">
            星期六 下午三點
          </p>
        </div>

        {/* Scroll hint */}
        <div
          className="animate-bounce opacity-50 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "1.2s", animationFillMode: "forwards" }}
        >
          <p className="font-noto-serif-tc text-xs text-green-600 tracking-widest mb-2">往下捲動</p>
          <div className="flex justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4 L10 16 M5 11 L10 16 L15 11" stroke="#5a8c30" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoveStorySection() {
  const { ref, isVisible } = useIntersectionObserver();
  
  return (
    <section
      ref={ref}
      className="py-20 px-6"
      style={{ background: "linear-gradient(180deg, #faf6d8 0%, #f5f8ee 100%)" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <p className="font-noto-serif-tc text-xs tracking-[0.5em] text-green-600 uppercase mb-3">我們的故事</p>
          <h2 className="font-playfair text-4xl italic text-green-800 mb-4">A Love Story</h2>
          <div className="flex justify-center">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
        </div>

        {/* Story with dog */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div className={`transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-green-100 to-yellow-50 rounded-full blur-xl opacity-60" />
                <DogWithBow size={180} className="relative animate-wiggle" />
              </div>
            </div>
            <p className="text-center font-noto-serif-tc text-sm text-green-600 mt-3 tracking-wider">
              我們的毛小孩 · 小黑
            </p>
          </div>

          <div className={`transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="space-y-5">
              <div className="bg-white/70 rounded-2xl p-5 invitation-shadow">
                <p className="font-noto-serif-tc text-green-800 leading-relaxed text-sm">
                  我們相遇於紐西蘭的草地上，那裡有著世界上最甜美的奇異果，
                  還有讓人心曠神怡的青山綠水。
                </p>
              </div>
              <div className="bg-white/70 rounded-2xl p-5 invitation-shadow">
                <p className="font-noto-serif-tc text-green-800 leading-relaxed text-sm">
                  小黑是我們愛情的見證者——牠第一個知道我們相愛的秘密，
                  也是第一個收到我們婚訊的「人」。
                </p>
              </div>
              <div className="bg-white/70 rounded-2xl p-5 invitation-shadow border-l-4 border-yellow-400">
                <p className="font-great-vibes text-2xl text-green-700 mb-1">
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

function MapsSection() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section
      ref={ref}
      className="py-20 px-6 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #f5f8ee 0%, #eef7e4 100%)" }}
    >
      <div className="max-w-4xl mx-auto">
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <p className="font-noto-serif-tc text-xs tracking-[0.5em] text-green-600 uppercase mb-3">橫跨兩個家</p>
          <h2 className="font-playfair text-4xl italic text-green-800 mb-4">Two Lands, One Heart</h2>
          <div className="flex justify-center">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
          {/* New Zealand */}
          <div className={`text-center transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <div className="relative inline-block">
              <div className="absolute -inset-6 bg-green-100 rounded-full blur-2xl opacity-50" />
              <NZMap size={110} className="relative animate-float-slow" />
            </div>
            <div className="mt-4">
              <p className="font-playfair text-xl text-green-800 font-semibold">New Zealand</p>
              <p className="font-noto-serif-tc text-sm text-green-600">紐西蘭</p>
              <div className="flex justify-center mt-2">
                <KiwiIcon size={28} className="opacity-70" />
              </div>
              <p className="font-noto-serif-tc text-xs text-green-500 mt-1 tracking-wider">
                奇異果之鄉 · 我們相遇的地方
              </p>
            </div>
          </div>

          {/* Connector */}
          <div className={`flex flex-col items-center gap-3 transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
            <div className="flex flex-col items-center gap-2">
              <div className="w-px h-8 bg-gradient-to-b from-transparent to-yellow-400 hidden md:block" />
              <div className="text-3xl animate-pulse-soft">💛</div>
              <div className="font-great-vibes text-2xl text-yellow-600">forever</div>
              <div className="text-xl animate-pulse-soft" style={{ animationDelay: "0.5s" }}>🐾</div>
              <div className="w-px h-8 bg-gradient-to-t from-transparent to-yellow-400 hidden md:block" />
            </div>
          </div>

          {/* Taiwan */}
          <div className={`text-center transition-all duration-1000 delay-600 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <div className="relative inline-block">
              <div className="absolute -inset-6 bg-red-50 rounded-full blur-2xl opacity-50" />
              <TWMap size={85} className="relative animate-float-slow" style={{ animationDelay: "1s" }} />
            </div>
            <div className="mt-4">
              <p className="font-playfair text-xl text-red-700 font-semibold">Taiwan</p>
              <p className="font-noto-serif-tc text-sm text-red-600">台灣</p>
              <div className="flex justify-center mt-2 text-lg">
                🏠
              </div>
              <p className="font-noto-serif-tc text-xs text-red-400 mt-1 tracking-wider">
                溫暖的家 · 我們攜手的地方
              </p>
            </div>
          </div>
        </div>

        {/* Kiwi facts */}
        <div className={`mt-16 bg-white/60 rounded-3xl p-8 invitation-shadow transition-all duration-1000 delay-500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="flex items-center gap-3 mb-4">
            <KiwiIcon size={36} />
            <h3 className="font-playfair text-xl text-green-800 italic">關於奇異果的小故事</h3>
          </div>
          <p className="font-noto-serif-tc text-sm text-green-700 leading-relaxed">
            奇異果原產於中國，卻在紐西蘭找到了最適合它生長的土地。就像我們的愛情，
            跨越了半個地球，在最意想不到的地方生根發芽。
            每一顆奇異果都承載著兩個家鄉的陽光與雨水，而我們的婚姻，
            也將融合兩種文化最美好的部分。
          </p>
        </div>
      </div>
    </section>
  );
}

function WeddingDetailsSection() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section
      ref={ref}
      className="py-20 px-6"
      style={{
        background: "linear-gradient(160deg, #2d5a1b 0%, #1a3a0f 50%, #2d5a1b 100%)"
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div className={`text-center mb-12 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <p className="font-noto-serif-tc text-xs tracking-[0.5em] text-yellow-400/70 uppercase mb-3">婚禮詳情</p>
          <h2 className="font-playfair text-4xl italic text-yellow-300 mb-4">Wedding Details</h2>
          <div className="flex justify-center">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: "📅",
              title: "日期",
              subtitle: "Date",
              content: "2025年10月18日",
              sub: "星期六",
              delay: "delay-100"
            },
            {
              icon: "⏰",
              title: "時間",
              subtitle: "Time",
              content: "下午二時",
              sub: "2:00 PM",
              delay: "delay-200"
            },
            {
              icon: "📍",
              title: "地點",
              subtitle: "Venue",
              content: "翠綠莊園",
              sub: "台北市信義區",
              delay: "delay-300"
            }
          ].map((item) => (
            <div
              key={item.title}
              className={`text-center bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-yellow-400/20 transition-all duration-1000 ${item.delay} ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
              data-testid={`card-detail-${item.title}`}
            >
              <div className="text-4xl mb-3">{item.icon}</div>
              <p className="font-noto-serif-tc text-yellow-400/70 text-xs tracking-widest mb-1">{item.subtitle}</p>
              <p className="font-noto-serif-tc text-yellow-200 text-base font-medium">{item.title}</p>
              <div className="h-px bg-yellow-400/20 my-3" />
              <p className="font-playfair text-yellow-100 text-lg font-semibold">{item.content}</p>
              <p className="font-noto-serif-tc text-yellow-400/60 text-sm mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Dress code */}
        <div className={`mt-8 text-center bg-yellow-400/10 rounded-2xl p-6 border border-yellow-400/20 transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <p className="font-noto-serif-tc text-yellow-300 text-sm tracking-wider mb-2">服裝建議</p>
          <p className="font-playfair text-yellow-200 text-xl italic mb-2">Dress Code</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <span className="bg-green-700/50 text-green-200 px-4 py-1 rounded-full text-sm font-noto-serif-tc border border-green-500/30">綠色系</span>
            <span className="bg-yellow-700/30 text-yellow-200 px-4 py-1 rounded-full text-sm font-noto-serif-tc border border-yellow-500/30">黃色系</span>
            <span className="text-yellow-300/70 text-sm font-noto-serif-tc self-center">歡迎融入奇異果元素 🥝</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function KiwiGallerySection() {
  const { ref, isVisible } = useIntersectionObserver();

  const kiwis = Array.from({ length: 7 });

  return (
    <section
      ref={ref}
      className="py-20 px-6"
      style={{ background: "linear-gradient(180deg, #f8f9e8 0%, #f2f8e6 100%)" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className={`text-center mb-12 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <p className="font-noto-serif-tc text-xs tracking-[0.5em] text-green-600 uppercase mb-3">奇異果的祝福</p>
          <h2 className="font-playfair text-4xl italic text-green-800 mb-4">Kiwi Blessings</h2>
          <div className="flex justify-center">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
          <p className="font-noto-serif-tc text-sm text-green-600 mt-4">
            每一顆奇異果，都是一份美好的祝福
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {kiwis.map((_, i) => (
            <div
              key={i}
              className={`transition-all duration-700 ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <KiwiIcon
                size={60 + (i % 3) * 10}
                className="animate-float"
                // @ts-ignore - style prop for animation delay
              />
            </div>
          ))}
        </div>

        {/* Blessing cards */}
        <div className={`grid md:grid-cols-2 gap-5 transition-all duration-1000 delay-500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          {[
            { zh: "願你們的愛情如奇異果般", en: "Sweet on the inside", icon: "💚" },
            { zh: "外表樸實，內心豐盛", en: "Simple outside, rich within", icon: "✨" },
            { zh: "帶著家鄉的溫暖", en: "Carrying the warmth of home", icon: "🏠" },
            { zh: "在異鄉找到最美的歸宿", en: "Finding love far from home", icon: "💛" }
          ].map((blessing, i) => (
            <div
              key={i}
              className="bg-white/70 rounded-2xl p-5 invitation-shadow flex items-start gap-3"
              data-testid={`card-blessing-${i}`}
            >
              <span className="text-2xl">{blessing.icon}</span>
              <div>
                <p className="font-noto-serif-tc text-green-800 text-sm">{blessing.zh}</p>
                <p className="font-playfair text-green-500 text-sm italic mt-1">{blessing.en}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RSVPSection() {
  const { ref, isVisible } = useIntersectionObserver();
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section
      ref={ref}
      className="py-20 px-6"
      style={{ background: "linear-gradient(160deg, #faf6d8 0%, #f0f7e6 100%)" }}
    >
      <div className="max-w-xl mx-auto">
        <div className={`text-center mb-12 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <p className="font-noto-serif-tc text-xs tracking-[0.5em] text-green-600 uppercase mb-3">出席確認</p>
          <h2 className="font-playfair text-4xl italic text-green-800 mb-4">RSVP</h2>
          <div className="flex justify-center mb-4">
            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
          <p className="font-noto-serif-tc text-sm text-green-600">
            請於 2025年9月30日 前回覆
          </p>
        </div>

        <div className={`bg-white/80 rounded-3xl p-8 invitation-shadow transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block font-noto-serif-tc text-sm text-green-700 mb-2">您的姓名</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="請填寫姓名"
                  className="w-full border border-green-200 rounded-xl px-4 py-3 font-noto-serif-tc text-sm text-green-800 bg-green-50/50 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                  data-testid="input-name"
                  required
                />
              </div>
              <div>
                <label className="block font-noto-serif-tc text-sm text-green-700 mb-2">出席人數</label>
                <select
                  className="w-full border border-green-200 rounded-xl px-4 py-3 font-noto-serif-tc text-sm text-green-800 bg-green-50/50 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                  data-testid="select-guests"
                >
                  <option value="1">1 人</option>
                  <option value="2">2 人</option>
                  <option value="3">3 人</option>
                  <option value="4">4 人</option>
                </select>
              </div>
              <div>
                <label className="block font-noto-serif-tc text-sm text-green-700 mb-2">給新人的祝福</label>
                <textarea
                  placeholder="寫下您的祝福..."
                  rows={3}
                  className="w-full border border-green-200 rounded-xl px-4 py-3 font-noto-serif-tc text-sm text-green-800 bg-green-50/50 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all resize-none"
                  data-testid="textarea-blessing"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-green-700 text-white font-noto-serif-tc text-sm py-3.5 rounded-xl hover:bg-green-800 active:bg-green-900 transition-all duration-200 tracking-wider shadow-lg shadow-green-700/25"
                data-testid="button-submit-rsvp"
              >
                確認出席 · Confirm Attendance
              </button>
            </form>
          ) : (
            <div className="text-center py-8">
              <div className="text-5xl mb-4 animate-bounce">🥝</div>
              <p className="font-playfair text-2xl text-green-800 mb-3 italic">Thank you!</p>
              <p className="font-noto-serif-tc text-green-700 text-sm leading-relaxed">
                {name}，感謝您的回覆！<br />
                我們非常期待與您共慶這份甜蜜的時光。
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <KiwiIcon size={30} />
                <span className="text-green-500 text-xl self-center">💚</span>
                <KiwiIcon size={30} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer
      className="py-16 px-6 text-center"
      style={{
        background: "linear-gradient(160deg, #1a3a0f 0%, #0f2208 100%)"
      }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Dog illustration */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute -inset-6 bg-green-900/40 rounded-full blur-xl" />
            <DogWithBow size={100} className="relative opacity-80" />
          </div>
        </div>

        <p className="font-noto-serif-tc text-green-400/60 text-xs tracking-widest mb-4">
          小黑 也很期待見到大家
        </p>

        {/* Divider with kiwis */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px flex-1 bg-green-700/40" />
          <KiwiIcon size={24} className="opacity-40" />
          <div className="h-px flex-1 bg-green-700/40" />
        </div>

        <h2 className="font-great-vibes text-5xl text-yellow-300/80 mb-3">Ming &amp; Ying</h2>
        <p className="font-noto-serif-tc text-green-400/50 text-xs tracking-widest mb-6">
          2025 · 10 · 18
        </p>

        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <NZMap size={40} className="mx-auto opacity-50" />
            <p className="font-noto-serif-tc text-green-500/40 text-xs mt-1">NZ</p>
          </div>
          <span className="text-yellow-400/40 text-2xl">💚</span>
          <div className="text-center">
            <TWMap size={32} className="mx-auto opacity-50" />
            <p className="font-noto-serif-tc text-green-500/40 text-xs mt-1">TW</p>
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
  return (
    <div className="min-h-screen">
      <FloatingKiwis />
      <HeroSection />
      <LoveStorySection />
      <MapsSection />
      <WeddingDetailsSection />
      <KiwiGallerySection />
      <RSVPSection />
      <FooterSection />
    </div>
  );
}
