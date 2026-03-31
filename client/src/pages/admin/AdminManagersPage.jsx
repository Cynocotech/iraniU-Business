import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPatchUrl } from "../../api.js";

export default function AdminManagersPage() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [rowPw, setRowPw] = useState({});
  const [rowTwilio, setRowTwilio] = useState({});
  const [twilioModuleEnabled, setTwilioModuleEnabled] = useState(true);

  const load = () => {
    apiGet("/api/managers").then(setRows).catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    apiGet("/api/admin/twilio-module")
      .then((d) => {
        if (d && typeof d.enabled === "boolean") setTwilioModuleEnabled(d.enabled);
      })
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await apiPost("/api/managers", { email, name, phone, password });
      setEmail("");
      setName("");
      setPhone("");
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

  const saveRowTwilio = async (id) => {
    if (!twilioModuleEnabled) {
      setMsg("ماژول Twilio غیرفعال است؛ ابتدا از امنیت و ۲FA آن را فعال کنید.");
      return;
    }
    const row = rowTwilio[id] || {};
    setMsg(null);
    try {
      const payload = {
        twilio_account_sid: row.twilio_account_sid || "",
        twilio_phone_number: row.twilio_phone_number || "",
      };
      if ((row.twilio_auth_token || "").trim()) payload.twilio_auth_token = row.twilio_auth_token.trim();
      const data = await apiPatchUrl(`/api/admin/managers/${id}/twilio-settings`, payload);
      setRowTwilio((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          twilio_account_sid: data.twilio_account_sid || "",
          twilio_phone_number: data.twilio_phone_number || "",
          twilio_auth_token: "",
          twilio_auth_token_set: !!data.twilio_auth_token_set,
          twilio_auth_token_masked: data.twilio_auth_token_masked || "",
        },
      }));
      setMsg(`تنظیمات Twilio مدیر ${id} ذخیره شد.`);
    } catch (err) {
      setMsg(err.message || String(err));
    }
  };

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
        {" · "}
        <Link to="/admin-link">لینک آگهی به مدیر</Link>
      </p>
      <section className="dashboard-panel">
        <h2>حساب‌های مدیر</h2>
        {!twilioModuleEnabled ? (
          <p className="field-hint" style={{ color: "#5d4037" }}>
            ماژول Twilio غیرفعال است — ستون Twilio فقط خواندنی است. برای ذخیره از{" "}
            <Link to="/admin-settings?tab=security">تنظیمات</Link> بخش «ماژول Twilio» را فعال کنید.
          </p>
        ) : null}
        <p className="field-hint">
          برای هر مدیر یک ایمیل و رمز (حداقل ۸ کاراکتر) تعریف کنید. مدیر از صفحهٔ{" "}
          <Link to="/login">ورود مدیر</Link> وارد پنل می‌شود. می‌توانید Google Authenticator را از API تنظیم کنید (۲FA).
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
              <input id="mgr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
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
                <th>رمز / ۲FA</th>
                <th>تلفن</th>
                <th>Twilio</th>
                <th>تاریخ ثبت</th>
                <th>آگهی‌های وابسته</th>
                <th>پنل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr">{r.id}</td>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.email}</td>
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
                  <td style={{ minWidth: "14rem", fontSize: "0.85rem" }}>
                    <div className="field" style={{ marginBottom: "0.35rem" }}>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Account SID"
                        disabled={!twilioModuleEnabled}
                        value={rowTwilio[r.id]?.twilio_account_sid ?? r.twilio_account_sid ?? ""}
                        onChange={(e) =>
                          setRowTwilio((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...prev[r.id],
                              twilio_account_sid: e.target.value,
                              twilio_phone_number: prev[r.id]?.twilio_phone_number ?? r.twilio_phone_number ?? "",
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="field" style={{ marginBottom: "0.35rem" }}>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Twilio Number"
                        disabled={!twilioModuleEnabled}
                        value={rowTwilio[r.id]?.twilio_phone_number ?? r.twilio_phone_number ?? ""}
                        onChange={(e) =>
                          setRowTwilio((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...prev[r.id],
                              twilio_phone_number: e.target.value,
                              twilio_account_sid: prev[r.id]?.twilio_account_sid ?? r.twilio_account_sid ?? "",
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <input
                        type="password"
                        dir="ltr"
                        disabled={!twilioModuleEnabled}
                        placeholder={
                          rowTwilio[r.id]?.twilio_auth_token_set || r.twilio_auth_token_set
                            ? `Token: ${rowTwilio[r.id]?.twilio_auth_token_masked || r.twilio_auth_token_masked || "••••"}`
                            : "Twilio Auth Token"
                        }
                        value={rowTwilio[r.id]?.twilio_auth_token || ""}
                        onChange={(e) =>
                          setRowTwilio((prev) => ({
                            ...prev,
                            [r.id]: { ...prev[r.id], twilio_auth_token: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={!twilioModuleEnabled}
                      onClick={() => saveRowTwilio(r.id)}
                    >
                      ذخیره Twilio
                    </button>
                  </td>
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
                              ({b.slug})
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
