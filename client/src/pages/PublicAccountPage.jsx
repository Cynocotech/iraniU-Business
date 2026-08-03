import { useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { usePublicAuth } from "../context/PublicAuthContext.jsx";

function validate(name, email, password, isRegister) {
  if (isRegister && !name.trim()) return "نام کامل را وارد کنید.";
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "ایمیل معتبر وارد کنید.";
  if (!password) return "رمز عبور را وارد کنید.";
  if (isRegister && password.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد.";
  if (isRegister && !/[A-Z]/.test(password)) return "رمز عبور باید حداقل یک حرف بزرگ داشته باشد.";
  if (isRegister && !/[0-9]/.test(password)) return "رمز عبور باید حداقل یک عدد داشته باشد.";
  return null;
}

function AuthForm({ mode, onSwitch }) {
  const { login, register } = usePublicAuth();
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handle(e) {
    e.preventDefault();
    setError("");
    const err = validate(name, email, password, isRegister);
    if (err) { setError(err); return; }
    setBusy(true);
    try {
      if (isRegister) await register(name.trim(), email.trim().toLowerCase(), password);
      else await login(email.trim().toLowerCase(), password);
    } catch (ex) {
      setError(ex.message || "خطا در ارتباط با سرور.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="pub-auth-form" noValidate>
      {error && <div className="pub-auth-form__error">{error}</div>}

      {isRegister && (
        <div className="pub-auth-form__field">
          <label>نام کامل</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="نام و نام‌خانوادگی" />
        </div>
      )}

      <div className="pub-auth-form__field">
        <label>ایمیل</label>
        <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="example@email.com" />
      </div>

      <div className="pub-auth-form__field">
        <label>رمز عبور</label>
        <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "حداقل ۸ کاراکتر، یک حرف بزرگ، یک عدد" : "رمز عبور"} />
      </div>

      <button type="submit" className="pub-auth-form__submit" disabled={busy}>
        {busy ? "در حال پردازش…" : isRegister ? "ثبت‌نام" : "ورود"}
      </button>

      <p className="pub-auth-form__switch">
        {isRegister ? "حساب دارید؟" : "حساب ندارید؟"}
        {" "}
        <button type="button" className="pub-auth-form__switch-btn" onClick={onSwitch}>
          {isRegister ? "وارد شوید" : "ثبت‌نام کنید"}
        </button>
      </p>
    </form>
  );
}

function ProfilePanel() {
  const { user, logout } = usePublicAuth();
  return (
    <div className="pub-account-profile">
      <div className="pub-account-profile__avatar" aria-hidden="true">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <h2 className="pub-account-profile__name">{user.name}</h2>
      <p className="pub-account-profile__email" dir="ltr">{user.email}</p>

      <div className="pub-account-profile__actions">
        <Link to="/create-ad" className="btn btn--primary">
          + ثبت آگهی جدید
        </Link>
        <Link to="/my-ads" className="btn btn--ghost">
          آگهی‌های من
        </Link>
      </div>

      <div className="pub-account-profile__meta">
        <span>عضویت از: {new Date(user.created_at).toLocaleDateString("fa-IR")}</span>
      </div>

      <button type="button" className="pub-account-profile__logout" onClick={logout}>
        خروج از حساب
      </button>
    </div>
  );
}

export default function PublicAccountPage() {
  const { user, loading } = usePublicAuth();
  const [mode, setMode] = useState("login");

  return (
    <div dir="rtl" className="pub-account-page">
      <Seo title="حساب کاربری — ایرانیو" />

      <div className="pub-account-page__inner">
        <div className="pub-account-page__header">
          <img src="/images/iraniu-logo-header.png" alt="Iraniu" className="pub-account-page__logo" />
          <h1 className="pub-account-page__title">
            {user ? `خوش آمدید، ${user.name}` : mode === "login" ? "ورود به حساب" : "ثبت‌نام"}
          </h1>
          <p className="pub-account-page__subtitle">
            {user ? "از اینجا می‌توانید آگهی‌های خود را مدیریت کنید." : "برای ثبت آگهی در دایرکتوری ایرانیو وارد شوید."}
          </p>
        </div>

        <div className="pub-account-page__body">
          {loading ? (
            <div className="pub-account-page__loading">در حال بارگذاری…</div>
          ) : user ? (
            <ProfilePanel />
          ) : (
            <AuthForm mode={mode} onSwitch={() => setMode(m => m === "login" ? "register" : "login")} />
          )}
        </div>

        <p className="pub-account-page__back">
          <Link to="/listings">← بازگشت به دایرکتوری</Link>
        </p>
      </div>

      <style>{`
        .pub-account-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          font-family: inherit;
        }
        .pub-account-page__inner {
          width: 100%;
          max-width: 420px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.10);
          overflow: hidden;
        }
        .pub-account-page__header {
          padding: 2rem 2rem 1.5rem;
          text-align: center;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #fff;
        }
        .pub-account-page__logo {
          height: 40px;
          margin-bottom: 1rem;
          object-fit: contain;
        }
        .pub-account-page__title {
          margin: 0 0 .5rem;
          font-size: 1.4rem;
          font-weight: 700;
        }
        .pub-account-page__subtitle {
          margin: 0;
          font-size: .9rem;
          opacity: .8;
        }
        .pub-account-page__body {
          padding: 2rem;
        }
        .pub-account-page__loading {
          text-align: center;
          color: #888;
          padding: 1rem;
        }
        .pub-account-page__back {
          text-align: center;
          padding: 0 2rem 1.5rem;
          margin: 0;
          font-size: .875rem;
        }
        .pub-account-page__back a {
          color: #4f67ff;
          text-decoration: none;
        }

        /* Auth form */
        .pub-auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .pub-auth-form__error {
          background: #fff0f0;
          border: 1px solid #ffbaba;
          border-radius: 8px;
          padding: .75rem 1rem;
          color: #c0392b;
          font-size: .875rem;
        }
        .pub-auth-form__field { display: flex; flex-direction: column; gap: .35rem; }
        .pub-auth-form__field label { font-size: .875rem; font-weight: 600; color: #374151; }
        .pub-auth-form__field input {
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
          padding: .65rem .875rem;
          font-size: .95rem;
          outline: none;
          transition: border-color .2s;
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
        }
        .pub-auth-form__field input:focus { border-color: #4f67ff; }
        .pub-auth-form__submit {
          background: #4f67ff;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: .75rem;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: background .2s;
          font-family: inherit;
        }
        .pub-auth-form__submit:hover:not(:disabled) { background: #3a52e8; }
        .pub-auth-form__submit:disabled { opacity: .6; cursor: not-allowed; }
        .pub-auth-form__switch { text-align: center; font-size: .875rem; color: #6b7280; margin: 0; }
        .pub-auth-form__switch-btn {
          background: none; border: none; color: #4f67ff; cursor: pointer;
          font-size: .875rem; font-weight: 600; padding: 0; font-family: inherit;
        }

        /* Profile panel */
        .pub-account-profile { text-align: center; }
        .pub-account-profile__avatar {
          width: 64px; height: 64px; border-radius: 50%;
          background: #4f67ff; color: #fff;
          font-size: 1.8rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1rem;
        }
        .pub-account-profile__name { margin: 0 0 .25rem; font-size: 1.2rem; font-weight: 700; }
        .pub-account-profile__email { margin: 0 0 1.5rem; color: #6b7280; font-size: .875rem; }
        .pub-account-profile__actions { display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1.5rem; }
        .pub-account-profile__meta { font-size: .8rem; color: #9ca3af; margin-bottom: 1.5rem; }
        .pub-account-profile__logout {
          background: none; border: 1px solid #e5e7eb; color: #6b7280;
          border-radius: 8px; padding: .5rem 1.5rem; cursor: pointer;
          font-size: .875rem; font-family: inherit; transition: all .2s;
        }
        .pub-account-profile__logout:hover { border-color: #ef4444; color: #ef4444; }
      `}</style>
    </div>
  );
}
