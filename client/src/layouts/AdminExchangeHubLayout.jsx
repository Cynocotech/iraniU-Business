import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";

export default function AdminExchangeHubLayout() {
  const [copied, setCopied] = useState(false);

  const copyOnboardingLink = async () => {
    const path = "/onboarding/exchange";
    const full = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("لینک راه‌اندازی را کپی کنید:", full);
    }
  };

  return (
    <>
      <Seo
        title="دپارتمان عملیات صرافی — پنل ادمین"
        noindex
        description="مدیریت داخلی صرافی‌ها و نرخ؛ جدا از دایرکتوری عمومی."
      />
      <div className="admin-exchange-hub">
        <header className="admin-exchange-dept" aria-labelledby="admin-exchange-dept-title">
          <p className="admin-exchange-dept__eyebrow">سامانه داخلی — بدون ارتباط با دایرکتوری عمومی</p>
          <h1 id="admin-exchange-dept-title" className="admin-exchange-dept__title">
            دپارتمان عملیات صرافی
          </h1>
          <p className="admin-exchange-dept__lead">
            این بخش فقط برای مدیریت آگهی‌های صرافی، نرخ و وضعیت انتشار در ایرانیو است و بخش جدا از «دایرکتوری» و صفحات عمومی محسوب می‌شود.
          </p>
          <div className="admin-exchange-dept__actions">
            <Link className="btn btn--ghost" to="/admin/exchanges/managers">
              مدیران صرافی
            </Link>
            <Link className="btn btn--ghost" to="/admin/exchanges/banners">
              بنرهای تبلیغاتی
            </Link>
            <Link className="btn btn--accent" to="/admin/exchanges/add">
              افزودن آگهی صرافی
            </Link>
            <Link className="btn btn--ghost" to="/admin-edit">
              ویرایش با نامک
            </Link>
            <Link className="btn btn--ghost" to="/onboarding/exchange">
              راه‌اندازی حساب مدیر صرافی
            </Link>
            <button type="button" className="btn btn--ghost" onClick={copyOnboardingLink}>
              {copied ? "کپی شد" : "کپی لینک راه‌اندازی"}
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </>
  );
}
