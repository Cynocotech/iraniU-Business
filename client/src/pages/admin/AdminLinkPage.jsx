import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatchUrl } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";

export default function AdminLinkPage() {
  const [businesses, setBusinesses] = useState([]);
  const [managers, setManagers] = useState([]);
  const [slug, setSlug] = useState("");
  const [managerId, setManagerId] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bizSearch, setBizSearch] = useState("");
  const [mgrSearch, setMgrSearch] = useState("");

  useEffect(() => {
    apiGet("/api/businesses").then(setBusinesses).catch(() => {});
    apiGet("/api/managers").then(setManagers).catch(() => {});
  }, []);

  const filteredBusinesses = useMemo(() => {
    const q = bizSearch.trim().toLowerCase();
    let list = businesses;
    if (q) {
      list = businesses.filter((b) => {
        const blob = `${b.name_fa || ""} ${b.slug || ""} ${b.listing_title || ""} ${b.category || ""} ${b.city || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    if (slug && !list.some((b) => b.slug === slug)) {
      const sel = businesses.find((b) => b.slug === slug);
      if (sel) list = [sel, ...list];
    }
    return list;
  }, [businesses, bizSearch, slug]);

  const filteredManagers = useMemo(() => {
    const q = mgrSearch.trim().toLowerCase();
    let list = managers;
    if (q) {
      list = managers.filter((m) => {
        const blob = `${m.name || ""} ${m.email || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    const mid = managerId === "" ? null : String(managerId);
    if (mid && !list.some((m) => String(m.id) === mid)) {
      const sel = managers.find((m) => String(m.id) === mid);
      if (sel) list = [sel, ...list];
    }
    return list;
  }, [managers, mgrSearch, managerId]);

  const selected = businesses.find((b) => b.slug === slug);

  useEffect(() => {
    const b = businesses.find((x) => x.slug === slug);
    if (!b) {
      setManagerId("");
      setManagerEmail("");
      return;
    }
    setManagerId(b.manager_id != null ? String(b.manager_id) : "");
    const linkedManager = managers.find((m) => Number(m.id) === Number(b.manager_id));
    setManagerEmail(linkedManager?.email || "");
  }, [slug, businesses, managers]);

  const save = async (e) => {
    e.preventDefault();
    if (!slug) return;
    setSaving(true);
    setMsg(null);
    try {
      const trimmedEmail = managerEmail.trim().toLowerCase();
      const payload =
        managerId === "" && !trimmedEmail
          ? { manager_id: null }
          : {
              ...(managerId !== "" ? { manager_id: parseInt(managerId, 10) } : {}),
              ...(trimmedEmail ? { manager_email: trimmedEmail } : {}),
            };
      await apiPatchUrl(`/api/admin/businesses/${encodeURIComponent(slug)}/manager`, {
        ...payload,
      });
      setMsg("ذخیره شد.");
      const next = await apiGet("/api/businesses");
      setBusinesses(next);
      if (trimmedEmail) {
        const byEmail = managers.find((m) => String(m.email || "").toLowerCase() === trimmedEmail);
        if (byEmail) setManagerId(String(byEmail.id));
      }
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
        {" · "}
        <Link to="/admin-managers">حساب‌های مدیر</Link>
      </p>
      <section className="dashboard-panel">
        <h2>لینک آگهی ↔ مدیر</h2>
        <p className="field-hint">یک مدیر را به آگهی وصل کنید (یا خالی کنید).</p>
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="field field--block">
              <label htmlFor="link-biz-search">جستجوی آگهی</label>
              <input
                id="link-biz-search"
                type="search"
                autoComplete="off"
                placeholder="نام، شناسه، دسته، شهر…"
                value={bizSearch}
                onChange={(e) => setBizSearch(e.target.value)}
              />
            </div>
            <div className="field field--block">
              <label htmlFor="link-mgr-search">جستجوی مدیر</label>
              <input
                id="link-mgr-search"
                type="search"
                autoComplete="off"
                placeholder="نام یا ایمیل…"
                value={mgrSearch}
                onChange={(e) => setMgrSearch(e.target.value)}
              />
            </div>
            <div className="field field--block">
              <label htmlFor="link-slug">آگهی</label>
              <select id="link-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required>
                <option value="">— انتخاب —</option>
                {filteredBusinesses.map((b) => (
                  <option key={b.slug} value={b.slug} title={b.slug}>
                    {b.name_fa} · {formatAdId(b.id) || b.slug}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--block">
              <label htmlFor="link-mgr">مدیر</label>
              <select
                id="link-mgr"
                value={managerId}
                onChange={(e) => {
                  const v = e.target.value;
                  setManagerId(v);
                  const m = managers.find((x) => String(x.id) === String(v));
                  if (m?.email) setManagerEmail(String(m.email).toLowerCase());
                }}
              >
                <option value="">— بدون مدیر —</option>
                {filteredManagers.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--block">
              <label htmlFor="link-mgr-email">ایمیل یا نام کاربری مدیر (اختیاری)</label>
              <input
                id="link-mgr-email"
                type="text"
                dir="ltr"
                autoComplete="off"
                placeholder="manager@email.com یا manager_username"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
              />
            </div>
          </div>
          {selected && (
            <p className="field-hint">
              manager_id فعلی در دیتابیس:{" "}
              <strong lang="en" dir="ltr">
                {selected.manager_id ?? "—"}
              </strong>
            </p>
          )}
          <div className="dashboard-actions">
            <button type="submit" className="btn btn--primary" disabled={saving || !slug}>
              {saving ? "…" : "ذخیره لینک"}
            </button>
          </div>
          {msg && <p className="field-hint">{msg}</p>}
        </form>
      </section>
    </>
  );
}
