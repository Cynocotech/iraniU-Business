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
  const [brief, setBrief] = useState(null);

  useEffect(() => {
    apiGet("/api/admin/stats")
      .then(setStats)
      .catch(() => setErr("بارگذاری آمار ناموفق بود."));
  }, []);

  useEffect(() => {
    apiGet("/api/admin/workspace-brief")
      .then(setBrief)
      .catch(() => setBrief(null));
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
          <p className="app-shell__metric-label">در انتظار تأیید انتشار</p>
          <p className="app-shell__metric-value" dir="ltr">
            {stats ? formatNum(stats.pending_listing_approvals) : "…"}
          </p>
          <p className="app-shell__metric-hint">ثبت از فرم عمومی؛ در لیست سایت نیستند</p>
          {stats && stats.pending_listing_approvals > 0 ? (
            <Link className="app-shell__hero-btn" to="/admin-businesses" style={{ marginTop: "0.5rem" }}>
              بررسی در همه آگهی‌ها
            </Link>
          ) : null}
        </div>
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

      <section className="dashboard-panel" id="admin-workspace" aria-labelledby="admin-workspace-h" style={{ marginBottom: "var(--space-lg)" }}>
        <h2 id="admin-workspace-h">یادداشت و کارهای داخلی</h2>
        <p className="field-hint">
          مختص سوپرادمین؛ در فهرست عمومی سایت دیده نمی‌شود.{" "}
          <Link className="btn btn--primary" to="/admin-notes" style={{ display: "inline-block", marginInlineStart: "0.35rem" }}>
            باز کردن صفحهٔ کامل
          </Link>
        </p>
        {brief ? (
          <div className="form-grid" style={{ maxWidth: "42rem", marginTop: "0.75rem" }}>
            <p style={{ margin: 0 }}>
              <strong>کارهای باز:</strong>{" "}
              <span dir="ltr">{formatNum(brief.open_tasks_count)}</span>
            </p>
            {brief.recent_notes && brief.recent_notes.length > 0 ? (
              <div>
                <p className="field-hint" style={{ marginBottom: "0.5rem" }}>
                  آخرین یادداشت‌ها:
                </p>
                <ul style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
                  {brief.recent_notes.map((n) => (
                    <li key={n.id} style={{ marginBottom: "0.35rem" }}>
                      <span style={{ whiteSpace: "pre-wrap" }}>{n.preview}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="field-hint" style={{ margin: 0 }}>
                هنوز یادداشت داخلی ثبت نشده است.
              </p>
            )}
          </div>
        ) : (
          <p className="field-hint" style={{ marginTop: "0.75rem" }}>
            در حال بارگذاری…
          </p>
        )}
      </section>

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
