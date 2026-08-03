import { NavLink } from "react-router-dom";

const lnk = ({ isActive }) => `demo-bnav__link${isActive ? " demo-bnav--active" : ""}`;
const fab = ({ isActive }) => `demo-bnav__fab${isActive ? " demo-bnav--active" : ""}`;

export default function DemoBottomNav() {
  return (
    <nav className="demo-bnav" aria-label="منوی پایین" dir="rtl">
      <NavLink to="/" end className={lnk}>
        <i className="fa-solid fa-house demo-bnav__ico" aria-hidden="true" />
        <span className="demo-bnav__lbl">خانه</span>
      </NavLink>
      <NavLink to="/listings" className={lnk}>
        <i className="fa-solid fa-store demo-bnav__ico" aria-hidden="true" />
        <span className="demo-bnav__lbl">آگهی‌ها</span>
      </NavLink>

      <div className="demo-bnav__fab-slot">
        <NavLink to="/onboarding" className={fab} aria-label="ثبت کسب‌وکار">
          <i className="fa-solid fa-circle-plus demo-bnav__fab-ico" aria-hidden="true" />
        </NavLink>
        <span className="demo-bnav__fab-lbl">ثبت</span>
      </div>

      <NavLink to="/blog" className={lnk}>
        <i className="fa-solid fa-newspaper demo-bnav__ico" aria-hidden="true" />
        <span className="demo-bnav__lbl">وبلاگ</span>
      </NavLink>
      <NavLink to="/tfl" className={lnk}>
        <i className="fa-solid fa-bus demo-bnav__ico" aria-hidden="true" />
        <span className="demo-bnav__lbl">حمل‌ونقل</span>
      </NavLink>
    </nav>
  );
}
