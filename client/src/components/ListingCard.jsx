import { useState } from "react";
import { Link } from "react-router-dom";
import ExchangeCompanyVerifiedBadge from "./ExchangeCompanyVerifiedBadge.jsx";
import ExchangePaymentMethodIcon from "./ExchangePaymentMethodIcon.jsx";
import {
  EXCHANGE_FEATURES,
  EXCHANGE_PAYMENT_METHODS,
  formatExchangeRateToman,
  getEffectiveRateRaw,
  isExchangeBusiness,
  isExchangeCompanyVerified,
  parseExchangeFeaturesJson,
  parseExchangePaymentMethodsJson,
  parseExchangeRatesJsonOrEmpty,
} from "../lib/exchangeRates.js";

/** Shared listing / featured business card (matches Listings page). */
export default function ListingCard({ b, titleHeading: TitleTag = "h2", variant = "default" }) {
  const href = `/business?slug=${encodeURIComponent(b.slug)}`;
  const cover = (b.cover_image_url || "").trim();
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(cover) && !imgFailed;
  const isExchangeVariant = variant === "exchange";
  const logoMark = String(b.name_fa || "?").trim().charAt(0) || "?";

  const exchangeRows = parseExchangeRatesJsonOrEmpty(b.exchange_rates_json);
  const featuredRateRow = exchangeRows.find((r) => getEffectiveRateRaw(r, "buy") || getEffectiveRateRaw(r, "sell")) || exchangeRows[0] || null;
  const buyRaw = featuredRateRow ? getEffectiveRateRaw(featuredRateRow, "buy") : "";
  const sellRaw = featuredRateRow ? getEffectiveRateRaw(featuredRateRow, "sell") : "";
  const paymentMethodIds = parseExchangePaymentMethodsJson(b.payment_methods_json);
  const paymentMethodBadges = paymentMethodIds
    .map((id) => EXCHANGE_PAYMENT_METHODS.find((m) => m.id === id))
    .filter(Boolean)
    .slice(0, 4);
  const exchangeFeatureIds = parseExchangeFeaturesJson(b.exchange_features_json);
  const hasExchangeFeature = (id) => exchangeFeatureIds.includes(id);
  const postcode =
    String(b.address || "")
      .toUpperCase()
      .match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() || "";

  if (isExchangeVariant) {
    return (
      <article className="listing-card listing-card--exchange">
        <div className="listing-card__exchange-head">
          <Link className="listing-card__exchange-logo-wrap" to={href} aria-label={`صفحه ${b.name_fa || ""}`}>
            {showImg ? (
              <img
                className="listing-card__exchange-logo"
                src={cover}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <span className="listing-card__exchange-logo listing-card__exchange-logo--fallback" aria-hidden>
                {logoMark}
              </span>
            )}
          </Link>

          <div className="listing-card__exchange-main">
            <TitleTag className="listing-card__exchange-title">
              <Link to={href}>
                {b.name_fa}
                {isExchangeBusiness(b) && isExchangeCompanyVerified(b) ? (
                  <ExchangeCompanyVerifiedBadge className="listing-card__verified-tick" />
                ) : null}
              </Link>
            </TitleTag>
            <p className="listing-card__exchange-loc">
              {b.city || "—"}
              {postcode ? ` / ${postcode}` : ""}
            </p>
          </div>
        </div>

        <div className="listing-card__exchange-chips">
          {EXCHANGE_FEATURES.filter((f) => hasExchangeFeature(f.id)).map((f) => (
            <span key={f.id} className="listing-card__exchange-chip">
              {f.label}
            </span>
          ))}
          {isExchangeCompanyVerified(b) ? <span className="listing-card__exchange-chip">دارای مجوز</span> : null}
        </div>

        <p className="listing-card__exchange-pair" dir="ltr">
          {featuredRateRow?.code || "USD"} → تومان
        </p>

        <div className="listing-card__exchange-rates">
          <div className="listing-card__exchange-rate listing-card__exchange-rate--buy">
            <strong>خرید</strong>
            <span dir="ltr">{buyRaw ? formatExchangeRateToman(buyRaw) : "—"}</span>
          </div>
          <div className="listing-card__exchange-rate listing-card__exchange-rate--sell">
            <strong>فروش</strong>
            <span dir="ltr">{sellRaw ? formatExchangeRateToman(sellRaw) : "—"}</span>
          </div>
        </div>

        <div className="listing-card__exchange-pay">
          <span>پرداخت با</span>
          <div className="listing-card__exchange-pay-icons" aria-label="روش‌های پرداخت">
            {paymentMethodBadges.length ? (
              paymentMethodBadges.map((method) => (
                <span key={method.id} className={`exchange-pay-badge ${method.badgeClassName || ""}`.trim()}>
                  <ExchangePaymentMethodIcon methodId={method.id} />
                </span>
              ))
            ) : (
              <span className="exchange-pay-badge exchange-pay-badge--muted">—</span>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="listing-card">
      <Link
        to={href}
        className={`listing-card__media ${showImg ? "img-shimmer-host" : ""}`}
        aria-hidden={showImg ? undefined : true}
        tabIndex={-1}
      >
        {showImg ? (
          <img
            className="listing-card__img"
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(e) => {
              e.currentTarget.closest(".img-shimmer-host")?.classList.add("is-loaded");
            }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="listing-card__placeholder" aria-hidden>
            <span className="listing-card__placeholder-title">{b.name_fa || "Iraniu Listing"}</span>
          </div>
        )}
      </Link>
      <div className="listing-card__body">
        <TitleTag className="listing-card__title">
          <Link to={href}>
            <i className="fa-solid fa-building listing-card__ico" aria-hidden="true" />
            {b.name_fa}
            {isExchangeBusiness(b) && isExchangeCompanyVerified(b) ? (
              <ExchangeCompanyVerifiedBadge className="listing-card__verified-tick" />
            ) : null}
          </Link>
        </TitleTag>
        {(b.category || b.listing_title) && (
          <p className="listing-card__cats">
            <i className="fa-solid fa-tag listing-card__ico" aria-hidden="true" />
            {b.category || b.listing_title}
          </p>
        )}
        {b.address ? (
          <p className="listing-card__line">
            <span className="listing-card__label">
              <i className="fa-solid fa-location-dot listing-card__ico" aria-hidden="true" />
              آدرس
            </span>
            {b.address}
          </p>
        ) : null}
        {b.city ? (
          <p className="listing-card__line">
            <span className="listing-card__label">
              <i className="fa-solid fa-map-location-dot listing-card__ico" aria-hidden="true" />
              منطقه
            </span>
            {b.city}
          </p>
        ) : null}
        <div className="listing-card__actions">
          <Link className="btn btn--primary listing-card__btn" to={href}>
            مشاهدهٔ صفحه
          </Link>
          <Link
            className="btn btn--ghost listing-card__btn"
            to={`/business?slug=${encodeURIComponent(b.slug)}&report=1`}
          >
            گزارش
          </Link>
        </div>
      </div>
    </article>
  );
}
