import { useEffect, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";
import "./process-selector-settings.css";

const DEFAULT_VISIBLE_COUNT = 6;
const VISIBLE_COUNT_OPTIONS = [3, 4, 5, 6, 7, 8];

const MODES = [
  {
    id: "traditional",
    title: "傳統按鈕",
    description: "保留原本橫向排列方式；使用者滑動後，再點選想看的分類。",
  },
  {
    id: "wheel",
    title: "輪盤滑動選擇",
    description: "滑動停止後，中央分類會立即切換，並自動定位到第一個影片或照片。",
  },
];

function normalizedVisibleCount(value) {
  const count = Number(value);
  return VISIBLE_COUNT_OPTIONS.includes(count) ? count : DEFAULT_VISIBLE_COUNT;
}

export default function ProcessSelectorSettings() {
  const [savedMode, setSavedMode] = useState("traditional");
  const [draftMode, setDraftMode] = useState("traditional");
  const [savedVisibleCount, setSavedVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const [draftVisibleCount, setDraftVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasChanges =
    draftMode !== savedMode || draftVisibleCount !== savedVisibleCount;

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const mode = settings.processWheelEnabled === true ? "wheel" : "traditional";
        const visibleCount = normalizedVisibleCount(settings.processWheelVisibleCount);
        setSavedMode(mode);
        setDraftMode(mode);
        setSavedVisibleCount(visibleCount);
        setDraftVisibleCount(visibleCount);
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
    if (saving || !hasChanges) return { succeeded: 0 };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await adminRequest("/admin/api/settings", {
        method: "PATCH",
        body: {
          processWheelEnabled: draftMode === "wheel",
          processWheelVisibleCount: draftVisibleCount,
        },
      });
      const mode = result.processWheelEnabled === true ? "wheel" : "traditional";
      const visibleCount = normalizedVisibleCount(result.processWheelVisibleCount);
      setSavedMode(mode);
      setDraftMode(mode);
      setSavedVisibleCount(visibleCount);
      setDraftVisibleCount(visibleCount);
      setMessage(
        mode === "wheel"
          ? `前台已切換為輪盤模式；手機目標顯示約 ${visibleCount} 個選項，並優先保持文字可讀。`
          : `前台已切換回傳統按鈕；輪盤目標數量保留為 ${visibleCount} 個。`,
      );
      return { succeeded: 1 };
    } catch (saveError) {
      if (saveError?.status === 401) window.location.replace("/Memories/");
      setError(adminErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  useAdminSaveSection("process-selector", {
    pendingCount: hasChanges ? 1 : 0,
    save,
  });

  return (
    <section
      className="selector-settings general-setting-card"
      aria-labelledby="selector-settings-title"
    >
      <div className="general-setting-heading">
        <div>
          <p className="admin-kicker">SUBCATEGORY EXPERIENCE</p>
          <h3 id="selector-settings-title">子分類操作方式</h3>
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

          <div className={`selector-density-card ${draftMode === "wheel" ? "enabled" : ""}`}>
            <div>
              <strong>手機目標顯示的選項數量</strong>
              <p>
                此數值控制輪盤密度；小螢幕會優先保留原本較寬、可讀且容易點選的尺寸，因此實際同時可見數量可能較少。
              </p>
            </div>
            <label>
              目標數量
              <select
                value={draftVisibleCount}
                onChange={(event) => {
                  setDraftVisibleCount(Number(event.target.value));
                  setMessage("");
                  setError("");
                }}
                disabled={saving}
              >
                {VISIBLE_COUNT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    約 {count} 個
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="selector-settings-actions">
            <span>
              {hasChanges
                ? "子分類操作方式有未儲存變更。"
                : "變更會由頁面底部統一儲存。"}
            </span>
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
