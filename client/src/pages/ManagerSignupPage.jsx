import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiPost } from "../api.js";
import { validatePasswordComplexity } from "../lib/passwordPolicy.js";
import PasswordRequirementsList from "../components/PasswordRequirementsList.jsx";

// Cloudflare Turnstile Site Key
const TURNSTILE_SITE_KEY = "0x4AAAAAADmEnAaO3lpBKumP";

export default function ManagerSignupPage() {
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
          turnstileWidgetId.current = window.turnstile.render("#cf-turnstile-signup", {
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

  const submit = async (e) => {
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
    const pw = validatePasswordComplexity(password);
    if (!pw.ok) {
      setMsg({ ok: false, text: pw.hint });
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
        captcha_token: captchaToken,
      });
      setMsg({
        ok: true,
        text: "حساب مدیر ساخته شد. اکنون می‌توانید از صفحهٔ ورود با ایمیل یا نام کاربری وارد پنل شوید. سوپرادمین می‌تواند آگهی شما را به این حساب وصل کند.",
      });
      setEmail("");
      setName("");
      setPhone("");
      setLoginUsername("");
      setPassword("");
      setPassword2("");
    } catch (err) {
      const code = err?.code;
      const t = String(err.message || "");
      let text = t;
      let loginLink = false;
      if (code === "email_taken" || t.includes("email_taken")) {
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

  return (
    <>
      <Seo title="ثبت‌نام مدیر" noindex description="ایجاد حساب مدیر برای اتصال به آگهی در ایرانیو." />
    <main className="container" style={{ padding: "2rem 0", maxWidth: "32rem" }}>
      <h1>ثبت‌نام مدیر</h1>
      <p className="field-hint">
        نام کاربری و رمز برای ورود به <strong>پنل کسب‌وکار</strong>؛ ایمیل برای تماس و بازیابی. پس از ثبت، سوپرادمین می‌تواند آگهی را به
        حساب شما وصل کند.
      </p>
      <form className="dashboard-panel" style={{ marginTop: "1rem" }} onSubmit={submit}>
        <div className="form-grid">
          <div className="field field--block">
            <label htmlFor="ms-user">نام کاربری (ورود)</label>
            <input
              id="ms-user"
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
            <label htmlFor="ms-pass">رمز عبور</label>
            <input
              id="ms-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              dir="ltr"
              autoComplete="new-password"
            />
            <PasswordRequirementsList password={password} />
          </div>
          <div className="field field--block">
            <label htmlFor="ms-pass2">تکرار رمز</label>
            <input
              id="ms-pass2"
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
            <label htmlFor="ms-email">ایمیل</label>
            <input
              id="ms-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              autoComplete="email"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="ms-name">نام کامل</label>
            <input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field field--block">
            <label htmlFor="ms-phone">تلفن</label>
            <input id="ms-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" required />
          </div>
        </div>

        {/* Cloudflare Turnstile Captcha */}
        <div id="cf-turnstile-signup" style={{ marginTop: "1rem", marginBottom: "1rem" }}></div>

        <button type="submit" className="btn btn--primary" disabled={sending}>
          {sending ? "…" : "ثبت حساب مدیر"}
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
      <p style={{ marginTop: "1rem" }}>
        <Link to="/login">ورود به پنل</Link>
        {" · "}
        <Link to="/">خانه</Link>
      </p>
    </main>
    </>
  );
}
