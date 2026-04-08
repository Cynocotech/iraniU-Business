import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatchUrl } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";

function isExchangeBusinessRow(b) {
  const cat = String(b?.category || "").trim().toLowerCase();
  return cat.includes("صراف") || cat.includes("exchange");
}

export default function AdminExchangeManagersPage() {
  const [rows, setRows] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [managerId, setManagerId] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

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

      {loading ? <p>در حال بارگذاری…</p> : null}
      {!loading && exchangeRows.length === 0 ? <p className="field-hint">فعلاً مدیر صرافی ثبت نشده است.</p> : null}

      {!loading && exchangeRows.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>شناسه</th>
                <th>نام</th>
                <th>ایمیل</th>
                <th>نام کاربری</th>
                <th>تلفن</th>
                <th>آگهی‌های صرافی</th>
                <th>پنل</th>
              </tr>
            </thead>
            <tbody>
              {exchangeRows.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr">{r.id}</td>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.email}</td>
                  <td dir="ltr">{r.login_username || "—"}</td>
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
