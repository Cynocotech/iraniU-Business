import { useLayoutEffect, useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiPost } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { passwordStrengthScore, validatePasswordComplexity } from "../lib/passwordPolicy.js";
import { pickPreferredManagerSlug } from "../lib/managerDashboardSlug.js";

// Cloudflare Turnstile Site Key
const TURNSTILE_SITE_KEY = "0x4AAAAAADmEnAaO3lpBKumP";

export default function ExchangeOnboardingPage() {
  const navigate = useNavigate();
  const { me, loading, loginManager, loadMe } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState(null);
  const [sending, setSending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileWidgetId = useRef(null);

  useLayoutEffect(() => {
    if (loading) return;
    if (me?.role === "manager") {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, me, navigate]);

  // Load Cloudflare Turnstile script
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

  // Initialize Turnstile widget
  useEffect(() => {
    const checkAndRender = () => {
      if (window.turnstile && !turnstileWidgetId.current) {
        try {
          turnstileWidgetId.current = window.turnstile.render("#cf-turnstile-exchange", {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token) => setCaptchaToken(token),
            "error-callback": () => {
              setCaptchaToken("");
              setMsg({ ok: false, text: "خطا در بارگذاری تأیید امنیتی. لطفاً صفحه را رفرش کنید." });
            },
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

  const strength = passwordStrengthScore(password);
  const policy = validatePasswordComplexity(password);

  const submitCredentials = async (e) => {
    e.preventDefault();
    setSending(true);
    setMsg(null);

    // Verify captcha token
    if (!captchaToken) {
      setMsg({ ok: false, text: "لطفاً تأیید امنیتی (Captcha) را تکمیل کنید." });
      setSending(false);
      return;
    }

    if (password !== password2) {
      setMsg({ ok: false, text: "دو بار رمز یکسان نیست." });
      setSending(false);
      return;
    }

    const chk = validatePasswordComplexity(password);
    if (!chk.ok) {
      setMsg({ ok: false, text: chk.hint });
      setSending(false);
      return;
    }

    try {
      await apiPost("/api/auth/register/manager", {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: phone.trim(),
        login_username: loginUsername.trim().toLowerCase(),
        password,
        exchange_onboarding: true,
        captcha_token: captchaToken,
      });
      const loginData = await loginManager(email.trim().toLowerCase(), password, undefined);
      try {
        const linked = loginData?.user?.linked_businesses;
        const slug = pickPreferredManagerSlug(linked) || linked?.[0]?.slug;
        if (slug) {
          localStorage.setItem("iraniu_dashboard_business_slug", slug);
          sessionStorage.setItem("iraniu_dashboard_business_slug", slug);
        }
        sessionStorage.setItem("iraniu_exchange_onboarding", "1");
      } catch (_) {}
      await loadMe();
      try {
        sessionStorage.setItem("iraniu_prompt_enable_2fa", "1");
      } catch (_) {}
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const code = err?.code;
      const t = String(err.message || "");
      const networkLike = t.includes("NetworkError") || t.includes("Failed to fetch");
      let text = t;
      let loginLink = false;
      if (networkLike) text = "ارتباط با سرور برقرار نشد. اینترنت/VPN یا وضعیت سرور را بررسی کنید.";
      else if (code === "email_taken" || t.includes("email_taken")) {
        text = t && t !== "email_taken" ? t : "حسابی با این ایمیل قبلاً وجود دارد. نمی‌توانید با همین ایمیل حساب دیگری بسازید.";
        loginLink = true;
      } else if (code === "username_taken" || t.includes("username_taken")) text = "این نام کاربری گرفته شده؛ نام دیگری انتخاب کنید.";
      else if (code === "invalid_username" || t.includes("invalid_username")) text = "نام کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل a-z، ۰-۹ و _ باشد.";
      else if (code === "invalid_email" || t.includes("invalid_email")) text = "ایمیل نامعتبر است.";
      else if (code === "captcha_failed" || t.includes("captcha_failed")) text = "تأیید امنیتی ناموفق بود. لطفاً دوباره امتحان کنید.";
      else if (String(code || "").startsWith("password_")) text = err.message;
      setMsg({ ok: false, text, loginLink });

      // Reset captcha on error
      if (turnstileWidgetId.current && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidgetId.current);
          setCaptchaToken("");
        } catch {}
      }
    } finally {
      setSending(false);
    }
  };

  const stepBlocks = [
    { id: "s1", label: "ثبت‌نام" },
    { id: "s2", label: "ورود خودکار" },
    { id: "s3", label: "فعال‌سازی ۲FA در پنل" },
  ];

  const stepBlockState = (index) => (index === 0 ? "active" : "pending");

  if (loading) {
    return (
      <main className="container exchange-onboarding" style={{ padding: "2rem 0", maxWidth: "32rem" }}>
        <p className="field-hint">در حال بارگذاری…</p>
      </main>
    );
  }

  return (
    <>
      <Seo title="راه‌اندازی صرافی" noindex description="ایجاد حساب مدیر برای دپارتمان صرافی." />
      <main className="container exchange-onboarding" style={{ padding: "2rem 0", maxWidth: "32rem" }}>
        <header className="exchange-onboarding__hero" aria-labelledby="exchange-onboarding-title">
          <div className="exchange-onboarding__logo-wrap">
            <img className="exchange-onboarding__logo" src="/images/iraniu-logo-header.png" alt="" width={120} height={48} />
          </div>
          <h1 id="exchange-onboarding-title" className="exchange-onboarding__title">
            راه‌اندازی حساب صرافی
          </h1>
          <p className="exchange-onboarding__subtitle">ثبت‌نام انجام می‌شود و سپس مستقیم وارد پنل می‌شوید.</p>

          <ol className="exchange-onboarding__stepper" aria-label="مراحل راه‌اندازی">
            {stepBlocks.map((s, i) => (
              <li key={s.id} className={`exchange-onboarding__step-card exchange-onboarding__step-card--${stepBlockState(i)}`}>
                <span className="exchange-onboarding__step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="exchange-onboarding__step-label">{s.label}</span>
              </li>
            ))}
          </ol>
        </header>

        <form className="dashboard-panel" style={{ marginTop: "1rem" }} onSubmit={submitCredentials}>
          <div className="form-grid">
            <div className="field field--block">
              <label htmlFor="eo-user">نام کاربری (ورود)</label>
              <input
                id="eo-user"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                required
                dir="ltr"
                autoComplete="username"
                minLength={3}
                maxLength={32}
                placeholder="مثلاً ali_london"
              />
              <span className="field-hint">فقط حروف انگلیسی کوچک، اعداد و _ — ۳ تا ۳۲ کاراکتر.</span>
            </div>
            <div className="field field--block">
              <label htmlFor="eo-pass">رمز عبور</label>
              <input
                id="eo-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                dir="ltr"
                autoComplete="new-password"
              />
              <div className="exchange-onboarding__strength" aria-hidden="true">
                <div className="exchange-onboarding__strength-bar">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={i < strength ? "is-on" : ""} />
                  ))}
                </div>
              </div>
              <ul className="exchange-onboarding__checklist">
                <li className={password.length >= 12 ? "is-ok" : ""}>حداقل ۱۲ کاراکتر</li>
                <li className={/[a-z]/.test(password) ? "is-ok" : ""}>یک حرف کوچک انگلیسی</li>
                <li className={/[A-Z]/.test(password) ? "is-ok" : ""}>یک حرف بزرگ انگلیسی</li>
                <li className={/[0-9]/.test(password) ? "is-ok" : ""}>یک رقم</li>
                <li className={/[^a-zA-Z0-9_]/.test(password) ? "is-ok" : ""}>یک نماد (مثلاً ! @ #)</li>
              </ul>
              {!policy.ok && password.length > 0 && (
                <span className="field-hint" style={{ color: "#b71c1c" }}>
                  {policy.hint}
                </span>
              )}
            </div>
            <div className="field field--block">
              <label htmlFor="eo-pass2">تکرار رمز</label>
              <input
                id="eo-pass2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={12}
                dir="ltr"
                autoComplete="new-password"
              />
            </div>
            <div className="field field--block">
              <label htmlFor="eo-email">ایمیل</label>
              <input
                id="eo-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                autoComplete="email"
              />
            </div>
            <div className="field field--block">
              <label htmlFor="eo-name">نام کامل</label>
              <input id="eo-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field field--block">
              <label htmlFor="eo-phone">تلفن</label>
              <input id="eo-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" required />
            </div>
          </div>

          {/* Cloudflare Turnstile Captcha */}
          <div id="cf-turnstile-exchange" style={{ marginTop: "1rem", marginBottom: "1rem" }}></div>

          <button type="submit" className="btn btn--primary" disabled={sending}>
            {sending ? "…" : "ثبت‌نام و ورود"}
          </button>
          {msg && (
            <p className="field-hint" style={{ color: msg.ok ? "inherit" : "#b71c1c" }}>
              {msg.text}
              {msg.loginLink && (
                <>{" — "}<Link to="/login" style={{ color: "#b71c1c", fontWeight: 600 }}>ورود به پنل</Link></>
              )}
            </p>
          )}
        </form>
      </main>
    </>
  );
}
