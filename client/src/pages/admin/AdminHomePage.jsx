import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api.js";

function formatNum(n) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return Number(n).toLocaleString("fa-IR");
  } catch {
    return String(n);
  }
}

export default function AdminHomePage() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    apiGet("/api/admin/stats")
      .then(setStats)
      .catch(() => setErr("بارگذاری آمار ناموفق بود."));
  }, []);

  return (
    <>
      <div className="app-shell__widgets">
        <div className="app-shell__hero-card">
          <p className="app-shell__hero-label">پنل مدیریت</p>
          <p className="app-shell__hero-value">سوپرادمین</p>
          <Link className="app-shell__hero-btn" to="/admin-businesses">
            مدیریت همه آگهی‌ها
          </Link>
        </div>
        <div className="app-shell__metrics">
          <div className="app-shell__metric app-shell__metric--teal">
            <svg className="app-shell__metric-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path stroke="#fff" strokeWidth="2" d="M4 4h5v5H4V4zm11 0h5v5h-5V4zM4 15h5v5H4v-5zm11 0h5v5h-5v-5z" />
              <path stroke="#fff" strokeWidth="2" d="M9 9h6v6H9z" />
            </svg>
            <p className="app-shell__metric-label">همه آگهی‌ها</p>
            <p className="app-shell__metric-value" dir="ltr">
              {stats ? formatNum(stats.total_businesses) : "…"}
            </p>
            <p className="app-shell__metric-hint">تعداد کل آگهی‌های ثبت‌شده</p>
          </div>
          <div className="app-shell__metric app-shell__metric--purple">
            <p className="app-shell__metric-label">آگهی فعال</p>
            <p className="app-shell__metric-value" dir="ltr">
              {stats ? formatNum(stats.active_businesses) : "…"}
            </p>
            <p className="app-shell__metric-hint">فعال یا بدون وضعیت</p>
          </div>
          <div className="app-shell__metric app-shell__metric--blue">
            <p className="app-shell__metric-label">اسکن QR (کل)</p>
            <p className="app-shell__metric-value" dir="ltr">
              {stats ? formatNum(stats.total_qr_scans) : "…"}
            </p>
            <p className="app-shell__metric-hint">همهٔ اسکن‌های QR لینک نظر Google</p>
          </div>
          <div className="app-shell__metric app-shell__metric--coral">
            <p className="app-shell__metric-label">اسکن QR (۷ روز)</p>
            <p className="app-shell__metric-value" dir="ltr">
              {stats ? formatNum(stats.qr_scans_7d) : "…"}
            </p>
            <p className="app-shell__metric-hint">روند کوتاه‌مدت</p>
          </div>
        </div>
      </div>

      <div className="app-shell__metrics" style={{ marginBottom: "var(--space-lg)" }}>
        <div className="app-shell__metric app-shell__metric--coral">
          <p className="app-shell__metric-label">غیرفعال</p>
          <p className="app-shell__metric-value" dir="ltr">
            {stats ? formatNum(stats.inactive_businesses) : "…"}
          </p>
          <p className="app-shell__metric-hint">آگهی‌هایی با وضعیت غیرفعال</p>
        </div>
      </div>

      {err && (
        <p className="field-hint" role="alert">
          {err}
        </p>
      )}

      <section className="dashboard-panel" id="admin-quick" aria-labelledby="admin-quick-h">
        <h2 id="admin-quick-h">اقدام سریع</h2>
        <div className="dashboard-actions dashboard-actions--inline" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          <Link className="btn btn--primary" to="/admin-add">
            افزودن آگهی
          </Link>
          <Link className="btn btn--accent" to="/admin-businesses">
            همه آگهی‌ها
          </Link>
          <Link className="btn btn--ghost" to="/admin-edit">
            ویرایش آگهی
          </Link>
        </div>
        <p className="field-hint" style={{ marginBottom: 0 }}>
          از «افزودن آگهی» می‌توانید آگهی جدید بسازید؛ از «ویرایش» همان آگهی را کامل کنید.
        </p>
      </section>
    </>
  );
}
