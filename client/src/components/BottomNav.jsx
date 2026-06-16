import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }) => `bottom-nav__link${isActive ? " active" : ""}`;
const fabClass = ({ isActive }) => `bottom-nav__fab${isActive ? " active" : ""}`;

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="ناوبری پایین صفحه">
      <NavLink to="/" end className={linkClass} title="خانه">
        <i className="fa-solid fa-house bottom-nav__ico" aria-hidden="true" />
        <span className="bottom-nav__label">خانه</span>
      </NavLink>
      <NavLink to="/listings" className={linkClass} title="لیست کسب‌وکارها">
        <i className="fa-solid fa-store bottom-nav__ico" aria-hidden="true" />
        <span className="bottom-nav__label">لیست</span>
      </NavLink>

      <div className="bottom-nav__fab-slot">
        <NavLink to="/onboarding" className={fabClass} title="ثبت کسب‌وکار">
          <i className="fa-solid fa-circle-plus bottom-nav__fab-ico" aria-hidden="true" />
        </NavLink>
        <span className="bottom-nav__fab-label">ثبت کسب‌وکار</span>
      </div>

      <NavLink to="/exchanges" className={linkClass} title="صرافی‌ها">
        <i className="fa-solid fa-arrow-right-arrow-left bottom-nav__ico" aria-hidden="true" />
        <span className="bottom-nav__label">صرافی</span>
      </NavLink>
      <NavLink to="/dashboard" className={linkClass} title="پنل کسب‌وکار">
        <i className="fa-solid fa-gauge-high bottom-nav__ico" aria-hidden="true" />
        <span className="bottom-nav__label">پنل من</span>
      </NavLink>
    </nav>
  );
}
