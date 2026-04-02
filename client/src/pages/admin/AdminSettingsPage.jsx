import { useLayoutEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import AdminSecurityPage from "./AdminSecurityPage.jsx";
import AdminSuperAdminsPage from "./AdminSuperAdminsPage.jsx";
import AdminSystemLogsPage from "./AdminSystemLogsPage.jsx";
import AdminEmailSettingsSection from "./AdminEmailSettingsSection.jsx";

export default function AdminSettingsPage() {
  const location = useLocation();
  const { me } = useAuth();
  const mustEnroll2fa = me?.role === "superadmin" && !!me?.totp_setup_required && !me?.totp_enabled;

  useLayoutEffect(() => {
    if (mustEnroll2fa) return;
    const id = location.hash?.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, mustEnroll2fa]);

  return (
    <div className="admin-settings-page">
      <header className="admin-settings-head">
        <p className="admin-settings-head__crumb">
          <Link to="/admin">← داشبورد</Link>
        </p>
        <div className="admin-settings-head__titles">
          <h2 className="admin-settings-head__title">تنظیمات</h2>
          <p className="admin-settings-head__subtitle">
            {mustEnroll2fa
              ? "ابتدا ورود دو مرحله‌ای را تکمیل کنید."
              : "امنیت، ایمیل، نقش‌ها و گزارش سیستم"}
          </p>
        </div>
      </header>

      <div className="admin-settings-sections">
        <section id="security" className="admin-settings-section">
          <AdminSecurityPage embedded />
        </section>
        {mustEnroll2fa ? null : (
          <>
            <section id="email" className="admin-settings-section">
              <AdminEmailSettingsSection embedded />
            </section>
            <section id="super-admins" className="admin-settings-section">
              <AdminSuperAdminsPage embedded />
            </section>
            <section id="logs" className="admin-settings-section">
              <AdminSystemLogsPage embedded />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
