import { Fragment, useEffect, useState } from "react";
import { Outlet, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { AdminPanelSearchProvider, useAdminPanelSearch } from "../context/AdminPanelSearchContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import AdminIdleSessionGuard from "../components/AdminIdleSessionGuard.jsx";
import ProfileAvatarUploader from "../components/ProfileAvatarUploader.jsx";
import { adminShellNavIcons } from "../components/AdminShellNavIcons.jsx";
import "../panel-redesign.css";

/** OpenAPI / Swagger — default matches production panel docs */
const API_DOCS_URL = (import.meta.env.VITE_API_DOCS_URL || "").trim() || "https://panel.iraniu.uk/docs/api/";

const adminNavSections = [
  {
    id: "overview",
    title: "عمومی",
    items: [
      { to: "/admin", label: "داشبورد", end: true, icon: "dashboard" },
      { to: "/admin-notes", label: "یادداشت و کارها", icon: "notes" },
      { to: "/admin-blog", label: "مدیریت وبلاگ", icon: "notes" },
      { to: "/admin-blog/new", label: "نوشته جدید", icon: "add" },
    ],
  },
  {
    id: "listings",
    title: "مدیریت آگهی‌ها",
    items: [
      { to: "/admin-businesses", label: "همه آگهی‌ها", icon: "businesses" },
      { to: "/admin-add", label: "افزودن آگهی", icon: "add" },
      { to: "/admin-edit", label: "ویرایش آگهی", icon: "edit" },
      { to: "/admin-import", label: "ورود CSV", icon: "importCsv" },
      { to: "/admin-categories", label: "دسته‌بندی‌ها", icon: "categories" },
      { to: "/admin-home-sections", label: "بخش‌های صفحه اصلی", icon: "notes" },
      { to: "/admin-qr-export", label: "خروجی QR", icon: "qrExport" },
    ],
  },
  {
    id: "users",
    title: "کاربران و درخواست‌ها",
    items: [
      { to: "/admin-managers", label: "حساب‌های مدیر", icon: "managers" },
      { to: "/admin-link", label: "لینک آگهی ↔ مدیر", icon: "link" },
      { to: "/admin-claims", label: "درخواست‌های ادعا", icon: "claims" },
      { to: "/admin-business-reports", label: "گزارش‌های آگهی", icon: "report" },
    ],
  },
  {
    id: "blog",
    title: "وبلاگ",
    items: [
      { to: "/admin-blog", label: "مدیریت مطالب", icon: "notes" },
      { to: "/admin-blog/new", label: "نوشته جدید", icon: "add" },
    ],
  },
  {
    id: "tokens",
    title: "توکن و تبلیغات",
    items: [
      { to: "/admin-tokens", label: "توکن‌ها و بوست", icon: "billing" },
      { to: "/admin/exchanges/banners", label: "بنرهای تبلیغاتی", icon: "ads" },
    ],
  },
  {
    id: "tools",
    title: "ابزارها",
    items: [
      { to: "/admin-chat-log", label: "گفتگو و لاگ", icon: "chatLog" },
      { to: "/admin-settings", label: "تنظیمات", icon: "settings" },
    ],
  },
  {
    id: "exchange",
    title: "خدمات ارزی",
    items: [
      { to: "/admin/exchanges", label: "دپارتمان صرافی", icon: "exchanges" },
      { to: "/admin/exchanges/banners", label: "بنرهای تبلیغاتی", icon: "ads" },
    ],
  },
];

function AdminShellSearchInput() {
  const { query, setQuery } = useAdminPanelSearch();
  const location = useLocation();
  const onExchangeHub = location.pathname === "/admin/exchanges" || location.pathname.startsWith("/admin/exchanges/");
  if (onExchangeHub) return null;
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
  const [collapsed, setCollapsed] = useState({});
  const toggleSection = (id) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  const location = useLocation();
  const onExchangeHub =
    location.pathname === "/admin/exchanges" || location.pathname.startsWith("/admin/exchanges/");

  useEffect(() => {
    document.body.classList.add("app-shell-body");
    return () => document.body.classList.remove("app-shell-body");
  }, []);

  useEffect(() => {
    if (onExchangeHub) document.body.classList.add("app-shell-body--exchange-hub");
    return () => document.body.classList.remove("app-shell-body--exchange-hub");
  }, [onExchangeHub]);

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
        <aside
          className={`app-shell__sidebar${onExchangeHub ? " app-shell__sidebar--exchange" : ""}`}
          aria-label="منوی ادمین"
        >
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
            {adminNavSections.map((section) => {
              const isCollapsed = !!collapsed[section.id];
              return (
                <Fragment key={section.id}>
                  <li className="app-shell__nav-heading">
                    <button
                      type="button"
                      className="app-shell__nav-heading-btn"
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={!isCollapsed}
                    >
                      <span className="app-shell__nav-heading-text">{section.title}</span>
                      <span className="app-shell__nav-heading-toggle" aria-hidden="true">
                        {isCollapsed ? "+" : "−"}
                      </span>
                    </button>
                  </li>
                  {!isCollapsed && section.items.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} end={item.end === true}>
                        <span className="app-shell__nav-icon" aria-hidden="true">
                          {adminShellNavIcons[item.icon]}
                        </span>
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </Fragment>
              );
            })}
          </ul>
          <div className="app-shell__sidebar-foot app-shell__sidebar-foot--stack">
            <Link to="/">
              <span className="app-shell__nav-icon" aria-hidden="true">
                {adminShellNavIcons.homePublic}
              </span>
              <span>بازگشت به سایت عمومی</span>
            </Link>
            <a
              href={API_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="مستندات API Swagger — باز می‌شود در تب جدید"
            >
              <span className="app-shell__nav-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </span>
              <span>مستندات API</span>
            </a>
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
              <h1>{onExchangeHub ? "دپارتمان صرافی (ادمین)" : "پنل سوپرادمین"}</h1>
              <p>
                {onExchangeHub
                  ? "مدیریت جدا از فهرست عمومی دایرکتوری — فقط صرافی و نرخ‌ها"
                  : "سلام! خوش آمدید — همان چیدمان داشبورد کسب‌وکار"}
              </p>
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
