import { useEffect, useMemo, useState } from "react";
import { EMPTY_IMAGE_SETTING_METADATA } from "../image-setting.mjs";
import {
  DEFAULT_SITE_COPY,
  SITE_COPY_TITLE_KEY,
  normalizeSiteCopy,
} from "../site-copy.mjs";
import {
  DEFAULT_SITE_STYLE,
  HERO_BACKGROUND_ACCEPTED_CONTENT_TYPES,
  HERO_BACKGROUND_MAX_UPLOAD_BYTES,
  HERO_BACKGROUND_RECOMMENDED_SIZE,
  applySiteStyle,
  heroBackgroundUrl,
  normalizeHeroBackgroundMetadata,
  normalizeSiteStyle,
  siteStyleCssVariables,
  validateHeroBackgroundFile,
} from "../site-style.mjs";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";
import {
  removeHeroBackground,
  replaceHeroBackground,
} from "./site-style-client.mjs";
import "./site-style-settings.css";

const UNCHANGED_BACKGROUND = Object.freeze({ kind: "unchanged", file: null });
const MAX_BACKGROUND_MB = HERO_BACKGROUND_MAX_UPLOAD_BYTES / (1024 * 1024);

const COLOR_GROUPS = Object.freeze([
  {
    id: "brand",
    title: "整體配色",
    fields: [
      ["paperColor", "頁面底色"],
      ["paperDeepColor", "次要底色"],
      ["inkColor", "主要文字"],
      ["mutedColor", "次要文字"],
      ["primaryColor", "品牌主色"],
      ["primarySoftColor", "品牌淺色"],
      ["detailColor", "金色細節"],
      ["accentColor", "強調色"],
    ],
  },
  {
    id: "hero",
    title: "首頁標題區",
    fields: [
      ["heroTitleColor", "主標題"],
      ["heroDateColor", "日期"],
      ["heroSubtitleColor", "說明文字"],
      ["heroOverlayColor", "背景遮罩"],
    ],
  },
  {
    id: "navigation",
    title: "底部導覽",
    fields: [
      ["bottomNavBackgroundColor", "導覽背景"],
      ["bottomNavTextColor", "圖示與文字"],
      ["bottomNavActiveBackgroundColor", "選取背景"],
    ],
  },
]);

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function useObjectUrl(file) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

function titleSnapshot(siteCopy) {
  const normalized = normalizeSiteCopy(siteCopy);
  return {
    zh: normalized.zh[SITE_COPY_TITLE_KEY],
    en: normalized.en[SITE_COPY_TITLE_KEY],
  };
}

function backgroundError(reason) {
  if (reason === "unsupported-type") {
    return "首頁背景只支援 PNG、JPEG 或 WebP。";
  }
  if (reason === "too-large") {
    return `首頁背景不能超過 ${MAX_BACKGROUND_MB} MB。`;
  }
  return "請選擇首頁背景圖片。";
}

