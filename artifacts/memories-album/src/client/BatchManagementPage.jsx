import { useEffect, useMemo, useState } from "react";
import {
  deletePrivatePhoto,
  fetchPrivateBatch,
  parsePrivateBatchLocation,
  rotatePrivateLink,
} from "./batch-management-client.mjs";
import LazyImage from "./LazyImage.jsx";

const COPY = {
  zh: {
    eyebrow: "私人照片管理",
    title: "管理你上傳的回憶",
    loading: "正在安全開啟你的照片…",
    invalidTitle: "這個私人連結無法使用",
    invalidBody:
      "連結可能不完整、已更新，或這批照片已關閉。請使用上傳完成時保存的完整網址。",
    warning:
      "請妥善保存這個網址；任何取得連結的人都能管理這一批照片。更新私人連結後，舊網址會立即失效。",
    uploader: "上傳者",
    empty: "這一批目前沒有可管理的照片。",
    delete: "永久刪除照片",
    deleting: "正在永久刪除…",
    deleteConfirm:
      "確定要永久刪除這張照片嗎？原始照片、縮圖及網站資料都會刪除，無法復原。",
    deleteFailed: "照片刪除失敗，尚未從清單移除。請稍後再試。",
    rotate: "更新私人連結",
    rotating: "正在更新…",
    rotateConfirm:
      "更新後，舊連結會立即失效。請確認你可以保存新的完整網址。",
    newLink: "新的私人連結已啟用，請立即保存：",
    copy: "複製連結",
    copied: "已複製",
    back: "返回婚禮相簿",
    photoAlt: "你上傳的婚禮照片",
  },
  en: {
    eyebrow: "PRIVATE PHOTO MANAGEMENT",
    title: "Manage your uploaded memories",
    loading: "Opening your photos securely…",
    invalidTitle: "This private link cannot be used",
    invalidBody:
      "The link may be incomplete, replaced, or this batch may be closed. Use the complete URL saved after upload.",
    warning:
      "Keep this URL private. Anyone with the link can manage this batch. The old URL stops working immediately after the link is renewed.",
    uploader: "Uploaded by",
    empty: "This batch has no manageable photos.",
    delete: "Permanently delete photo",
    deleting: "Deleting permanently…",
    deleteConfirm:
      "Permanently delete this photo? The original, thumbnail, and website records will be removed and cannot be recovered.",
    deleteFailed: "The photo could not be deleted and remains listed. Please try again.",
    rotate: "Renew private link",
    rotating: "Renewing…",
    rotateConfirm:
      "The old link will stop working immediately. Make sure you can save the complete replacement URL.",
    newLink: "Your new private link is active. Save it now:",
    copy: "Copy link",
    copied: "Copied",
    back: "Back to the wedding archive",
    photoAlt: "A wedding photo you uploaded",
  },
};

