import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiGet, apiPost } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { passwordStrengthScore, validatePasswordComplexity } from "../lib/passwordPolicy.js";

// Cloudflare Turnstile Site Key
const TURNSTILE_SITE_KEY = "0x4AAAAAADmEnAaO3lpBKumP";

export default function VerifyBusinessEmailPage() {
  const navigate = useNavigate();
  const { loginManager, loadMe } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [business, setBusiness] = useState(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileWidgetId = useRef(null);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    apiGet(`/api/business-signup/verify?token=${encodeURIComponent(token)}`)
      .then((d) => setBusiness(d))
      .catch(() => setBusiness(null))
      .finally(() => setChecking(false));
  }, [token]);

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
    if (!business) return;
    const checkAndRender = () => {
      if (window.turnstile && !turnstileWidgetId.current) {
        try {
          turnstileWidgetId.current = window.turnstile.render("#cf-turnstile-verify-business", {
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
  }, [business]);

  const strength = passwordStrengthScore(password);
  const policy = validatePasswordComplexity(password);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!captchaToken) {
      setMsg({ ok: false, text: "لطفاً تأیید امنیتی (Captcha) را تکمیل کنید." });
      return;
    }
    if (password !== password2) {
      setMsg({ ok: false, text: "دو بار رمز یکسان نیست." });
      return;
    }
    const chk = validatePasswordComplexity(password);
    if (!chk.ok) {
      setMsg({ ok: false, text: chk.hint });
      return;
    }
    setSending(true);
    try {
      await apiPost("/api/business-signup/complete", {
        token,
        login_username: loginUsername.trim().toLowerCase(),
        password,
        captcha_token: captchaToken,
      });
      await loginManager(business.listing_contact_email, password, undefined);
      await loadMe();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const t = String(err.message || "");
      let text = t;
      if (t.includes("email_taken")) text = "این ایمیل قبلاً ثبت شده.";
      else if (t.includes("username_taken")) text = "این نام کاربری گرفته شده؛ نام دیگری انتخاب کنید.";
      else if (t.includes("invalid_username")) text = "نام کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل a-z، ۰-۹ و _ باشد.";
      else if (t.includes("captcha_failed")) text = "تأیید امنیتی ناموفق بود. لطفاً دوباره امتحان کنید.";
      else if (t.includes("invalid_or_expired_token")) text = "لینک تأیید نامعتبر یا منقضی شده است.";
      setMsg({ ok: false, text });
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
      <Seo title="تأیید ایمیل" noindex description="تأیید ایمیل و تعیین رمز عبور برای پنل مدیر." />
      <main className="container exchange-onboarding" style={{ padding: "2rem 0", maxWidth: "32rem" }}>
        <header className="exchange-onboarding__hero" aria-labelledby="verify-business-title">
          <h1 id="verify-business-title" className="exchange-onboarding__title">
            تأیید ایمیل
          </h1>
        </header>

        {checking && <p className="field-hint">در حال بررسی لینک…</p>}

        {!checking && !business && (
          <p className="field-hint" style={{ color: "#b71c1c" }}>
            این لینک نامعتبر یا منقضی شده است. اگر ایمیل تأیید را دریافت نکرده‌اید، ابتدا پوشهٔ <strong>Spam / Junk</strong> را بررسی کنید.
            در غیر این صورت، دوباره از فرم ثبت کسب‌وکار اقدام کنید.
          </p>
        )}

        {!checking && business && (
          <form className="dashboard-panel" style={{ marginTop: "1rem" }} onSubmit={submit}>
            <p className="field-hint">
              ایمیل <strong dir="ltr">{business.listing_contact_email}</strong> برای آگهی{" "}
              <strong>{business.name_fa}</strong> تأیید شد. برای ساخت حساب مدیر، نام کاربری و رمز عبور انتخاب کنید.
            </p>
            <div className="form-grid">
              <div className="field field--block">
                <label htmlFor="vb-user">نام کاربری (ورود)</label>
                <input
                  id="vb-user"
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
                <label htmlFor="vb-pass">رمز عبور</label>
                <input
                  id="vb-pass"
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
                {!policy.ok && password.length > 0 && (
                  <span className="field-hint" style={{ color: "#b71c1c" }}>
                    {policy.hint}
                  </span>
                )}
              </div>
              <div className="field field--block">
                <label htmlFor="vb-pass2">تکرار رمز</label>
                <input
                  id="vb-pass2"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={12}
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div id="cf-turnstile-verify-business" style={{ marginTop: "1rem", marginBottom: "1rem" }}></div>

            <button type="submit" className="btn btn--primary" disabled={sending}>
              {sending ? "…" : "ساخت حساب مدیر و ورود"}
            </button>
            {msg && (
              <p className="field-hint" style={{ color: msg.ok ? "inherit" : "#b71c1c" }}>
                {msg.text}
              </p>
            )}
          </form>
        )}
      </main>
    </>
  );
}
