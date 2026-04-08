import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatchUrl, apiPost } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";

function isExchangeBusinessRow(b) {
  const cat = String(b?.category || "").trim().toLowerCase();
  return cat.includes("صراف") || cat.includes("exchange");
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
  const safe = base.length >= 3 ? base : `manager_${randomSuffix(5)}`;
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
  const [newMgr, setNewMgr] = useState({
    name: "",
    email: "",
    phone: "",
    login_username: "",
    password: "",
  });
  const [creatingManager, setCreatingManager] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);

  useEffect(() => {
    apiGet("/api/businesses").then(setBusinesses).catch(() => {});
    apiGet("/api/managers").then(setManagers).catch(() => {});
  }, []);

  const filteredBusinesses = useMemo(() => {
    const q = bizSearch.trim().toLowerCase();
    let list = businesses.filter((b) => !isExchangeBusinessRow(b));
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
    const normalizedManagerId = Number.isFinite(Number(b.manager_id)) && Number(b.manager_id) > 0 ? Number(b.manager_id) : null;
    setManagerId(normalizedManagerId != null ? String(normalizedManagerId) : "");
    const linkedManager = managers.find((m) => Number(m.id) === normalizedManagerId);
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

  const createAndLinkManager = async (e) => {
    e.preventDefault();
    if (!slug) {
      setMsg("ابتدا یک آگهی انتخاب کنید.");
      return;
    }
    setCreatingManager(true);
    setMsg(null);
    setCreatedCreds(null);
    try {
      const email = String(newMgr.email || "").trim().toLowerCase();
      const name = String(newMgr.name || "").trim();
      const phone = String(newMgr.phone || "").trim();
      const login_username = String(newMgr.login_username || "").trim().toLowerCase();
      const password = String(newMgr.password || "").trim();
      if (!email || !name || !phone || !login_username || !password) {
        throw new Error("نام، ایمیل، تلفن، نام کاربری و رمز الزامی است.");
      }

      const created = await apiPost("/api/managers", {
        email,
        name,
        phone,
        login_username,
        password,
      });

      await apiPatchUrl(`/api/admin/businesses/${encodeURIComponent(slug)}/manager`, {
        manager_id: created?.id,
      });

      const [nextBusinesses, nextManagers] = await Promise.all([apiGet("/api/businesses"), apiGet("/api/managers")]);
      setBusinesses(nextBusinesses);
      setManagers(nextManagers);
      setManagerId(String(created?.id || ""));
      setManagerEmail(email);
      setCreatedCreds({ name, email, phone, login_username, password, slug });
      setMsg("مدیر ساخته شد و آگهی به او لینک شد.");
      setNewMgr({
        name: "",
        email: "",
        phone: "",
        login_username: "",
        password: "",
      });
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setCreatingManager(false);
    }
  };

  const copyCreds = async () => {
    if (!createdCreds) return;
    const text = `سلام ${createdCreds.name || "مدیر محترم"}،
حساب پنل شما در ایرانیو ساخته شد.

ایمیل: ${createdCreds.email}
نام کاربری: ${createdCreds.login_username}
رمز عبور: ${createdCreds.password}
ورود: https://iraniu.uk/login
آگهی متصل: ${createdCreds.slug}
`;
    try {
      await navigator.clipboard.writeText(text);
      setMsg("متن ورود برای مدیر کپی شد.");
    } catch {
      setMsg("کپی انجام نشد. لطفاً دستی کپی کنید.");
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
        <p className="field-hint">
          یک مدیر را به آگهی وصل کنید (یا خالی کنید). آگهی‌های صرافی از این بخش حذف شده‌اند و باید در دپارتمان صرافی مدیریت شوند.
        </p>
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
                {Number.isFinite(Number(selected.manager_id)) && Number(selected.manager_id) > 0 ? selected.manager_id : "—"}
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

      <section className="dashboard-panel" style={{ marginTop: "var(--space-md)" }}>
        <h2>ساخت مدیر جدید + لینک خودکار</h2>
        <p className="field-hint">اگر مدیر هنوز حساب ندارد، همین‌جا حساب بسازید و مستقیم به آگهی وصل کنید.</p>
        <form onSubmit={createAndLinkManager}>
          <div className="form-grid">
            <div className="field field--block">
              <label htmlFor="new-mgr-name">نام مدیر</label>
              <input
                id="new-mgr-name"
                value={newMgr.name}
                onChange={(e) => setNewMgr((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="new-mgr-email">ایمیل</label>
              <input
                id="new-mgr-email"
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
              <label htmlFor="new-mgr-phone">تلفن</label>
              <input
                id="new-mgr-phone"
                dir="ltr"
                value={newMgr.phone}
                onChange={(e) => setNewMgr((p) => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="new-mgr-username">نام کاربری</label>
              <input
                id="new-mgr-username"
                dir="ltr"
                value={newMgr.login_username}
                onChange={(e) => setNewMgr((p) => ({ ...p, login_username: e.target.value.toLowerCase() }))}
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="new-mgr-password">رمز عبور</label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  id="new-mgr-password"
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
            </div>
          </div>
          <div className="dashboard-actions">
            <button type="submit" className="btn btn--primary" disabled={creatingManager || !slug}>
              {creatingManager ? "در حال ساخت…" : "ساخت مدیر و لینک به آگهی انتخاب‌شده"}
            </button>
          </div>
        </form>

        {createdCreds ? (
          <div style={{ marginTop: "0.8rem" }}>
            <p className="field-hint" style={{ marginBottom: "0.4rem" }}>
              اطلاعات ورود ساخته شد. برای ارسال به مدیر، کپی کنید:
            </p>
            <div className="dashboard-actions">
              <button type="button" className="btn btn--ghost" onClick={copyCreds}>
                کپی متن ارسال به مدیر
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
