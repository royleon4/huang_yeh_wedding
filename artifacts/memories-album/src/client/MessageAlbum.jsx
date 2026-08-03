import { useEffect, useMemo, useState } from "react";
import {
  normalizeAlbumPhotoSortMode,
  sortAlbumMessages,
} from "../../album-photo-order.mjs";
import MessageModal from "./MessageModal.jsx";
import useMasonryLayout from "./useMasonryLayout.mjs";
import "./message-album.css";

const MESSAGE_SORT_MODES = Object.freeze([
  "random",
  "time-desc",
  "time-asc",
  "name-asc",
  "name-desc",
  "author-asc",
  "author-desc",
]);

const COPY = {
  zh: {
    add: "留下留言",
    addHint: "把祝福放進留言區",
    loading: "正在整理留言……",
    empty: "還沒有留言，歡迎成為第一位留下祝福的訪客。",
    failed: "留言暫時無法載入，請稍後再試。",
    retry: "重新載入",
    count: "則留言",
    sortLabel: "留言排序",
    sortOptions: {
      random: "隨機排列",
      "time-desc": "最新留言優先",
      "time-asc": "最早留言優先",
      "name-asc": "留言內容：正序",
      "name-desc": "留言內容：反序",
      "author-asc": "留言者姓名：正序",
      "author-desc": "留言者姓名：反序",
    },
  },
  en: {
    add: "Leave a message",
    addHint: "Add your blessing to the Guestbook",
    loading: "Arranging the messages…",
    empty: "There are no messages yet. Be the first guest to leave a blessing.",
    failed: "Messages are temporarily unavailable. Please try again shortly.",
    retry: "Try again",
    count: "messages",
    sortLabel: "Sort messages",
    sortOptions: {
      random: "Random order",
      "time-desc": "Newest messages first",
      "time-asc": "Oldest messages first",
      "name-asc": "Message text: A–Z",
      "name-desc": "Message text: Z–A",
      "author-asc": "Guest name: A–Z",
      "author-desc": "Guest name: Z–A",
    },
  },
};

function readableFontSize(body) {
  const length = Math.max(1, Array.from(String(body ?? "")).length);
  const pixels = 38 - Math.sqrt(length) * 1.15;
  return `${Math.max(18, Math.min(34, pixels)).toFixed(1)}px`;
}

function localizedDateTime(value, lang) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-NZ" : "zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MessageGrid({ messages, lang, copy, onCompose }) {
  const gridRef = useMasonryLayout();

  return (
    <div ref={gridRef} className="masonry-grid message-grid">
      <article className="photo-card message-action-card">
        <button type="button" onClick={onCompose}>
          <strong>{copy.add}</strong>
          <span>{copy.addHint}</span>
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
            <small>{localizedDateTime(message.messageAt, lang)}</small>
          </footer>
        </article>
      ))}
    </div>
  );
}

export default function MessageAlbum({ lang, albumId, sortMode }) {
  const t = COPY[lang] ?? COPY.zh;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [selectedSortMode, setSelectedSortMode] = useState(() =>
    normalizeAlbumPhotoSortMode(sortMode),
  );
  const [messageRandomSeed] = useState(
    () =>
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random()}`,
  );

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

  useEffect(() => {
    setSelectedSortMode(normalizeAlbumPhotoSortMode(sortMode));
  }, [sortMode]);

  const orderedMessages = useMemo(
    () => sortAlbumMessages(messages, selectedSortMode, messageRandomSeed),
    [messages, selectedSortMode, messageRandomSeed],
  );

  const countLabel = useMemo(
    () => `${messages.length} ${t.count}`,
    [messages.length, t.count],
  );

  return (
    <section className="message-album" aria-live="polite">
      <div className="message-album-heading">
        <span>{countLabel}</span>
        <label className="message-sort-control">
          <span>{t.sortLabel}</span>
          <select
            aria-label={t.sortLabel}
            value={selectedSortMode}
            onChange={(event) =>
              setSelectedSortMode(
                normalizeAlbumPhotoSortMode(event.target.value),
              )
            }
          >
            {MESSAGE_SORT_MODES.map((mode) => (
              <option value={mode} key={mode}>
                {t.sortOptions[mode]}
              </option>
            ))}
          </select>
        </label>
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
        <MessageGrid
          messages={orderedMessages}
          lang={lang}
          copy={t}
          onCompose={() => setShowComposer(true)}
        />
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
