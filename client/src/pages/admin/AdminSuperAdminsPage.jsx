import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AdminSuperAdminsPage({ embedded = false }) {
  const { me } = useAuth();
  const myId = me?.user?.id;

  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [totpSetupRequired, setTotpSetupRequired] = useState(true);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet("/api/admin/super-admins")
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    if (pw.length < 8) {
      setMsg("رمز باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (pw !== password2.trim()) {
      setMsg("تکرار رمز با رمز اول یکسان نیست.");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/admin/super-admins", {
        email: em,
        name: name.trim() || undefined,
        password: pw,
        totp_setup_required: totpSetupRequired,
      });
      setEmail("");
      setName("");
      setPassword("");
      setPassword2("");
      setMsg("سوپرادمین جدید ایجاد شد.");
      load();
    } catch (err) {
      const m = String(err?.message || err);
      if (m.includes("409") || m.includes("email_taken")) setMsg("این ایمیل قبلاً ثبت شده است.");
      else setMsg(m);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("این حساب سوپرادمین برای همیشه حذف شود؟")) return;
    setMsg(null);
    try {
      await apiDelete(`/api/admin/super-admins/${id}`);
      setMsg("حساب حذف شد.");
      load();
    } catch (err) {
      setMsg(err.message || String(err));
    }
  };

  const total = rows.length;
  const canDeleteAny = total > 1;

  return (
    <>
      {!embedded ? (
        <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
          <Link to="/admin">← داشبورد</Link>
        </p>
      ) : null}

      <section className="dashboard-panel">
        <h2>ایجاد سوپرادمین جدید</h2>
        <p className="field-hint">
          حساب‌هایی که اینجا می‌سازید همان ورود از <Link to="/admin/login">/admin/login</Link> را دارند و به همین پنل
          دسترسی دارند. رمز را فقط از کانال امن بفرستید.
        </p>
        <form onSubmit={submit} className="form-grid" style={{ maxWidth: "28rem", marginTop: "1rem" }}>
          <div className="field field--block">
            <label htmlFor="sa-email">ایمیل</label>
            <input
              id="sa-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="sa-name">نام نمایشی (اختیاری)</label>
            <input id="sa-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field field--block">
            <label htmlFor="sa-pw">رمز عبور (حداقل ۸ کاراکتر)</label>
            <input
              id="sa-pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="sa-pw2">تکرار رمز</label>
            <input
              id="sa-pw2"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <div className="field field--block">
            <label>
              <input
                type="checkbox"
                checked={totpSetupRequired}
                onChange={(e) => setTotpSetupRequired(e.target.checked)}
              />{" "}
              الزام به راه‌اندازی ۲FA پس از اولین ورود (توصیه می‌شود)
            </label>
          </div>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "در حال ایجاد…" : "ایجاد سوپرادمین"}
          </button>
        </form>
        {msg ? (
          <p className="field-hint" style={{ marginTop: "1rem", color: msg.includes("ایجاد") || msg.includes("حذف") ? "var(--color-success, #2e7d32)" : "#b71c1c" }}>
            {msg}
          </p>
        ) : null}
      </section>

      <section className="dashboard-panel" style={{ marginTop: "1.5rem" }}>
        <h2>سوپرادمین‌های فعلی</h2>
        <p className="field-hint">حذف حساب خودتان یا آخرین سوپرادمین ممکن نیست.</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>شناسه</th>
                <th>ایمیل</th>
                <th>نام</th>
                <th>۲FA</th>
                <th>تاریخ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelf = myId != null && Number(r.id) === Number(myId);
                const showDelete = canDeleteAny && !isSelf;
                return (
                  <tr key={r.id}>
                    <td dir="ltr">{r.id}</td>
                    <td dir="ltr">{r.email}</td>
                    <td>{r.name || "—"}</td>
                    <td>
                      {r.totp_enabled ? "فعال" : r.totp_setup_required ? "باید فعال شود" : "خاموش"}
                    </td>
                    <td dir="ltr" style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                      {r.created_at || "—"}
                    </td>
                    <td>
                      {isSelf ? (
                        <span className="field-hint">شما</span>
                      ) : showDelete ? (
                        <button type="button" className="btn btn--ghost" onClick={() => remove(r.id)}>
                          حذف
                        </button>
                      ) : (
                        <span className="field-hint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
