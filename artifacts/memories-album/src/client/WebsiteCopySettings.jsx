import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SITE_COPY,
  SITE_COPY_GROUPS,
  normalizeSiteCopy,
} from "../site-copy.mjs";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";
import "./website-copy-settings.css";

function cloneCopy(value) {
  return normalizeSiteCopy(JSON.parse(JSON.stringify(value ?? {})));
}

function sameCopy(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function WebsiteCopySettings() {
  const [saved, setSaved] = useState(() => cloneCopy(DEFAULT_SITE_COPY));
  const [draft, setDraft] = useState(() => cloneCopy(DEFAULT_SITE_COPY));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const changed = useMemo(() => !sameCopy(saved, draft), [saved, draft]);

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const next = normalizeSiteCopy(settings.siteCopy);
        setSaved(next);
        setDraft(cloneCopy(next));
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

  const update = (language, key, value) => {
    setDraft((current) => ({
      ...current,
      [language]: { ...current[language], [key]: value },
    }));
    setMessage("");
    setError("");
  };

  const save = async () => {
    if (saving || !changed) return { succeeded: 0 };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await adminRequest("/admin/api/settings", {
        method: "PATCH",
        body: { siteCopy: draft },
        timeoutMs: 30_000,
      });
      const next = normalizeSiteCopy(response.siteCopy);
      setSaved(next);
      setDraft(cloneCopy(next));
      setMessage("網站文字已儲存，重新整理前台後即可看到更新。");
      return { succeeded: 1 };
    } catch (saveError) {
      if (saveError?.status === 401) window.location.replace("/Memories/");
      setError(adminErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  useAdminSaveSection("website-copy", {
    pendingCount: changed ? 1 : 0,
    save,
  });

  if (loading) {
    return <p className="admin-feature-status">正在讀取網站文字…</p>;
  }

  return (
    <section
      className="website-copy-settings general-setting-card"
      aria-labelledby="website-copy-title"
    >
      <div className="website-copy-heading">
        <div>
          <p className="admin-kicker">WEBSITE COPY</p>
          <h2 id="website-copy-title">網站文字</h2>
          <p>
            編輯公開照片牆的中英文文字。主標題支援換行，輸入幾行就會在前台顯示幾行。
          </p>
        </div>
        <div className="website-copy-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setDraft(cloneCopy(DEFAULT_SITE_COPY));
              setMessage("");
              setError("");
            }}
            disabled={saving}
          >
            套用預設文字
          </button>
        </div>
      </div>

      <div className="website-title-preview" aria-label="主標題預覽">
        <small>主標題預覽</small>
        <strong>{draft.zh.archive || "（空白）"}</strong>
      </div>

      {SITE_COPY_GROUPS.map((group, groupIndex) => (
        <details className="website-copy-group" key={group.id} open={groupIndex === 0}>
          <summary>{group.label}</summary>
          <div className="website-copy-language-grid">
            {[
              ["zh", "中文"],
              ["en", "English"],
            ].map(([language, label]) => (
              <fieldset key={language}>
                <legend>{label}</legend>
                {group.fields.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    {field.multiline ? (
                      <textarea
                        value={draft[language][field.key]}
                        onChange={(event) =>
                          update(language, field.key, event.target.value)
                        }
                        rows={field.key === "archive" ? 3 : 4}
                        maxLength={field.maxLength}
                        disabled={saving}
                      />
                    ) : (
                      <input
                        value={draft[language][field.key]}
                        onChange={(event) =>
                          update(language, field.key, event.target.value)
                        }
                        maxLength={field.maxLength}
                        disabled={saving}
                      />
                    )}
                    {field.help && <small>{field.help}</small>}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </details>
      ))}

      <p className="admin-draft-hint">
        {changed ? "網站文字有未儲存變更。" : "變更會由頁面底部統一儲存。"}
      </p>

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
