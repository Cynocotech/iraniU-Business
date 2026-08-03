import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../../api.js";

export default function AdminClaimsPage() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => {
    const q = filter === "" ? "" : `?status=${encodeURIComponent(filter)}`;
    apiGet(`/api/admin/claim-requests${q}`)
      .then(setRows)
      .catch(() => setErr("بارگذاری ناموفق"));
  };

  useEffect(() => {
    setErr(null);
    load();
  }, [filter]);

  const decide = async (id, action) => {
    setBusy(id);
    setErr(null);
    try {
      await apiPost(`/api/admin/claim-requests/${id}/decide`, { action });
      load();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
      </p>
      <section className="dashboard-panel">
        <h2>درخواست‌های ادعا</h2>
        <div className="field field--block" style={{ maxWidth: "12rem" }}>
          <label htmlFor="claim-filter">وضعیت</label>
          <select id="claim-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">همه</option>
            <option value="pending">در انتظار</option>
            <option value="approved">تأیید شده</option>
            <option value="rejected">رد شده</option>
          </select>
        </div>
        {err && <p className="field-hint">{err}</p>}
        <div className="table-wrap" style={{ marginTop: "1rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>آگهی</th>
                <th>درخواست‌دهنده</th>
                <th>ایمیل</th>
                <th>موبایل / تلفن</th>
                <th>تاریخ</th>
                <th>مدیر خودکار</th>
                <th>وضعیت</th>
                <th>اقدام</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span lang="en" dir="ltr">
                      {r.business_slug}
                    </span>
                  </td>
                  <td>{r.applicant_name}</td>
                  <td dir="ltr">{r.email}</td>
                  <td dir="ltr">{r.phone || "—"}</td>
                  <td dir="ltr" style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                    {r.created_at ? String(r.created_at).slice(0, 10) : "—"}
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {r.claim_manager_id ? (
                      <span style={{ color: "#2e7d32" }}>#{r.claim_manager_id} ✓</span>
                    ) : (
                      <span className="field-hint">—</span>
                    )}
                  </td>
                  <td>{r.status}</td>
                  <td>
                    {r.status === "pending" ? (
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={busy === r.id}
                          onClick={() => decide(r.id, "approve")}
                        >
                          تأیید
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={busy === r.id}
                          onClick={() => decide(r.id, "reject")}
                        >
                          رد
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
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
