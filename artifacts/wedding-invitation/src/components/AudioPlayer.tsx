import { useEffect, useRef, useState } from "react";
import weddingMusic from "@assets/【好喜歡與你在一起_I_Really_Love_To_Be_With_You】官方歌詞版MV_(Official_Lyric_1775124403812.mp4";

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = () => {
      if (startedRef.current) return;
      audio
        .play()
        .then(() => {
          startedRef.current = true;
          removeListeners();
        })
        .catch(() => {});
    };

    const removeListeners = () => {
      window.removeEventListener("click", tryPlay);
      window.removeEventListener("touchstart", tryPlay);
      window.removeEventListener("scroll", tryPlay);
    };

    window.addEventListener("click", tryPlay);
    window.addEventListener("touchstart", tryPlay);
    window.addEventListener("scroll", tryPlay);

    return () => {
      removeListeners();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
  }, [muted]);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => {
          startedRef.current = true;
        })
        .catch(() => {});
    }

    setMuted((prev) => !prev);
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={weddingMusic}
        loop
        autoPlay
        muted
        preload="none"
      />
      <button
        onClick={toggleMute}
        aria-label={muted ? "播放音樂" : "靜音"}
        className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 border border-white/30"
        style={{
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        {muted ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5a8c30"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5a8c30"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>
    </>
  );
}
