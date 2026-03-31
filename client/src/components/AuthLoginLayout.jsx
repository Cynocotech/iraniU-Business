import { Link } from "react-router-dom";

/**
 * قاب مشترک صفحات ورود — پس‌زمینهٔ گرادیان، کارت شیشه‌ای، تایپوگرافی
 */
export default function AuthLoginLayout({ variant = "manager", badge, title, description, children, footer }) {
  const v = variant === "admin" ? "admin" : "manager";
  return (
    <main className={`auth-login auth-login--${v}`} id="main">
      <a className="skip-link" href="#auth-login-panel">
        پرش به فرم ورود
      </a>
      <div className="auth-login__bg" aria-hidden="true" />
      <div className="auth-login__glow auth-login__glow--1" aria-hidden="true" />
      <div className="auth-login__glow auth-login__glow--2" aria-hidden="true" />
      <div className="auth-login__wrap">
        <header className="auth-login__hero">
          <Link to="/" className="auth-login__logo" aria-label="ایرانیو — صفحهٔ اصلی">
            <span className="auth-login__logo-mark" aria-hidden="true">
              ای
            </span>
            <span className="auth-login__logo-text">ایرانیو</span>
          </Link>
          {badge ? (
            <span className="auth-login__badge">
              <span className="auth-login__badge-dot" aria-hidden="true" />
              {badge}
            </span>
          ) : null}
          <h1 className="auth-login__title">{title}</h1>
          <p className="auth-login__lead">{description}</p>
          <ul className="auth-login__features">
            <li>دسترسی امن با HTTPS</li>
            <li>رمزنگاری رمز عبور روی سرور</li>
            {v === "admin" ? <li>ورود دو مرحله‌ای در صورت فعال‌سازی</li> : <li>پنل اختصاصی کسب‌وکار شما</li>}
          </ul>
        </header>

        <div className="auth-login__card" id="auth-login-panel">
          <div className="auth-login__card-inner">{children}</div>
          {footer ? <div className="auth-login__card-foot">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
