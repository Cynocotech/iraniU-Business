import { useEffect } from "react";
import { Outlet, Link, NavLink } from "react-router-dom";

const nav = [
  { to: "/dashboard#panel-overview", label: "نمای کلی" },
  { to: "/dashboard#edit-ad", label: "ویرایش آگهی" },
  { to: "/dashboard#package", label: "بسته تبلیغاتی" },
  { to: "/dashboard#media", label: "تصاویر" },
  { to: "/dashboard#qr-review", label: "QR نظر Google" },
  { to: "/business", label: "پیش‌نمایش عمومی" },
];

export default function AppShellLayout() {
  useEffect(() => {
    document.body.classList.add("app-shell-body");
    return () => document.body.classList.remove("app-shell-body");
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">
        پرش به محتوا
      </a>
      <div className="app-shell" id="main">
        <input type="checkbox" id="app-shell-sidebar-toggle" className="app-shell-sidebar-cb" />
        <label
          className="app-shell__sidebar-overlay"
          htmlFor="app-shell-sidebar-toggle"
          aria-hidden="true"
        ></label>
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
          <ul className="app-shell__nav">
            {nav.map((item) => (
              <li key={item.to}>
                <a href={item.to}>{item.label}</a>
              </li>
            ))}
          </ul>
          <div className="app-shell__sidebar-foot">
            <Link to="/listings">مشاهده در فهرست</Link>
            {" · "}
            <Link to="/advertise">ارتقای بسته</Link>
          </div>
        </aside>

        <div className="app-shell__body">
          <header className="app-shell__header">
            <label
              htmlFor="app-shell-sidebar-toggle"
              className="app-shell__sidebar-toggle"
              aria-label="باز و بسته کردن منو"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path stroke="currentColor" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
            <div className="app-shell__header-text">
              <h1>پنل کسب‌وکار</h1>
              <p>سلام! خوش آمدید — نمونه متصل به SQLite</p>
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
              <div className="app-shell__user">
                <div className="app-shell__user-avatar" aria-hidden="true">
                  س
                </div>
                <div className="app-shell__user-text">
                  <strong>مالک آگهی</strong>
                  <small>پنل کسب‌وکار</small>
                </div>
              </div>
            </div>
          </header>

          <div className="app-shell__scroll">
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}
