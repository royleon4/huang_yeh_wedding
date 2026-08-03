import { useEffect, useMemo, useState } from "react";
import MessageModal from "./MessageModal.jsx";
import useMasonryLayout from "./useMasonryLayout.mjs";
import "./message-album.css";

const COPY = {
  zh: {
    add: "留下留言",
    addHint: "把祝福放進留言區",
    loading: "正在整理留言……",
    empty: "還沒有留言，歡迎成為第一位留下祝福的訪客。",
    failed: "留言暫時無法載入，請稍後再試。",
    retry: "重新載入",
    count: "則留言",
  },
  en: {
    add: "Leave a message",
    addHint: "Add your blessing to the Guestbook",
    loading: "Arranging the messages…",
    empty: "There are no messages yet. Be the first guest to leave a blessing.",
    failed: "Messages are temporarily unavailable. Please try again shortly.",
    retry: "Try again",
    count: "messages",
  },
};

function readableFontSize(body) {
  const length = Math.max(1, Array.from(String(body ?? "")).length);
  const pixels = 38 - Math.sqrt(length) * 1.15;
  return `${Math.max(18, Math.min(34, pixels)).toFixed(1)}px`;
}

function localizedDate(value, lang) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-NZ" : "zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function MessageAlbum({ lang, albumId }) {
  const t = COPY[lang] ?? COPY.zh;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const gridRef = useMasonryLayout();

  const loadMessages = async ({
    showLoading = true,
    preserveOnError = false,
  } = {}) => {
    if (showLoading) setLoading(true);
    if (!preserveOnError) setError("");
    try {
      const query = new URLSearchParams({ limit: "500" });
      const response = await fetch(`/Memories/api/settings/messages?${query}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload.messages)) {
        throw new Error(payload.error || t.failed);
      }
      setMessages(
        payload.messages.filter(
          (message) => !message.albumId || message.albumId === albumId,
        ),
      );
      setError("");
    } catch (loadError) {
      if (!preserveOnError) {
        setError(loadError instanceof Error ? loadError.message : t.failed);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadMessages();
  }, [albumId]);

  const countLabel = useMemo(
    () => `${messages.length} ${t.count}`,
    [messages.length, t.count],
  );

  return (
    <section className="message-album" aria-live="polite">
      <div className="message-album-heading">
        <span>{countLabel}</span>
      </div>

      {loading ? (
        <p className="message-album-state">{t.loading}</p>
      ) : error ? (
        <div className="message-album-state" role="alert">
          <p>{error}</p>
          <button className="button secondary" type="button" onClick={loadMessages}>
            {t.retry}
          </button>
        </div>
      ) : (
        <div ref={gridRef} className="masonry-grid message-grid">
          <article className="photo-card message-action-card">
            <button type="button" onClick={() => setShowComposer(true)}>
              <strong>{t.add}</strong>
              <span>{t.addHint}</span>
              <b aria-hidden="true">＋</b>
            </button>
          </article>

          {messages.map((message) => (
            <article className="photo-card message-card" key={message.id}>
              <div className="message-card-body">
                <p style={{ fontSize: readableFontSize(message.body) }}>
                  {message.body}
                </p>
              </div>
              <footer>
                <strong>{message.visitorName}</strong>
                <small>{localizedDate(message.messageAt, lang)}</small>
              </footer>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && messages.length === 0 && (
        <p className="message-empty-copy">{t.empty}</p>
      )}

      {showComposer && (
        <MessageModal
          lang={lang}
          onClose={() => setShowComposer(false)}
          onCreated={(message) => {
            setMessages((current) => [
              message,
              ...current.filter((item) => item.id !== message.id),
            ]);
            void loadMessages({ showLoading: false, preserveOnError: true });
          }}
        />
      )}
    </section>
  );
}
