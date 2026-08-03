import { useEffect, useMemo, useState } from "react";
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

export default function AdminMessagesPanel() {
  const [messages, setMessages] = useState([]);
  const [format, setFormat] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await adminRequest("/admin/api/settings/messages");
      setMessages(payload.messages ?? []);
      setFormat(payload.format ?? null);
    } catch (loadError) {
      if (loadError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

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

  const importMessages = async (event) => {
    event.preventDefault();
    if (!file || busy || activeMessageId) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const content = await file.text();
      const payload = await adminRequest("/admin/api/settings/messages/import", {
        method: "POST",
        body: { content },
        timeoutMs: 120_000,
      });
      setMessage(`已匯入 ${payload.imported ?? 0} 則留言。 Imported ${payload.imported ?? 0} messages.`);
      setFile(null);
      event.currentTarget.reset();
      await load();
    } catch (importError) {
      if (importError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(importError));
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

  return (
    <section className="admin-messages" aria-labelledby="messages-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-kicker">GUESTBOOK MESSAGES</p>
          <h2 id="messages-title">留言區管理 / Guestbook</h2>
        </div>
        <span>{messages.length} 則 / messages</span>
      </div>

      <form className="admin-create-card" onSubmit={importMessages}>
        <h3>匯入留言 / Import messages</h3>
        <p className="admin-section-note">
          使用 UTF-8 CSV、TSV 或 TXT。第一列必須是 {acceptedHeaders}；日期時間可省略，省略時使用匯入時間。支援 {acceptedDateTimeFormats}。需要精確時區時，請使用含 Z 或 +08:00 等時區的 ISO 8601。最多 {format?.maximumRows ?? 500} 則。
        </p>
        <p className="admin-section-note">
          Use a UTF-8 CSV, TSV or TXT file. The first row must use {acceptedHeaders}. Datetime is optional and defaults to the import time. Supported formats: {acceptedDateTimeFormats}. Use ISO 8601 with Z or an offset such as +08:00 when exact timezone handling matters. Maximum {format?.maximumRows ?? 500} rows.
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

      {loading ? (
        <p className="admin-section-note">正在載入留言… / Loading messages…</p>
      ) : (
        <div className="admin-message-list">
          {messages.map((item) => {
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
                  <p className="admin-message-status">已隱藏 / Hidden</p>
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
            <p className="admin-section-note">目前沒有留言。 / No messages yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