export default function BatchManagementPage() {
  const route = useMemo(
    () =>
      parsePrivateBatchLocation(window.location.pathname, window.location.hash),
    [],
  );
  const [lang, setLang] = useState(() =>
    localStorage.getItem("memories-language") === "en" ? "en" : "zh",
  );
  const [token, setToken] = useState(route?.token ?? null);
  const [batch, setBatch] = useState(null);
  const [state, setState] = useState(route?.token ? "loading" : "invalid");
  const [busyPhotoId, setBusyPhotoId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [rotating, setRotating] = useState(false);
  const [replacementUrl, setReplacementUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const t = COPY[lang];

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    document.title =
      lang === "zh" ? "管理你上傳的回憶" : "Manage your uploaded memories";
  }, [lang]);

  useEffect(() => {
    if (!route?.batchId || !token) return undefined;
    const controller = new AbortController();
    setState("loading");
    fetchPrivateBatch({
      batchId: route.batchId,
      token,
      fetchImpl: (url, options) =>
        fetch(url, { ...options, signal: controller.signal }),
    })
      .then((payload) => {
        setBatch(payload.batch);
        setState("ready");
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setState("invalid");
      });
    return () => controller.abort();
  }, [route?.batchId, token]);

  const switchLanguage = () => {
    const next = lang === "zh" ? "en" : "zh";
    setLang(next);
    localStorage.setItem("memories-language", next);
  };

  const deletePhoto = async (photoId) => {
    if (!window.confirm(t.deleteConfirm)) return;
    setBusyPhotoId(photoId);
    setActionError("");
    try {
      await deletePrivatePhoto({
        batchId: route.batchId,
        photoId,
        token,
      });
      setBatch((current) => ({
        ...current,
        photos: current.photos.filter((photo) => photo.id !== photoId),
      }));
    } catch {
      setActionError(t.deleteFailed);
    } finally {
      setBusyPhotoId(null);
    }
  };

  const rotate = async () => {
    if (!window.confirm(t.rotateConfirm)) return;
    setRotating(true);
    setActionError("");
    try {
      const payload = await rotatePrivateLink({
        batchId: route.batchId,
        token,
      });
      const nextUrl = new URL(payload.manageUrl, window.location.origin);
      const nextRoute = parsePrivateBatchLocation(
        nextUrl.pathname,
        nextUrl.hash,
      );
      if (!nextRoute?.token) throw new Error("Invalid replacement link");
      window.history.replaceState(null, "", payload.manageUrl);
      setToken(nextRoute.token);
      setReplacementUrl(window.location.href);
      setCopied(false);
    } catch {
      setState("invalid");
    } finally {
      setRotating(false);
    }
  };

  const copyReplacement = async () => {
    await navigator.clipboard.writeText(replacementUrl);
    setCopied(true);
  };

  return (
    <main className="batch-management-page">
      <header className="batch-management-header">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
        </div>
        <button className="quiet-button" type="button" onClick={switchLanguage}>
          {lang === "zh" ? "English" : "中文"}
        </button>
      </header>

      <p className="batch-private-warning">{t.warning}</p>

      {state === "loading" && (
        <section className="batch-management-state" aria-live="polite">
          <span aria-hidden="true">◌</span>
          <p>{t.loading}</p>
        </section>
      )}

      {state === "invalid" && (
        <section className="batch-management-state" role="alert">
          <span aria-hidden="true">!</span>
          <h2>{t.invalidTitle}</h2>
          <p>{t.invalidBody}</p>
        </section>
      )}

      {state === "ready" && batch && (
        <>
          <section className="batch-management-summary">
            <p>
              {t.uploader}：<strong>{batch.uploaderName}</strong>
            </p>
            <button
              className="button secondary"
              type="button"
              disabled={rotating}
              onClick={rotate}
            >
              {rotating ? t.rotating : t.rotate}
            </button>
          </section>

          {replacementUrl && (
            <section className="replacement-link" aria-live="polite">
              <label htmlFor="replacement-management-link">{t.newLink}</label>
              <input
                id="replacement-management-link"
                readOnly
                value={replacementUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                className="button primary"
                type="button"
                onClick={copyReplacement}
              >
                {copied ? t.copied : t.copy}
              </button>
            </section>
          )}

          {actionError && (
            <p className="upload-error" role="alert">
              {actionError}
            </p>
          )}

          {batch.photos.length === 0 ? (
            <section className="batch-management-state">
              <p>{t.empty}</p>
            </section>
          ) : (
            <ul className="batch-photo-grid">
              {batch.photos.map((photo) => (
                <li key={photo.id}>
                  <LazyImage
                    src={photo.thumbnailUrl}
                    alt={t.photoAlt}
                    width={photo.width}
                    height={photo.height}
                  />
                  <button
                    className="button danger"
                    type="button"
                    disabled={busyPhotoId === photo.id}
                    onClick={() => deletePhoto(photo.id)}
                  >
                    {busyPhotoId === photo.id ? t.deleting : t.delete}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <a className="batch-back-link" href="/Memories/">
        {t.back}
      </a>
    </main>
  );
}
