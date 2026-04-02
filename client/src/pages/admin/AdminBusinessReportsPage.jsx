import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";

export default function AdminBusinessReportsPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setErr(null);
    apiGet("/api/admin/business-reports")
      .then(setRows)
      .catch(() => setErr("بارگذاری ناموفق"));
  }, []);

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
      </p>
      <section className="dashboard-panel">
        <h2>گزارش‌های آگهی</h2>
        <p className="field-hint">
          گزارش‌های ارسالی از دکمهٔ «گزارش» در صفحهٔ آگهی و لیست. دلیل انتخابی و توضیح کاربر در جدول آمده است.
        </p>
        {err && <p className="field-hint">{err}</p>}
        <div className="table-wrap" style={{ marginTop: "1rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>آگهی</th>
                <th>شناسه</th>
                <th>دلیل</th>
                <th>توضیح</th>
                <th>ایمیل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr" style={{ whiteSpace: "nowrap" }}>
                    {r.created_at || "—"}
                  </td>
                  <td>
                    <Link to={`/business?slug=${encodeURIComponent(r.business_slug)}`}>
                      {r.business_name_fa || r.business_slug}
                    </Link>
                  </td>
                  <td dir="ltr">{formatAdId(r.business_id) || "—"}</td>
                  <td>{r.reason_label || r.reason_key}</td>
                  <td style={{ maxWidth: "14rem", wordBreak: "break-word" }}>{r.details?.trim() || "—"}</td>
                  <td dir="ltr">{r.reporter_email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && !err && <p className="field-hint">هنوز گزارشی ثبت نشده است.</p>}
      </section>
    </>
  );
}
