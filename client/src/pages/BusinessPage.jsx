import { Link, useSearchParams, useLocation, useOutletContext } from "react-router-dom";
import BusinessReportModal from "../components/BusinessReportModal.jsx";
import Seo from "../components/Seo.jsx";
import { useEffect, useMemo, useState } from "react";
import "./businessCoverHead.desktop.css";
import { apiGet, apiPost } from "../api.js";
import { getSiteUrl } from "../lib/siteUrl.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import {
  parseGalleryJson,
  parseHoursJson,
  resolveBusinessImageUrl,
  pickHeroImageUrlFromBusiness,
} from "../lib/businessProfile.js";
import { useMediaQuery } from "../lib/useMediaQuery.js";
import {
  EXCHANGE_PAYMENT_METHODS,
  exchangeCurrencyNameFaShort,
  formatExchangeRateToman,
  getEffectiveRateRaw,
  isExchangeBusiness,
  isExchangeCompanyVerified,
  isExchangeCategory,
  parseExchangePaymentMethodsJson,
  parseExchangeRatesJson,
} from "../lib/exchangeRates.js";
import ExchangeInlineCalc from "../components/ExchangeInlineCalc.jsx";
import ExchangeCompanyVerifiedBadge from "../components/ExchangeCompanyVerifiedBadge.jsx";
import ExchangePaymentMethodIcon from "../components/ExchangePaymentMethodIcon.jsx";

const FALLBACK_LONDON_COVER =
  "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600&q=80&auto=format&fit=crop";

function trackBusinessPhoneClick(slug) {
  if (!slug) return;
  apiPost("/api/phone-click", { slug }).catch(() => {});
}

function resolveBusinessTimeZone(row) {
  const raw = `${row?.city || ""} ${row?.address || ""}`.toLowerCase();
  const map = [
    { keys: ["london", "manchester", "birmingham", "uk", "england"], tz: "Europe/London", label: "وقت محلی (انگلستان)" },
    { keys: ["tehran", "iran", "تهران", "ایران"], tz: "Asia/Tehran", label: "وقت محلی" },
    { keys: ["dubai", "uae", "emirates"], tz: "Asia/Dubai", label: "وقت محلی (امارات)" },
    { keys: ["istanbul", "turkey"], tz: "Europe/Istanbul", label: "وقت محلی (ترکیه)" },
    { keys: ["toronto", "canada"], tz: "America/Toronto", label: "وقت محلی (کانادا)" },
  ];
  const hit = map.find((m) => m.keys.some((k) => raw.includes(k)));
  return hit || { tz: "Europe/London", label: "وقت محلی" };
}

function formatClockForZone(nowMs, timeZone) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(nowMs));
  } catch {
    return "—";
  }
}

/** یکدست‌سازی توضیحات: حذف خط خالی پشت‌سرهم، تبدیل \\n ذخیره‌شده به خط جدید */
function normalizeAboutDescription(raw) {
  let s = String(raw ?? "");
  s = s.replace(/\\n/g, "\n");
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** Short lead for profile; full text available on demand (long directory imports). */
function summarizeAboutText(raw, maxLen = 280) {
  const original = normalizeAboutDescription(raw);
  if (!original) return { summary: "", hasMore: false };
  const flat = original
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= maxLen) return { summary: flat, hasMore: false };
  const slice = flat.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxLen * 0.55 ? slice.slice(0, lastSpace) : slice;
  return { summary: `${cut.trim()}…`, hasMore: true };
}

/** Inline SVG defs (IDs match css / legacy business.html) */
function ProfileSprites() {
  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" className="contact-sprite" aria-hidden="true" focusable="false">
        <defs>
          <symbol id="section-about" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-2-7H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
            />
          </symbol>
          <symbol id="section-hours" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM7 12h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"
            />
          </symbol>
          <symbol id="section-gallery" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
            />
          </symbol>
          <symbol id="section-promote" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z"
            />
          </symbol>
          <symbol id="section-careers" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm-6 0h-4V4h4v2z"
            />
          </symbol>
        </defs>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" className="contact-sprite" aria-hidden="true" focusable="false">
        <defs>
          <symbol id="contact-phone" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
            />
          </symbol>
        </defs>
      </svg>
    </>
  );
}

