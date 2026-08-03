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

function StarRating({ value }) {
  const n = Math.round(Number(value));
  if (!n || n < 1) return null;
  const filled = Math.min(n, 5);
  const empty = 5 - filled;
  return (
    <span className="listing-card__rating" aria-label={`امتیاز ${value} از ۵`}>
      <span className="listing-card__rating-stars">
        {"★".repeat(filled)}
        <span className="listing-card__rating-empty">{"★".repeat(empty)}</span>
      </span>
      <span className="listing-card__rating-val" dir="ltr">{Number(value).toFixed(1)}</span>
    </span>
  );
}

function MapLink({ address, city }) {
  const query = [address, city].filter(Boolean).join(", ");
  if (!query) return null;
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return (
    <a
      className="listing-card__map-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="نمایش روی نقشه"
      onClick={(e) => e.stopPropagation()}
    >
      <i className="fa-solid fa-map-location-dot" aria-hidden="true" />
      نقشه
    </a>
  );
}

function stripHtml(str) {
  return String(str || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const BOOST_BADGE = {
  diamond:  { label: "💠 الماسی",    cls: "listing-card__boost-badge--diamond"  },
  platinum: { label: "💎 پلاتینیوم", cls: "listing-card__boost-badge--platinum" },
  gold:     { label: "🥇 طلایی",     cls: "listing-card__boost-badge--gold"     },
  silver:   { label: "🥈 نقره‌ای",   cls: "listing-card__boost-badge--silver"   },
};

export default function ListingCard({ b, titleHeading: TitleTag = "h2", variant = "default" }) {
  const href = `/business?slug=${encodeURIComponent(b.slug)}`;
  const cover = (b.cover_image_url || "").trim();
  const [imgFailed, setImgFailed] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const showImg = Boolean(cover) && !imgFailed;
  const isExchangeVariant = variant === "exchange";
  const boostPlan = b.active_boost_plan || null;
  const boostInfo = boostPlan ? BOOST_BADGE[boostPlan] : null;
  const logoMark = String(b.name_fa || "?").trim().charAt(0) || "?";
  const phone = String(b.phone || b.call_tracking_number || "").trim();
  const descRaw = stripHtml(b.description || "");
  const descExcerpt = descRaw.length > 170 ? descRaw.slice(0, 170) + "…" : descRaw;

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
    <article className={`listing-card${boostPlan ? ` listing-card--boosted listing-card--boost-${boostPlan}` : ""}`}>
      {boostInfo && (
        <div className={`listing-card__boost-badge ${boostInfo.cls}`}>
          {boostInfo.label}
        </div>
      )}
      {/* Image side */}
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
        {b.category && (
          <span className="listing-card__cat-tag" aria-hidden="true">{b.category}</span>
        )}
      </Link>

      {/* Content side */}
      <div className="listing-card__body">
        <div className="listing-card__content">
          <TitleTag className="listing-card__title">
            <Link to={href}>
              {b.name_fa}
              {isExchangeBusiness(b) && isExchangeCompanyVerified(b) ? (
                <ExchangeCompanyVerifiedBadge className="listing-card__verified-tick" />
              ) : null}
            </Link>
          </TitleTag>

          {b.listing_title && b.listing_title !== b.name_fa && (
            <p className="listing-card__cats">{b.listing_title}</p>
          )}

          <div className="listing-card__metas">
            {(b.address || b.city) && (
              <span className="listing-card__meta">
                <i className="fa-solid fa-location-dot" aria-hidden="true" />
                {[b.address, b.city].filter(Boolean).join("، ")}
              </span>
            )}
            {phone && (
              <span className="listing-card__meta" style={{ cursor: "pointer" }} onClick={() => setPhoneRevealed(true)} title="نمایش شماره تلفن">
                <i className="fa-solid fa-phone" aria-hidden="true" />
                {phoneRevealed ? (
                  <span dir="ltr">{phone}</span>
                ) : (
                  <span dir="ltr" style={{ letterSpacing: "1px", fontFamily: "monospace" }}>
                    {phone.slice(0, 3) + " " + "*".repeat(Math.max(4, phone.length - 3))}
                    <i className="fa-solid fa-eye" aria-hidden="true" style={{ marginRight: "0.35rem", color: "#73208a", fontSize: "0.82rem" }} />
                  </span>
                )}
              </span>
            )}
          </div>

          {b.rating && <StarRating value={b.rating} />}

          {b.claimed || b.description_rewritten ? (
            descExcerpt ? <p className="listing-card__desc">{descExcerpt}</p> : null
          ) : (
            <p className="listing-card__desc listing-card__desc--demo">
              در این بخش می‌توانید اطلاعات کاملی درباره کسب‌وکار خود، خدمات، محصولات، سابقه فعالیت و مزایای رقابتی خود را معرفی کنید. هرچه توضیحات شما کامل‌تر و دقیق‌تر باشد، مشتریان راحت‌تر با برند شما آشنا شده و با اطمینان بیشتری با شما تماس خواهند گرفت.
            </p>
          )}
        </div>

        {/* Action buttons — vertical column, physically on the LEFT in RTL */}
        <div className="listing-card__actions">
          <Link className="listing-card__action-btn listing-card__action-btn--primary" to={href}>
            <i className="fa-solid fa-eye" aria-hidden="true" />
            مشاهده
          </Link>
          <MapLink address={b.address} city={b.city} />
          <Link
            className="listing-card__action-btn listing-card__action-btn--ghost"
            to={`/business?slug=${encodeURIComponent(b.slug)}&report=1`}
          >
            <i className="fa-solid fa-flag" aria-hidden="true" />
            گزارش
          </Link>
        </div>
      </div>
    </article>
  );
}
