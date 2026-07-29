import { useEffect, useRef, useState } from "react";
import { adminApi as api, adminLoginMessage } from "./admin-api.mjs";
import { useMemoriesState } from "./MemoriesState.jsx";
import { useAccessibleDialog } from "./useAccessibleDialog.js";

export default function ProcessSyncAdmin() {
  const {
    adminAuthenticated: authenticated,
    adminOpen: open,
    albumOpen,
    markPhotosChanged,
    photoRevision,
    primaryNavigationVisible,
    processes,
    setAdminAuthenticated,
    setAdminOpen,
    setAlbumOpen,
    setPrimaryNavigationVisible,
    setServerProcesses,
  } = useMemoriesState();
  const [token, setToken] = useState("");
  const [batches, setBatches] = useState([]);
  const [trash, setTrash] = useState([]);
  const [replacementLink, setReplacementLink] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);
  const gateRef = useRef(null);
  const panelRef = useRef(null);
  const panelCloseRef = useRef(null);

  const refresh = async () => {
    const [processPayload, settingsPayload, batchPayload, trashPayload] =
      await Promise.all([
        api("/Memories/api/processes"),
        api("/Memories/api/settings"),
        api("/Memories/api/admin/upload-batches"),
        api("/Memories/api/admin/trash"),
      ]);
    const nextProcesses = processPayload.processes || [];
    setServerProcesses(nextProcesses);
    const visible = settingsPayload.primaryNavigationVisible === true;
    setPrimaryNavigationVisible(visible);
    setAlbumOpen(settingsPayload.albumOpen !== false);
    setBatches(batchPayload.batches || []);
    setTrash(trashPayload.photos || []);
  };

  useEffect(() => {
    if (open && authenticated) void refresh();
  }, [photoRevision, open, authenticated]);

  const run = async (work, success) => {
    setBusy(true);
    setMessage("");
    try {
      await work();
      await refresh();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  };

  const login = async (event) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      await api("/Memories/api/admin/session", { token, method: "POST" });
      setToken("");
      setAdminAuthenticated(true);
      await refresh();
    } catch (error) {
      setMessage(adminLoginMessage(error));
      setAdminAuthenticated(false);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setAdminOpen(false);
    setToken("");
    setMessage("");
    setReplacementLink("");
  };

  const signOut = () =>
    void api("/Memories/api/admin/session", { method: "DELETE" }).finally(
      () => {
        setAdminAuthenticated(false);
        close();
      },
    );

  useAccessibleDialog({
    containerRef: gateRef,
    initialFocusRef: passwordRef,
    onClose: close,
    enabled: open && !authenticated,
  });
  useAccessibleDialog({
    containerRef: panelRef,
    initialFocusRef: panelCloseRef,
    onClose: close,
    enabled: open && authenticated,
  });

  const sync = () =>
    run(
      () => api("/Memories/api/admin/processes/sync", { method: "POST" }),
      "已從 Google Drive 同步流程與照片分類。",
    );
  const reload = () => run(async () => {}, "已重新讀取目前的相簿管理資料。");

  const add = () => {
    const labelZh = window.prompt("新增流程名稱");
    if (!labelZh?.trim()) return;
    void run(
      () =>
        api("/Memories/api/admin/processes", {
          method: "POST",
          body: { labelZh: labelZh.trim() },
        }),
      "已在 Google Drive 建立流程，網站與上傳選項已更新。",
    );
  };

  const rename = (process) => {
    const labelZh = window.prompt("新的流程名稱", process.labelZh);
    if (!labelZh?.trim()) return;
    void run(
      () =>
        api(`/Memories/api/admin/processes/${encodeURIComponent(process.id)}`, {
          method: "PATCH",
          body: { labelZh: labelZh.trim() },
        }),
      "Google Drive 資料夾已改名，網站與上傳選項已更新。",
    );
  };

  const move = (index, delta) => {
    const next = [...processes];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(
      () =>
        api("/Memories/api/admin/processes/order", {
          method: "PUT",
          body: { processIds: next.map((item) => item.id) },
        }),
      "Google Drive 資料夾編號已重新排序，網站與上傳選項已更新。",
    );
  };

  const togglePrimaryNavigation = (visible) =>
    run(
      async () => {
        const payload = await api("/Memories/api/admin/settings", {
          method: "PATCH",
          body: { primaryNavigationVisible: visible },
        });
        setPrimaryNavigationVisible(payload.primaryNavigationVisible === true);
      },
      visible ? "功能導覽列已對訪客顯示。" : "功能導覽列已對訪客隱藏。",
    );

  const toggleAlbum = (openForGuests) =>
    run(
      async () => {
        const payload = await api("/Memories/api/admin/settings", {
          method: "PATCH",
          body: { albumOpen: openForGuests },
        });
        setAlbumOpen(payload.albumOpen !== false);
      },
      openForGuests
        ? "Memories 已重新對訪客開放。"
        : "Memories 已關閉；管理員仍可檢視與整理。",
    );

  const revokeBatch = (batch) => {
    if (!window.confirm(`撤銷 ${batch.uploaderName || "訪客"} 的私人連結？`)) {
      return;
    }
    void run(
      () =>
        api(
          `/Memories/api/admin/upload-batches/${encodeURIComponent(batch.id)}/revoke`,
          { method: "POST" },
        ),
      "私人連結已撤銷。",
    );
  };

  const regenerateBatchLink = (batch) => {
    if (!window.confirm("建立新連結後，舊連結會立即失效。確定繼續？")) {
      return;
    }
    setBusy(true);
    setMessage("");
    void api(
      `/Memories/api/admin/upload-batches/${encodeURIComponent(batch.id)}/management-token`,
      { method: "POST" },
    )
      .then(async (payload) => {
        setReplacementLink(
          new URL(payload.manageUrl, window.location.origin).href,
        );
        await refresh();
        setMessage("新的私人連結已建立，請立即交給正確的訪客。");
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "建立連結失敗");
      })
      .finally(() => setBusy(false));
  };

  const restorePhoto = (photo) =>
    run(async () => {
      await api(
        `/Memories/api/admin/photos/${encodeURIComponent(photo.id)}/restore`,
        { method: "POST" },
      );
      markPhotosChanged();
    }, "照片已還原到相簿。");

  const deleteProcess = (process) => {
    if (
      !window.confirm(`確定刪除「${process.labelZh}」？只有空的分類可以刪除。`)
    ) {
      return;
    }
    void run(
      () =>
        api(`/Memories/api/admin/processes/${encodeURIComponent(process.id)}`, {
          method: "DELETE",
        }),
      "分類已刪除，網站與 Google Drive 已同步。",
    );
  };

  return (
    <>
      {open && !authenticated && (
        <div
          className="admin-gate-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && close()
          }
        >
          <form
            ref={gateRef}
            className="admin-gate"
            onSubmit={login}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-gate-title"
            tabIndex="-1"
          >
            <button
              type="button"
              className="admin-gate-close"
              onClick={close}
              aria-label="關閉"
            >
              ×
            </button>
            <p className="eyebrow">ARCHIVE ADMIN</p>
            <h2 id="admin-gate-title">管理員登入</h2>
            <label>
              管理密碼
              <input
                ref={passwordRef}
                type="password"
                autoComplete="current-password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="請輸入管理密碼"
                required
              />
            </label>
            {message && (
              <p role="alert" className="process-sync-message">
                {message}
              </p>
            )}
            <button type="submit" disabled={busy || !token}>
              {busy ? "驗證中…" : "進入管理"}
            </button>
          </form>
        </div>
      )}

      {open && authenticated && (
        <aside
          ref={panelRef}
          className="process-sync-admin"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-panel-title"
          tabIndex="-1"
        >
          <div className="process-sync-heading">
            <div>
              <p className="eyebrow">ARCHIVE DESK</p>
              <h2 id="admin-panel-title">相簿管理</h2>
            </div>
            <button
              ref={panelCloseRef}
              type="button"
              className="process-sync-close"
              onClick={close}
            >
              關閉
            </button>
          </div>

          <section className="admin-setting-card">
            <div>
              <strong>顯示功能導覽列</strong>
              <p>
                控制「相簿分類、人物、上傳、找找我」整組是否對一般訪客顯示。
              </p>
            </div>
            <label className="switch-control">
              <input
                type="checkbox"
                checked={primaryNavigationVisible}
                disabled={busy}
                onChange={(event) =>
                  void togglePrimaryNavigation(event.target.checked)
                }
              />
              <span>{primaryNavigationVisible ? "顯示" : "隱藏"}</span>
            </label>
          </section>

          <section className="admin-setting-card">
            <div>
              <strong>對訪客開放 Memories</strong>
              <p>
                關閉後會停止一般瀏覽、上傳與私人批次管理；原邀請網站不受影響，管理員仍可整理。
              </p>
            </div>
            <label className="switch-control">
              <input
                type="checkbox"
                checked={albumOpen}
                disabled={busy}
                onChange={(event) => void toggleAlbum(event.target.checked)}
              />
              <span>{albumOpen ? "開放" : "關閉"}</span>
            </label>
          </section>

          <div className="process-sync-actions">
            <button type="button" disabled={busy} onClick={reload}>
              重新讀取分類
            </button>
            <button type="button" disabled={busy} onClick={sync}>
              立即同步 Drive
            </button>
            <button type="button" disabled={busy} onClick={add}>
              新增流程
            </button>
          </div>
          <p className="process-sync-source-note">
            Google Drive 流程資料夾是唯一來源；此處的建立、改名與排序會先寫入
            Drive，再更新網站與訪客上傳選項。
          </p>
          <ol>
            {processes.map((process, index) => (
              <li key={process.id}>
                <span>
                  {String(process.displayOrder).padStart(2, "0")}{" "}
                  {process.labelZh}
                </span>
                <div>
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === processes.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => rename(process)}
                  >
                    改名
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => deleteProcess(process)}
                    aria-label={`刪除分類 ${process.labelZh}`}
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <section className="admin-batch-section">
            <div>
              <h3>訪客上傳批次</h3>
              <p>可檢查照片數、撤銷舊連結，或建立只能顯示一次的新連結。</p>
            </div>
            {replacementLink && (
              <label className="admin-replacement-link">
                新的私人連結
                <input
                  readOnly
                  value={replacementLink}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
            )}
            <ul>
              {batches.map((batch) => (
                <li key={batch.id}>
                  <div>
                    <strong>{batch.uploaderName || "未命名訪客"}</strong>
                    <small>
                      {batch.status} · {batch.visiblePhotoCount ?? 0}/
                      {batch.photoCount ?? 0} 張可見
                      {Object.keys(batch.uploadStatusCounts || {}).length > 0
                        ? ` · ${Object.entries(batch.uploadStatusCounts)
                            .map(([status, count]) => `${status} ${count}`)
                            .join(" / ")}`
                        : ""}
                    </small>
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={busy || batch.status === "revoked"}
                      onClick={() => revokeBatch(batch)}
                    >
                      撤銷連結
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => regenerateBatchLink(batch)}
                    >
                      建立新連結
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="admin-batch-section">
            <div>
              <h3>七天垃圾桶</h3>
              <p>到期前可還原；到期後背景工作才會移除 Drive 檔案與資料。</p>
            </div>
            {trash.length === 0 ? (
              <p>垃圾桶目前是空的。</p>
            ) : (
              <ul>
                {trash.map((photo) => (
                  <li key={photo.id}>
                    <div>
                      <strong>
                        {photo.originalFilename || photo.uploaderName || "照片"}
                      </strong>
                      <small>
                        可還原至{" "}
                        {new Intl.DateTimeFormat("zh-TW", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(photo.restoreUntil))}
                      </small>
                    </div>
                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => restorePhoto(photo)}
                      >
                        還原照片
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {message && (
            <p role="status" className="process-sync-message">
              {message}
            </p>
          )}
          <button
            type="button"
            className="process-sync-signout"
            onClick={signOut}
          >
            登出管理員
          </button>
        </aside>
      )}
    </>
  );
}
