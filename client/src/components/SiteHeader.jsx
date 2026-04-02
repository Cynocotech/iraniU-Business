import { Link, NavLink } from "react-router-dom";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="logo" to="/" title="ایرانیو — صفحهٔ اصلی">
          <img
            className="logo__img"
            src="/images/iraniu-logo-header.png"
            alt=""
            width={200}
            height={52}
            decoding="async"
          />
          <span className="visually-hidden">ایرانیو — صفحهٔ اصلی</span>
        </Link>
        <input type="checkbox" id="site-nav-toggle" className="site-nav-cb" />
        <label htmlFor="site-nav-toggle" className="nav-toggle" aria-label="باز و بسته کردن منو">
          <span></span>
          <span></span>
          <span></span>
        </label>
        <nav className="nav" id="site-nav" aria-label="اصلی">
          <ul className="nav__links">
            <li>
              <NavLink to="/">خانه</NavLink>
            </li>
            <li>
              <NavLink to="/listings">لیست کسب‌وکارها</NavLink>
            </li>
            <li>
              <NavLink to="/dashboard">پنل کسب‌وکار</NavLink>
            </li>
          </ul>
          <div className="nav__cta">
            <Link className="btn btn--ghost" to="/onboarding">
              ثبت کسب‌وکار
            </Link>
            <Link className="btn btn--primary" to="/listings">
              جستجو
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
