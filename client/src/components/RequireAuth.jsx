import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/** پنل کسب‌وکار: مدیر آگهی یا سوپرادمین (برای ورود سریع / تست) */
export function RequireManager({ children }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="section container" style={{ padding: "2rem" }}>
        <p className="field-hint">در حال بررسی نشست…</p>
      </div>
    );
  }
  if (me?.role !== "manager" && me?.role !== "superadmin") {
    return <Navigate to={`/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  }
  return children;
}

export function RequireSuperAdmin({ children }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="section container" style={{ padding: "2rem" }}>
        <p className="field-hint">در حال بررسی نشست…</p>
      </div>
    );
  }
  if (me?.role !== "superadmin") {
    return <Navigate to={`/admin/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  }
  const mustEnroll2fa = !!me?.totp_setup_required && !me?.totp_enabled;
  if (mustEnroll2fa) {
    const params = new URLSearchParams(loc.search);
    const tab = params.get("tab") || "security";
    if (loc.pathname !== "/admin-settings" || tab !== "security") {
      return <Navigate to="/admin-settings?tab=security" replace />;
    }
  }
  return children;
}
