import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import DemoBottomNav from "../components/DemoBottomNav.jsx";

const DEMO_STYLES = `
  @font-face { font-family: 'Yekan Bakh'; font-weight: 400; font-style: normal; src: local('YekanBakh-Regular'), url('/fonts/YekanBakh-Regular.otf') format('opentype'); }
  @font-face { font-family: 'Yekan Bakh'; font-weight: 700; font-style: normal; src: local('YekanBakh-Bold'), url('/fonts/YekanBakh-Bold.otf') format('opentype'); }
  @font-face { font-family: 'Yekan Bakh'; font-weight: 800; font-style: normal; src: local('YekanBakh-ExtraBlack'), url('/fonts/YekanBakh-ExtraBlack.otf') format('opentype'); }
  .demo-page { font-family: 'Yekan Bakh', Tahoma, Arial, sans-serif; color: #222; min-height: 100vh; }
  .demo-header { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: rgba(12,8,30,0.96); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.08); }
  .demo-header__inner { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; height: 68px; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; }
  .demo-header__logo img { height: 38px; display: block; }

  /* Desktop nav */
  .demo-header__nav { display: flex; align-items: center; gap: 0.25rem; }
  .demo-header__nav a { color: rgba(255,255,255,0.82); text-decoration: none; padding: 0.4rem 0.85rem; border-radius: 6px; font-size: 0.9rem; font-family: 'Yekan Bakh', Tahoma, Arial, sans-serif; transition: background 0.2s, color 0.2s; }
  .demo-header__nav a:hover,
  .demo-header__nav a.demo-nav-active { background: rgba(255,255,255,0.12); color: #fff; }

  /* Desktop actions */
  .demo-header__actions { display: flex; gap: 0.6rem; align-items: center; }

  /* Hamburger button — hidden on desktop */
  .demo-header__burger {
    display: none;
    background: none; border: none;
    color: rgba(255,255,255,0.85); font-size: 1.35rem; cursor: pointer;
    width: 40px; height: 40px;
    border-radius: 8px;
    align-items: center; justify-content: center;
    transition: background 0.18s;
    padding: 0;
  }
  .demo-header__burger:hover { background: rgba(255,255,255,0.1); }

  /* Mobile menu panel */
  .demo-mobile-menu {
    display: none;
    position: fixed; top: 68px; left: 0; right: 0; z-index: 999;
    background: rgba(10,6,24,0.98);
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding: 0.75rem 1.25rem 1.25rem;
    flex-direction: column; gap: 0.25rem;
    animation: demo-menu-drop 0.2s ease;
  }
  .demo-mobile-menu--open { display: flex; }
  @keyframes demo-menu-drop {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .demo-mobile-menu a {
    color: rgba(255,255,255,0.8); text-decoration: none;
    padding: 0.72rem 0.85rem; border-radius: 10px;
    font-size: 0.96rem; font-family: 'Yekan Bakh', Tahoma, Arial, sans-serif;
    display: flex; align-items: center; gap: 0.55rem;
    transition: background 0.15s, color 0.15s;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .demo-mobile-menu a:last-child { border-bottom: none; }
  .demo-mobile-menu a:hover,
  .demo-mobile-menu a.demo-nav-active { background: rgba(255,255,255,0.08); color: #fff; }
  .demo-mobile-menu a i { color: #a78bfa; font-size: 0.9rem; width: 16px; text-align: center; flex-shrink: 0; }
  .demo-mobile-menu__divider {
    height: 1px; background: rgba(255,255,255,0.07); margin: 0.4rem 0;
  }
  .demo-mobile-menu__actions {
    display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;
  }
  .demo-mobile-menu__actions .demo-btn {
    justify-content: center; width: 100%; text-align: center; padding: 0.65rem 1rem;
  }

  /* Buttons */
  .demo-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 1.1rem; border-radius: 6px; font-size: 0.88rem; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: all 0.2s; font-family: 'Yekan Bakh', Tahoma, Arial, sans-serif; }
  .demo-btn--outline { background: transparent; border: 1.5px solid rgba(255,255,255,0.45); color: #fff; }
  .demo-btn--outline:hover { background: rgba(255,255,255,0.1); }
  .demo-btn--accent { background: linear-gradient(135deg,#f4511e,#e53935); color: #fff; }
  .demo-btn--accent:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(244,81,30,0.45); }

  /* Footer */
  .demo-footer { background: #0c081e; color: rgba(255,255,255,0.7); padding: 4rem 1.5rem 2rem; }
  .demo-footer__inner { max-width: 1200px; margin: 0 auto; }
  .demo-footer__grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 2.5rem; margin-bottom: 3rem; }
  .demo-footer__logo img { height: 34px; margin-bottom: 1rem; }
  .demo-footer__desc { font-size: 0.88rem; line-height: 1.7; color: rgba(255,255,255,0.5); margin: 0 0 1.25rem; }
  .demo-footer__social { display: flex; gap: 0.6rem; }
  .demo-footer__social-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.65); font-size: 0.85rem; text-decoration: none; transition: background 0.2s; }
  .demo-footer__social-btn:hover { background: #5c1f6e; color: #fff; }
  .demo-footer__col-title { color: #fff; font-size: 0.95rem; font-weight: 700; margin: 0 0 1.25rem; }
  .demo-footer__links { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .demo-footer__links a { color: rgba(255,255,255,0.55); text-decoration: none; font-size: 0.88rem; font-family: 'Yekan Bakh', Tahoma, Arial, sans-serif; transition: color 0.2s; }
  .demo-footer__links a:hover { color: #f4511e; }
  .demo-footer__bottom { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; font-size: 0.82rem; color: rgba(255,255,255,0.35); }
  .demo-footer__back { color: rgba(200,160,255,0.7); text-decoration: none; font-size: 0.82rem; font-family: 'Yekan Bakh', Tahoma, Arial, sans-serif; }
  .demo-footer__back:hover { color: #c8a0ff; }
  .demo-main { margin-top: 68px; }

  /* Responsive: show burger, hide desktop nav + actions */
  @media(max-width:768px){
    .demo-header__nav { display: none; }
    .demo-header__actions { display: none; }
    .demo-header__burger { display: flex; }
    .demo-footer { display: none; }
    .demo-main { padding-bottom: calc(4rem + env(safe-area-inset-bottom, 0px)); }
    .demo-footer__grid { grid-template-columns: 1fr 1fr; }
  }
  @media(max-width:480px){
    .demo-footer__grid { grid-template-columns: 1fr; }
  }
`;

