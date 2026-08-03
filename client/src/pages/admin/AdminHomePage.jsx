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
  const [qrLeaderboard, setQrLeaderboard] = useState(null);

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

  useEffect(() => {
    apiGet("/api/admin/qr-scan-leaderboard")
      .then(setQrLeaderboard)
      .catch(() => setQrLeaderboard([]));
  }, []);

  return (
    <>
      {/* Welcome banner */}
      <div className="panel-welcome">
        <div>
          <p className="panel-welcome__title">خوش آمدید، سوپرادمین</p>
          <p className="panel-welcome__sub">مدیریت کامل آگهی‌ها، صرافی‌ها و کاربران ایرانیو</p>
        </div>
        <div className="panel-welcome__actions">
          <Link to="/admin-add" className="panel-welcome__btn panel-welcome__btn--white">
            <i className="fa-solid fa-plus" aria-hidden="true" /> افزودن آگهی
          </Link>
          <Link to="/admin-businesses" className="panel-welcome__btn panel-welcome__btn--outline">
            <i className="fa-solid fa-list" aria-hidden="true" /> همه آگهی‌ها
          </Link>
        </div>
      </div>

      {/* KPI stats */}
      <div className="panel-stats">
        <div className="panel-stat panel-stat--blue">
          <div className="panel-stat__icon"><i className="fa-solid fa-store" /></div>
          <div>
            <p className="panel-stat__value">{stats ? formatNum(stats.total_businesses) : "…"}</p>
            <p className="panel-stat__label">کل آگهی‌ها</p>
          </div>
        </div>
        <div className="panel-stat panel-stat--green">
          <div className="panel-stat__icon"><i className="fa-solid fa-circle-check" /></div>
          <div>
            <p className="panel-stat__value">{stats ? formatNum(stats.active_businesses) : "…"}</p>
            <p className="panel-stat__label">آگهی فعال</p>
          </div>
        </div>
        <div className="panel-stat panel-stat--orange">
          <div className="panel-stat__icon"><i className="fa-solid fa-clock" /></div>
          <div>
            <p className="panel-stat__value">{stats ? formatNum(stats.pending_listing_approvals) : "…"}</p>
            <p className="panel-stat__label">در انتظار تأیید</p>
          </div>
        </div>
        <div className="panel-stat panel-stat--red">
          <div className="panel-stat__icon"><i className="fa-solid fa-ban" /></div>
          <div>
            <p className="panel-stat__value">{stats ? formatNum(stats.inactive_businesses) : "…"}</p>
            <p className="panel-stat__label">غیرفعال</p>
          </div>
        </div>
      </div>

      {err && <p style={{ color: "#b71c1c", marginBottom: "1rem" }}>{err}</p>}

      <div className="panel-cols">
        {/* Quick actions */}
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">اقدام سریع</h3>
          </div>
          <div className="panel-card__body">
            <div className="panel-quick-grid">
              <Link to="/admin-add" className="panel-quick-btn">
                <i className="fa-solid fa-plus" />
                افزودن آگهی
              </Link>
              <Link to="/admin-businesses" className="panel-quick-btn">
                <i className="fa-solid fa-list" />
                همه آگهی‌ها
              </Link>
              <Link to="/admin-edit" className="panel-quick-btn">
                <i className="fa-solid fa-pen" />
                ویرایش آگهی
              </Link>
              <Link to="/admin/exchanges" className="panel-quick-btn">
                <i className="fa-solid fa-coins" />
                صرافی‌ها
              </Link>
              <Link to="/admin-claims" className="panel-quick-btn">
                <i className="fa-solid fa-flag" />
                ادعاهای مالکیت
              </Link>
              <Link to="/admin-city-images" className="panel-quick-btn">
                <i className="fa-solid fa-image" />
                تصاویر شهرها
              </Link>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">یادداشت‌های داخلی</h3>
            <Link to="/admin-notes" className="pact-btn pact-btn--ghost">باز کردن کامل</Link>
          </div>
          <div className="panel-card__body">
            {brief ? (
              <>
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", color: "#475569" }}>
                  <strong style={{ color: "#0f172a" }}>{formatNum(brief.open_tasks_count)}</strong> کار باز
                </p>
                {brief.recent_notes && brief.recent_notes.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: "1.25rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {brief.recent_notes.map((n) => (
                      <li key={n.id} style={{ fontSize: "0.85rem", color: "#475569" }}>
                        {n.preview}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>یادداشتی ثبت نشده است.</p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>در حال بارگذاری…</p>
            )}
          </div>
        </div>
      </div>

      {/* QR stats card */}
      {stats && (
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">آمار اسکن QR</h3>
          </div>
          <div className="panel-card__body" style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 0.2rem", fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>{formatNum(stats.total_qr_scans)}</p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>کل اسکن QR</p>
            </div>
            <div>
              <p style={{ margin: "0 0 0.2rem", fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>{formatNum(stats.qr_scans_7d)}</p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>اسکن ۷ روز اخیر</p>
            </div>
          </div>
        </div>
      )}

      {/* Per-business Google QR scan leaderboard */}
      <div className="panel-card">
        <div className="panel-card__head">
          <h3 className="panel-card__title">اسکن QR لینک Google — به تفکیک آگهی</h3>
        </div>
        <div className="panel-card__body">
          {qrLeaderboard === null && (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>در حال بارگذاری…</p>
          )}
          {qrLeaderboard !== null && qrLeaderboard.length === 0 && (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>هنوز هیچ اسکنی ثبت نشده است.</p>
          )}
          {qrLeaderboard !== null && qrLeaderboard.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", color: "#475569", fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", color: "#475569", fontWeight: 600 }}>نام آگهی</th>
                  <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", color: "#475569", fontWeight: 600 }}>شناسه</th>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.5rem", color: "#475569", fontWeight: 600 }}>تعداد اسکن</th>
                </tr>
              </thead>
              <tbody>
                {qrLeaderboard.map((row, i) => (
                  <tr key={row.slug} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.4rem 0.5rem", color: "#94a3b8", width: "2rem" }}>{i + 1}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: "#0f172a" }}>{row.name_fa || row.slug}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: "#64748b", direction: "ltr", textAlign: "left" }}>{row.slug}</td>
                    <td style={{ padding: "0.4rem 0.5rem", textAlign: "left" }}>
                      <span style={{
                        display: "inline-block",
                        background: "#f0fdf4",
                        color: "#15803d",
                        borderRadius: "999px",
                        padding: "0.1rem 0.65rem",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        minWidth: "2.5rem",
                        textAlign: "center",
                      }}>
                        {formatNum(row.scan_count)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
