import { useEffect, useState } from "react";

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
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export default function ProcessSyncAdmin() {
  const enabled = new URLSearchParams(window.location.search).get("admin") === "1";
  const [token, setToken] = useState(() => sessionStorage.getItem("memories-admin-token") || "");
  const [processes, setProcesses] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const payload = await api("/Memories/api/processes");
    setProcesses(payload.processes || []);
  };

  useEffect(() => {
    if (!enabled) return;
    void refresh().catch((error) => setMessage(error.message));
  }, [enabled]);

  if (!enabled) return null;

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

  const rememberToken = (value) => {
    setToken(value);
    if (value) sessionStorage.setItem("memories-admin-token", value);
    else sessionStorage.removeItem("memories-admin-token");
  };

  const sync = () => run(
    () => api("/Memories/api/admin/processes/sync", { token, method: "POST" }),
    "已從 Google Drive 同步流程與照片分類。",
  );

  const add = () => {
    const labelZh = window.prompt("新增流程名稱");
    if (!labelZh?.trim()) return;
    void run(
      () => api("/Memories/api/admin/processes", {
        token,
        method: "POST",
        body: { labelZh: labelZh.trim() },
      }),
      "已在網站與 Google Drive 建立流程。",
    );
  };

  const rename = (process) => {
    const labelZh = window.prompt("新的流程名稱", process.labelZh);
    if (!labelZh?.trim()) return;
    void run(
      () => api(`/Memories/api/admin/processes/${encodeURIComponent(process.id)}`, {
        token,
        method: "PATCH",
        body: { labelZh: labelZh.trim() },
      }),
      "網站與 Google Drive 資料夾已同步改名。",
    );
  };

  const move = (index, delta) => {
    const next = [...processes];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(
      () => api("/Memories/api/admin/processes/order", {
        token,
        method: "PUT",
        body: { processIds: next.map((item) => item.id) },
      }),
      "網站順序與 Google Drive 資料夾編號已同步。",
    );
  };

  return (
    <aside className="process-sync-admin" aria-label="Google Drive 流程同步管理">
      <h2>流程與 Google Drive 同步</h2>
      <p>此管理面板只在網址加入 <code>?admin=1</code> 時顯示。管理密碼只保存在目前瀏覽器分頁。</p>
      <label>
        管理密碼
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => rememberToken(event.target.value)}
          placeholder="MEMORIES_ADMIN_TOKEN"
        />
      </label>
      <div className="process-sync-actions">
        <button type="button" disabled={busy || !token} onClick={sync}>立即同步 Drive</button>
        <button type="button" disabled={busy || !token} onClick={add}>新增流程</button>
      </div>
      <ol>
        {processes.map((process, index) => (
          <li key={process.id}>
            <span>{String(process.displayOrder).padStart(2, "0")} {process.labelZh}</span>
            <div>
              <button type="button" disabled={busy || !token || index === 0} onClick={() => move(index, -1)}>↑</button>
              <button type="button" disabled={busy || !token || index === processes.length - 1} onClick={() => move(index, 1)}>↓</button>
              <button type="button" disabled={busy || !token} onClick={() => rename(process)}>改名</button>
            </div>
          </li>
        ))}
      </ol>
      {message && <p role="status" className="process-sync-message">{message}</p>}
      <button type="button" className="process-sync-close" onClick={() => window.location.assign("/Memories/")}>離開管理面板</button>
    </aside>
  );
}
