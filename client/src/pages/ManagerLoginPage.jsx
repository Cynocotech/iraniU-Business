import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthLoginLayout from "../components/AuthLoginLayout.jsx";

function totpErrMessage(code, fallback) {
  if (code === "invalid_totp") return "کد شش‌رقمی نادرست است. دوباره تلاش کنید.";
  return fallback;
}

export default function ManagerLoginPage() {
  const { loginManager } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [err, setErr] = useState(null);
  const [pending, setPending] = useState(false);
  const totpRef = useRef(null);

  const redirectTo = params.get("redirect") || "/dashboard";

  useEffect(() => {
    if (phase === "totp" && totpRef.current) {
      const t = window.setTimeout(() => totpRef.current?.focus(), 200);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  const afterManagerLogin = async () => {
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
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      if (phase === "password") {
        await loginManager(email, password, undefined);
        await afterManagerLogin();
        return;
      }
      await loginManager(email, password, totp.trim());
      await afterManagerLogin();
    } catch (ex) {
      const code = ex?.code;
      if (phase === "password" && code === "totp_required") {
        setPhase("totp");
        setTotp("");
        setErr(null);
      } else {
        setErr(totpErrMessage(code, ex.message || "ورود ناموفق"));
      }
    } finally {
      setPending(false);
    }
  };

  const backToPassword = () => {
    setPhase("password");
    setTotp("");
    setErr(null);
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
      title={phase === "password" ? "ورود مدیر" : "کد تأیید"}
      description={
        phase === "password"
          ? "ایمیل و رمز عبور را وارد کنید. اگر ورود دو مرحله‌ای فعال باشد، در مرحلهٔ بعد کد را می‌گیرید."
          : "کد ۶ رقمی از Google Authenticator را وارد کنید."
      }
      footer={footer}
    >
      <form onSubmit={onSubmit} className="auth-login__form form-grid" noValidate>
        {phase === "password" ? (
          <div key="step-pw" className="auth-login__step-panel">
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
          </div>
        ) : (
          <div key="step-totp" className="auth-login__step-panel">
            <p className="auth-login__step-email-hint" dir="ltr">
              {email}
            </p>
            <div className="field field--block">
              <label htmlFor="ml-totp">کد Google Authenticator</label>
              <input
                ref={totpRef}
                id="ml-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="۶ رقم"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                dir="ltr"
                className="auth-login__input auth-login__input--otp"
              />
            </div>
            <button type="button" className="btn btn--ghost auth-login__back-step" onClick={backToPassword} disabled={pending}>
              ویرایش ایمیل و رمز
            </button>
          </div>
        )}

        {err ? (
          <div className="auth-login__error" role="alert">
            {err}
          </div>
        ) : null}
        <button type="submit" className="btn btn--primary auth-login__submit" disabled={pending}>
          {pending ? (
            <>
              <span className="auth-login__spinner" aria-hidden="true" />
              {phase === "password" ? "در حال بررسی…" : "در حال ورود…"}
            </>
          ) : phase === "password" ? (
            "ادامه"
          ) : (
            "ورود به پنل"
          )}
        </button>
      </form>
    </AuthLoginLayout>
  );
}
