import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import ListingCard from "../components/ListingCard.jsx";
import Seo from "../components/Seo.jsx";
import { apiGet } from "../api.js";
import { getListingsLocationFromForm } from "../lib/listingsSearchNavigate.js";
import { getSiteUrl } from "../lib/siteUrl.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import { LEGACY_CATEGORY_SELECT_OPTIONS } from "../lib/categoryFilters.js";
import { useBusinessCategories } from "../hooks/useBusinessCategories.js";

const CATEGORY_CARD_THEMES = ["food", "market", "health", "legal", "beauty", "auto"];
const CATEGORY_CARD_ICONS = ["🍽", "🛒", "🩺", "⚖️", "✨", "🚗", "📌", "🏷️"];

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories: categoryOptions } = useBusinessCategories();
  const [featured, setFeatured] = useState([]);
  const [showPendingBanner, setShowPendingBanner] = useState(
    () => !!location.state?.listingPendingReview
  );

  useEffect(() => {
    if (location.state?.listingPendingReview) {
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    document.body.classList.add("page-home");
    return () => document.body.classList.remove("page-home");
  }, []);

  useEffect(() => {
    apiGet("/api/businesses")
      .then((rows) => {
        setFeatured((rows || []).slice(0, 6));
      })
      .catch(() => setFeatured([]));
  }, []);

  const homeJsonLd = useMemo(() => {
    const site = getSiteUrl();
    if (!site) return null;
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          name: "ایرانیو",
          url: site,
          logo: `${site}/images/iraniu-logo-header.png`,
        },
        {
          "@type": "WebSite",
          name: "ایرانیو",
          url: site,
          inLanguage: "fa-IR",
          publisher: { "@type": "Organization", name: "ایرانیو" },
          potentialAction: {
            "@type": "SearchAction",
            target: `${site}/listings?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        },
      ],
    };
  }, []);

  return (
    <>
      <Seo
        description={SEO_DEFAULT_DESCRIPTION}
        keywords="ایرانیو, کسب و کار ایرانی, لندن, بریتانیا, دایرکتوری ایرانی, رستوران ایرانی"
        jsonLd={homeJsonLd}
      />
      {showPendingBanner && (
        <div className="container" style={{ paddingTop: "1rem" }}>
          <div
            role="status"
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(212, 184, 224, 0.85)",
              background: "linear-gradient(145deg, rgba(250, 245, 252, 0.98), #fff)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <p style={{ margin: 0 }}>
              <strong>آگهی شما ثبت شد و در انتظار تأیید مدیر است.</strong> بعد از تأیید، در لیست و جستجو نمایش داده می‌شود.
            </p>
            <button type="button" className="btn btn--ghost" onClick={() => setShowPendingBanner(false)}>
              بستن
            </button>
          </div>
        </div>
      )}
      <section className="hero hero--home page-home" aria-labelledby="hero-title">
        <div className="hero__bg" aria-hidden="true"></div>
        <div className="hero__inner">
          <header className="hero__intro">
            <p className="hero__eyebrow">فهرست کسب‌وکارهای ایرانی در بریتانیا</p>
            <h1 id="hero-title" className="hero__display">
              کسب‌وکار ایرانی را پیدا کنید
            </h1>
            <p className="hero__tagline">نام، شهر یا دسته را انتخاب کنید؛ نتیجه در لیست دیده می‌شود.</p>
          </header>

          <form
            id="hero-search-form"
            className="hero__form hero__panel"
            method="get"
            role="search"
            aria-label="جستجو و فیلتر کسب‌وکار"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(getListingsLocationFromForm(e.currentTarget));
            }}
          >
            <input type="hidden" name="adv" value="" id="hero-adv-flag" />
            <div className="search-bar hero__search search-bar--home">
              <input
                type="search"
                name="q"
                id="hero-search-q"
                placeholder="نام کسب‌وکار، رستوران، وکیل، آرایشگاه…"
                autoComplete="off"
              />
              <label htmlFor="hero-search-city" className="visually-hidden">
                شهر
              </label>
              <select id="hero-search-city" name="city" aria-label="شهر">
                <option value="">همه شهرها</option>
                <option value="london">لندن</option>
                <option value="manchester">منچستر</option>
                <option value="birmingham">برمنگام</option>
                <option value="glasgow">گلاسگو</option>
              </select>
              <label htmlFor="hero-search-cat" className="visually-hidden">
                دسته
              </label>
              <select id="hero-search-cat" name="cat" aria-label="دسته">
                <option value="">همه دسته‌ها</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <optgroup label="جستجوی موضوعی (لینک‌های قدیمی)">
                  {LEGACY_CATEGORY_SELECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <button type="submit" className="btn btn--accent">
                جستجو
              </button>
            </div>
          </form>
        </div>
      </section>

      <section
        className="section section--home section--categories-home container"
        aria-labelledby="cat-title"
      >
        <div className="section__head section__head--home section__head--categories">
          <h2 id="cat-title" className="section__title section__title--home">
            دسته‌بندی‌ها
          </h2>
          <p className="section__lead section__lead--home section__lead--categories">
            همهٔ دسته‌های ثبت‌شده در سایت؛ همان فیلتر «دسته» در صفحهٔ لیست.
          </p>
        </div>
        <div className="category-grid category-grid--home">
          {categoryOptions.map((c, i) => {
            const theme = CATEGORY_CARD_THEMES[i % CATEGORY_CARD_THEMES.length];
            const icon = CATEGORY_CARD_ICONS[i % CATEGORY_CARD_ICONS.length];
            return (
              <Link
                key={c.id}
                className={`category-card category-card--home category-card--cat-${theme}`}
                to={`/listings?cat=${encodeURIComponent(c.name)}`}
              >
                <span className="category-card__icon" aria-hidden="true">
                  {icon}
                </span>
                <span className="category-card__label">{c.name}</span>
                <span className="category-card__hint">مشاهده آگهی‌ها</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section section--home section--featured-strip container" aria-labelledby="feat-title">
        <div className="section__head section__head--home">
          <h2 id="feat-title" className="section__title section__title--home">
            کسب‌وکارهای ویژه
          </h2>
        </div>
        <div className="listing-cards page-home__listing-cards">
          {featured.length === 0 ? (
            <p className="field-hint" style={{ gridColumn: "1 / -1" }}>
              هنوز آگهی‌ای ثبت نشده.{" "}
              <Link to="/listings">مشاهدهٔ همهٔ آگهی‌ها</Link>
            </p>
          ) : (
            featured.map((b) => (
              <ListingCard key={b.slug} b={b} titleHeading="h3" />
            ))
          )}
        </div>
      </section>
    </>
  );
}