export default function BusinessPage() {
  const { setHeaderLogoHref } = useOutletContext() ?? {};
  const [params, setSearchParams] = useSearchParams();
  const location = useLocation();
  const slug = params.get("slug") || "clinic-pars";
  const [b, setB] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [showOnboardingWelcome, setShowOnboardingWelcome] = useState(
    () => !!location.state?.onboardingComplete
  );
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [exchangeContactSheetOpen, setExchangeContactSheetOpen] = useState(false);
  const [exchangeCalcSheetOpen, setExchangeCalcSheetOpen] = useState(false);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [exchangeMode, setExchangeMode] = useState("buy");
  const [exchangeAmount, setExchangeAmount] = useState("1");
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState("USD");

  useEffect(() => {
    setAboutExpanded(false);
    setExchangeContactSheetOpen(false);
    setExchangeCalcSheetOpen(false);
    setHeaderLogoHref?.("/");
  }, [slug, setHeaderLogoHref]);

  useEffect(() => {
    const t = window.setInterval(() => setClockNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    setB(null);
    setLoadState("loading");
    apiGet(`/api/businesses/${encodeURIComponent(slug)}`)
      .then((row) => {
        setB(row);
        setLoadState("ok");
      })
      .catch(() => {
        setB(null);
        setLoadState("error");
      });
  }, [slug]);

  useEffect(() => {
    if (loadState !== "ok" || !b) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("report") !== "1") return;
    setReportOpen(true);
    sp.delete("report");
    setSearchParams(sp, { replace: true });
  }, [loadState, b, setSearchParams]);

  const logoMark = useMemo(() => {
    if (!b?.name_fa) return "؟";
    const t = b.name_fa.trim();
    return t ? [...t][0] : "؟";
  }, [b]);

  useEffect(() => {
    document.body.classList.add("business-page");
    return () => {
      document.body.classList.remove(
        "business-page",
        "business-page--unclaimed",
        "business-page--claimed",
        "business-page--exchange-detail"
      );
    };
  }, []);

  useEffect(() => {
    if (!b) return;
    const claimed = !!b.claimed;
    document.body.classList.toggle("business-page--claimed", claimed);
    document.body.classList.toggle("business-page--unclaimed", !claimed);
    document.body.classList.toggle("business-page--exchange-detail", isExchangeBusiness(b));
    return () => {
      document.body.classList.remove("business-page--claimed", "business-page--unclaimed", "business-page--exchange-detail");
    };
  }, [b]);

  useEffect(() => {
    if (!setHeaderLogoHref) return;
    if (loadState !== "ok" || !b) {
      return;
    }
    setHeaderLogoHref(isExchangeBusiness(b) ? "/exchanges" : "/");
    return () => setHeaderLogoHref("/");
  }, [loadState, b, setHeaderLogoHref]);

  const businessSeoDescription = useMemo(() => {
    if (!b) return SEO_DEFAULT_DESCRIPTION;
    const norm = normalizeAboutDescription(b.description);
    const flat = norm.replace(/\s+/g, " ").trim();
    if (flat) return flat.slice(0, 320);
    const line = [b.listing_title, b.category, b.city].filter(Boolean).join(" — ");
    return `${b.name_fa || "کسب‌وکار"}${line ? ` — ${line}` : ""}`.slice(0, 320);
  }, [b]);

  const reservationLink = String(b?.reservation_link || "").trim();
  const twilioModuleOn = b?.twilio_module_enabled !== false;
  const trackedEnabled = twilioModuleOn && !!b?.call_tracking_enabled;
  const trackedNumber = String(b?.call_tracking_number || "").trim();
  const phoneForCall = trackedEnabled && trackedNumber ? trackedNumber : String(b?.phone || "").trim();
  const showExchangeContactFab = isExchangeBusiness(b) && !!phoneForCall;

  const coverView = useMemo(() => {
    if (!b) return { url: FALLBACK_LONDON_COVER, fallback: true };
    const custom = pickHeroImageUrlFromBusiness(b);
    if (custom) return { url: resolveBusinessImageUrl(custom), fallback: false };
    return { url: FALLBACK_LONDON_COVER, fallback: true };
  }, [b]);

  const businessJsonLd = useMemo(() => {
    if (!b) return null;
    const site = getSiteUrl();
    const url = site ? `${site}/business?slug=${encodeURIComponent(b.slug)}` : undefined;
    let imageUrl = coverView.url;
    if (imageUrl && !/^https?:\/\//i.test(imageUrl) && site) {
      imageUrl = `${site}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
    }
    const addr = {};
    if (b.address) addr.streetAddress = String(b.address).trim();
    if (b.city) addr.addressLocality = String(b.city).trim();
    const out = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: (b.name_fa || "").trim() || "کسب‌وکار",
      ...(url ? { url } : {}),
      ...(imageUrl && /^https?:\/\//i.test(imageUrl) ? { image: imageUrl } : {}),
      ...(b.phone && String(b.phone).trim() ? { telephone: String(b.phone).trim() } : {}),
    };
    if (Object.keys(addr).length) {
      out.address = { "@type": "PostalAddress", ...addr };
    }
    return out;
  }, [b, coverView.url]);

  const leadTitleRaw = b?.listing_title && String(b.listing_title).trim() ? String(b.listing_title).trim() : "";
  const leadTitle = leadTitleRaw && leadTitleRaw !== String(b?.name_fa || "").trim() ? leadTitleRaw : "";
  const secondLine =
    (b?.subtitle && String(b.subtitle).trim()) ||
    [b?.category, b?.city].filter(Boolean).join(" — ") ||
    (b?.address ? String(b.address).trim() : "");
  const metaParts = [
    b?.price_range,
    b?.rating != null ? `${Number(b?.rating).toFixed(1)} ★` : "",
  ].filter(Boolean);
  const isActive = !b?.status || String(b.status).toLowerCase() === "active";

  const hoursRows = parseHoursJson(b?.hours_json);
  const gallerySlots = parseGalleryJson(b?.gallery_json);
  const exchangeRatesRows = parseExchangeRatesJson(b?.exchange_rates_json);
  const exchangePaymentMethods = parseExchangePaymentMethodsJson(b?.payment_methods_json);
  const showExchangeSection = isExchangeCategory(b?.category) || exchangeRatesRows.some((r) => r.buy || r.sell);
  const exchangeTodayRateEnabled = Number(b?.exchange_today_rate_enabled) !== 0;
  const selectedRate =
    exchangeRatesRows.find((r) => r.code === selectedCurrencyCode) || exchangeRatesRows[0] || null;
  const showExchangeCalcFab = isExchangeBusiness(b) && !!selectedRate;
  const selectedRateRaw = getEffectiveRateRaw(selectedRate, exchangeMode);
  const selectedRateNum = Number.parseFloat(String(selectedRateRaw || "").replace(",", "."));
  const exchangeAmountNum = Number.parseFloat(String(exchangeAmount || "").replace(",", "."));
  const exchangeResult =
    Number.isFinite(selectedRateNum) && Number.isFinite(exchangeAmountNum)
      ? selectedRateNum * exchangeAmountNum
      : null;
  const showPromo = !!(b?.promo_title?.trim() || b?.promo_description?.trim());
  const careersBody = b?.careers_text && String(b.careers_text).trim();
  const careersSubtitle = b?.careers_title && String(b.careers_title).trim();
  const showCareers = !!careersBody;

  const aboutLead = useMemo(() => summarizeAboutText(b?.description), [b?.description]);
  const descriptionNormalized = useMemo(() => normalizeAboutDescription(b?.description), [b?.description]);
  const desktopLayout = useMediaQuery("(min-width: 1024px)");
  const exchangeBusinessTime = useMemo(() => resolveBusinessTimeZone(b), [b?.city, b?.address]);
  const exchangeLocalTimeText = useMemo(
    () => formatClockForZone(clockNowMs, exchangeBusinessTime.tz),
    [clockNowMs, exchangeBusinessTime.tz]
  );
  const iranTimeText = useMemo(() => formatClockForZone(clockNowMs, "Asia/Tehran"), [clockNowMs]);
  const categoryOnly =
    b?.category && String(b.category).trim() ? String(b.category).trim() : "";
  /** Desktop bar: category, else subtitle / location line (same as mobile second line). */
  const desktopBarSubtitle = categoryOnly || secondLine || "";

  useEffect(() => {
    if (!exchangeRatesRows.length) return;
    if (exchangeRatesRows.some((r) => r.code === selectedCurrencyCode)) return;
    setSelectedCurrencyCode(exchangeRatesRows[0].code);
  }, [exchangeRatesRows, selectedCurrencyCode]);

  useEffect(() => {
    if (!selectedRate) return;
    const buyOk = selectedRate.buy_active !== false;
    const sellOk = selectedRate.sell_active !== false;
    setExchangeMode((m) => {
      if (m === "buy" && !buyOk && sellOk) return "sell";
      if (m === "sell" && !sellOk && buyOk) return "buy";
      return m;
    });
  }, [selectedRate?.code, selectedRate?.buy_active, selectedRate?.sell_active]);

  if (loadState === "loading") {
    return (
      <>
        <Seo title="پروفایل کسب‌وکار" description={SEO_DEFAULT_DESCRIPTION} />
        <article className="section container" style={{ padding: "2rem 0" }}>
          <p className="field-hint">در حال بارگذاری…</p>
        </article>
      </>
    );
  }

  if (loadState === "error" || !b) {
    return (
      <>
        <Seo
          title="کسب‌وکار پیدا نشد"
          noindex
          description="این آگهی در فهرست نیست یا آدرس نامعتبر است."
        />
        <article className="section container" style={{ padding: "2rem 0" }}>
        <h1>کسب‌وکار پیدا نشد</h1>
        <p className="field-hint">آدرس نامعتبر است یا داده‌ای برای این شناسه نیست.</p>
        <p>
          <Link to="/listings">بازگشت به لیست</Link>
        </p>
      </article>
      </>
    );
  }

  const claimHref = `/claim?slug=${encodeURIComponent(b.slug)}&business=${encodeURIComponent(b.name_fa)}`;

  return (
    <>
      <Seo
        title={`${b.name_fa} — پروفایل کسب‌وکار`}
        description={businessSeoDescription}
        image={coverView.url}
        jsonLd={businessJsonLd}
      />
    <article className="section container">
      {showOnboardingWelcome && (
        <div
          className="onboarding-success-banner"
          role="status"
          style={{
            marginBottom: "1rem",
            padding: "0.85rem 1rem",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>آگهی شما ثبت شد.</strong> می‌توانید جزئیات بیشتر را بعداً تکمیل کنید یا{" "}
            <Link to={`/claim?slug=${encodeURIComponent(b.slug)}&business=${encodeURIComponent(b.name_fa)}`}>
              مالکیت را ادعا
            </Link>{" "}
            کنید.
          </p>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ marginTop: "0.5rem" }}
            onClick={() => setShowOnboardingWelcome(false)}
          >
            بستن
          </button>
        </div>
      )}
      {!b.claimed && !isExchangeBusiness(b) && (
        <div className="claim-banner" role="region" aria-label="ادعای مالکیت">
          <p className="claim-banner__text">
            <strong>این کسب‌وکار هنوز به حساب هیچ مدیری وصل نشده است.</strong>
          </p>
          <Link className="btn btn--primary" id="biz-claim-link" to={claimHref}>
            ادعای مالکیت
          </Link>
        </div>
      )}

      {!!b.claimed && (
        <div className="owner-managed-note" role="status">
          <p>
            <strong>آگهی تأییدشده:</strong> این کسب‌وکار به یک مدیر وصل شده است. دکمهٔ «ادعای مالکیت» برای بازدیدکنندگان
            نمایش داده نمی‌شود.
          </p>
          <Link className="btn btn--primary" to="/login?redirect=%2Fdashboard">
            ورود به پنل و ویرایش آگهی
          </Link>
        </div>
      )}

      <div className="profile-panel">
        {isExchangeBusiness(b) && !isExchangeCompanyVerified(b) ? (
          <div className="exchange-private-alert exchange-private-alert--hero" role="alert">
            <strong>توجه:</strong> این صرافی در ایرانیو به‌عنوان کسب‌وکار ثبت‌شده (شرکت) تأیید نشده است؛ ممکن است فعالیت
            شخصی یا غیررسمی باشد. پیش از هر معامله، هویت و اعتبار طرف مقابل را بررسی کنید و در صورت تردید مستقیماً تماس
            بگیرید.
          </div>
        ) : null}
        {isExchangeBusiness(b) ? (
          <div className="exchange-world-clock" role="status" aria-live="polite">
            <div className="exchange-world-clock__item">
              <span className="exchange-world-clock__label">
                <i className="fa-solid fa-location-dot exchange-world-clock__ico" aria-hidden="true" />
                {exchangeBusinessTime.label}
              </span>
              <strong className="exchange-world-clock__time" dir="ltr">
                <i className="fa-regular fa-clock exchange-world-clock__time-ico" aria-hidden="true" />
                {exchangeLocalTimeText}
              </strong>
            </div>
            <div className="exchange-world-clock__item exchange-world-clock__item--iran">
              <span className="exchange-world-clock__label">
                <i className="fa-solid fa-earth-asia exchange-world-clock__ico" aria-hidden="true" />
                وقت ایران
              </span>
              <strong className="exchange-world-clock__time" dir="ltr">
                <i className="fa-regular fa-clock exchange-world-clock__time-ico" aria-hidden="true" />
                {iranTimeText}
              </strong>
            </div>
          </div>
        ) : null}
        <div className="profile-hero" id="biz-profile-cover">
          <div
            className={`profile-cover ${coverView.fallback ? "profile-cover--fallback" : ""}`}
            aria-hidden="true"
            style={{
              backgroundImage: `url(${coverView.url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {!desktopLayout && (
            <div className="profile-head profile-head--cover-card">
              <div className="profile-logo" id="biz-profile-logo" aria-hidden="true">
                {logoMark}
              </div>
              <div className="profile-title-block">
                <h1 id="biz-name" className="profile-name-with-verified">
                  <span className="profile-name-with-verified__text">{b.name_fa}</span>
                  {isExchangeBusiness(b) && isExchangeCompanyVerified(b) ? <ExchangeCompanyVerifiedBadge /> : null}
                </h1>
                {leadTitle && (
                  <p className="profile-listing-lead" id="biz-listing-title">
                    {leadTitle}
                  </p>
                )}
                {secondLine && <p id="biz-subtitle">{secondLine}</p>}
                {metaParts.length > 0 && (
                  <p className="profile-meta-line" id="biz-meta" lang="en">
                    {metaParts.join(" · ")}
                  </p>
                )}
                {(!isActive || b.claimed) && (
                  <p>
                    {!isActive && <span className="badge">غیرفعال</span>}
                    {!!b.claimed && <span className="badge badge--claimed-owner">مالک ثبت‌شده</span>}
                  </p>
                )}
                {isActive && b.cta && String(b.cta).trim() && phoneForCall && (
                  <p className="profile-cta-row">
                    <a
                      className="btn btn--primary"
                      href={`tel:${String(phoneForCall).replace(/\s/g, "")}`}
                      onClick={() => trackBusinessPhoneClick(b.slug)}
                    >
                      {String(b.cta).trim()}
                    </a>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        {desktopLayout && (
          <div className="profile-hero-desktop-bar">
            <div className="profile-hero-desktop-bar__main">
              <div className="profile-logo profile-logo--desktop-bar" id="biz-profile-logo" aria-hidden="true">
                {logoMark}
              </div>
              <div className="profile-hero-desktop-bar__text">
                <h1 id="biz-name" className="profile-hero-desktop-bar__title profile-name-with-verified">
                  <span className="profile-name-with-verified__text">{b.name_fa}</span>
                  {isExchangeBusiness(b) && isExchangeCompanyVerified(b) ? <ExchangeCompanyVerifiedBadge /> : null}
                </h1>
                {desktopBarSubtitle && (
                  <p className="profile-hero-desktop-bar__category" id="biz-subtitle">
                    {desktopBarSubtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {desktopLayout && isActive && b.cta && String(b.cta).trim() && phoneForCall && (
          <div className="profile-hero-desktop-cta">
            <a
              className="btn btn--primary"
              href={`tel:${String(phoneForCall).replace(/\s/g, "")}`}
              onClick={() => trackBusinessPhoneClick(b.slug)}
            >
              {String(b.cta).trim()}
            </a>
          </div>
        )}
      </div>

      <div className="layout-split">
        <div>
          <ProfileSprites />

          {showPromo && (
            <section
              className="profile-panel profile-body profile-promo"
              id="biz-promo-section"
              aria-labelledby="promo-section-title"
            >
              <h2 id="promo-section-title" className="profile-section-heading">
                <span className="profile-section-heading__icon" aria-hidden="true">
                  <svg className="profile-section-heading__svg" aria-hidden="true">
                    <use href="#section-promote" />
                  </svg>
                </span>
                پیشنهاد و تبلیغ
              </h2>
              {b.promo_title && b.promo_title.trim() && (
                <h3 className="profile-promo__title" id="biz-promo-title">
                  {b.promo_title.trim()}
                </h3>
              )}
              {b.promo_description && b.promo_description.trim() && (
                <p className="profile-promo__desc" id="biz-promo-desc">
                  {b.promo_description.trim()}
                </p>
              )}
            </section>
          )}

          {showExchangeSection && (
            <section className="profile-panel profile-body exchange-panel" id="biz-exchange-section" aria-label="نرخ ارز صرافی">
              {exchangeTodayRateEnabled ? (
                <div className="exchange-panel__hero exchange-panel__hero--with-calc">
                  <h2 id="exchange-title" className="profile-section-heading">
                    نرخ ویژه امروز
                  </h2>
                  <p className="field-hint exchange-panel__lead">
                    نرخ‌ها توسط صرافی ثبت می‌شوند. برای معاملهٔ قطعی، قبل از مراجعه با صرافی تماس بگیرید.
                  </p>

                  {selectedRate ? (
                    <div className="exchange-hero-stack">
                      <div className="exchange-featured">
                        <div className="exchange-featured__currency field field--block">
                          <label htmlFor="exchange-currency">ارز</label>
                          <select
                            id="exchange-currency"
                            className="exchange-featured__select"
                            value={selectedRate.code}
                            onChange={(e) => setSelectedCurrencyCode(e.target.value)}
                            dir="ltr"
                          >
                            {exchangeRatesRows.map((row) => (
                              <option key={row.code} value={row.code}>
                                {row.flag || "🏳️"} {row.code}
                                {row.name ? ` — ${row.name}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="exchange-featured__subtitle">
                          نرخ لحظه‌ای{" "}
                          <span dir="ltr" className="exchange-featured__currency-name">
                            {exchangeCurrencyNameFaShort(selectedRate.code, selectedRate.name)}
                          </span>{" "}
                          به تومان
                        </p>
                        <ul className="exchange-featured__rates" aria-label="نرخ خرید و فروش">
                          {selectedRate.buy_active !== false ? (
                            <li className="exchange-featured__rate-line exchange-featured__rate-line--buy">
                              <span className="exchange-featured__rate-label exchange-featured__rate-label--buy">خرید</span>
                              <span className="exchange-featured__rate-value exchange-featured__rate-value--buy" dir="ltr">
                                {formatExchangeRateToman(selectedRate.buy)}
                              </span>
                            </li>
                          ) : null}
                          {selectedRate.sell_active !== false ? (
                            <li className="exchange-featured__rate-line exchange-featured__rate-line--sell">
                              <span className="exchange-featured__rate-label exchange-featured__rate-label--sell">فروش</span>
                              <span className="exchange-featured__rate-value exchange-featured__rate-value--sell" dir="ltr">
                                {formatExchangeRateToman(selectedRate.sell)}
                              </span>
                            </li>
                          ) : null}
                        </ul>
                      </div>

                      <ExchangeInlineCalc
                        idPrefix="biz-ex"
                        exchangeMode={exchangeMode}
                        onExchangeModeChange={setExchangeMode}
                        exchangeAmount={exchangeAmount}
                        onExchangeAmountChange={setExchangeAmount}
                        exchangeResult={exchangeResult}
                        exchangeAmountNum={exchangeAmountNum}
                        selectedRateNum={selectedRateNum}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="exchange-panel__table-block">
                <div className="table-wrap exchange-table-wrap">
                  <table className="data-table exchange-rates-table">
                    <thead>
                      <tr>
                        <th scope="col">پرچم</th>
                        <th scope="col">ارز</th>
                        <th scope="col" className="exchange-rate-col--buy">
                          خرید
                        </th>
                        <th scope="col" className="exchange-rate-col--sell">
                          فروش
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {exchangeRatesRows.map((row) => (
                        <tr key={row.code}>
                          <td style={{ fontSize: "1.15rem" }} dir="ltr">
                            {row.flag || "🏳️"}
                          </td>
                          <td dir="ltr">
                            {row.code}
                            {row.name ? <span className="exchange-rates-table__name"> — {row.name}</span> : null}
                          </td>
                          <td dir="ltr" className="exchange-rate-col--buy">
                            {row.buy_active === false ? "—" : formatExchangeRateToman(row.buy)}
                          </td>
                          <td dir="ltr" className="exchange-rate-col--sell">
                            {row.sell_active === false ? "—" : formatExchangeRateToman(row.sell)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="exchange-featured__pay" style={{ marginTop: "0.75rem" }}>
                <span className="exchange-featured__pay-title">پرداخت با</span>
                <div className="exchange-featured__pay-badges" aria-label="روش‌های پرداخت">
                  {exchangePaymentMethods.length ? (
                    exchangePaymentMethods.map((methodId) => {
                      const method = EXCHANGE_PAYMENT_METHODS.find((m) => m.id === methodId);
                      if (!method) return null;
                      return (
                        <span key={method.id} className={`exchange-pay-badge ${method.badgeClassName || ""}`.trim()}>
                          <ExchangePaymentMethodIcon methodId={method.id} />
                          {method.label}
                        </span>
                      );
                    })
                  ) : (
                    <span className="exchange-pay-badge exchange-pay-badge--muted">ثبت نشده</span>
                  )}
                </div>
              </div>
            </section>
          )}

          <section
            className="profile-panel profile-body profile-about profile-about--compact"
            aria-labelledby="about-title"
          >
            <h2 id="about-title" className="profile-section-heading">
              <span className="profile-section-heading__icon" aria-hidden="true">
                <svg className="profile-section-heading__svg" aria-hidden="true">
                  <use href="#section-about" />
                </svg>
              </span>
              در یک نگاه
            </h2>
            {!b.claimed ? (
              <p className="profile-about__empty profile-about__claim-prompt">
                معرفی در این بخش نمایش داده نمی‌شود. برای افزودن و ویرایش متن معرفی،{" "}
                <Link to={claimHref} className="profile-about__claim-link">
                  مالکیت این آگهی را ادعا کنید
                </Link>
                .
              </p>
            ) : !aboutLead.summary ? (
              <p className="profile-about__empty">توضیحی ثبت نشده است.</p>
            ) : (
              <>
                {aboutExpanded && aboutLead.hasMore ? (
                  <p id="biz-about" className="biz-text-pre profile-about__full">
                    {descriptionNormalized}
                  </p>
                ) : (
                  <p id="biz-about" className="profile-about__summary">
                    {aboutLead.summary}
                  </p>
                )}
                {aboutLead.hasMore && (
                  <button
                    type="button"
                    className="profile-about__toggle"
                    onClick={() => setAboutExpanded((v) => !v)}
                    aria-expanded={aboutExpanded}
                  >
                    {aboutExpanded ? "نمایش خلاصه" : "ادامهٔ متن"}
                  </button>
                )}
              </>
            )}
          </section>

          {showCareers && (
            <section
              className="profile-panel profile-body profile-careers"
              id="biz-careers-section"
              aria-labelledby="careers-section-title"
            >
              <h2 id="careers-section-title" className="profile-section-heading">
                <span className="profile-section-heading__icon" aria-hidden="true">
                  <svg className="profile-section-heading__svg" aria-hidden="true">
                    <use href="#section-careers" />
                  </svg>
                </span>
                فرصت‌های شغلی
              </h2>
              {careersSubtitle ? (
                <h3 className="profile-careers__subtitle" id="biz-careers-custom-title">
                  {careersSubtitle}
                </h3>
              ) : null}
              <p id="biz-careers" className="biz-text-pre">
                {careersBody}
              </p>
            </section>
          )}

          <section className="profile-panel profile-body" id="biz-hours-section" aria-labelledby="hours-title">
            <h2 id="hours-title" className="profile-section-heading">
              <span className="profile-section-heading__icon" aria-hidden="true">
                <svg className="profile-section-heading__svg" aria-hidden="true">
                  <use href="#section-hours" />
                </svg>
              </span>
              ساعات کاری
            </h2>
            <div className="biz-hours-grid" id="biz-hours-grid" role="list" aria-label="ساعات باز بودن به تفکیک روز">
              {hoursRows.map((row, i) => (
                <div key={`${row.day}-${i}`} className="biz-hours-row" role="listitem">
                  <span className="biz-hours-day">{row.day}</span>
                  <span className="biz-hours-value">{row.hours || "—"}</span>
                </div>
              ))}
            </div>
          </section>

          {!isExchangeBusiness(b) ? (
            <section className="profile-panel profile-body" id="biz-gallery-section" aria-labelledby="gallery-title">
              <h2 id="gallery-title" className="profile-section-heading">
                <span className="profile-section-heading__icon" aria-hidden="true">
                  <svg className="profile-section-heading__svg" aria-hidden="true">
                    <use href="#section-gallery" />
                  </svg>
                </span>
                گالری
              </h2>
              <div className="gallery" id="biz-gallery" role="list">
                {gallerySlots.map((url, i) => (
                  <div
                    key={i}
                    className="gallery__item"
                    role="listitem"
                    style={
                      url
                        ? {
                            backgroundImage: `url(${resolveBusinessImageUrl(String(url).trim())})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}

          {reservationLink && (
            <section className="profile-panel profile-body" aria-labelledby="booking-title">
              <h2 id="booking-title" className="profile-section-heading">
                رزرو
              </h2>
              <p className="field-hint">برای رزرو از لینک اختصاصی این کسب‌وکار استفاده کنید.</p>
              <div className="dashboard-actions">
                <a className="btn btn--primary" href={reservationLink} target="_blank" rel="noopener noreferrer">
                  رزرو آنلاین
                </a>
              </div>
            </section>
          )}
        </div>

        <aside aria-label={isExchangeBusiness(b) ? "اقدامات" : "تماس و تبلیغات"}>
          <section className="profile-panel profile-body">
            {!isExchangeBusiness(b) ? (
              <>
                <h2 className="contact-panel__title">
                  <span className="contact-list__icon-wrap" aria-hidden="true">
                    <svg className="contact-list__svg" aria-hidden="true">
                      <use href="#contact-phone" />
                    </svg>
                  </span>
                  تماس
                </h2>
                <ul className="contact-list" id="biz-contact">
                  {phoneForCall ? (
                    <li className="contact-list__item">
                      <span className="contact-list__icon-wrap" aria-hidden="true">
                        <svg className="contact-list__svg" aria-hidden="true">
                          <use href="#contact-phone" />
                        </svg>
                      </span>
                      <div className="contact-list__main">
                        <a
                          href={`tel:${String(phoneForCall).replace(/\s/g, "")}`}
                          className="phone-ltr"
                          dir="ltr"
                          onClick={() => trackBusinessPhoneClick(b.slug)}
                        >
                          {phoneForCall}
                        </a>
                      </div>
                    </li>
                  ) : (
                    <li className="contact-list__item">
                      <span className="contact-list__icon-wrap" aria-hidden="true">
                        <svg className="contact-list__svg" aria-hidden="true">
                          <use href="#contact-phone" />
                        </svg>
                      </span>
                      <div className="contact-list__main">
                        <span className="field-hint">شماره ثبت نشده</span>
                      </div>
                    </li>
                  )}
                </ul>
              </>
            ) : null}
            <p style={{ marginTop: isExchangeBusiness(b) ? 0 : "0.75rem" }}>
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => setReportOpen(true)}
              >
                <i className="fa-solid fa-flag" aria-hidden="true" /> گزارش مشکل در این آگهی
              </button>
            </p>
          </section>
          {!isExchangeBusiness(b) ? (
            <div className="ad-slot ad-slot--sidebar" role="complementary" aria-label="جای تبلیغ">
              تبلیغ کنار پروفایل — ۳۰۰×۲۵۰ یا ستون ثابت
            </div>
          ) : null}
        </aside>
      </div>

      {!isExchangeBusiness(b) ? (
        <p style={{ marginTop: "1.5rem" }}>
          <Link to="/listings">بازگشت به لیست</Link>
        </p>
      ) : null}

      {showExchangeContactFab || showExchangeCalcFab ? (
        <>
          <div className={`exchange-fab-row${showExchangeContactFab && showExchangeCalcFab ? "" : " exchange-fab-row--single"}`}>
            {showExchangeCalcFab ? (
              <button
                type="button"
                className="exchange-contact-fab exchange-contact-fab--calc"
                onClick={() => setExchangeCalcSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={exchangeCalcSheetOpen}
              >
                ماشین حساب لحظه ای
              </button>
            ) : null}
            {showExchangeContactFab ? (
              <button
                type="button"
                className="exchange-contact-fab"
                onClick={() => setExchangeContactSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={exchangeContactSheetOpen}
              >
                تماس با صرافی
              </button>
            ) : null}
          </div>
          {exchangeContactSheetOpen ? (
            <div
              className="exchange-contact-sheet__overlay"
              role="presentation"
              onClick={() => setExchangeContactSheetOpen(false)}
            >
              <section
                className="exchange-contact-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="اطلاعات تماس صرافی"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="exchange-contact-sheet__handle" aria-hidden="true" />
                <div className="exchange-contact-sheet__head">
                  <h3>اطلاعات تماس</h3>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setExchangeContactSheetOpen(false)}
                  >
                    بستن
                  </button>
                </div>
                <a
                  href={`tel:${String(phoneForCall).replace(/\s/g, "")}`}
                  className="exchange-contact-sheet__call"
                  dir="ltr"
                  onClick={() => trackBusinessPhoneClick(b.slug)}
                >
                  {phoneForCall}
                </a>
              </section>
            </div>
          ) : null}
          {exchangeCalcSheetOpen ? (
            <div
              className="exchange-contact-sheet__overlay"
              role="presentation"
              onClick={() => setExchangeCalcSheetOpen(false)}
            >
              <section
                className="exchange-contact-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="ماشین حساب لحظه ای"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="exchange-contact-sheet__handle" aria-hidden="true" />
                <div className="exchange-contact-sheet__head">
                  <h3>ماشین حساب لحظه ای</h3>
                  <button type="button" className="btn btn--ghost" onClick={() => setExchangeCalcSheetOpen(false)}>
                    بستن
                  </button>
                </div>
                <div className="field field--block exchange-contact-sheet__currency">
                  <label htmlFor="exchange-currency-sheet">ارز برای محاسبه</label>
                  <select
                    id="exchange-currency-sheet"
                    value={selectedCurrencyCode}
                    onChange={(e) => setSelectedCurrencyCode(e.target.value)}
                    dir="ltr"
                  >
                    {exchangeRatesRows.map((row) => (
                      <option key={row.code} value={row.code}>
                        {row.flag || "🏳️"} {row.code}
                        {row.name ? ` — ${row.name}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <ExchangeInlineCalc
                  idPrefix="biz-ex-sheet"
                  exchangeMode={exchangeMode}
                  onExchangeModeChange={setExchangeMode}
                  exchangeAmount={exchangeAmount}
                  onExchangeAmountChange={setExchangeAmount}
                  exchangeResult={exchangeResult}
                  exchangeAmountNum={exchangeAmountNum}
                  selectedRateNum={selectedRateNum}
                />
              </section>
            </div>
          ) : null}
        </>
      ) : null}

      <BusinessReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        slug={b.slug}
        businessName={b.name_fa}
      />
    </article>
    </>
  );
}
