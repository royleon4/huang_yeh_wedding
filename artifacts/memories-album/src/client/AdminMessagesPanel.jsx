import { useEffect, useMemo, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import "./admin-messages.css";

const DATE_FORMAT = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formattedDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? DATE_FORMAT.format(date) : "—";
}

export default function AdminMessagesPanel() {
  const [messages, setMessages] = useState([]);
  const [format, setFormat] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
    () => format?.acceptedHeaders?.join(" 或 ") ?? "name,message,date 或 姓名,留言,日期",
    [format],
  );

  const importMessages = async (event) => {
    event.preventDefault();
    if (!file || busy) return;
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
          使用 UTF-8 CSV、TSV 或 TXT。第一列必須是 {acceptedHeaders}；日期可省略，省略時使用匯入時間。最多 {format?.maximumRows ?? 500} 則。
        </p>
        <p className="admin-section-note">
          Use a UTF-8 CSV, TSV or TXT file. The first row must use {acceptedHeaders}. The date is optional and defaults to the import time. Maximum {format?.maximumRows ?? 500} rows.
        </p>
        <label className="admin-message-file">
          選擇檔案 / Choose file
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={busy}
            required
          />
        </label>
        <button className="button primary" type="submit" disabled={busy || !file}>
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
          {messages.map((item) => (
            <article className="admin-editor-card" key={item.id}>
              <div className="admin-message-meta">
                <strong>{item.visitorName}</strong>
                <small>{formattedDate(item.messageAt)}</small>
              </div>
              <p>{item.body}</p>
            </article>
          ))}
          {messages.length === 0 && (
            <p className="admin-section-note">目前沒有留言。 / No messages yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
