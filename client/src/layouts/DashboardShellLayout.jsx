import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { DashboardProvider, useDashboard } from "../context/DashboardContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { dashboardIcons } from "../components/DashboardPanelHead.jsx";
import ProfileAvatarUploader from "../components/ProfileAvatarUploader.jsx";

const NAV = [
  { to: "/dashboard", label: "نمای کلی", end: true },
  { to: "/dashboard/edit", label: "ویرایش آگهی" },
  { to: "/dashboard/careers", label: "فرصت‌های شغلی" },
  { to: "/dashboard/media", label: "تصاویر" },
  { to: "/dashboard/twilio", label: "تنظیمات Twilio" },
  { to: "/dashboard/calls", label: "لاگ تماس‌ها" },
  { to: "/dashboard/qr", label: "QR نظر Google" },
  { to: "/dashboard/biolink", label: "لینک‌های من (Biolink)" },
];

function ImpersonationBanner() {
  const { impersonation, endImpersonation } = useDashboard();
  if (!impersonation) return null;
  return (
    <div
      className="dashboard-panel dashboard-panel--impersonate"
      style={{
        marginBottom: "var(--space-md)",
        border: "1px solid rgba(46, 125, 50, 0.35)",
        background: "rgba(232, 245, 233, 0.95)",
      }}
      role="status"
    >
      <div className="dashboard-panel__head dashboard-panel__head--inline">
        <span className="dashboard-panel__icon dashboard-panel__icon--muted" aria-hidden="true">
          {dashboardIcons.impersonate}
        </span>
        <p style={{ margin: 0, fontWeight: 600 }}>حالت ورود از سوپرادمین</p>
      </div>
      <p className="field-hint" style={{ margin: "0.35rem 0 0" }}>
        پنل به‌عنوان مدیر <strong>{impersonation.name}</strong>
        {impersonation.email ? (
          <>
            {" "}
            (<span dir="ltr">{impersonation.email}</span>)
          </>
        ) : null}
      </p>
      {impersonation.noBusiness && (
        <p className="field-hint" style={{ margin: "0.5rem 0 0", color: "#5d4037" }}>
          هیچ آگهی‌ای به این مدیر وصل نیست. در سوپرادمین از «لینک آگهی ↔ مدیر» یک آگهی را انتساب دهید.
        </p>
      )}
      <div className="dashboard-actions dashboard-actions--inline" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn btn--primary" onClick={endImpersonation}>
          پایان و بازگشت به حساب‌های مدیر
        </button>
        <Link className="btn btn--ghost" to="/admin">
          داشبورد سوپرادمین
        </Link>
      </div>
    </div>
  );
}

function DashboardChrome() {
  const { dashSlug } = useDashboard();
  const { logout, me } = useAuth();
  const navigate = useNavigate();
  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  const previewTo = `/business?slug=${encodeURIComponent(dashSlug)}`;
  const biolinkPublicTo = `/l/${encodeURIComponent(dashSlug)}`;

  return (
    <>
      <a className="skip-link" href="#main">
        پرش به محتوا
      </a>
      <div className="app-shell" id="main">
        <input type="checkbox" id="app-shell-sidebar-toggle" className="app-shell-sidebar-cb" />
        <label className="app-shell__sidebar-overlay" htmlFor="app-shell-sidebar-toggle" aria-hidden="true" />
        <aside className="app-shell__sidebar" aria-label="منوی پنل">
          <Link className="app-shell__brand" to="/">
            <span className="app-shell__brand-mark" aria-hidden="true">
              ای
            </span>
            <span>ایرانیو</span>
          </Link>
          <p className="app-shell__nav-title">پنل کسب‌وکار</p>
          <ul className="app-shell__nav">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              <Link to={previewTo}>پیش‌نمایش صفحهٔ آگهی</Link>
            </li>
            <li>
              <Link to={biolinkPublicTo} target="_blank" rel="noreferrer">
                صفحهٔ Biolink (عمومی)
              </Link>
            </li>
          </ul>
          <div className="app-shell__sidebar-foot">
            <Link to="/listings">مشاهده در فهرست</Link>
          </div>
        </aside>

        <div className="app-shell__body">
          <header className="app-shell__header">
            <label htmlFor="app-shell-sidebar-toggle" className="app-shell__sidebar-toggle" aria-label="باز و بسته کردن منو">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path stroke="currentColor" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
            <div className="app-shell__header-text">
              <h1>پنل کسب‌وکار</h1>
              <p>مدیریت آگهی، لینک‌ها و ابزارها</p>
            </div>
            <div className="app-shell__search-wrap">
              <label className="visually-hidden" htmlFor="dash-global-search">
                جستجو در پنل
              </label>
              <input
                type="search"
                id="dash-global-search"
                className="app-shell__search"
                placeholder="جستجو در پنل…"
                autoComplete="off"
              />
            </div>
            <div className="app-shell__header-actions">
              <button type="button" className="btn btn--ghost" onClick={onLogout}>
                خروج
              </button>
              <ProfileAvatarUploader />
              <div className="app-shell__user">
                <div className="app-shell__user-avatar" aria-hidden="true">
                  {me?.user?.avatar_url ? (
                    <img
                      src={me.user.avatar_url}
                      alt=""
                      style={{ width: "100%", height: "100%", borderRadius: "999px", objectFit: "cover" }}
                    />
                  ) : (
                    "س"
                  )}
                </div>
                <div className="app-shell__user-text">
                  <strong>{me?.role === "superadmin" ? "سوپرادمین" : "مدیر آگهی"}</strong>
                  <small dir="ltr">{me?.user?.email || "—"}</small>
                </div>
              </div>
            </div>
          </header>

          <div className="app-shell__scroll">
            <ImpersonationBanner />
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardShellLayout() {
  useEffect(() => {
    document.body.classList.add("app-shell-body");
    return () => document.body.classList.remove("app-shell-body");
  }, []);

  return (
    <DashboardProvider>
      <DashboardChrome />
    </DashboardProvider>
  );
}
