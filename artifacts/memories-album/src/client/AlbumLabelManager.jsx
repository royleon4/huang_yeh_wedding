import { useEffect, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { albumSupportsPhotoLabels } from "./album-labels.mjs";
import "./album-label-manager.css";

export default function AlbumLabelManager({ album, busy }) {
  const supported = albumSupportsPhotoLabels(album);
  const [labels, setLabels] = useState([]);
  const [labelZh, setLabelZh] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    void adminRequest(
      `/admin/api/album-labels?albumId=${encodeURIComponent(album.id)}`,
    )
      .then((payload) => {
        if (!cancelled) {
          setLabels(Array.isArray(payload.labels) ? payload.labels : []);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(adminErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [album.id, supported]);

  if (!supported) return null;

  const createLabel = async () => {
    const normalizedZh = labelZh.replace(/\s+/g, " ").trim();
    if (!normalizedZh || saving || busy) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = await adminRequest("/admin/api/album-labels", {
        method: "POST",
        body: {
          albumId: album.id,
          labelZh: normalizedZh,
          labelEn: labelEn.replace(/\s+/g, " ").trim(),
        },
        timeoutMs: album.id === "wedding" ? 120_000 : undefined,
      });
      if (payload.label) {
        setLabels((current) => [...current, payload.label]);
      }
      setLabelZh("");
      setLabelEn("");
      setMessage("標籤已新增。");
    } catch (saveError) {
      setError(adminErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-album-label-manager" aria-label={`${album.titleZh} 標籤`}>
      <div className="admin-album-label-heading">
        <div>
          <strong>子分類（標籤）</strong>
          <p>
            新增照片時會在「{album.titleZh}」群組下提供這些標籤。
          </p>
        </div>
        <span>{labels.length} 個標籤</span>
      </div>

      {loading ? (
        <p className="admin-album-label-status">正在讀取標籤…</p>
      ) : labels.length > 0 ? (
        <div className="admin-album-label-list" aria-label="現有標籤">
          {labels.map((label) => (
            <span className="admin-album-label-chip" key={label.id}>
              {label.labelZh}
              {label.labelEn && label.labelEn !== label.labelZh
                ? ` / ${label.labelEn}`
                : ""}
            </span>
          ))}
        </div>
      ) : (
        <p className="admin-album-label-status">尚未建立標籤。</p>
      )}

      <div className="admin-album-label-fields">
        <label>
          中文標籤
          <input
            value={labelZh}
            onChange={(event) => setLabelZh(event.target.value)}
            maxLength={80}
            disabled={busy || saving}
          />
        </label>
        <label>
          英文標籤
          <input
            value={labelEn}
            onChange={(event) => setLabelEn(event.target.value)}
            maxLength={80}
            disabled={busy || saving}
          />
        </label>
        <button
          type="button"
          onClick={() => void createLabel()}
          disabled={busy || saving || !labelZh.trim()}
        >
          {saving ? "新增中…" : "新增標籤"}
        </button>
      </div>

      {(message || error) && (
        <p
          className={`admin-album-label-status${error ? " error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
    </section>
  );
}
