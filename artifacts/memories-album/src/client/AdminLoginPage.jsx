import { useEffect, useState } from "react";
import { adminErrorMessage, loginAdministrator } from "./admin-client.mjs";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.documentElement.lang = "zh-Hant";
    document.title = "管理員登入｜詠葉婚禮照片檔案館";
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await loginAdministrator(password);
    } catch (error) {
      setMessage(adminErrorMessage(error));
      setBusy(false);
    }
  };

  return (
    <main className="admin-auth-shell">
      <section className="admin-auth-card" aria-labelledby="admin-login-title">
        <p className="admin-kicker">WEDDING ARCHIVE</p>
        <h1 id="admin-login-title">管理員登入</h1>
        <p>輸入 Replit Secrets 中設定的 SECRET_TOKEN。</p>
        <form onSubmit={submit}>
          <label htmlFor="admin-password">管理密碼</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            required
            autoFocus
          />
          {message && (
            <p className="admin-form-error" role="alert">
              {message}
            </p>
          )}
          <button type="submit" disabled={busy || !password}>
            {busy ? "驗證中…" : "登入管理後台"}
          </button>
        </form>
        <a href="/Memories/">返回婚禮相簿</a>
      </section>
    </main>
  );
}
