import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

export default function SiteHeader({ logoHref = "/", hamburgerOnly = false, hideLinks = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const logoTitle =
    logoHref === "/exchanges" ? "بازگشت به لیست صرافی‌ها" : "ایرانیو — صفحهٔ اصلی";
  const logoHiddenLabel = logoHref === "/exchanges" ? "بازگشت به لیست صرافی‌ها" : "ایرانیو — صفحهٔ اصلی";
  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={`site-header${hamburgerOnly ? " site-header--hamburger-only" : ""}${hideLinks ? " site-header--logo-only" : ""}`}
      role="banner"
    >
      <div className="site-header__bar">
        <div className="site-header__inner">
          <Link className="logo" to={logoHref} title={logoTitle}>
            <img
              className="logo__img"
              src="/images/iraniu-logo-header.png"
              alt=""
              width={200}
              height={52}
              decoding="async"
            />
            <span className="visually-hidden">{logoHiddenLabel}</span>
          </Link>
          {hamburgerOnly && !hideLinks ? (
            <button
              type="button"
              className="site-header__hamburger-btn"
              aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
              aria-controls="site-nav"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <i className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"}`} aria-hidden="true" />
            </button>
          ) : null}
          {!hideLinks ? (
            <nav className={`nav nav--labeled${hamburgerOnly ? " site-header__hamburger-nav" : ""}${menuOpen ? " is-open" : ""}`} id="site-nav" aria-label="اصلی">
              <ul className="nav__links nav__links--labeled site-header__icon-links">
                <li>
                  <NavLink to="/" end className="nav__icon-link" title="خانه" onClick={closeMenu}>
                    <span className="nav__icon-link-inner">
                      <i className="fa-solid fa-house" aria-hidden="true" />
                      <span className="nav__icon-link-label">خانه</span>
                    </span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/listings" className="nav__icon-link" title="لیست کسب‌وکارها" onClick={closeMenu}>
                    <span className="nav__icon-link-inner">
                      <i className="fa-solid fa-store" aria-hidden="true" />
                      <span className="nav__icon-link-label">لیست کسب‌وکارها</span>
                    </span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/dashboard" className="nav__icon-link" title="پنل کسب‌وکار" onClick={closeMenu}>
                    <span className="nav__icon-link-inner">
                      <i className="fa-solid fa-gauge-high" aria-hidden="true" />
                      <span className="nav__icon-link-label">پنل کسب‌وکار</span>
                    </span>
                  </NavLink>
                </li>
              </ul>
              <div className="nav__cta nav__cta--labeled site-header__icon-cta">
                <Link className="site-header__icon-btn site-header__icon-btn--ghost" to="/onboarding" title="ثبت کسب‌وکار" onClick={closeMenu}>
                  <span className="site-header__icon-btn-inner">
                    <i className="fa-solid fa-circle-plus" aria-hidden="true" />
                    <span className="site-header__icon-btn-label">ثبت کسب‌وکار</span>
                  </span>
                </Link>
                <Link className="site-header__icon-btn site-header__icon-btn--primary" to="/listings" title="جستجو" onClick={closeMenu}>
                  <span className="site-header__icon-btn-inner">
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                    <span className="site-header__icon-btn-label">جستجو</span>
                  </span>
                </Link>
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}
