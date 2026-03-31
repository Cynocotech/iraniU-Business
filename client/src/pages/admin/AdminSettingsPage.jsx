import { Link, useSearchParams } from "react-router-dom";
import AdminSecurityPage from "./AdminSecurityPage.jsx";
import AdminSuperAdminsPage from "./AdminSuperAdminsPage.jsx";
import AdminSystemLogsPage from "./AdminSystemLogsPage.jsx";

const TABS = [
  { id: "security", label: "امنیت و ۲FA" },
  { id: "super-admins", label: "سوپرادمین‌ها" },
  { id: "logs", label: "لاگ سیستم" },
];

export default function AdminSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab") || "security";
  const tab = TABS.some((t) => t.id === raw) ? raw : "security";

  const setTab = (id) => {
    setSearchParams({ tab: id }, { replace: true });
  };

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
      </p>

      <nav className="admin-settings-tabs" aria-label="بخش‌های تنظیمات">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              tab === t.id ? "admin-settings-tabs__btn admin-settings-tabs__btn--active" : "admin-settings-tabs__btn"
            }
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="admin-settings-panels">
        {tab === "security" ? <AdminSecurityPage embedded /> : null}
        {tab === "super-admins" ? <AdminSuperAdminsPage embedded /> : null}
        {tab === "logs" ? <AdminSystemLogsPage embedded /> : null}
      </div>
    </>
  );
}
