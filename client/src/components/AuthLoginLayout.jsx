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
            <img
              src="/images/login-logo.png"
              alt=""
              className="auth-login__logo-img"
              width={320}
              height={80}
              decoding="async"
            />
          </Link>
          {badge ? (
            <span className="auth-login__badge">
              <span className="auth-login__badge-dot" aria-hidden="true" />
              {badge}
            </span>
          ) : null}
          <h1 className="auth-login__title">{title}</h1>
          {description ? <p className="auth-login__lead">{description}</p> : null}
        </header>

        <div className="auth-login__card" id="auth-login-panel">
          <div className="auth-login__card-inner">{children}</div>
          {footer ? <div className="auth-login__card-foot">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
