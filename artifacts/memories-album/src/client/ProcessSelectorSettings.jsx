import { useEffect, useMemo, useState } from "react";
import {
  PROCESS_WHEEL_LOOP_SUPPORTED_ALBUMS,
  PROCESS_WHEEL_VISIBLE_COUNTS,
  normalizeProcessSelectorSettings,
} from "../process-selector-settings.mjs";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";
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
    description: "滑動停止後，中央分類會立即切換。",
  },
];

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function ProcessSelectorSettings() {
  const [saved, setSaved] = useState(() =>
    normalizeProcessSelectorSettings(),
  );
  const [draft, setDraft] = useState(() =>
    normalizeProcessSelectorSettings(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const mode = draft.processWheelEnabled ? "wheel" : "traditional";
  const savedMode = saved.processWheelEnabled ? "wheel" : "traditional";
  const hasChanges = useMemo(() => !same(saved, draft), [saved, draft]);

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const next = normalizeProcessSelectorSettings(settings);
        setSaved(next);
        setDraft(next);
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

  const updateDraft = (patch) => {
    setDraft((current) =>
      normalizeProcessSelectorSettings({ ...current, ...patch }),
    );
    setMessage("");
    setError("");
  };

  const toggleLoopAlbum = (albumId, enabled) => {
    const next = enabled
      ? [...draft.processWheelLoopAlbumIds, albumId]
      : draft.processWheelLoopAlbumIds.filter((id) => id !== albumId);
    updateDraft({ processWheelLoopAlbumIds: next });
  };

  const save = async () => {
    if (saving || !hasChanges) return { succeeded: 0 };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await adminRequest(
        "/admin/api/settings/process-selector",
        {
          method: "PATCH",
          body: draft,
        },
      );
      const next = normalizeProcessSelectorSettings(result);
      setSaved(next);
      setDraft(next);
      const autoScrollMessage = next.processLabelAutoScrollEnabled
        ? "選中標籤後會自動回到內容開頭。"
        : "選中標籤後會保留目前垂直位置。";
      setMessage(
        next.processWheelEnabled
          ? `前台已切換為輪盤模式；手機目標顯示約 ${next.processWheelVisibleCount} 個選項。已啟用無限循環的相簿：${
              next.processWheelLoopAlbumIds.length || "無"
            }。${autoScrollMessage}`
          : `前台已切換回傳統按鈕；輪盤設定會保留到下次啟用。${autoScrollMessage}`,
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
          <label className="selector-auto-scroll-card">
            <input
              type="checkbox"
              checked={draft.processLabelAutoScrollEnabled}
              onChange={(event) =>
                updateDraft({
                  processLabelAutoScrollEnabled: event.target.checked,
                })
              }
              disabled={saving}
            />
            <span>
              <strong>選中標籤後自動捲動至內容開頭</strong>
              <small>
                開啟後，點擊、滑動或鍵盤選中新的子分類時，標籤列會貼齊畫面頂部，內容從標籤列正下方開始顯示。
              </small>
            </span>
          </label>

          <div
            className="selector-mode-grid"
            role="radiogroup"
            aria-label="子分類操作方式"
          >
            {MODES.map((item) => (
              <label
                key={item.id}
                className={`selector-mode-card ${mode === item.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="process-selector-mode"
                  value={item.id}
                  checked={mode === item.id}
                  onChange={() =>
                    updateDraft({ processWheelEnabled: item.id === "wheel" })
                  }
                  disabled={saving}
                />
                <span className="selector-mode-check" aria-hidden="true" />
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <div
                  className={`selector-mode-preview ${item.id}`}
                  aria-hidden="true"
                >
                  <i>迎賓</i>
                  <i className="focus">證婚</i>
                  <i>宴客</i>
                  {item.id === "wheel" && <i>送客</i>}
                </div>
              </label>
            ))}
          </div>

          <div
            className={`selector-density-card ${mode === "wheel" ? "enabled" : ""}`}
          >
            <div>
              <strong>手機目標顯示的選項數量</strong>
              <p>
                此數值控制輪盤密度；小螢幕會優先保留較寬、可讀且容易點選的尺寸，因此實際同時可見數量可能較少。
              </p>
            </div>
            <label>
              目標數量
              <select
                value={draft.processWheelVisibleCount}
                onChange={(event) =>
                  updateDraft({
                    processWheelVisibleCount: Number(event.target.value),
                  })
                }
                disabled={saving || mode !== "wheel"}
              >
                {PROCESS_WHEEL_VISIBLE_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    約 {count} 個
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset
            className={`selector-loop-card ${mode === "wheel" ? "enabled" : ""}`}
          >
            <legend>各相簿的無限左右滾動</legend>
            <p>
              開啟後，輪盤從最後一項繼續向右會回到第一項，從第一項向左則回到最後一項。每個使用輪盤的相簿可獨立設定。
            </p>
            <div className="selector-loop-options">
              {PROCESS_WHEEL_LOOP_SUPPORTED_ALBUMS.map((album) => (
                <label className="admin-check" key={album.id}>
                  <input
                    type="checkbox"
                    checked={draft.processWheelLoopAlbumIds.includes(album.id)}
                    onChange={(event) =>
                      toggleLoopAlbum(album.id, event.target.checked)
                    }
                    disabled={saving || mode !== "wheel"}
                  />
                  {album.labelZh}
                </label>
              ))}
            </div>
          </fieldset>

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
