import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader.jsx";
import Seo from "../components/Seo.jsx";
import FloatingBackButton from "../components/FloatingBackButton.jsx";

/**
 * تمام‌مسیرهای ناشناخته — بیرون از MainLayout تا با /admin و /dashboard تداخل نکند.
 * هدر سایت اینجا تکرار می‌شود تا ظاهر یکدست بماند.
 */
export default function NotFoundPage() {
  return (
    <>
      <Seo title="صفحه پیدا نشد" noindex description="این آدرس در ایرانیو وجود ندارد." />
      <a className="skip-link" href="#main">
        پرش به محتوا
      </a>
      <SiteHeader />
      <main id="main">
        <div className="page-404">
          <div className="page-404__bg" aria-hidden="true" />
          <div className="container page-404__wrap">
            <div className="page-404__card">
              <p className="page-404__code" aria-hidden="true">
                ۴۰۴
              </p>
              <h1 className="page-404__title">صفحه پیدا نشد</h1>
              <p className="page-404__lead">
                این آدرس در سایت نیست. آدرس را بررسی کنید یا از لینک‌های زیر استفاده کنید.
              </p>
              <div className="page-404__actions">
                <Link to="/" className="btn btn--primary">
                  صفحهٔ اصلی
                </Link>
                <Link to="/listings" className="btn btn--ghost">
                  فهرست کسب‌وکارها
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <FloatingBackButton />
    </>
  );
}