export default function SiteStyleSettings() {
  const [savedStyle, setSavedStyle] = useState(() =>
    normalizeSiteStyle(DEFAULT_SITE_STYLE),
  );
  const [draftStyle, setDraftStyle] = useState(() =>
    normalizeSiteStyle(DEFAULT_SITE_STYLE),
  );
  const [savedTitles, setSavedTitles] = useState(() =>
    titleSnapshot(DEFAULT_SITE_COPY),
  );
  const [draftTitles, setDraftTitles] = useState(() =>
    titleSnapshot(DEFAULT_SITE_COPY),
  );
  const [savedBackground, setSavedBackground] = useState(
    EMPTY_IMAGE_SETTING_METADATA,
  );
  const [backgroundDraft, setBackgroundDraft] = useState(UNCHANGED_BACKGROUND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedBackground =
    backgroundDraft.kind === "replace" ? backgroundDraft.file : null;
  const localBackgroundUrl = useObjectUrl(selectedBackground);
  const styleChanged = !same(savedStyle, draftStyle);
  const titlesChanged = !same(savedTitles, draftTitles);
  const backgroundChanged = backgroundDraft.kind !== "unchanged";
  const pendingCount =
    Number(styleChanged) + Number(titlesChanged) + Number(backgroundChanged);

  const previewBackground = localBackgroundUrl
    ? `url("${localBackgroundUrl}")`
    : backgroundDraft.kind !== "remove" && savedBackground.configured
      ? `url("${heroBackgroundUrl(savedBackground.version)}")`
      : "none";
  const previewVariables = useMemo(
    () => ({
      ...siteStyleCssVariables(draftStyle, EMPTY_IMAGE_SETTING_METADATA),
      "--memories-hero-background-image": previewBackground,
    }),
    [draftStyle, previewBackground],
  );

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const style = normalizeSiteStyle(settings.siteStyle);
        const titles = titleSnapshot(settings.siteCopy);
        setSavedStyle(style);
        setDraftStyle(style);
        setSavedTitles(titles);
        setDraftTitles(titles);
        setSavedBackground(
          normalizeHeroBackgroundMetadata(settings.heroBackground),
        );
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

  const clearFeedback = () => {
    setMessage("");
    setError("");
  };

  const updateStyle = (key, value) => {
    setDraftStyle((current) =>
      normalizeSiteStyle({ ...current, [key]: value }),
    );
    clearFeedback();
  };

  const chooseBackground = (file) => {
    clearFeedback();
    const validation = validateHeroBackgroundFile(file);
    if (!validation.valid) {
      setError(backgroundError(validation.reason));
      return;
    }
    setBackgroundDraft({ kind: "replace", file });
  };

  const resetAll = () => {
    setDraftStyle(normalizeSiteStyle(DEFAULT_SITE_STYLE));
    setDraftTitles(titleSnapshot(DEFAULT_SITE_COPY));
    setBackgroundDraft({ kind: "remove", file: null });
    clearFeedback();
  };

  const save = async () => {
    if (saving || pendingCount === 0) return { succeeded: 0 };
    setSaving(true);
    clearFeedback();
    let succeeded = 0;
    try {
      if (styleChanged) {
        const response = await adminRequest("/admin/api/settings", {
          method: "PATCH",
          body: { siteStyle: draftStyle },
        });
        const next = normalizeSiteStyle(response.siteStyle);
        setSavedStyle(next);
        setDraftStyle(next);
        succeeded += 1;
      }

      if (titlesChanged) {
        const response = await adminRequest("/admin/api/settings", {
          method: "PATCH",
          body: {
            siteCopyPatch: {
              zh: { [SITE_COPY_TITLE_KEY]: draftTitles.zh },
              en: { [SITE_COPY_TITLE_KEY]: draftTitles.en },
            },
          },
        });
        const next = titleSnapshot(response.siteCopy);
        setSavedTitles(next);
        setDraftTitles(next);
        succeeded += 1;
      }

      let nextBackground = savedBackground;
      if (backgroundDraft.kind === "replace") {
        nextBackground = await replaceHeroBackground(backgroundDraft.file);
        succeeded += 1;
      } else if (backgroundDraft.kind === "remove") {
        nextBackground = await removeHeroBackground();
        succeeded += 1;
      }
      if (backgroundChanged) {
        setSavedBackground(nextBackground);
        setBackgroundDraft(UNCHANGED_BACKGROUND);
      }

      applySiteStyle({ siteStyle: draftStyle, heroBackground: nextBackground });
      setMessage("網站樣式已儲存；公開網站重新整理後會套用新的首圖、標題與配色。");
      return { succeeded };
    } catch (saveError) {
      if (saveError?.status === 401) window.location.replace("/Memories/");
      setError(adminErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  useAdminSaveSection("site-style", {
    pendingCount,
    save,
  });

  return (
    <section
      className="site-style-settings general-setting-card"
      aria-labelledby="site-style-title"
    >
      <div className="site-style-heading">
        <div>
          <p className="admin-kicker">STYLE & HERO</p>
          <h2 id="site-style-title">樣式與首頁首圖</h2>
          <p>
            調整首頁標題區背景、透明遮罩、網站主標題與全站配色。所有設定沿用現有設計語言，不會改動照片或分類資料。
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={resetAll}
          disabled={saving || loading}
        >
          套用預設樣式
        </button>
      </div>

      {loading ? (
        <p className="admin-feature-status">正在讀取網站樣式…</p>
      ) : (
        <>
          <div className="site-style-preview" style={previewVariables}>
            <div className="site-style-preview-background" aria-hidden="true" />
            <div className="site-style-preview-content">
              <small>LEON & YEHY · WEDDING ARCHIVE</small>
              <strong>{draftTitles.zh || "（空白標題）"}</strong>
              <span>二〇二六年六月二十日</span>
              <p>首頁首圖、標題、日期與遮罩即時預覽</p>
            </div>
          </div>

          <div className="site-style-grid">
            <fieldset className="site-style-panel site-style-background-panel">
              <legend>首頁背景圖片</legend>
              <p>
                建議上傳 {HERO_BACKGROUND_RECOMMENDED_SIZE}、16:9 橫式圖片。支援 PNG、JPG／JPEG、WebP，最大 {MAX_BACKGROUND_MB} MB；儲存時會置中裁切並轉為 1600 × 900 WebP。
              </p>
              <div className="site-style-file-actions">
                <label className="site-style-file-button">
                  <input
                    type="file"
                    accept={HERO_BACKGROUND_ACCEPTED_CONTENT_TYPES.join(",")}
                    onChange={(event) =>
                      chooseBackground(event.target.files?.[0])
                    }
                    disabled={saving}
                  />
                  {savedBackground.configured || selectedBackground
                    ? "更換背景"
                    : "選擇背景"}
                </label>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setBackgroundDraft({ kind: "remove", file: null });
                    clearFeedback();
                  }}
                  disabled={
                    saving || (!savedBackground.configured && !selectedBackground)
                  }
                >
                  移除背景
                </button>
                {backgroundChanged && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setBackgroundDraft(UNCHANGED_BACKGROUND);
                      clearFeedback();
                    }}
                    disabled={saving}
                  >
                    取消背景變更
                  </button>
                )}
              </div>
              <label className="site-style-range">
                <span>
                  背景遮罩透明度
                  <strong>{Math.round(draftStyle.heroOverlayOpacity * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min="0"
                  max="0.95"
                  step="0.05"
                  value={draftStyle.heroOverlayOpacity}
                  onChange={(event) =>
                    updateStyle("heroOverlayOpacity", event.target.value)
                  }
                  disabled={saving}
                />
                <small>數值越高，文字越容易閱讀；背景圖片也會越淡。</small>
              </label>
            </fieldset>

            <fieldset className="site-style-panel site-style-title-panel">
              <legend>網站主標題</legend>
              <label>
                中文標題
                <textarea
                  rows="3"
                  maxLength="200"
                  value={draftTitles.zh}
                  onChange={(event) => {
                    setDraftTitles((current) => ({
                      ...current,
                      zh: event.target.value,
                    }));
                    clearFeedback();
                  }}
                  disabled={saving}
                />
              </label>
              <label>
                English title
                <textarea
                  rows="3"
                  maxLength="200"
                  value={draftTitles.en}
                  onChange={(event) => {
                    setDraftTitles((current) => ({
                      ...current,
                      en: event.target.value,
                    }));
                    clearFeedback();
                  }}
                  disabled={saving}
                />
              </label>
              <small>允許換行；前台會依照輸入的行數顯示。</small>
            </fieldset>
          </div>

          {COLOR_GROUPS.map((group) => (
            <details className="site-style-color-group" key={group.id}>
              <summary>{group.title}</summary>
              <div className="site-style-color-grid">
                {group.fields.map(([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <span className="site-style-color-control">
                      <input
                        type="color"
                        value={draftStyle[key]}
                        onChange={(event) => updateStyle(key, event.target.value)}
                        disabled={saving}
                        aria-label={`${label}顏色`}
                      />
                      <input
                        type="text"
                        value={draftStyle[key]}
                        pattern="#[0-9a-fA-F]{6}"
                        maxLength="7"
                        onChange={(event) => updateStyle(key, event.target.value)}
                        disabled={saving}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </details>
          ))}

          <p className="admin-draft-hint">
            {pendingCount > 0
              ? `網站樣式有 ${pendingCount} 組未儲存變更。`
              : "變更會由頁面底部統一儲存。"}
          </p>
        </>
      )}

      {(message || error) && (
        <p
          className={`admin-feature-status${error ? " error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
    </section>
  );
}
