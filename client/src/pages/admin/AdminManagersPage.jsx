import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPatchUrl } from "../../api.js";
import { validatePasswordComplexity } from "../../lib/passwordPolicy.js";
import PasswordRequirementsList from "../../components/PasswordRequirementsList.jsx";

function isExchangeLinkedBusiness(b) {
  const s = `${b?.name_fa || ""} ${b?.slug || ""}`.toLowerCase();
  return s.includes("صراف") || s.includes("exchange");
}

function initials(name) {
  if (!name) return "م";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "linear-gradient(135deg,#6366f1,#a78bfa)",
  "linear-gradient(135deg,#10b981,#34d399)",
  "linear-gradient(135deg,#f59e0b,#fcd34d)",
  "linear-gradient(135deg,#ef4444,#f87171)",
  "linear-gradient(135deg,#3b82f6,#60a5fa)",
  "linear-gradient(135deg,#8b5cf6,#c084fc)",
];

function avatarColor(id) {
  return AVATAR_COLORS[Number(id) % AVATAR_COLORS.length];
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return String(iso).slice(0, 10); }
}

/* ── Manager detail modal ── */
function ManagerModal({ manager, onClose, onDeleted, onPasswordSaved }) {
  const [pw, setPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const overlayRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const savePassword = async () => {
    const check = validatePasswordComplexity(pw);
    if (!check.ok) { setPwMsg({ type: "err", text: check.hint }); return; }
    setSavingPw(true); setPwMsg(null);
    try {
      await apiPatchUrl(`/api/admin/managers/${manager.id}/password`, { password: pw });
      setPw("");
      setPwMsg({ type: "ok", text: "رمز با موفقیت به‌روز شد." });
      onPasswordSaved();
    } catch (e) {
      setPwMsg({ type: "err", text: e.message || String(e) });
    } finally { setSavingPw(false); }
  };

  const linked = Array.isArray(manager.linked_businesses) ? manager.linked_businesses : [];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column",
        maxHeight: "90vh", overflow: "hidden",
      }}>
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", gap: "1rem",
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid #f1f5f9",
          flexShrink: 0,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: avatarColor(manager.id),
            color: "#fff", fontWeight: 800, fontSize: "1.1rem",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {initials(manager.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>{manager.name || "—"}</p>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }} dir="ltr">{manager.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "none",
              background: "#f1f5f9", color: "#475569", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem", flexShrink: 0,
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Modal body — scrollable */}
        <div style={{ overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Detail rows */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            {[
              { icon: "fa-id-badge",    label: "شناسه",         value: `#${manager.id}`, dir: "ltr" },
              { icon: "fa-user",        label: "نام کاربری",    value: manager.login_username ? `@${manager.login_username}` : "—", dir: "ltr" },
              { icon: "fa-phone",       label: "تلفن",          value: manager.phone || "—", dir: "ltr" },
              { icon: "fa-calendar",   label: "تاریخ ثبت‌نام", value: formatDate(manager.created_at) },
              { icon: "fa-lock",        label: "رمز عبور",      value: manager.password_set ? "رمز دارد ✓" : "بدون رمز ✗" },
              { icon: "fa-shield-halved", label: "ورود دو مرحله‌ای", value: manager.totp_enabled ? "فعال ✓" : "غیرفعال" },
            ].map(({ icon, label, value, dir }) => (
              <div key={label} style={{
                background: "#f8fafc", borderRadius: 12, padding: "0.75rem 1rem",
              }}>
                <p style={{ margin: "0 0 0.2rem", fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <i className={`fa-solid ${icon}`} style={{ marginInlineEnd: "0.3rem", color: "#818cf8" }} />
                  {label}
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#0f172a" }} dir={dir || "auto"}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Linked businesses */}
          <div>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <i className="fa-solid fa-store" style={{ marginInlineEnd: "0.4rem", color: "#818cf8" }} />
              آگهی‌های وابسته
            </p>
            {linked.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {linked.map((b) => (
                  <div key={b.slug} style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    background: "#f8fafc", borderRadius: 10, padding: "0.6rem 0.85rem",
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "linear-gradient(135deg,#6366f1,#a78bfa)",
                      color: "#fff", fontSize: "0.8rem", fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {(b.name_fa || b.slug || "?")[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>{b.name_fa}</p>
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8" }} dir="ltr">{b.slug}</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      {b.status === "inactive" && <span className="pbadge pbadge--red">غیرفعال</span>}
                      {b.claimed ? <span className="pbadge pbadge--purple">مالک‌دار</span> : <span className="pbadge pbadge--yellow">بدون مالک</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#94a3b8" }}>
                هیچ آگهی وصل نیست —{" "}
                <Link to="/admin-link" onClick={onClose} style={{ color: "#6366f1" }}>لینک آگهی ↔ مدیر</Link>
              </p>
            )}
          </div>

          {/* Password change */}
          <div style={{ background: "#fafbff", borderRadius: 12, padding: "1rem" }}>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <i className="fa-solid fa-key" style={{ marginInlineEnd: "0.4rem", color: "#818cf8" }} />
              تغییر رمز عبور
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                type="password"
                placeholder="رمز جدید…"
                dir="ltr"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => { setPw(e.target.value); setPwMsg(null); }}
                style={{
                  flex: 1, minWidth: 180,
                  padding: "0.55rem 0.85rem", border: "1.5px solid #e2e8f0",
                  borderRadius: 10, fontSize: "0.88rem", fontFamily: "inherit",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#818cf8")}
                onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              />
              <button
                type="button"
                className="pact-btn pact-btn--primary"
                disabled={savingPw || !pw.trim()}
                onClick={savePassword}
              >
                {savingPw ? <i className="fa-solid fa-spinner fa-spin" /> : "ذخیره رمز"}
              </button>
            </div>
            {pw && <PasswordRequirementsList password={pw} />}
            {pwMsg && (
              <p className={`panel-form-msg ${pwMsg.type === "ok" ? "panel-form-msg--ok" : "panel-form-msg--error"}`} style={{ margin: "0.6rem 0 0" }}>
                {pwMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* Modal footer */}
        <div style={{
          padding: "1rem 1.5rem",
          borderTop: "1px solid #f1f5f9",
          display: "flex", gap: "0.75rem",
          flexShrink: 0,
        }}>
          <Link
            className="pbtn pbtn--primary"
            to={`/dashboard?asManager=${manager.id}`}
            style={{ flex: 1, justifyContent: "center" }}
            onClick={onClose}
          >
            <i className="fa-solid fa-arrow-right-to-bracket" /> ورود به پنل مدیر
          </Link>
          <button
            type="button"
            className="pbtn pbtn--danger"
            onClick={() => onDeleted(manager.id, manager.name)}
            style={{ flexShrink: 0 }}
          >
            <i className="fa-solid fa-trash" /> حذف
          </button>
          <button type="button" className="pbtn pbtn--ghost" onClick={onClose}>
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function AdminManagersPage() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // manager opened in modal

  const load = () => apiGet("/api/managers").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.ok) { setMsg({ type: "err", text: pwCheck.hint }); return; }
    setSaving(true);
    try {
      await apiPost("/api/managers", {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: phone.trim(),
        password,
        login_username: loginUsername.trim().toLowerCase(),
      });
      setEmail(""); setName(""); setPhone(""); setLoginUsername(""); setPassword("");
      load();
      setMsg({ type: "ok", text: "مدیر با موفقیت اضافه شد." });
    } catch (err) {
      setMsg({ type: "err", text: err.message || String(err) });
    } finally { setSaving(false); }
  };

  const deleteManager = async (id, name) => {
    if (!window.confirm(`مدیر «${name}» حذف شود؟ لینک آگهی‌های متصل هم قطع می‌شود.`)) return;
    setDeleting(id);
    setSelected(null);
    try {
      await apiDelete(`/api/managers/${id}`);
      load();
      setMsg({ type: "ok", text: "مدیر حذف شد." });
    } catch (err) {
      setMsg({ type: "err", text: err.message || String(err) });
    } finally { setDeleting(null); }
  };

  const nonExchangeRows = rows.filter((r) => {
    const linked = Array.isArray(r?.linked_businesses) ? r.linked_businesses : [];
    return !linked.some(isExchangeLinkedBusiness);
  });

  const filtered = nonExchangeRows.filter((r) => {
    const q = search.toLowerCase();
    return !q ||
      (r.name || "").toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.login_username || "").toLowerCase().includes(q);
  });

  return (
    <>
      {/* Page header */}
      <div className="panel-page-title">
        <div>
          <h2>حساب‌های مدیر</h2>
          <p>{nonExchangeRows.length} مدیر · مدیران صرافی در <Link to="/admin/exchanges/managers">دپارتمان صرافی</Link></p>
        </div>
        <Link to="/admin-link" className="pact-btn pact-btn--ghost">
          <i className="fa-solid fa-link" /> لینک آگهی ↔ مدیر
        </Link>
      </div>

      {msg && (
        <div className={`panel-form-msg ${msg.type === "ok" ? "panel-form-msg--ok" : "panel-form-msg--error"}`} style={{ marginBottom: "1.25rem" }}>
          {msg.text}
        </div>
      )}

      <div className="panel-form-grid" style={{ gridTemplateColumns: "1fr 320px" }}>

        {/* Manager list */}
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">
              <i className="fa-solid fa-users" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
              فهرست مدیران
            </h3>
            <input
              type="search"
              placeholder="جستجو…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "0.38rem 0.7rem", borderRadius: 8,
                border: "1.5px solid #e2e8f0", fontSize: "0.82rem",
                width: 180, fontFamily: "inherit", outline: "none",
              }}
            />
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>
              <i className="fa-solid fa-users-slash" style={{ fontSize: "1.8rem", marginBottom: "0.5rem", display: "block" }} />
              {search ? "مدیری با این مشخصات یافت نشد." : "هنوز مدیری ثبت نشده است."}
            </div>
          ) : (
            filtered.map((r) => {
              const linked = Array.isArray(r.linked_businesses) ? r.linked_businesses : [];
              return (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.85rem",
                    padding: "0.8rem 1.25rem",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafbff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: avatarColor(r.id),
                    color: "#fff", fontWeight: 800, fontSize: "0.9rem",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {initials(r.name)}
                  </div>

                  {/* Name + email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>{r.name || "—"}</span>
                      {r.totp_enabled && <span className="pbadge pbadge--green" style={{ fontSize: "0.62rem" }}>۲FA</span>}
                      {!r.password_set && <span className="pbadge pbadge--red" style={{ fontSize: "0.62rem" }}>بدون رمز</span>}
                    </div>
                    <p style={{ margin: "0.12rem 0 0", fontSize: "0.75rem", color: "#64748b" }} dir="ltr">
                      {r.email}
                      {r.login_username ? <span style={{ color: "#94a3b8" }}> · @{r.login_username}</span> : null}
                    </p>
                    {/* Linked biz chips */}
                    {linked.length > 0 ? (
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                        {linked.map((b) => (
                          <span key={b.slug} style={{
                            background: "#f1f5f9", borderRadius: 5,
                            padding: "0.1rem 0.45rem", fontSize: "0.68rem", color: "#475569",
                          }}>
                            {b.name_fa}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: "0.3rem 0 0", fontSize: "0.68rem", color: "#cbd5e1" }}>آگهی وصل نیست</p>
                    )}
                  </div>

                  {/* Chevron hint */}
                  <i className="fa-solid fa-chevron-left" style={{ color: "#cbd5e1", fontSize: "0.75rem", flexShrink: 0 }} />
                </div>
              );
            })
          )}
        </div>

        {/* Add manager form */}
        <div>
          <div className="panel-card">
            <div className="panel-card__head">
              <h3 className="panel-card__title">
                <i className="fa-solid fa-user-plus" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                افزودن مدیر
              </h3>
            </div>
            <div className="panel-card__body">
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column" }}>
                <div className="pfield">
                  <label htmlFor="mgr-email">ایمیل *</label>
                  <input id="mgr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" autoComplete="email" />
                </div>
                <div className="pfield" style={{ marginTop: "0.85rem" }}>
                  <label htmlFor="mgr-name">نام *</label>
                  <input id="mgr-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="pfield" style={{ marginTop: "0.85rem" }}>
                  <label htmlFor="mgr-phone">تلفن *</label>
                  <input id="mgr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" required />
                </div>
                <div className="pfield" style={{ marginTop: "0.85rem" }}>
                  <label htmlFor="mgr-login-user">نام کاربری *</label>
                  <input
                    id="mgr-login-user"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                    dir="ltr"
                    autoComplete="off"
                    required
                    minLength={3}
                    maxLength={32}
                    placeholder="admin_london"
                  />
                  <p className="pfield__hint">۳–۳۲ کاراکتر: a-z، 0-9، _</p>
                </div>
                <div className="pfield" style={{ marginTop: "0.85rem" }}>
                  <label htmlFor="mgr-pass">رمز عبور *</label>
                  <input
                    id="mgr-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                    dir="ltr"
                  />
                  <PasswordRequirementsList password={password} />
                </div>
                <div className="panel-form-actions">
                  <button type="submit" className="pbtn pbtn--primary" disabled={saving} style={{ flex: 1 }}>
                    {saving
                      ? <><i className="fa-solid fa-spinner fa-spin" /> در حال ثبت…</>
                      : <><i className="fa-solid fa-plus" /> ثبت مدیر</>}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-card__body" style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: 1.65 }}>
              <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#374151" }}>
                <i className="fa-solid fa-circle-info" style={{ marginInlineEnd: "0.4rem", color: "#818cf8" }} />
                نکات
              </p>
              <ul style={{ margin: 0, paddingInlineStart: "1.2rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <li>روی هر ردیف کلیک کنید تا جزئیات کامل باز شود.</li>
                <li>مدیر از <Link to="/login">صفحه ورود</Link> با ایمیل یا نام کاربری وارد می‌شود.</li>
                <li>ثبت‌نام عمومی: <Link to="/manager-signup">ثبت‌نام مدیر</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <ManagerModal
          manager={selected}
          onClose={() => setSelected(null)}
          onDeleted={(id, name) => deleteManager(id, name)}
          onPasswordSaved={() => {
            load();
            // refresh the selected row data too
            apiGet("/api/managers").then((data) => {
              setRows(Array.isArray(data) ? data : []);
              const fresh = (Array.isArray(data) ? data : []).find((r) => r.id === selected.id);
              if (fresh) setSelected(fresh);
            }).catch(() => {});
          }}
        />
      )}
    </>
  );
}
