import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import DashboardMain from "../../components/DashboardMain.jsx";
import { isExchangeBusiness, parseExchangeRatesJson, parseLocalizedNumber } from "../../lib/exchangeRates.js";
import { apiGet } from "../../api.js";

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
  const n = parseLocalizedNumber(raw);
  return Number.isFinite(n) ? n : null;
}

function formatToman(raw) {
  const n = parseRateNum(raw);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fa-IR", { maximumFractionDigits: 2 })} تومان`;
}

function daysLeft(ends_at) {
  if (!ends_at) return 0;
  return Math.max(0, Math.ceil((new Date(ends_at) - Date.now()) / 86_400_000));
}

const PLAN_LABELS = { bronze: "برنز", silver: "نقره‌ای", gold: "طلایی", platinum: "پلاتینیوم" };

export default function DashboardOverviewPage() {
  const { dashSlug, biz, heroQr, phoneClickCount, impersonation } = useDashboard();
  const { me } = useAuth();
  const show2faPrompt = !me?.totp_enabled;
  const isExchange = isExchangeBusiness(biz);
  const exchangeRows = parseExchangeRatesJson(biz?.exchange_rates_json);
  const featuredRate = exchangeRows.find((r) => r.code === "GBP") || exchangeRows.find((r) => r.code === "USD") || exchangeRows[0] || null;
  const statusText = biz?.status && biz.status !== "active" ? "غیرفعال" : "فعال";

  const [wallet, setWallet] = useState(null);
  useEffect(() => {
    const url = impersonation ? `/api/wallet?slug=${encodeURIComponent(dashSlug)}` : "/api/wallet";
    apiGet(url).then(setWallet).catch(() => {});
  }, [impersonation?.managerId, dashSlug]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <div className="panel-welcome">
            <div>
              <p className="panel-welcome__title">
                {biz?.name_fa ? `خوش آمدید — ${biz.name_fa}` : "پنل کسب‌وکار شما"}
              </p>
              <p className="panel-welcome__sub">مدیریت آگهی، تبلیغات، لینک‌ها و ابزارها</p>
            </div>
            <div className="panel-welcome__actions">
              <Link to="/dashboard/edit" className="panel-welcome__btn panel-welcome__btn--white">
                <i className="fa-solid fa-pen" /> ویرایش آگهی
              </Link>
              <Link to={`/business?slug=${encodeURIComponent(dashSlug)}`} className="panel-welcome__btn panel-welcome__btn--outline">
                <i className="fa-solid fa-eye" /> پیش‌نمایش
              </Link>
            </div>
          </div>

          <div className="panel-stats">
            <div className="panel-stat panel-stat--blue">
              <div className="panel-stat__icon"><i className="fa-solid fa-qrcode" /></div>
              <div>
                <p className="panel-stat__value">{heroQr}</p>
                <p className="panel-stat__label">اسکن QR</p>
              </div>
            </div>
            <div className="panel-stat panel-stat--green">
              <div className="panel-stat__icon"><i className="fa-solid fa-phone" /></div>
              <div>
                <p className="panel-stat__value">{phoneClickCount === null ? "—" : toFaDigits(String(phoneClickCount))}</p>
                <p className="panel-stat__label">کلیک تماس</p>
              </div>
            </div>
            <div className="panel-stat panel-stat--orange">
              <div className="panel-stat__icon"><i className="fa-solid fa-star" /></div>
              <div>
                <p className="panel-stat__value">{formatRatingDisplay(biz?.rating)}</p>
                <p className="panel-stat__label">امتیاز</p>
              </div>
            </div>
            <div className="panel-stat panel-stat--purple">
              <div className="panel-stat__icon"><i className="fa-solid fa-circle-check" /></div>
              <div>
                <p className="panel-stat__value">{statusText}</p>
                <p className="panel-stat__label">وضعیت آگهی</p>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="panel-cols" style={{ marginTop: "0.25rem" }}>
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-bolt" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                  اقدام سریع
                </h3>
              </div>
              <div className="panel-card__body">
                <div className="panel-quick-grid">
                  <Link to="/dashboard/edit" className="panel-quick-btn">
                    <i className="fa-solid fa-pen" />ویرایش آگهی
                  </Link>
                  <Link to="/dashboard/media" className="panel-quick-btn">
                    <i className="fa-solid fa-images" />تصاویر
                  </Link>
                  <Link to="/dashboard/wallet" className="panel-quick-btn">
                    <i className="fa-solid fa-coins" />کیف توکن
                  </Link>
                  <Link to="/dashboard/qr" className="panel-quick-btn">
                    <i className="fa-solid fa-qrcode" />کد QR
                  </Link>
                  <Link to="/dashboard/biolink" className="panel-quick-btn">
                    <i className="fa-solid fa-link" />Biolink
                  </Link>
                  <Link to={`/business?slug=${encodeURIComponent(dashSlug)}`} target="_blank" className="panel-quick-btn">
                    <i className="fa-solid fa-arrow-up-right-from-square" />مشاهده آگهی
                  </Link>
                  <Link to="/guide" className="panel-quick-btn">
                    <i className="fa-solid fa-book-open" />راهنما
                  </Link>
                </div>
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-coins" style={{ marginInlineEnd: "0.5rem", color: "#f59e0b" }} />
                  کیف توکن
                </h3>
                <Link to="/dashboard/wallet" className="pact-btn pact-btn--ghost" style={{ fontSize: "0.78rem" }}>مشاهده کامل</Link>
              </div>
              <div className="panel-card__body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                {/* Balance row */}
                <div style={{ display: "flex", gap: "1rem" }}>
                  {/* Big balance */}
                  <div style={{
                    flex: 1, background: "linear-gradient(135deg,#1e1b4b,#4f46e5)",
                    borderRadius: 14, padding: "1rem 1.25rem", color: "#fff",
                    display: "flex", alignItems: "center", gap: "0.75rem",
                  }}>
                    <i className="fa-solid fa-coins" style={{ fontSize: "1.5rem", color: "#fcd34d" }} />
                    <div>
                      <p style={{ margin: 0, fontSize: "2rem", fontWeight: 900, lineHeight: 1 }}>
                        {toFaDigits(String(wallet?.wallet?.balance ?? "—"))}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>موجودی توکن</p>
                    </div>
                  </div>
                  {/* Earned / Spent */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", justifyContent: "center" }}>
                    <div style={{ background: "#dcfce7", borderRadius: 10, padding: "0.45rem 0.85rem", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#166534" }}>+{toFaDigits(String(wallet?.wallet?.total_earned ?? 0))}</p>
                      <p style={{ margin: 0, fontSize: "0.68rem", color: "#16a34a" }}>دریافتی</p>
                    </div>
                    <div style={{ background: "#fee2e2", borderRadius: 10, padding: "0.45rem 0.85rem", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#991b1b" }}>-{toFaDigits(String(wallet?.wallet?.total_spent ?? 0))}</p>
                      <p style={{ margin: 0, fontSize: "0.68rem", color: "#dc2626" }}>مصرف</p>
                    </div>
                  </div>
                </div>

                {/* Active boost */}
                {wallet?.activeBoost ? (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.65rem",
                    background: "#eef2ff", borderRadius: 12, padding: "0.65rem 0.85rem",
                    border: "1.5px solid #c7d2fe",
                  }}>
                    <i className="fa-solid fa-rocket" style={{ color: "#6366f1", fontSize: "1.1rem" }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#3730a3" }}>
                        تبلیغ فعال — پلن {PLAN_LABELS[wallet.activeBoost.plan_id] || wallet.activeBoost.plan_id}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "#6366f1" }}>
                        {toFaDigits(String(daysLeft(wallet.activeBoost.ends_at)))} روز باقی‌مانده
                      </p>
                    </div>
                    <span className="pbadge pbadge--blue">فعال</span>
                  </div>
                ) : null}

                {/* Milestone progress */}
                {wallet?.milestones ? (() => {
                  const earned = wallet.milestones.filter(m => m.earned).length;
                  const total  = wallet.milestones.length;
                  const pct    = Math.round((earned / total) * 100);
                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>
                          پیشرفت کسب توکن
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                          {toFaDigits(String(earned))}/{toFaDigits(String(total))}
                        </span>
                      </div>
                      <div style={{ height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 99,
                          background: "linear-gradient(90deg,#6366f1,#a78bfa)",
                          width: `${pct}%`, transition: "width 0.6s ease",
                        }} />
                      </div>
                    </div>
                  );
                })() : null}

                <Link to="/dashboard/wallet" className="pbtn pbtn--primary" style={{ justifyContent: "center" }}>
                  <i className="fa-solid fa-rocket" /> پلن‌های تبلیغاتی
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </DashboardMain>
  );
}
