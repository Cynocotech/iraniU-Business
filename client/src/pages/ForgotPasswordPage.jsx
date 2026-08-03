import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AuthLoginLayout from "../components/AuthLoginLayout.jsx";
import Seo from "../components/Seo.jsx";
import { apiPost } from "../api.js";

// Cloudflare Turnstile Site Key
const TURNSTILE_SITE_KEY = "0x4AAAAAADmEnAaO3lpBKumP";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileWidgetId = useRef(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      try {
        document.body.removeChild(script);
      } catch {}
    };
  }, []);

  useEffect(() => {
    const checkAndRender = () => {
      if (window.turnstile && !turnstileWidgetId.current) {
        try {
          turnstileWidgetId.current = window.turnstile.render("#cf-turnstile-forgot-password", {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (t) => setCaptchaToken(t),
            "error-callback": () => setCaptchaToken(""),
            theme: "light",
            language: "fa",
          });
        } catch (e) {
          console.error("Turnstile render error:", e);
        }
      }
    };
    const timer = setInterval(checkAndRender, 100);
    const timeout = setTimeout(() => clearInterval(timer), 5000);
    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
      if (turnstileWidgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetId.current);
          turnstileWidgetId.current = null;
        } catch {}
      }
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!captchaToken) {
      setErr("لطفاً تأیید امنیتی (Captcha) را تکمیل کنید.");
      return;
    }
    setPending(true);
    try {
      await apiPost("/api/auth/forgot-password", { email: email.trim().toLowerCase(), captcha_token: captchaToken });
      setSent(true);
    } catch (ex) {
      setErr(ex.message || "خطایی رخ داد؛ دوباره تلاش کنید.");
      if (window.turnstile && turnstileWidgetId.current) {
        try {
          window.turnstile.reset(turnstileWidgetId.current);
          setCaptchaToken("");
        } catch {}
      }
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
      <Seo title="فراموشی رمز عبور" noindex description="بازیابی رمز عبور پنل مدیر." />
      <AuthLoginLayout
        variant="manager"
        badge="فراموشی رمز عبور"
        title="بازیابی رمز عبور"
        description="ایمیل حساب خود را وارد کنید؛ اگر ثبت‌شده باشد، لینک تعیین رمز جدید برایتان ارسال می‌شود."
        footer={footer}
      >
        {sent ? (
          <p className="field-hint">
            اگر این ایمیل در سیستم ثبت باشد، لینک تعیین رمز جدید برای آن ارسال شد.
            لطفاً صندوق ورودی و همچنین پوشهٔ <strong>Spam / Junk</strong> را بررسی کنید.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="auth-login__form form-grid" noValidate>
            <div className="field field--block">
              <label htmlFor="fp-email">ایمیل</label>
              <input
                id="fp-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="auth-login__input"
              />
            </div>
            <div className="field field--block" style={{ marginTop: "1rem" }}>
              <div id="cf-turnstile-forgot-password" style={{ display: "flex", justifyContent: "center" }}></div>
            </div>
            {err ? (
              <div className="auth-login__error" role="alert">
                {err}
              </div>
            ) : null}
            <button type="submit" className="btn btn--primary auth-login__submit" disabled={pending}>
              {pending ? "در حال ارسال…" : "ارسال لینک بازیابی"}
            </button>
          </form>
        )}
      </AuthLoginLayout>
    </>
  );
}
