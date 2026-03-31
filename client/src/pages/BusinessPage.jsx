import { Link, useSearchParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api.js";
import {
  parseGalleryJson,
  parseHoursJson,
  resolveBusinessImageUrl,
  pickHeroImageUrlFromBusiness,
} from "../lib/businessProfile.js";

const COVER_BY_CATEGORY = {
  رستوران: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
  سلامت: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=80",
  خرده‌فروشی: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80",
  default: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80",
};

function profileCoverUrl(category) {
  if (!category) return COVER_BY_CATEGORY.default;
  return COVER_BY_CATEGORY[category] || COVER_BY_CATEGORY.default;
}

function trackBusinessPhoneClick(slug) {
  if (!slug) return;
  apiPost("/api/phone-click", { slug }).catch(() => {});
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
          <symbol id="section-map" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
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
          <symbol id="contact-mobile" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z"
            />
          </symbol>
          <symbol id="contact-globe" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93h2c0 2.76 2.24 5 5 5v2zm6.9-3h-2.08c-.41 2.63-1.41 4.93-2.82 6.56A9.97 9.97 0 0 0 17.93 17zM12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm5.9 8h2a9.87 9.87 0 0 1-3.55 5.56c1.41-1.63 2.41-3.93 2.82-6.56z"
            />
          </symbol>
          <symbol id="contact-mail" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
            />
          </symbol>
        </defs>
      </svg>
    </>
  );
}

export default function BusinessPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const slug = params.get("slug") || "clinic-pars";
  const [b, setB] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [showOnboardingWelcome, setShowOnboardingWelcome] = useState(
    () => !!location.state?.onboardingComplete
  );

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

  const logoMark = useMemo(() => {
    if (!b?.name_fa) return "؟";
    const t = b.name_fa.trim();
    return t ? [...t][0] : "؟";
  }, [b]);

  useEffect(() => {
    document.body.classList.add("business-page");
    return () => {
      document.body.classList.remove("business-page", "business-page--unclaimed", "business-page--claimed");
    };
  }, []);

  useEffect(() => {
    if (!b) return;
    const claimed = !!b.claimed;
    document.body.classList.toggle("business-page--claimed", claimed);
    document.body.classList.toggle("business-page--unclaimed", !claimed);
    document.title = `${b.name_fa} — پروفایل کسب‌وکار — ایرانیو`;
    return () => {
      document.body.classList.remove("business-page--claimed", "business-page--unclaimed");
    };
  }, [b]);

  const mapsSearchUrl = b?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`
    : "https://www.google.com/maps";
  const reservationLink = String(b?.reservation_link || "").trim();
  const twilioModuleOn = b?.twilio_module_enabled !== false;
  const trackedEnabled = twilioModuleOn && !!b?.call_tracking_enabled;
  const trackedNumber = String(b?.call_tracking_number || "").trim();
  const phoneForCall = trackedEnabled && trackedNumber ? trackedNumber : String(b?.phone || "").trim();

  const coverStyleUrl = useMemo(() => {
    if (!b) return COVER_BY_CATEGORY.default;
    const custom = pickHeroImageUrlFromBusiness(b);
    if (custom) return resolveBusinessImageUrl(custom);
    return profileCoverUrl(b.category);
  }, [b]);

  const leadTitle =
    b?.listing_title && String(b.listing_title).trim() ? String(b.listing_title).trim() : "";
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
  const showPromo = !!(b?.promo_title?.trim() || b?.promo_description?.trim());
  const careersBody = b?.careers_text && String(b.careers_text).trim();
  const careersSubtitle = b?.careers_title && String(b.careers_title).trim();
  const showCareers = !!careersBody;

  if (loadState === "loading") {
    return (
      <article className="section container" style={{ padding: "2rem 0" }}>
        <p className="field-hint">در حال بارگذاری…</p>
      </article>
    );
  }

  if (loadState === "error" || !b) {
    return (
      <article className="section container" style={{ padding: "2rem 0" }}>
        <h1>کسب‌وکار پیدا نشد</h1>
        <p className="field-hint">آدرس نامعتبر است یا داده‌ای برای این شناسه نیست.</p>
        <p>
          <Link to="/listings">بازگشت به لیست</Link>
        </p>
      </article>
    );
  }

  const claimHref = `/claim?slug=${encodeURIComponent(b.slug)}&business=${encodeURIComponent(b.name_fa)}`;

  return (
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
      {!b.claimed && (
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
        <div className="profile-hero">
          <div
            className="profile-cover"
            id="biz-profile-cover"
            style={{
              backgroundImage: `url(${coverStyleUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            aria-hidden="true"
          />
          <div className="profile-head">
            <div className="profile-logo" id="biz-profile-logo" aria-hidden="true">
              {logoMark}
            </div>
            <div className="profile-title-block">
              <h1 id="biz-name">{b.name_fa}</h1>
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
              <p>
                {!isActive && <span className="badge">غیرفعال</span>}
                {!b.claimed && <span className="badge badge--unclaimed">بدون مالک</span>}
                {!!b.claimed && <span className="badge badge--claimed-owner">مالک ثبت‌شده</span>}
              </p>
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
        </div>
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

          <section className="profile-panel profile-body profile-about" aria-labelledby="about-title">
            <h2 id="about-title" className="profile-section-heading">
              <span className="profile-section-heading__icon" aria-hidden="true">
                <svg className="profile-section-heading__svg" aria-hidden="true">
                  <use href="#section-about" />
                </svg>
              </span>
              درباره کسب‌وکار
            </h2>
            <p id="biz-about" className="biz-text-pre">
              {b.description || "توضیحی ثبت نشده است."}
            </p>
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

          <section className="profile-panel profile-body" aria-labelledby="map-title">
            <h2 id="map-title" className="profile-section-heading">
              <span className="profile-section-heading__icon" aria-hidden="true">
                <svg className="profile-section-heading__svg" aria-hidden="true">
                  <use href="#section-map" />
                </svg>
              </span>
              موقعیت روی نقشه
            </h2>
            <p className="profile-map__address" id="biz-map-address">
              <span className="profile-map__address-label">آدرس</span> {b.address || "—"}
            </p>
            <div id="biz-map-box">
              <a className="btn btn--primary btn--block" href={mapsSearchUrl} target="_blank" rel="noopener noreferrer">
                مسیریابی در Google Maps
              </a>
            </div>
          </section>

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

        <aside aria-label="تماس و تبلیغات">
          <section className="profile-panel profile-body">
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
              <li className="contact-list__item contact-list__item--icon-row">
                <div className="contact-list__icon-row-inner" role="group" aria-label="وب‌سایت">
                  <a
                    className="contact-list__icon-link"
                    href={mapsSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="مشاهده روی نقشه"
                  >
                    <span className="contact-list__icon-wrap" aria-hidden="true">
                      <svg className="contact-list__svg" aria-hidden="true">
                        <use href="#contact-globe" />
                      </svg>
                    </span>
                  </a>
                </div>
              </li>
            </ul>
          </section>
          <div className="ad-slot ad-slot--sidebar" role="complementary" aria-label="جای تبلیغ">
            تبلیغ کنار پروفایل — ۳۰۰×۲۵۰ یا ستون ثابت
          </div>
        </aside>
      </div>

      <p style={{ marginTop: "1.5rem" }}>
        <Link to="/listings">بازگشت به لیست</Link>
      </p>
    </article>
  );
}
