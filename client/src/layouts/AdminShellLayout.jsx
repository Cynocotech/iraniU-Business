import { useEffect } from "react";
import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AdminIdleSessionGuard from "../components/AdminIdleSessionGuard.jsx";
import ProfileAvatarUploader from "../components/ProfileAvatarUploader.jsx";

const adminNav = [
  { to: "/admin", label: "داشبورد", end: true },
  { to: "/admin-notes", label: "یادداشت و کارها" },
  { to: "/admin-security", label: "امنیت و ۲FA" },
  { to: "/admin-super-admins", label: "سوپرادمین‌ها" },
  { to: "/admin-businesses", label: "همه آگهی‌ها" },
  { to: "/admin-edit", label: "ویرایش آگهی" },
  { to: "/admin-add", label: "افزودن آگهی" },
  { to: "/admin-categories", label: "دسته‌بندی‌ها" },
  { to: "/admin-qr-export", label: "خروجی QR" },
  { to: "/admin-claims", label: "درخواست‌های ادعا" },
  { to: "/admin-link", label: "لینک آگهی ↔ مدیر" },
  { to: "/admin-billing", label: "صورت‌حساب" },
  { to: "/admin-managers", label: "حساب‌های مدیر" },
  { to: "/admin-chat-log", label: "گفتگو و لاگ سایت" },
  { to: "/admin-system-logs", label: "لاگ سیستم" },
];

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
    <>
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
          <Link className="app-shell__brand" to="/">
            <span className="app-shell__brand-mark" aria-hidden="true">
              ای
            </span>
            <span>ایرانیو</span>
          </Link>
          <p className="app-shell__nav-title">سوپرادمین</p>
          <ul className="app-shell__nav">
            {adminNav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end === true}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="app-shell__sidebar-foot">
            <Link to="/">بازگشت به سایت عمومی</Link>
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
            <div className="app-shell__search-wrap">
              <label className="visually-hidden" htmlFor="admin-global-search">
                جستجو در پنل
              </label>
              <input
                type="search"
                id="admin-global-search"
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
    </>
  );
}
