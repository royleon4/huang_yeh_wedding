import { useMemo, useRef, useState } from "react";
import { sortAlbumMessages } from "../../album-photo-order.mjs";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import "./admin-messages.css";

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formattedDateTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? DATE_TIME_FORMAT.format(date) : "—";
}

export default function AdminMessagesPanel({ sortMode }) {
  const [messages, setMessages] = useState([]);
  const [format, setFormat] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loadInFlightRef = useRef(false);
  const [messageRandomSeed] = useState(
    () =>
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random()}`,
  );

  const load = async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setLoading(true);
    setError("");
    try {
      const payload = await adminRequest("/admin/api/settings/messages");
      setMessages(payload.messages ?? []);
      setFormat(payload.format ?? null);
      setMessagesLoaded(true);
    } catch (loadError) {
      if (loadError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(loadError));
    } finally {
      loadInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleMessagesToggle = (event) => {
    const open = event.currentTarget.open;
    setMessagesOpen(open);
    if (open && !messagesLoaded && !loadInFlightRef.current) {
      void load();
    }
  };

  const acceptedHeaders = useMemo(
    () =>
      format?.acceptedHeaders?.join(" 或 ") ??
      "name,message,datetime 或 姓名,留言,日期時間",
    [format],
  );

  const acceptedDateTimeFormats = useMemo(
    () =>
      format?.dateTimeFormats?.join("、") ??
      "YYYY-MM-DD HH:mm、YYYY-MM-DDTHH:mm、含時區的 ISO 8601",
    [format],
  );

  const orderedMessages = useMemo(
    () => sortAlbumMessages(messages, sortMode, messageRandomSeed),
    [messages, sortMode, messageRandomSeed],
  );

  const importMessages = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file || busy || activeMessageId) return;
    setBusy(true);
    setMessage("");
    setError("");

    let payload;
    try {
      const content = await file.text();
      payload = await adminRequest("/admin/api/settings/messages/import", {
        method: "POST",
        body: {
          content,
          timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
        },
        timeoutMs: 120_000,
      });
    } catch (importError) {
      if (importError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(importError));
      setBusy(false);
      return;
    }

    try {
      setFile(null);
      form.reset();
      if (messagesOpen) {
        await load();
      } else if (messagesLoaded) {
        setMessagesLoaded(false);
      }
      setMessage(
        `已匯入 ${payload.imported ?? 0} 則留言。 Imported ${payload.imported ?? 0} messages.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const changeVisibility = async (item, visibility) => {
    if (busy || activeMessageId) return;
    setActiveMessageId(item.id);
    setMessage("");
    setError("");
    try {
      const payload = await adminRequest(
        `/admin/api/settings/messages/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          body: { visibility },
        },
      );
      setMessages((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? payload.message : candidate,
        ),
      );
      setMessage(
        visibility === "hidden"
          ? "留言已隱藏，前台將不再顯示。 Message hidden."
          : "留言已重新顯示。 Message visible again.",
      );
    } catch (visibilityError) {
      if (visibilityError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(visibilityError));
    } finally {
      setActiveMessageId("");
    }
  };

  const deleteMessage = async (item) => {
    if (busy || activeMessageId) return;
    const confirmed = window.confirm(
      `確定永久刪除 ${item.visitorName} 的留言？此動作無法復原。\nPermanently delete this message? This cannot be undone.`,
    );
    if (!confirmed) return;

    setActiveMessageId(item.id);
    setMessage("");
    setError("");
    try {
      await adminRequest(
        `/admin/api/settings/messages/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      setMessages((current) =>
        current.filter((candidate) => candidate.id !== item.id),
      );
      setMessage("留言已永久刪除。 Message permanently deleted.");
    } catch (deleteError) {
      if (deleteError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(deleteError));
    } finally {
      setActiveMessageId("");
    }
  };

  const deleteAllMessages = async () => {
    if (
      busy ||
      activeMessageId ||
      !messagesLoaded ||
      messages.length === 0
    ) {
      return;
    }
    const confirmed = window.confirm(
      `確定永久刪除全部 ${messages.length} 則留言？此動作無法復原。\nPermanently delete all ${messages.length} messages? This cannot be undone.`,
    );
    if (!confirmed) return;

    setActiveMessageId("all");
    setMessage("");
    setError("");
    try {
      const payload = await adminRequest("/admin/api/settings/messages", {
        method: "DELETE",
      });
      setMessages([]);
      setMessage(
        `已永久刪除 ${payload.deleted ?? 0} 則留言。 Permanently deleted ${payload.deleted ?? 0} messages.`,
      );
    } catch (deleteError) {
      if (deleteError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(deleteError));
    } finally {
      setActiveMessageId("");
    }
  };

  return (
    <section className="admin-messages" aria-labelledby="messages-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-kicker">GUESTBOOK MESSAGES</p>
          <h2 id="messages-title">留言區管理 / Guestbook</h2>
        </div>
        <span>
          {messagesLoaded
            ? `${messages.length} 則 / messages`
            : "留言尚未載入 / Messages not loaded"}
        </span>
      </div>

      <form className="admin-create-card" onSubmit={importMessages}>
        <h3>匯入留言 / Import messages</h3>
        <p className="admin-section-note">
          使用 UTF-8 CSV、TSV 或 TXT。第一列必須是 {acceptedHeaders}；日期時間可省略，省略時使用匯入時間。支援 {acceptedDateTimeFormats}。未附時區的值會依目前管理員瀏覽器時區解讀；需要固定時區時，請使用含 Z 或 +08:00 等時區的 ISO 8601。最多 {format?.maximumRows ?? 500} 則。
        </p>
        <p className="admin-section-note">
          Use a UTF-8 CSV, TSV or TXT file. The first row must use {acceptedHeaders}. Datetime is optional and defaults to the import time. Supported formats: {acceptedDateTimeFormats}. Values without a timezone use the current administrator browser offset; use ISO 8601 with Z or an offset such as +08:00 for a fixed timezone. Maximum {format?.maximumRows ?? 500} rows.
        </p>
        <label className="admin-message-file">
          選擇檔案 / Choose file
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={busy || Boolean(activeMessageId)}
            required
          />
        </label>
        <button
          className="button primary"
          type="submit"
          disabled={busy || Boolean(activeMessageId) || !file}
        >
          {busy ? "正在匯入… / Importing…" : "匯入留言 / Import messages"}
        </button>
      </form>

      {(message || error) && (
        <div className={error ? "admin-banner error" : "admin-banner"} role={error ? "alert" : "status"}>
          {error || message}
        </div>
      )}

      <details
        className="admin-accordion admin-message-list-accordion"
        onToggle={handleMessagesToggle}
      >
        <summary className="admin-accordion-summary admin-message-list-summary">
          <span className="admin-accordion-title">
            所有留言 / All messages
          </span>
          <span className="admin-accordion-meta">
            {messagesLoaded
              ? `${messages.length} 則 / messages`
              : "開啟後載入 / Load on open"}
          </span>
        </summary>
        <div className="admin-accordion-body admin-message-list-body">
          {loading ? (
            <p className="admin-section-note">
              正在載入留言… / Loading messages…
            </p>
          ) : messagesLoaded ? (
            <div className="admin-message-list">
              {orderedMessages.map((item) => {
                const hidden = item.visibility === "hidden";
                const itemBusy = activeMessageId === item.id;
                return (
                  <article
                    className={`admin-editor-card${hidden ? " admin-message-hidden" : ""}`}
                    key={item.id}
                  >
                    <div className="admin-message-meta">
                      <strong>{item.visitorName}</strong>
                      <small>{formattedDateTime(item.messageAt)}</small>
                    </div>
                    {hidden && (
                      <p className="admin-message-status">
                        已隱藏 / Hidden
                      </p>
                    )}
                    <p>{item.body}</p>
                    <div className="admin-message-actions">
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() =>
                          changeVisibility(item, hidden ? "public" : "hidden")
                        }
                        disabled={busy || Boolean(activeMessageId)}
                      >
                        {itemBusy
                          ? "處理中… / Working…"
                          : hidden
                            ? "重新顯示 / Show"
                            : "隱藏 / Hide"}
                      </button>
                      <button
                        className="button secondary admin-message-delete"
                        type="button"
                        onClick={() => deleteMessage(item)}
                        disabled={busy || Boolean(activeMessageId)}
                      >
                        永久刪除 / Delete
                      </button>
                    </div>
                  </article>
                );
              })}
              {messages.length === 0 && (
                <p className="admin-section-note">
                  目前沒有留言。 / No messages yet.
                </p>
              )}
            </div>
          ) : (
            <p className="admin-section-note">
              開啟此區塊後才會載入留言。 / Messages load only after this section is opened.
            </p>
          )}
        </div>
      </details>

      <section
        className="admin-message-danger-zone"
        aria-labelledby="message-danger-title"
      >
        <div>
          <p className="admin-kicker">DANGER ZONE</p>
          <h3 id="message-danger-title">危險區 / Danger zone</h3>
          <p>
            永久刪除全部留言，且無法復原。 / Permanently delete every message. This cannot be undone.
          </p>
        </div>
        <button
          className="button admin-permanent-delete admin-message-delete-all"
          type="button"
          onClick={deleteAllMessages}
          disabled={
            busy ||
            Boolean(activeMessageId) ||
            !messagesLoaded ||
            messages.length === 0
          }
        >
          {activeMessageId === "all"
            ? "正在刪除… / Deleting…"
            : "永久刪除全部留言 / Delete all messages"}
        </button>
      </section>
    </section>
  );
}
