import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPatchUrl, apiPost } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";
import { isExchangeBusiness } from "../../lib/exchangeRates.js";
import { validatePasswordComplexity } from "../../lib/passwordPolicy.js";
import PasswordRequirementsList from "../../components/PasswordRequirementsList.jsx";

function isExchangeBusinessRow(b) {
  return isExchangeBusiness(b);
}

function randomSuffix(len = 4) {
  return Math.random().toString(36).slice(2, 2 + len).toLowerCase();
}

function suggestUsername(email) {
  const base = String(email || "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safe = base.length >= 3 ? base : `exmgr_${randomSuffix(5)}`;
  return `${safe}_${randomSuffix(3)}`.slice(0, 32);
}

function generateStrongPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%";
  const all = upper + lower + digits + special;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  let out = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = out.length; i < 14; i += 1) out.push(pick(all));
  out = out.sort(() => Math.random() - 0.5);
  return out.join("");
}

export default function AdminExchangeManagersPage() {
  const [rows, setRows] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [managerId, setManagerId] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [newMgr, setNewMgr] = useState({
    name: "",
    email: "",
    phone: "",
    login_username: "",
    password: "",
    link_slug: "",
  });
  const [createdCreds, setCreatedCreds] = useState(null);
  const [rowPw, setRowPw] = useState({});
  const [savingPwId, setSavingPwId] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([apiGet("/api/exchange-managers"), apiGet("/api/businesses")])
      .then(([mgrs, biz]) => {
        setRows(Array.isArray(mgrs) ? mgrs : []);
        setBusinesses(Array.isArray(biz) ? biz : []);
      })
      .catch(() => {
        setRows([]);
        setBusinesses([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const exchangeRows = rows;
  const exchangeBusinesses = useMemo(() => businesses.filter(isExchangeBusinessRow), [businesses]);
  const selectedBiz = useMemo(() => exchangeBusinesses.find((b) => b.slug === slug), [exchangeBusinesses, slug]);

  useEffect(() => {
    if (!selectedBiz) {
      setManagerId("");
      return;
    }
    const normalized = Number.isFinite(Number(selectedBiz.exchange_manager_id)) && Number(selectedBiz.exchange_manager_id) > 0
      ? String(selectedBiz.exchange_manager_id)
      : "";
    setManagerId(normalized);
  }, [selectedBiz]);

  const saveLink = async (e) => {
    e.preventDefault();
    if (!slug) return;
    setSaving(true);
    setMsg("");
    try {
      await apiPatchUrl(`/api/admin/exchange-businesses/${encodeURIComponent(slug)}/manager`, {
        manager_id: managerId === "" ? null : parseInt(managerId, 10),
      });
      const [mgrs, biz] = await Promise.all([apiGet("/api/exchange-managers"), apiGet("/api/businesses")]);
      setRows(Array.isArray(mgrs) ? mgrs : []);
      setBusinesses(Array.isArray(biz) ? biz : []);
      setMsg("لینک مدیر صرافی ذخیره شد.");
    } catch (e2) {
      setMsg(e2.message || "خطا در ذخیره لینک");
    } finally {
      setSaving(false);
    }
  };

  const createAndLinkExchangeManager = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMsg("");
    setCreatedCreds(null);
    try {
      const payload = {
        name: String(newMgr.name || "").trim(),
        email: String(newMgr.email || "").trim().toLowerCase(),
        phone: String(newMgr.phone || "").trim(),
        login_username: String(newMgr.login_username || "").trim().toLowerCase(),
        password: String(newMgr.password || "").trim(),
      };
      if (!payload.name || !payload.email || !payload.phone || !payload.login_username || !payload.password) {
        throw new Error("نام، ایمیل، تلفن، نام کاربری و رمز عبور الزامی است.");
      }
      const pwCheck = validatePasswordComplexity(payload.password);
      if (!pwCheck.ok) {
        throw new Error(pwCheck.hint);
      }
      const created = await apiPost("/api/exchange-managers", payload);
      const createdId = created?.id || created?.user?.id;
      const linkSlug = String(newMgr.link_slug || "").trim();
      if (linkSlug && Number.isFinite(Number(createdId))) {
        await apiPatchUrl(`/api/admin/exchange-businesses/${encodeURIComponent(linkSlug)}/manager`, {
          manager_id: Number(createdId),
        });
      }
      const [mgrs, biz] = await Promise.all([apiGet("/api/exchange-managers"), apiGet("/api/businesses")]);
      setRows(Array.isArray(mgrs) ? mgrs : []);
      setBusinesses(Array.isArray(biz) ? biz : []);
      if (linkSlug) setSlug(linkSlug);
      if (createdId) setManagerId(String(createdId));
      setCreatedCreds({
        ...payload,
        link_slug: linkSlug || null,
      });
      setMsg(linkSlug ? "مدیر صرافی ساخته شد و آگهی لینک شد." : "مدیر صرافی ساخته شد.");
      setNewMgr({
        name: "",
        email: "",
        phone: "",
        login_username: "",
        password: "",
        link_slug: "",
      });
    } catch (err) {
      setMsg(err.message || "ساخت مدیر صرافی ناموفق بود.");
    } finally {
      setCreating(false);
    }
  };

  const copyCredentials = async () => {
    if (!createdCreds) return;
    const text = `سلام ${createdCreds.name || "مدیر محترم"},
حساب پنل صرافی شما در ایرانیو ساخته شد.

ایمیل: ${createdCreds.email}
نام کاربری: ${createdCreds.login_username}
رمز عبور: ${createdCreds.password}
ورود: https://iraniu.uk/login
${createdCreds.link_slug ? `آگهی متصل: ${createdCreds.link_slug}` : ""}
`;
    try {
      await navigator.clipboard.writeText(text);
      setMsg("متن ارسال اطلاعات ورود کپی شد.");
    } catch {
      setMsg("کپی انجام نشد. لطفاً متن را دستی کپی کنید.");
    }
  };

  const deleteManagerById = async (rawId) => {
    const id = parseInt(String(rawId || ""), 10);
    if (!Number.isFinite(id) || id <= 0) {
      setMsg("ابتدا یک مدیر را برای حذف انتخاب کنید.");
      return;
    }
    const ok = window.confirm("مدیر انتخاب‌شده حذف شود؟ لینک آگهی‌های متصل هم قطع می‌شود.");
    if (!ok) return;
    setDeleting(true);
    setMsg("");
    try {
      await apiDelete(`/api/exchange-managers/${id}`);
      const [mgrs, biz] = await Promise.all([apiGet("/api/exchange-managers"), apiGet("/api/businesses")]);
      setRows(Array.isArray(mgrs) ? mgrs : []);
      setBusinesses(Array.isArray(biz) ? biz : []);
      if (String(managerId) === String(id)) setManagerId("");
      setDeletingId("");
      setMsg("مدیر صرافی حذف شد.");
    } catch (err) {
      setMsg(err.message || "حذف مدیر صرافی ناموفق بود.");
    } finally {
      setDeleting(false);
    }
  };
  const deleteSelectedManager = async () => {
    const selectedFromDom =
      typeof document !== "undefined"
        ? document.querySelector('input[name="exchange-manager-delete"]:checked')?.value || ""
        : "";
    await deleteManagerById(deletingId || selectedFromDom || "");
  };

  const saveRowPassword = async (id) => {
    const p = (rowPw[id] || "").trim();
    const pwCheck = validatePasswordComplexity(p);
    if (!pwCheck.ok) {
      setMsg(pwCheck.hint);
      return;
    }
    setMsg("");
    setSavingPwId(id);
    try {
      await apiPatchUrl(`/api/admin/exchange-managers/${id}/password`, { password: p });
      setRowPw((prev) => ({ ...prev, [id]: "" }));
      setMsg(`رمز مدیر ${id} به‌روز شد.`);
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setSavingPwId(null);
    }
  };

  return (
    <section className="dashboard-panel" aria-labelledby="admin-exchange-managers-h" style={{ marginTop: "var(--space-md)" }}>
      <h2 id="admin-exchange-managers-h">مدیران صرافی</h2>
      <p className="field-hint">
        مدیران صرافی کاملاً جدا از مدیران دایرکتوری هستند. مدیران غیرصرافی در صفحه{" "}
        <Link to="/admin-managers">مدیران</Link> باقی می‌مانند.
      </p>

      <form onSubmit={saveLink} style={{ marginBottom: "var(--space-md)" }}>
        <div className="form-grid">
          <div className="field field--block">
            <label htmlFor="ex-link-biz">آگهی صرافی</label>
            <select id="ex-link-biz" value={slug} onChange={(e) => setSlug(e.target.value)} required>
              <option value="">— انتخاب —</option>
              {exchangeBusinesses.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name_fa} · {formatAdId(b.id) || b.slug}
                </option>
              ))}
            </select>
          </div>
          <div className="field field--block">
            <label htmlFor="ex-link-mgr">مدیر صرافی</label>
            <select id="ex-link-mgr" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">— بدون مدیر —</option>
              {exchangeRows.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="dashboard-actions">
          <button type="submit" className="btn btn--primary" disabled={saving || !slug}>
            {saving ? "…" : "ذخیره لینک مدیر صرافی"}
          </button>
        </div>
        {msg ? <p className="field-hint">{msg}</p> : null}
      </form>

      <section className="dashboard-panel" style={{ marginBottom: "var(--space-md)" }}>
        <h3 style={{ marginTop: 0 }}>Create Exchange Manager + send credentials</h3>
        <p className="field-hint">ساخت مدیر صرافی جدید + لینک اختیاری به آگهی و کپی متن ارسال اطلاعات ورود.</p>
        <form onSubmit={createAndLinkExchangeManager}>
          <div className="form-grid">
            <div className="field field--block">
              <label htmlFor="ex-new-name">نام مدیر</label>
              <input
                id="ex-new-name"
                value={newMgr.name}
                onChange={(e) => setNewMgr((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="ex-new-email">ایمیل</label>
              <input
                id="ex-new-email"
                type="email"
                dir="ltr"
                value={newMgr.email}
                onChange={(e) =>
                  setNewMgr((p) => {
                    const email = e.target.value;
                    return {
                      ...p,
                      email,
                      login_username: p.login_username || suggestUsername(email),
                    };
                  })
                }
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="ex-new-phone">تلفن</label>
              <input
                id="ex-new-phone"
                dir="ltr"
                value={newMgr.phone}
                onChange={(e) => setNewMgr((p) => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="ex-new-username">نام کاربری</label>
              <input
                id="ex-new-username"
                dir="ltr"
                value={newMgr.login_username}
                onChange={(e) => setNewMgr((p) => ({ ...p, login_username: e.target.value.toLowerCase() }))}
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="ex-new-password">رمز عبور</label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  id="ex-new-password"
                  dir="ltr"
                  value={newMgr.password}
                  onChange={(e) => setNewMgr((p) => ({ ...p, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setNewMgr((p) => ({ ...p, password: generateStrongPassword() }))}
                >
                  تولید رمز
                </button>
              </div>
              <PasswordRequirementsList password={newMgr.password} />
            </div>
            <div className="field field--block">
              <label htmlFor="ex-new-link-biz">لینک به آگهی صرافی (اختیاری)</label>
              <select
                id="ex-new-link-biz"
                value={newMgr.link_slug}
                onChange={(e) => setNewMgr((p) => ({ ...p, link_slug: e.target.value }))}
              >
                <option value="">— فعلاً لینک نشود —</option>
                {exchangeBusinesses.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name_fa} · {formatAdId(b.id) || b.slug}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="dashboard-actions">
            <button type="submit" className="btn btn--primary" disabled={creating}>
              {creating ? "در حال ساخت…" : "ساخت مدیر صرافی"}
            </button>
            {createdCreds ? (
              <button type="button" className="btn btn--ghost" onClick={copyCredentials}>
                کپی متن ارسال اطلاعات ورود
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {loading ? <p>در حال بارگذاری…</p> : null}
      {!loading && exchangeRows.length === 0 ? <p className="field-hint">فعلاً مدیر صرافی ثبت نشده است.</p> : null}

      {!loading && exchangeRows.length > 0 ? (
        <div className="table-wrap">
          <div className="dashboard-actions" style={{ marginBottom: "0.6rem" }}>
            <button
              type="button"
              className="btn btn--danger"
              disabled={deleting || !deletingId}
              onClick={deleteSelectedManager}
            >
              {deleting ? "در حال حذف…" : "حذف مدیر انتخاب‌شده"}
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>حذف</th>
                <th>شناسه</th>
                <th>نام</th>
                <th>ایمیل</th>
                <th>نام کاربری</th>
                <th>رمز عبور</th>
                <th>تلفن</th>
                <th>آگهی‌های صرافی</th>
                <th>پنل</th>
              </tr>
            </thead>
            <tbody>
              {exchangeRows.map((r) => (
                <tr key={r.id}>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className="btn btn--danger"
                      aria-label={`حذف مدیر ${r.name}`}
                      title="حذف مدیر"
                      disabled={deleting}
                      onClick={() => deleteManagerById(r.id)}
                      style={{ minWidth: "2rem", height: "2rem", lineHeight: 1, padding: 0 }}
                    >
                      ×
                    </button>
                  </td>
                  <td dir="ltr">{r.id}</td>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.email}</td>
                  <td dir="ltr">{r.login_username || "—"}</td>
                  <td style={{ minWidth: "10rem" }}>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <input
                        type="password"
                        placeholder="رمز جدید"
                        dir="ltr"
                        style={{ maxWidth: "9rem" }}
                        value={rowPw[r.id] || ""}
                        onChange={(e) => setRowPw((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={savingPwId === r.id}
                        onClick={() => saveRowPassword(r.id)}
                      >
                        {savingPwId === r.id ? "…" : "ذخیره رمز"}
                      </button>
                    </div>
                    {rowPw[r.id] ? <PasswordRequirementsList password={rowPw[r.id]} /> : null}
                  </td>
                  <td dir="ltr">{r.phone || "—"}</td>
                  <td style={{ minWidth: "12rem", maxWidth: "22rem" }}>
                    <ul style={{ margin: 0, paddingInlineStart: "1.1rem" }}>
                      {(r.linked_businesses || []).map((b) => (
                        <li key={b.slug} style={{ marginBottom: "0.25rem" }}>
                          <strong>{b.name_fa}</strong>
                          <span className="field-hint" dir="ltr">
                            {" "}
                            ({formatAdId(b.id) || b.slug})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <Link className="btn btn--primary" to={`/dashboard?asExchangeManager=${r.id}`}>
                      ورود به پنل مدیر
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
