import { useEffect } from "react";
import { Outlet, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { AdminPanelSearchProvider, useAdminPanelSearch } from "../context/AdminPanelSearchContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import AdminIdleSessionGuard from "../components/AdminIdleSessionGuard.jsx";
import ProfileAvatarUploader from "../components/ProfileAvatarUploader.jsx";
import { adminShellNavIcons } from "../components/AdminShellNavIcons.jsx";

const adminNav = [
  { to: "/admin", label: "داشبورد", end: true, icon: "dashboard" },
  { to: "/admin-notes", label: "یادداشت و کارها", icon: "notes" },
  { to: "/admin-businesses", label: "همه آگهی‌ها", icon: "businesses" },
  { to: "/admin-edit", label: "ویرایش آگهی", icon: "edit" },
  { to: "/admin-add", label: "افزودن آگهی", icon: "add" },
  { to: "/admin-import", label: "ورود دسته‌ای CSV", icon: "importCsv" },
  { to: "/admin-categories", label: "دسته‌بندی‌ها", icon: "categories" },
  { to: "/admin-qr-export", label: "خروجی QR", icon: "qrExport" },
  { to: "/admin-claims", label: "درخواست‌های ادعا", icon: "claims" },
  { to: "/admin-business-reports", label: "گزارش‌های آگهی", icon: "report" },
  { to: "/admin-link", label: "لینک آگهی ↔ مدیر", icon: "link" },
  { to: "/admin-billing", label: "صورت‌حساب", icon: "billing" },
  { to: "/admin-managers", label: "حساب‌های مدیر", icon: "managers" },
  { to: "/admin-chat-log", label: "گفتگو و لاگ سایت", icon: "chatLog" },
  { to: "/admin-settings", label: "تنظیمات", icon: "settings" },
];

function AdminShellSearchInput() {
  const { query, setQuery } = useAdminPanelSearch();
  const location = useLocation();
  const onBusinesses = location.pathname === "/admin-businesses";
  return (
    <div className="app-shell__search-wrap">
      <label className="visually-hidden" htmlFor="admin-global-search">
        {onBusinesses ? "جستجو در فهرست آگهی‌ها" : "جستجو در پنل"}
      </label>
      <input
        type="search"
        id="admin-global-search"
        className="app-shell__search"
        placeholder={onBusinesses ? "جستجو در آگهی‌ها — نام، نامک، شهر، تلفن…" : "جستجو در پنل…"}
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-describedby={onBusinesses ? "admin-search-hint" : undefined}
      />
      {onBusinesses && (
        <span id="admin-search-hint" className="visually-hidden">
          فیلتر زنده روی جدول «همه آگهی‌ها»
        </span>
      )}
    </div>
  );
}

export default function AdminShellLayout() {
  const { logout, me } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add("app-shell-body");
    return () => document.body.classList.remove("app-shell-body");
  }, []);

  const onLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <AdminPanelSearchProvider>
      <Seo title="پنل سوپرادمین" noindex description="پنل مدیریت سایت ایرانیو — فقط برای مدیران." />
      <AdminIdleSessionGuard />
      <a className="skip-link" href="#main">
        پرش به محتوا
      </a>
      <div className="app-shell" id="main">
        <input type="checkbox" id="admin-shell-sidebar-toggle" className="app-shell-sidebar-cb" />
        <label
          className="app-shell__sidebar-overlay"
          htmlFor="admin-shell-sidebar-toggle"
          aria-hidden="true"
        ></label>
        <aside className="app-shell__sidebar" aria-label="منوی ادمین">
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
          <p className="app-shell__nav-title">سوپرادمین</p>
          <ul className="app-shell__nav">
            {adminNav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end === true}>
                  <span className="app-shell__nav-icon" aria-hidden="true">
                    {adminShellNavIcons[item.icon]}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="app-shell__sidebar-foot">
            <Link to="/">
              <span className="app-shell__nav-icon" aria-hidden="true">
                {adminShellNavIcons.homePublic}
              </span>
              <span>بازگشت به سایت عمومی</span>
            </Link>
          </div>
        </aside>

        <div className="app-shell__body">
          <header className="app-shell__header">
            <label
              htmlFor="admin-shell-sidebar-toggle"
              className="app-shell__sidebar-toggle"
              aria-label="باز و بسته کردن منو"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path stroke="currentColor" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
            <div className="app-shell__header-text">
              <h1>پنل سوپرادمین</h1>
              <p>سلام! خوش آمدید — همان چیدمان داشبورد کسب‌وکار</p>
            </div>
            <AdminShellSearchInput />
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
                  <strong>سوپرادمین</strong>
                  <small dir="ltr">{me?.user?.email || "—"}</small>
                </div>
              </div>
            </div>
          </header>
          <div className="app-shell__scroll">
            <div className="dashboard-wrap">
              <div className="dashboard">
                <aside className="dashboard-sidebar" aria-hidden="true"></aside>
                <div className="dashboard-main">
                  <Outlet />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminPanelSearchProvider>
  );
}
