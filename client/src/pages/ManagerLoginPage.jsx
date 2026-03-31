import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthLoginLayout from "../components/AuthLoginLayout.jsx";

export default function ManagerLoginPage() {
  const { loginManager } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [err, setErr] = useState(null);
  const [pending, setPending] = useState(false);

  const redirectTo = params.get("redirect") || "/dashboard";

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await loginManager(email, password, totp.trim() || undefined);
      try {
        const raw = sessionStorage.getItem("iraniu_dashboard_business_slug");
        if (!raw) {
          const t = sessionStorage.getItem("iraniu_jwt");
          const r = await fetch("/api/auth/me", {
            headers: t ? { Authorization: `Bearer ${t}` } : {},
            credentials: "include",
          });
          if (r.ok) {
            const m = await r.json();
            const first = m.user?.linked_businesses?.[0]?.slug;
            if (first) localStorage.setItem("iraniu_dashboard_business_slug", first);
          }
        }
      } catch (_) {}
      navigate(redirectTo, { replace: true });
    } catch (ex) {
      setErr(ex.message || "ورود ناموفق");
    } finally {
      setPending(false);
    }
  };

  const footer = (
    <p className="auth-login__links">
      <Link to="/">بازگشت به خانه</Link>
      <span className="auth-login__links-sep" aria-hidden="true">
        ·
      </span>
      <Link to="/admin/login">ورود سوپرادمین</Link>
    </p>
  );

  return (
    <AuthLoginLayout
      variant="manager"
      badge="پنل کسب‌وکار"
      title="ورود مدیر"
      description="با ایمیل و رمزی که برای شما ثبت شده وارد شوید. اگر ورود دو مرحله‌ای فعال باشد، کد ۶ رقمی را هم وارد کنید."
      footer={footer}
    >
      <form onSubmit={onSubmit} className="auth-login__form form-grid" noValidate>
        <div className="field field--block">
          <label htmlFor="ml-email">ایمیل</label>
          <input
            id="ml-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            dir="ltr"
            className="auth-login__input"
            placeholder="name@example.com"
          />
        </div>
        <div className="field field--block">
          <label htmlFor="ml-pass">رمز عبور</label>
          <input
            id="ml-pass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            dir="ltr"
            className="auth-login__input"
          />
        </div>
        <div className="field field--block">
          <label htmlFor="ml-totp">کد تأیید (اختیاری)</label>
          <input
            id="ml-totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="۶ رقم — اگر ۲FA فعال است"
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            dir="ltr"
            className="auth-login__input auth-login__input--otp"
          />
        </div>
        {err ? (
          <div className="auth-login__error" role="alert">
            {err}
          </div>
        ) : null}
        <button type="submit" className="btn btn--primary auth-login__submit" disabled={pending}>
          {pending ? (
            <>
              <span className="auth-login__spinner" aria-hidden="true" />
              در حال ورود…
            </>
          ) : (
            "ورود به پنل"
          )}
        </button>
      </form>
    </AuthLoginLayout>
  );
}
