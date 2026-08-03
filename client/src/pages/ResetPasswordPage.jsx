import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLoginLayout from "../components/AuthLoginLayout.jsx";
import Seo from "../components/Seo.jsx";
import { apiPost } from "../api.js";
import { passwordStrengthScore, validatePasswordComplexity } from "../lib/passwordPolicy.js";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const strength = passwordStrengthScore(password);
  const policy = validatePasswordComplexity(password);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!token) {
      setErr("لینک نامعتبر است.");
      return;
    }
    if (password !== password2) {
      setErr("دو بار رمز یکسان نیست.");
      return;
    }
    const chk = validatePasswordComplexity(password);
    if (!chk.ok) {
      setErr(chk.hint);
      return;
    }
    setPending(true);
    try {
      await apiPost("/api/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (ex) {
      const t = String(ex.message || "");
      setErr(t.includes("invalid_or_expired_token") ? "لینک نامعتبر یا منقضی شده است." : ex.message || "خطایی رخ داد.");
    } finally {
      setPending(false);
    }
  };

  const footer = (
    <p className="auth-login__links">
      <Link to="/login">بازگشت به ورود</Link>
      <span className="auth-login__links-sep" aria-hidden="true">
        ·
      </span>
      <Link to="/">بازگشت به خانه</Link>
    </p>
  );

  return (
    <>
      <Seo title="تعیین رمز جدید" noindex description="تعیین رمز عبور جدید." />
      <AuthLoginLayout
        variant="manager"
        badge="رمز جدید"
        title="تعیین رمز عبور جدید"
        description="رمز عبور جدید خود را وارد کنید."
        footer={footer}
      >
        {done ? (
          <p className="field-hint">رمز عبور با موفقیت تغییر کرد؛ در حال انتقال به صفحهٔ ورود…</p>
        ) : (
          <form onSubmit={onSubmit} className="auth-login__form form-grid" noValidate>
            <div className="field field--block">
              <label htmlFor="rp-pass">رمز عبور جدید</label>
              <input
                id="rp-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                dir="ltr"
                autoComplete="new-password"
                className="auth-login__input"
              />
              <div className="exchange-onboarding__strength" aria-hidden="true">
                <div className="exchange-onboarding__strength-bar">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={i < strength ? "is-on" : ""} />
                  ))}
                </div>
              </div>
              {!policy.ok && password.length > 0 && (
                <span className="field-hint" style={{ color: "#b71c1c" }}>
                  {policy.hint}
                </span>
              )}
            </div>
            <div className="field field--block">
              <label htmlFor="rp-pass2">تکرار رمز عبور</label>
              <input
                id="rp-pass2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={12}
                dir="ltr"
                autoComplete="new-password"
                className="auth-login__input"
              />
            </div>
            {err ? (
              <div className="auth-login__error" role="alert">
                {err}
              </div>
            ) : null}
            <button type="submit" className="btn btn--primary auth-login__submit" disabled={pending}>
              {pending ? "در حال ذخیره…" : "تغییر رمز عبور"}
            </button>
          </form>
        )}
      </AuthLoginLayout>
    </>
  );
}
