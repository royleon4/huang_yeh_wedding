import { useEffect, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import "./process-selector-settings.css";

const MODES = [
  {
    id: "traditional",
    title: "傳統按鈕",
    description: "保留原本橫向排列方式；使用者滑動後，再點選想看的分類。",
  },
  {
    id: "wheel",
    title: "輪盤滑動選擇",
    description: "手機同時看見約 3 個、桌面約 5 個以上；滑動停止後，中央分類會立即切換。",
  },
];

export default function ProcessSelectorSettings() {
  const [savedMode, setSavedMode] = useState("traditional");
  const [draftMode, setDraftMode] = useState("traditional");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const mode = settings.processWheelEnabled === true ? "wheel" : "traditional";
        setSavedMode(mode);
        setDraftMode(mode);
      })
      .catch((loadError) => {
        if (loadError?.status === 401) {
          window.location.replace("/Memories/");
          return;
        }
        if (!cancelled) setError(adminErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (saving || draftMode === savedMode) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await adminRequest("/admin/api/settings", {
        method: "PATCH",
        body: { processWheelEnabled: draftMode === "wheel" },
      });
      const mode = result.processWheelEnabled === true ? "wheel" : "traditional";
      setSavedMode(mode);
      setDraftMode(mode);
      setMessage(
        mode === "wheel"
          ? "前台子分類已切換為輪盤滑動選擇。"
          : "前台子分類已切換回傳統按鈕。",
      );
    } catch (saveError) {
      if (saveError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="selector-settings" aria-labelledby="selector-settings-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-kicker">SUBCATEGORY EXPERIENCE</p>
          <h2 id="selector-settings-title">子分類操作方式</h2>
        </div>
        <span>{savedMode === "wheel" ? "輪盤模式" : "傳統模式"}</span>
      </div>
      <p className="admin-section-note">
        此設定同時套用於「婚禮流程」與「訪客上傳者」子分類。切換後不會改動分類、相片或排序資料。
      </p>

      {loading ? (
        <p className="selector-settings-status">正在讀取設定…</p>
      ) : (
        <>
          <div className="selector-mode-grid" role="radiogroup" aria-label="子分類操作方式">
            {MODES.map((mode) => (
              <label
                key={mode.id}
                className={`selector-mode-card ${draftMode === mode.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="process-selector-mode"
                  value={mode.id}
                  checked={draftMode === mode.id}
                  onChange={() => {
                    setDraftMode(mode.id);
                    setMessage("");
                    setError("");
                  }}
                  disabled={saving}
                />
                <span className="selector-mode-check" aria-hidden="true" />
                <strong>{mode.title}</strong>
                <p>{mode.description}</p>
                <div className={`selector-mode-preview ${mode.id}`} aria-hidden="true">
                  <i>迎賓</i>
                  <i className="focus">證婚</i>
                  <i>宴客</i>
                  {mode.id === "wheel" && <i>送客</i>}
                </div>
              </label>
            ))}
          </div>

          <div className="selector-settings-actions">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || draftMode === savedMode}
            >
              {saving ? "儲存中…" : "套用操作方式"}
            </button>
            {draftMode !== savedMode && <span>尚未儲存</span>}
          </div>
        </>
      )}

      {(message || error) && (
        <p
          className={`selector-settings-status${error ? " error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
    </section>
  );
}
