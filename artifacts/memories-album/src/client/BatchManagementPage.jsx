import { useEffect, useMemo, useState } from "react";
import {
  fetchPrivateBatch,
  parsePrivateBatchLocation,
  rotatePrivateLink,
  withdrawPrivatePhoto,
} from "./batch-management-client.mjs";

const COPY = {
  zh: {
    eyebrow: "私人照片管理",
    title: "管理你上傳的回憶",
    loading: "正在安全開啟你的照片…",
    invalidTitle: "這個私人連結無法使用",
    invalidBody:
      "連結可能不完整、已更新，或相簿目前暫停開放。請使用你上傳完成時保存的完整網址。",
    warning:
      "請妥善保存這個網址；任何取得連結的人都能管理這一批照片。相簿關閉或連結更新後，舊連結可能失效。",
    uploader: "上傳者",
    empty: "這一批目前沒有可管理的照片。",
    withdraw: "撤回照片",
    withdrawing: "正在撤回…",
    withdrawConfirm:
      "要撤回這張照片嗎？照片會立刻從公開相簿隱藏，管理員可在七天內復原。",
    rotate: "更新私人連結",
    rotating: "正在更新…",
    rotateConfirm: "更新後，舊連結會立刻失效。請確認你可以保存新的完整網址。",
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
      "The link may be incomplete, replaced, or temporarily unavailable while the album is closed. Use the complete URL saved after upload.",
    warning:
      "Keep this URL private. Anyone with the link can manage this batch. An old link may stop working after the album closes or the link is renewed.",
    uploader: "Uploaded by",
    empty: "This batch has no manageable photos.",
    withdraw: "Withdraw photo",
    withdrawing: "Withdrawing…",
    withdrawConfirm:
      "Withdraw this photo? It will disappear from the public album immediately and can be restored by an administrator for seven days.",
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

  const withdraw = async (photoId) => {
    if (!window.confirm(t.withdrawConfirm)) return;
    setBusyPhotoId(photoId);
    try {
      await withdrawPrivatePhoto({
        batchId: route.batchId,
        photoId,
        token,
      });
      setBatch((current) => ({
        ...current,
        photos: current.photos.filter((photo) => photo.id !== photoId),
      }));
    } catch {
      setState("invalid");
    } finally {
      setBusyPhotoId(null);
    }
  };

  const rotate = async () => {
    if (!window.confirm(t.rotateConfirm)) return;
    setRotating(true);
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

          {batch.photos.length === 0 ? (
            <section className="batch-management-state">
              <p>{t.empty}</p>
            </section>
          ) : (
            <ul className="batch-photo-grid">
              {batch.photos.map((photo) => (
                <li key={photo.id}>
                  <img
                    src={photo.thumbnailUrl}
                    alt={t.photoAlt}
                    loading="lazy"
                  />
                  <button
                    className="button danger"
                    type="button"
                    disabled={busyPhotoId === photo.id}
                    onClick={() => withdraw(photo.id)}
                  >
                    {busyPhotoId === photo.id ? t.withdrawing : t.withdraw}
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
