import { useEffect, useRef, useState } from "react";

document.documentElement.dataset.memoriesPrimaryNav = "hidden";

const PROCESSES_UPDATED_EVENT = "memories:processes-updated";
const ADMIN_TITLE_SELECTOR = ".archive-header h1";

async function api(path, { token, method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.code = payload.code;
    throw error;
  }
  return payload;
}

function applyNavigationVisibility(visible) {
  document.documentElement.dataset.memoriesPrimaryNav = visible
    ? "visible"
    : "hidden";
}

function publishProcesses(processes) {
  window.dispatchEvent(
    new CustomEvent(PROCESSES_UPDATED_EVENT, {
      detail: { processes: Array.isArray(processes) ? processes : [] },
    }),
  );
}

export default function ProcessSyncAdmin() {
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState("");
  const [processes, setProcesses] = useState([]);
  const [primaryNavigationVisible, setPrimaryNavigationVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const tapsRef = useRef([]);
  const passwordRef = useRef(null);

  const loadPublicSettings = async () => {
    const payload = await api("/Memories/api/settings");
    const visible = payload.primaryNavigationVisible === true;
    setPrimaryNavigationVisible(visible);
    applyNavigationVisibility(visible);
    return visible;
  };

  const refresh = async () => {
    const [processPayload, settingsPayload] = await Promise.all([
      api("/Memories/api/processes"),
      api("/Memories/api/settings"),
    ]);
    const nextProcesses = processPayload.processes || [];
    setProcesses(nextProcesses);
    publishProcesses(nextProcesses);
    const visible = settingsPayload.primaryNavigationVisible === true;
    setPrimaryNavigationVisible(visible);
    applyNavigationVisibility(visible);
  };

  useEffect(() => {
    void loadPublicSettings().catch(() => {
      applyNavigationVisibility(false);
    });
  }, []);

  useEffect(() => {
    const labelCurrentTitle = () => {
      const title = document.querySelector(ADMIN_TITLE_SELECTOR);
      if (!title) return;
      title.setAttribute(
        "aria-label",
        `${title.textContent || "Wedding archive"}. Administrator access is hidden.`,
      );
    };

    const onDocumentClick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(ADMIN_TITLE_SELECTOR)) return;

      const now = Date.now();
      tapsRef.current = [
        ...tapsRef.current.filter((time) => now - time < 3500),
        now,
      ];
      if (tapsRef.current.length < 5) return;

      tapsRef.current = [];
      setMessage("");
      setAuthenticated(false);
      setToken("");
      setOpen(true);
      requestAnimationFrame(() => passwordRef.current?.focus());
    };

    labelCurrentTitle();
    document.addEventListener("click", onDocumentClick);
    const observer = new MutationObserver(labelCurrentTitle);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", onDocumentClick);
      observer.disconnect();
    };
  }, []);

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
      sessionStorage.setItem("memories-admin-token", token);
      setAuthenticated(true);
      await refresh();
    } catch {
      sessionStorage.removeItem("memories-admin-token");
      setMessage("管理密碼錯誤");
      setAuthenticated(false);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    setAuthenticated(false);
    setToken("");
    setMessage("");
  };

  const signOut = () => {
    sessionStorage.removeItem("memories-admin-token");
    close();
  };

  const sync = () =>
    run(
      () => api("/Memories/api/admin/processes/sync", { token, method: "POST" }),
      "已從 Google Drive 同步流程與照片分類。",
    );

  const add = () => {
    const labelZh = window.prompt("新增流程名稱");
    if (!labelZh?.trim()) return;
    void run(
      () =>
        api("/Memories/api/admin/processes", {
          token,
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
          token,
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
          token,
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
          token,
          method: "PATCH",
          body: { primaryNavigationVisible: visible },
        });
        applyNavigationVisibility(payload.primaryNavigationVisible === true);
      },
      visible ? "功能導覽列已對訪客顯示。" : "功能導覽列已對訪客隱藏。",
    );

  const openUpload = () => {
    const uploadButton = document.querySelectorAll(".primary-nav .nav-card")[2];
    uploadButton?.click();
  };

  return (
    <>
      <button
        type="button"
        className="floating-upload-button"
        onClick={openUpload}
        aria-label="上傳婚禮照片"
      >
        <span aria-hidden="true">＋</span>
        <strong>上傳照片</strong>
      </button>

      {open && !authenticated && (
        <div className="admin-gate-backdrop" role="presentation">
          <form className="admin-gate" onSubmit={login}>
            <button
              type="button"
              className="admin-gate-close"
              onClick={close}
              aria-label="關閉"
            >
              ×
            </button>
            <p className="eyebrow">ARCHIVE ADMIN</p>
            <h2>管理員登入</h2>
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
            {message && <p role="alert" className="process-sync-message">{message}</p>}
            <button type="submit" disabled={busy || !token}>
              {busy ? "驗證中…" : "進入管理"}
            </button>
          </form>
        </div>
      )}

      {open && authenticated && (
        <aside className="process-sync-admin" aria-label="Google Drive 流程同步管理">
          <div className="process-sync-heading">
            <div>
              <p className="eyebrow">ARCHIVE DESK</p>
              <h2>相簿管理</h2>
            </div>
            <button type="button" className="process-sync-close" onClick={close}>
              關閉
            </button>
          </div>

          <section className="admin-setting-card">
            <div>
              <strong>顯示功能導覽列</strong>
              <p>控制「相簿分類、人物、上傳、找找我」整組是否對一般訪客顯示。</p>
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

          <div className="process-sync-actions">
            <button type="button" disabled={busy} onClick={sync}>立即同步 Drive</button>
            <button type="button" disabled={busy} onClick={add}>新增流程</button>
          </div>
          <p className="process-sync-source-note">
            Google Drive 流程資料夾是唯一來源；此處的建立、改名與排序會先寫入 Drive，再更新網站與訪客上傳選項。
          </p>
          <ol>
            {processes.map((process, index) => (
              <li key={process.id}>
                <span>{String(process.displayOrder).padStart(2, "0")} {process.labelZh}</span>
                <div>
                  <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button>
                  <button type="button" disabled={busy || index === processes.length - 1} onClick={() => move(index, 1)}>↓</button>
                  <button type="button" disabled={busy} onClick={() => rename(process)}>改名</button>
                </div>
              </li>
            ))}
          </ol>
          {message && <p role="status" className="process-sync-message">{message}</p>}
          <button type="button" className="process-sync-signout" onClick={signOut}>
            登出管理員
          </button>
        </aside>
      )}
    </>
  );
}
