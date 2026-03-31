import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthLoginLayout from "../components/AuthLoginLayout.jsx";

function totpErrMessage(code, fallback) {
  if (code === "invalid_totp") return "کد شش‌رقمی نادرست است. دوباره تلاش کنید.";
  return fallback;
}

export default function AdminLoginPage() {
  const { loginAdmin } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [err, setErr] = useState(null);
  const [pending, setPending] = useState(false);
  const totpRef = useRef(null);

  const redirectTo = params.get("redirect") || "/admin";

  useEffect(() => {
    if (phase === "totp" && totpRef.current) {
      const t = window.setTimeout(() => totpRef.current?.focus(), 200);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      if (phase === "password") {
        await loginAdmin(email, password, undefined);
        navigate(redirectTo, { replace: true });
        return;
      }
      await loginAdmin(email, password, totp.trim());
      navigate(redirectTo, { replace: true });
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
      <Link to="/login">ورود مدیر کسب‌وکار</Link>
    </p>
  );

  return (
    <AuthLoginLayout
      variant="admin"
      badge="مدیریت کل سایت"
      title={phase === "password" ? "ورود سوپرادمین" : "کد تأیید"}
      description={
        phase === "password"
          ? "ایمیل و رمز را وارد کنید. در صورت فعال بودن ۲FA، مرحلهٔ بعد باز می‌شود."
          : "کد ۶ رقمی از Google Authenticator را وارد کنید."
      }
      footer={footer}
    >
      <form onSubmit={onSubmit} className="auth-login__form form-grid" noValidate>
        {phase === "password" ? (
          <div key="step-pw" className="auth-login__step-panel">
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
          </div>
        ) : (
          <div key="step-totp" className="auth-login__step-panel">
            <p className="auth-login__step-email-hint" dir="ltr">
              {email}
            </p>
            <div className="field field--block">
              <label htmlFor="al-totp">کد Google Authenticator</label>
              <input
                ref={totpRef}
                id="al-totp"
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
            "ورود امن"
          )}
        </button>
      </form>
    </AuthLoginLayout>
  );
}