const NAV_LINKS = [
  { to: "/", label: "خانه", icon: "fa-house", key: "" },
  { to: "/listings", label: "آگهی‌ها", icon: "fa-store", key: "listings" },
  { to: "/exchanges", label: "صرافی‌ها", icon: "fa-coins", key: "exchanges" },
  { to: "/boost-plans", label: "پلن‌های تبلیغاتی", icon: "fa-bolt", key: "boost-plans" },
  { to: "/blog", label: "وبلاگ", icon: "fa-newspaper", key: "blog" },
  { to: "/tfl", label: "حمل‌ونقل لندن", icon: "fa-bus", key: "tfl" },
];

export default function DemoLayout() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeNav = pathname.startsWith("/exchanges")
    ? "exchanges"
    : pathname.startsWith("/listings")
    ? "listings"
    : pathname.startsWith("/boost-plans")
    ? "boost-plans"
    : pathname.startsWith("/blog")
    ? "blog"
    : pathname.startsWith("/tfl")
    ? "tfl"
    : pathname === "/"
    ? ""
    : "";

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="demo-page" dir="rtl" lang="fa">
      <style>{DEMO_STYLES}</style>

      <header className="demo-header">
        <div className="demo-header__inner">
          <Link to="/" className="demo-header__logo" onClick={closeMenu}>
            <img src="/images/iraniu-logo-header.png" alt="ایرانیو" />
          </Link>

          {/* Desktop nav */}
          <nav className="demo-header__nav" aria-label="منوی اصلی">
            <Link to="/">خانه</Link>
            <Link
              to="/listings"
              style={activeNav === "listings" ? { background: "rgba(255,255,255,0.12)", color: "#fff" } : undefined}
            >
              آگهی‌ها
            </Link>
            <Link
              to="/exchanges"
              style={activeNav === "exchanges" ? { background: "rgba(255,255,255,0.12)", color: "#fff" } : undefined}
            >
              صرافی‌ها
            </Link>
            <Link
              to="/boost-plans"
              style={activeNav === "boost-plans" ? { background: "rgba(255,255,255,0.12)", color: "#fff" } : undefined}
            >
              پلن‌های تبلیغاتی
            </Link>
            <Link
              to="/blog"
              style={activeNav === "blog" ? { background: "rgba(255,255,255,0.12)", color: "#fff" } : undefined}
            >
              وبلاگ
            </Link>
            <Link
              to="/tfl"
              style={activeNav === "tfl" ? { background: "rgba(255,255,255,0.12)", color: "#fff" } : undefined}
            >
              🚇 حمل‌ونقل
            </Link>
          </nav>

          {/* Desktop action buttons */}
          <div className="demo-header__actions">
            <Link to="/login" className="demo-btn demo-btn--outline">ورود</Link>
            <Link to="/onboarding" className="demo-btn demo-btn--accent">ثبت کسب‌وکار</Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="demo-header__burger"
            aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
            aria-expanded={menuOpen}
            aria-controls="demo-mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <i className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"}`} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      <nav
        id="demo-mobile-menu"
        className={`demo-mobile-menu${menuOpen ? " demo-mobile-menu--open" : ""}`}
        aria-label="منوی موبایل"
        dir="rtl"
      >
        {NAV_LINKS.map((lnk) => (
          <Link
            key={lnk.key}
            to={lnk.to}
            className={activeNav === lnk.key ? "demo-nav-active" : undefined}
            onClick={closeMenu}
          >
            <i className={`fa-solid ${lnk.icon}`} aria-hidden="true" />
            {lnk.label}
          </Link>
        ))}
        <div className="demo-mobile-menu__divider" aria-hidden="true" />
        <div className="demo-mobile-menu__actions">
          <Link to="/login" className="demo-btn demo-btn--outline" onClick={closeMenu}>ورود</Link>
          <Link to="/onboarding" className="demo-btn demo-btn--accent" onClick={closeMenu}>ثبت کسب‌وکار</Link>
        </div>
      </nav>

      <DemoBottomNav />

      <div className="demo-main">
        <Outlet />
      </div>

      <footer className="demo-footer">
        <div className="demo-footer__inner">
          <div className="demo-footer__grid">
            <div>
              <div className="demo-footer__logo">
                <img src="/images/iraniu-logo-header.png" alt="ایرانیو" />
              </div>
              <p className="demo-footer__desc">ایرانیو — فهرست جامع کسب‌وکارهای ایرانی در بریتانیا. از رستوران و صرافی گرفته تا وکیل و پزشک، همه را اینجا پیدا کنید.</p>
              <div className="demo-footer__social">
                <a href="#" className="demo-footer__social-btn">f</a>
                <a href="#" className="demo-footer__social-btn">t</a>
                <a href="#" className="demo-footer__social-btn">in</a>
              </div>
            </div>
            <div>
              <h4 className="demo-footer__col-title">لینک‌های مفید</h4>
              <ul className="demo-footer__links">
                <li><Link to="/">خانه</Link></li>
                <li><Link to="/listings">آگهی‌ها</Link></li>
                <li><Link to="/exchanges">صرافی‌ها</Link></li>
                <li><Link to="/onboarding">ثبت کسب‌وکار</Link></li>
                <li><Link to="/boost-plans">پلن‌های تبلیغاتی</Link></li>
                <li><Link to="/blog">وبلاگ</Link></li>
                <li><Link to="/tfl">حمل‌ونقل لندن</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="demo-footer__col-title">پنل کاربری</h4>
              <ul className="demo-footer__links">
                <li><Link to="/dashboard">داشبورد</Link></li>
                <li><Link to="/login">ورود</Link></li>
                <li><Link to="/manager-signup">ثبت‌نام</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="demo-footer__col-title">تماس</h4>
              <ul className="demo-footer__links">
                <li><a href="mailto:info@cybercina.co.uk">info@cybercina.co.uk</a></li>
                <li><a href="#">راهنما</a></li>
                <li><a href="#">حریم خصوصی</a></li>
              </ul>
            </div>
          </div>
          <div className="demo-footer__bottom">
            <span>© ۱۴۰۴ ایرانیو — تمامی حقوق محفوظ است</span>
            <Link to="/" className="demo-footer__back">← بازگشت به خانه</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
