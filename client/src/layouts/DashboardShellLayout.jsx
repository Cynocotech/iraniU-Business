import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { DashboardProvider, useDashboard } from "../context/DashboardContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { dashboardIcons } from "../components/DashboardPanelHead.jsx";
import ProfileAvatarUploader from "../components/ProfileAvatarUploader.jsx";
import { isExchangeBusiness } from "../lib/exchangeRates.js";

const NAV_BASE = [
  { to: "/dashboard", label: "نمای کلی", end: true, iconKey: "overview" },
  { to: "/dashboard/careers", label: "فرصت‌های شغلی", iconKey: "careers" },
  { to: "/dashboard/media", label: "تصاویر", iconKey: "media" },
  { to: "/dashboard/twilio", label: "تنظیمات Twilio", twilioOnly: true, iconKey: "twilio" },
  { to: "/dashboard/calls", label: "لاگ تماس‌ها", twilioOnly: true, iconKey: "calls" },
  { to: "/dashboard/qr", label: "QR نظر Google", iconKey: "qr" },
  { to: "/dashboard/biolink", label: "لینک‌های من (Biolink)", iconKey: "biolink" },
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
  const { dashSlug, twilioModuleEnabled, biz } = useDashboard();
  const navItems = NAV_BASE.filter((item) => !item.twilioOnly || twilioModuleEnabled);
  const { logout, me, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const isExchangePanel = isExchangeBusiness(biz);
  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  const previewTo = `/business?slug=${encodeURIComponent(dashSlug)}`;
  const biolinkPublicTo = `/l/${encodeURIComponent(dashSlug)}`;

  return (
    <>
      <Seo title="پنل کسب‌وکار" noindex description="ورود مدیران آگهی برای ویرایش اطلاعات در ایرانیو." />
      <a className="skip-link" href="#main">
        پرش به محتوا
      </a>
      <div className={`app-shell${isExchangePanel ? " app-shell--exchange-panel" : ""}`} id="main">
        <input type="checkbox" id="app-shell-sidebar-toggle" className="app-shell-sidebar-cb" />
        <label className="app-shell__sidebar-overlay" htmlFor="app-shell-sidebar-toggle" aria-hidden="true" />
        <aside className="app-shell__sidebar" aria-label="منوی پنل">
          <Link className="app-shell__brand" to="/" title="ایرانیو — صفحهٔ اصلی">
            <img
              className="app-shell__brand-img"
              src="/images/iraniu-logo-header.png"
              alt=""
              width={200}
              height={52}
              decoding="async"
            />
            <span className="visually-hidden">ایرانیو — صفحهٔ اصلی</span>
          </Link>
          <p className="app-shell__nav-title">پنل کسب‌وکار</p>
          <p className="app-shell__nav-title">ویرایش آگهی</p>
          <ul className="app-shell__nav">
            <li>
              <NavLink to="/dashboard/edit">
                <span className="app-shell__nav-icon" aria-hidden="true">
                  {dashboardIcons.edit}
                </span>
                <span>ویرایش آگهی</span>
              </NavLink>
            </li>
          </ul>
          {isExchangePanel ? (
            <>
          <p className="app-shell__nav-title">نرخ‌ها</p>
          <ul className="app-shell__nav">
            <li>
              <NavLink to="/dashboard/rates">
                <span className="app-shell__nav-icon" aria-hidden="true">
                  {dashboardIcons.package}
                </span>
                <span>نرخ‌ها</span>
              </NavLink>
            </li>
          </ul>
            </>
          ) : null}
          <p className="app-shell__nav-title">ابزارها</p>
          <ul className="app-shell__nav">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  <span className="app-shell__nav-icon" aria-hidden="true">
                    {dashboardIcons[item.iconKey]}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
            {isSuperAdmin ? (
              <li>
                <Link to={previewTo}>
                  <span className="app-shell__nav-icon" aria-hidden="true">
                    {dashboardIcons.preview}
                  </span>
                  <span>پیش‌نمایش صفحهٔ آگهی</span>
                </Link>
              </li>
            ) : null}
            <li>
              <Link to={biolinkPublicTo} target="_blank" rel="noreferrer">
                <span className="app-shell__nav-icon" aria-hidden="true">
                  {dashboardIcons.external}
                </span>
                <span>صفحهٔ Biolink (عمومی)</span>
              </Link>
            </li>
          </ul>
          <div className="app-shell__sidebar-foot">
            <Link to="/listings">
              <span className="app-shell__nav-icon" aria-hidden="true">
                {dashboardIcons.listings}
              </span>
              <span>مشاهده در فهرست</span>
            </Link>
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
              <h1>{isExchangePanel ? "پنل مدیریت صرافی" : "پنل کسب‌وکار"}</h1>
              <p>{isExchangePanel ? "نرخ‌ها، وضعیت انتشار و مدیریت سریع" : "مدیریت آگهی، لینک‌ها و ابزارها"}</p>
            </div>
            <div className="app-shell__search-wrap">
              <label className="visually-hidden" htmlFor="dash-global-search">
                جستجو در پنل
              </label>
              <input
                type="search"
                id="dash-global-search"
                className="app-shell__search"
                placeholder={isExchangePanel ? "جستجو در پنل صرافی…" : "جستجو در پنل…"}
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
