import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPatchUrl } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";

function isExchangeLinkedBusiness(b) {
  const s = `${String(b?.name_fa || "")} ${String(b?.slug || "")}`.toLowerCase();
  return s.includes("صراف") || s.includes("exchange");
}

export default function AdminManagersPage() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [rowPw, setRowPw] = useState({});

  const load = () => {
    apiGet("/api/managers").then(setRows).catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, []);


  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await apiPost("/api/managers", {
        email,
        name,
        phone,
        password,
        login_username: loginUsername.trim(),
      });
      setEmail("");
      setName("");
      setPhone("");
      setLoginUsername("");
      setPassword("");
      load();
      setMsg("مدیر اضافه شد.");
    } catch (err) {
      setMsg(err.message || String(err));
    }
  };

  const saveRowPassword = async (id) => {
    const p = (rowPw[id] || "").trim();
    if (p.length < 8) {
      setMsg("رمز باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    setMsg(null);
    try {
      await apiPatchUrl(`/api/admin/managers/${id}/password`, { password: p });
      setRowPw((prev) => ({ ...prev, [id]: "" }));
      load();
      setMsg(`رمز مدیر ${id} به‌روز شد.`);
    } catch (err) {
      setMsg(err.message || String(err));
    }
  };

  const nonExchangeRows = rows.filter((r) => {
    const linked = Array.isArray(r?.linked_businesses) ? r.linked_businesses : [];
    return !linked.some(isExchangeLinkedBusiness);
  });

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
        {" · "}
        <Link to="/admin-link">لینک آگهی به مدیر</Link>
      </p>
      <section className="dashboard-panel">
        <h2>حساب‌های مدیر</h2>
        <p className="field-hint">
          برای هر مدیر ایمیل، تلفن، نام کاربری (۳–۳۲ کاراکتر، a-z، ۰-۹، _) و رمز (حداقل ۸ کاراکتر) تعریف کنید. مدیر از صفحهٔ{" "}
          <Link to="/login">ورود مدیر</Link> با ایمیل یا نام کاربری وارد می‌شود. ثبت‌نام عمومی:{" "}
          <Link to="/manager-signup">ثبت‌نام مدیر</Link>. مدیران صرافی در{" "}
          <Link to="/admin/exchanges/managers">دپارتمان صرافی</Link> نمایش داده می‌شوند.
        </p>
        <form onSubmit={submit} style={{ marginBottom: "1.5rem" }}>
          <div className="form-grid">
            <div className="field field--block">
              <label htmlFor="mgr-email">ایمیل</label>
              <input
                id="mgr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                autoComplete="email"
              />
            </div>
            <div className="field field--block">
              <label htmlFor="mgr-name">نام</label>
              <input id="mgr-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field field--block">
              <label htmlFor="mgr-phone">تلفن</label>
              <input id="mgr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" required />
            </div>
            <div className="field field--block">
              <label htmlFor="mgr-login-user">نام کاربری</label>
              <input
                id="mgr-login-user"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                dir="ltr"
                autoComplete="off"
                required
                minLength={3}
                maxLength={32}
                placeholder="مثلاً admin_london"
              />
            </div>
            <div className="field field--block">
              <label htmlFor="mgr-pass">رمز عبور (حداقل ۸ کاراکتر)</label>
              <input
                id="mgr-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                dir="ltr"
              />
            </div>
          </div>
          <button type="submit" className="btn btn--primary">
            ثبت مدیر
          </button>
          {msg && <p className="field-hint">{msg}</p>}
        </form>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>شناسه</th>
                <th>نام</th>
                <th>ایمیل</th>
                <th>نام کاربری</th>
                <th>رمز / ۲FA</th>
                <th>تلفن</th>
                <th>تاریخ ثبت</th>
                <th>آگهی‌های وابسته</th>
                <th>پنل</th>
              </tr>
            </thead>
            <tbody>
              {nonExchangeRows.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr">{r.id}</td>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.email}</td>
                  <td dir="ltr">{r.login_username || "—"}</td>
                  <td style={{ fontSize: "0.85rem" }}>
                    {r.password_set ? "رمز دارد" : "بدون رمز"}
                    {r.totp_enabled ? " · ۲FA" : ""}
                    <div style={{ marginTop: "0.35rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <input
                        type="password"
                        placeholder="رمز جدید"
                        dir="ltr"
                        style={{ maxWidth: "9rem" }}
                        value={rowPw[r.id] || ""}
                        onChange={(e) => setRowPw((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      />
                      <button type="button" className="btn btn--ghost" onClick={() => saveRowPassword(r.id)}>
                        ذخیره رمز
                      </button>
                    </div>
                  </td>
                  <td dir="ltr">{r.phone || "—"}</td>
                  <td dir="ltr" style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                    {r.created_at}
                  </td>
                  <td style={{ minWidth: "12rem", maxWidth: "22rem" }}>
                    {r.linked_businesses && r.linked_businesses.length > 0 ? (
                      <ul style={{ margin: 0, paddingInlineStart: "1.1rem" }}>
                        {r.linked_businesses.map((b) => (
                          <li key={b.slug} style={{ marginBottom: "0.25rem" }}>
                            <strong>{b.name_fa}</strong>
                            <span className="field-hint" dir="ltr">
                              {" "}
                              ({formatAdId(b.id) || b.slug})
                            </span>
                            {b.status === "inactive" ? (
                              <span className="field-hint"> · غیرفعال</span>
                            ) : null}
                            {b.claimed ? (
                              <span className="field-hint"> · مالک‌دار</span>
                            ) : (
                              <span className="field-hint"> · بدون مالک</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="field-hint">هیچ آگهی وصل نیست — از «لینک آگهی» وصل کنید.</span>
                    )}
                  </td>
                  <td>
                    <Link className="btn btn--primary" to={`/dashboard?asManager=${r.id}`}>
                      ورود به پنل مدیر
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
