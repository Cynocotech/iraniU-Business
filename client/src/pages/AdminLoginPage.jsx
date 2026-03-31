import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthLoginLayout from "../components/AuthLoginLayout.jsx";

export default function AdminLoginPage() {
  const { loginAdmin } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [err, setErr] = useState(null);
  const [pending, setPending] = useState(false);

  const redirectTo = params.get("redirect") || "/admin";

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await loginAdmin(email, password, totp.trim() || undefined);
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
      <Link to="/login">ورود مدیر کسب‌وکار</Link>
    </p>
  );

  return (
    <AuthLoginLayout
      variant="admin"
      badge="مدیریت کل سایت"
      title="ورود سوپرادمین"
      description="فقط برای حساب‌های مدیریت کل. در صورت فعال بودن Google Authenticator، کد ۶ رقمی را وارد کنید."
      footer={footer}
    >
      <form onSubmit={onSubmit} className="auth-login__form form-grid" noValidate>
        <div className="field field--block">
          <label htmlFor="al-email">ایمیل</label>
          <input
            id="al-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            dir="ltr"
            className="auth-login__input"
            placeholder="admin@example.com"
          />
        </div>
        <div className="field field--block">
          <label htmlFor="al-pass">رمز عبور</label>
          <input
            id="al-pass"
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
          <label htmlFor="al-totp">کد تأیید (اختیاری)</label>
          <input
            id="al-totp"
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
            "ورود امن"
          )}
        </button>
      </form>
    </AuthLoginLayout>
  );
}
