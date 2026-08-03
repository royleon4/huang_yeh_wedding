import { useRef, useState } from "react";

const COPY = {
  zh: {
    title: "留下你的祝福",
    intro: "姓名與留言皆為必填。送出後會直接收藏在留言區，不需要選擇分類。",
    name: "你的姓名（必填）",
    namePlaceholder: "例如：小安",
    message: "留言（必填）",
    messagePlaceholder: "寫下想對我們說的話……",
    count: "字",
    submit: "送出留言",
    sending: "正在收藏……",
    close: "關閉",
    required: "請填寫姓名與留言。",
    failed: "留言暫時無法送出，請稍後再試。",
  },
  en: {
    title: "Leave a message",
    intro: "Your name and message are required. It will be added directly to the Guestbook without choosing a category.",
    name: "Your name (required)",
    namePlaceholder: "For example: An",
    message: "Message (required)",
    messagePlaceholder: "Share a blessing or a note for us…",
    count: "characters",
    submit: "Send message",
    sending: "Adding your message…",
    close: "Close",
    required: "Enter your name and message.",
    failed: "The message could not be sent. Please try again shortly.",
  },
};

export default function MessageModal({ lang, onClose, onCreated }) {
  const t = COPY[lang] ?? COPY.zh;
  const [visitorName, setVisitorName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef(null);

  const close = () => {
    controllerRef.current?.abort();
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!visitorName.trim() || !message.trim()) {
      setError(t.required);
      return;
    }

    setBusy(true);
    setError("");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch("/Memories/api/settings/messages", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visitorName, message }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.message) {
        throw new Error(payload.error || t.failed);
      }
      onCreated(payload.message);
      onClose();
    } catch (submitError) {
      if (submitError?.name !== "AbortError") {
        setError(submitError instanceof Error ? submitError.message : t.failed);
      }
    } finally {
      controllerRef.current = null;
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="paper-modal upload-modal message-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-dialog-title"
      >
        <button
          className="icon-button modal-close"
          type="button"
          onClick={close}
          aria-label={t.close}
          disabled={busy}
        >
          ×
        </button>
        <p className="eyebrow">GUESTBOOK · 20 JUN 2026</p>
        <h2 id="message-dialog-title">{t.title}</h2>
        <p>{t.intro}</p>

        <form className="upload-form message-form" onSubmit={submit}>
          <label>
            <span>{t.name}</span>
            <input
              type="text"
              value={visitorName}
              onChange={(event) => setVisitorName(event.target.value)}
              placeholder={t.namePlaceholder}
              maxLength={80}
              required
              disabled={busy}
              autoComplete="name"
            />
          </label>
          <label>
            <span>{t.message}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t.messagePlaceholder}
              maxLength={1000}
              rows={7}
              required
              disabled={busy}
            />
            <small className="message-character-count">
              {Array.from(message).length} / 1000 {t.count}
            </small>
          </label>

          {error && (
            <p className="upload-error" role="alert">
              {error}
            </p>
          )}

          <div className="upload-actions">
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? t.sending : t.submit}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={close}
              disabled={busy}
            >
              {t.close}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
