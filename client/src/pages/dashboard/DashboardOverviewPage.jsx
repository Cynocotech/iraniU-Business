import { Link } from "react-router-dom";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import DashboardPanelHead, { dashboardIcons } from "../../components/DashboardPanelHead.jsx";
import DashboardMain from "../../components/DashboardMain.jsx";
import { isExchangeBusiness, parseExchangeRatesJson } from "../../lib/exchangeRates.js";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function toFaDigits(str) {
  return String(str).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

function formatRatingDisplay(rating) {
  if (rating == null || rating === "") return "—";
  const n = Number(rating);
  if (!Number.isFinite(n)) return "—";
  const [intPart, dec] = n.toFixed(1).split(".");
  return `${toFaDigits(intPart)}٫${toFaDigits(dec)}`;
}

function parseRateNum(raw) {
  const n = Number.parseFloat(String(raw || "").replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatToman(raw) {
  const n = parseRateNum(raw);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fa-IR", { maximumFractionDigits: 2 })} تومان`;
}

export default function DashboardOverviewPage() {
  const { dashSlug, biz, heroQr, phoneClickCount } = useDashboard();
  const { me } = useAuth();
  const show2faPrompt = !me?.totp_enabled;
  const isExchange = isExchangeBusiness(biz);
  const exchangeRows = parseExchangeRatesJson(biz?.exchange_rates_json);
  const featuredRate = exchangeRows.find((r) => r.code === "GBP") || exchangeRows.find((r) => r.code === "USD") || exchangeRows[0] || null;
  const statusText = biz?.status && biz.status !== "active" ? "غیرفعال" : "فعال";

  return (
    <DashboardMain>
      {show2faPrompt ? (
        <section
          className="dashboard-panel"
          role="status"
          style={{ marginBottom: "var(--space-md)", borderColor: "rgba(245, 158, 11, 0.45)", background: "rgba(254, 252, 232, 0.9)" }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>امنیت حساب: ورود دو مرحله‌ای را فعال کنید</p>
          <p className="field-hint" style={{ margin: "0.35rem 0 0" }}>
            برای امنیت بیشتر، در ورود بعدی کد Google Authenticator را هم فعال کنید. این مرحله در onboarding اجباری نیست.
          </p>
        </section>
      ) : null}

      {isExchange ? (
        <section className="exchange-panel-overview" aria-labelledby="exchange-overview-heading">
          <header className="exchange-panel-overview__head">
            <h2 id="exchange-overview-heading" className="exchange-panel-overview__title">
              پنل مدیریت
            </h2>
            <p className="exchange-panel-overview__subtitle">آگهی صرافی: {biz?.name_fa || "—"}</p>
          </header>

          <div className="exchange-panel-overview__notice" role="status">
            در حال مشاهده پنل به عنوان مدیر — برای خروج از حساب، از منوی بالا استفاده کنید.
          </div>

          <div className="exchange-panel-overview__stats">
            <article className="exchange-panel-overview__stat exchange-panel-overview__stat--buy">
              <p className="exchange-panel-overview__stat-label">نرخ خرید {featuredRate?.name || featuredRate?.code || "ارز"}</p>
              <p className="exchange-panel-overview__stat-value" dir="ltr">
                {formatToman(featuredRate?.buy)}
              </p>
            </article>
            <article className="exchange-panel-overview__stat exchange-panel-overview__stat--sell">
              <p className="exchange-panel-overview__stat-label">نرخ فروش {featuredRate?.name || featuredRate?.code || "ارز"}</p>
              <p className="exchange-panel-overview__stat-value" dir="ltr">
                {formatToman(featuredRate?.sell)}
              </p>
            </article>
            <article className="exchange-panel-overview__stat exchange-panel-overview__stat--status">
              <p className="exchange-panel-overview__stat-label">وضعیت نمایش</p>
              <p className="exchange-panel-overview__status-value">{statusText}</p>
              <p className="exchange-panel-overview__status-sub">وضعیت آگهی/پکیج</p>
            </article>
          </div>

          <div className="exchange-panel-overview__content">
            <section className="exchange-panel-overview__board">
              <h3>تابلو اعلانات</h3>
              <ul>
                <li>اطلاعات صرافی خود را کامل کنید تا در دایرکتوری رتبه بهتری بگیرید.</li>
                <li>برای نمایش در لیست پیشنهادها، نرخ‌ها را منظم به‌روزرسانی کنید.</li>
                <li>تصویر کاور استاندارد و واضح، اعتماد کاربر را بیشتر می‌کند.</li>
              </ul>
            </section>

            <section className="exchange-panel-overview__actions">
              <Link className="btn btn--primary" to="/dashboard/rates">
                نرخ‌ها
              </Link>
              <Link className="btn btn--ghost" to="/dashboard/edit">
                ویرایش آگهی
              </Link>
              <Link className="btn btn--ghost" to="/dashboard/media">
                تصاویر و کاور
              </Link>
              <Link className="btn btn--ghost" to={`/business?slug=${encodeURIComponent(dashSlug)}`}>
                پیش‌نمایش صفحهٔ عمومی
              </Link>
            </section>
          </div>
        </section>
      ) : null}

      {!isExchange ? (
      <>
      <div className="app-shell__widgets">
        <div className="app-shell__hero-card">
          <svg className="app-shell__hero-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
            />
            <polyline
              points="22 4 12 14.01 9 11.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="app-shell__hero-label">وضعیت آگهی</p>
          <p className="app-shell__hero-value">منتشر شده</p>
          <p className="app-shell__hero-meta">
            در فهرست عمومی دیده می‌شود
          </p>
          <Link className="app-shell__hero-btn" to="/dashboard/edit">
            مدیریت آگهی
          </Link>
        </div>
        <div className="app-shell__metrics">
          <div className="app-shell__metric app-shell__metric--teal">
            <svg className="app-shell__metric-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path stroke="#fff" strokeWidth="2" d="M4 4h5v5H4V4zm11 0h5v5h-5V4zM4 15h5v5H4v-5zm11 0h5v5h-5v-5z" />
              <path stroke="#fff" strokeWidth="2" d="M9 9h6v6H9z" />
            </svg>
            <p className="app-shell__metric-label">اسکن QR نظر Google</p>
            <p className="app-shell__metric-value" id="dash-metric-qr-scans" dir="ltr">
              {heroQr}
            </p>
            <p className="app-shell__metric-hint">جزئیات در بخش «QR نظر Google»</p>
          </div>
          <div className="app-shell__metric app-shell__metric--blue">
            <svg className="app-shell__metric-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
              />
            </svg>
            <p className="app-shell__metric-label">تماس</p>
            <p className="app-shell__metric-value" id="dash-metric-phone-clicks" dir="ltr">
              {phoneClickCount === null ? "—" : toFaDigits(String(phoneClickCount))}
            </p>
            <p className="app-shell__metric-hint">کلیک روی شماره در صفحهٔ عمومی</p>
          </div>
          <div className="app-shell__metric app-shell__metric--coral">
            <svg className="app-shell__metric-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                stroke="#fff"
                strokeWidth="2"
                strokeLinejoin="round"
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
            <p className="app-shell__metric-label">امتیاز آگهی</p>
            <p className="app-shell__metric-value" dir="ltr">
              {formatRatingDisplay(biz?.rating)}
            </p>
            <p className="app-shell__metric-hint">از ویرایش آگهی</p>
          </div>
        </div>
      </div>

      <section className="dashboard-panel" id="panel-overview" aria-labelledby="overview-heading">
        <DashboardPanelHead headingId="overview-heading" title="نمای کلی" icon={dashboardIcons.overview} />
        <p className="field-hint" style={{ margin: 0 }}>
          {biz?.name_fa ? (
            <>
              آگهی فعال: <strong>{biz.name_fa}</strong>
              {" — "}
              نامک: <strong lang="en">{dashSlug}</strong>
              {" — "}
            </>
          ) : (
            <>
              نامک فعال: <strong lang="en">{dashSlug}</strong>
              {" — "}
            </>
          )}
          از منوی کنار به هر بخش بروید؛ مثلاً <Link to="/dashboard/edit">ویرایش آگهی</Link> یا{" "}
          <Link to="/dashboard/careers">فرصت‌های شغلی</Link>.
        </p>
      </section>
      </>
      ) : null}
    </DashboardMain>
  );
}
