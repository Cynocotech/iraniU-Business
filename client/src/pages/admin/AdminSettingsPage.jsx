import { Link, useSearchParams } from "react-router-dom";
import AdminSecurityPage from "./AdminSecurityPage.jsx";
import AdminSuperAdminsPage from "./AdminSuperAdminsPage.jsx";
import AdminSystemLogsPage from "./AdminSystemLogsPage.jsx";

const TABS = [
  {
    id: "security",
    label: "امنیت و ۲FA",
    hint: "رمز دو مرحله‌ای و ماژول‌ها",
    icon: (
      <svg className="admin-settings-tabs__glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v5.7c0 4.67-3.13 8.98-7 10.05-3.87-1.07-7-5.38-7-10.05V6.3l7-3.12zM11 7h2v6h-2V7zm0 8h2v2h-2v-2z"
        />
      </svg>
    ),
  },
  {
    id: "super-admins",
    label: "سوپرادمین‌ها",
    hint: "دسترسی سطح بالا",
    icon: (
      <svg className="admin-settings-tabs__glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
        />
      </svg>
    ),
  },
  {
    id: "logs",
    label: "لاگ سیستم",
    hint: "رویدادها و خطاها",
    icon: (
      <svg className="admin-settings-tabs__glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7v-7zm4-5h2v12h-2V5zm4 3h2v9h-2V8z"
        />
      </svg>
    ),
  },
];

export default function AdminSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab") || "security";
  const tab = TABS.some((t) => t.id === raw) ? raw : "security";

  const setTab = (id) => {
    setSearchParams({ tab: id }, { replace: true });
  };

  return (
    <div className="admin-settings-page">
      <header className="admin-settings-head">
        <p className="admin-settings-head__crumb">
          <Link to="/admin">← داشبورد</Link>
        </p>
        <div className="admin-settings-head__titles">
          <h2 className="admin-settings-head__title">تنظیمات</h2>
          <p className="admin-settings-head__subtitle">امنیت، نقش‌ها و گزارش سیستم</p>
        </div>
      </header>

      <div className="admin-settings-tabs-wrap">
        <nav className="admin-settings-tabs" role="tablist" aria-label="بخش‌های تنظیمات">
          {TABS.map((t) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`admin-settings-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`admin-settings-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                className={
                  selected ? "admin-settings-tabs__btn admin-settings-tabs__btn--active" : "admin-settings-tabs__btn"
                }
                onClick={() => setTab(t.id)}
              >
                <span className="admin-settings-tabs__btn-inner">
                  {t.icon}
                  <span className="admin-settings-tabs__text">
                    <span className="admin-settings-tabs__label">{t.label}</span>
                    <span className="admin-settings-tabs__hint">{t.hint}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="admin-settings-panels">
        {tab === "security" ? (
          <div id="admin-settings-panel-security" role="tabpanel" aria-labelledby="admin-settings-tab-security">
            <AdminSecurityPage embedded />
          </div>
        ) : null}
        {tab === "super-admins" ? (
          <div id="admin-settings-panel-super-admins" role="tabpanel" aria-labelledby="admin-settings-tab-super-admins">
            <AdminSuperAdminsPage embedded />
          </div>
        ) : null}
        {tab === "logs" ? (
          <div id="admin-settings-panel-logs" role="tabpanel" aria-labelledby="admin-settings-tab-logs">
            <AdminSystemLogsPage embedded />
          </div>
        ) : null}
      </div>
    </div>
  );
}
