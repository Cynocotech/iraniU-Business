import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import ListingCard from "../components/ListingCard.jsx";
import Seo from "../components/Seo.jsx";
import { apiGet } from "../api.js";
import { getListingsLocationFromForm } from "../lib/listingsSearchNavigate.js";
import { getSiteUrl } from "../lib/siteUrl.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import { LEGACY_CATEGORY_SELECT_OPTIONS } from "../lib/categoryFilters.js";
import { useBusinessCategories } from "../hooks/useBusinessCategories.js";

const TYPING_WORDS = ["کسب‌وکار", "رستوران", "آرایشگاه", "پزشک", "وکیل", "فروشگاه", "مکانیک"];

const CATEGORY_CARD_THEMES = ["food", "market", "health", "legal", "beauty", "auto"];

// Category to Font Awesome icon mapping
const CATEGORY_ICONS = {
  "رستوران": "fa-utensils",
  "سلامت": "fa-heartbeat",
  "خرده‌فروشی": "fa-shopping-bag",
  "خدمات": "fa-hands-helping",
  "زیبایی": "fa-spa",
  "آموزش": "fa-graduation-cap",
  "خدمات ساختمان": "fa-hammer",
  "فروشگاه": "fa-store",
  "مکانیک": "fa-wrench",
  "فرش": "fa-couch",
  "پیتزا و ساندویچ": "fa-pizza-slice",
  "کلینیک زیبایی": "fa-cut",
  "کافی شاپ": "fa-coffee",
  "سایر خدمات": "fa-concierge-bell",
  "شرکت های صنعتی": "fa-industry",
  "صرافی": "fa-exchange-alt",
  "طلا فروشی و جواهری": "fa-gem",
  "حسابدار": "fa-calculator",
  "شیرینی فروشی": "fa-birthday-cake",
  "خیاطی و مزون": "fa-tshirt",
  "طراحی سایت و آی تی": "fa-laptop-code",
  "آموزش هنری و علمی": "fa-book-reader",
  "باربری": "fa-truck",
  "خدمات مجالس": "fa-glass-cheers",
  "مدرسه": "fa-school",
  "مشاور املاک": "fa-home",
  "مشاور مهاجرت": "fa-plane-departure",
  "چاپ و تبلیغات": "fa-print",
  "آژانس هواپیمایی": "fa-plane",
  "دیجیتال مارکتینگ": "fa-bullhorn",
  "آموزش رانندگی": "fa-car",
  "مشاور کسب و کار": "fa-briefcase",
  "تراپیست": "fa-spa",
  "خشکشویی": "fa-tint",
  "محصولات غذایی": "fa-apple-alt",
  "دوربین مداربسته و امنیت": "fa-video",
  "خرید ماشین": "fa-car-side",
  "عکاسی": "fa-camera",
  "باشگاه ورزشی": "fa-dumbbell",
  "فروشگاه اینترنتی": "fa-shopping-cart",
  "دارالترجمه": "fa-language",
  "مهد کودک": "fa-baby",
  "کارواش": "fa-shower",
  "اجاره خودرو": "fa-car-alt",
  "دامپزشکی و پت شاپ": "fa-paw",
  "مشاور مالیات": "fa-file-invoice-dollar",
};

// Default icon for categories not in the map
const DEFAULT_ICON = "fa-tag";

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories: categoryOptions } = useBusinessCategories();
  const [typedWord, setTypedWord] = useState(TYPING_WORDS[0]);
  const typingRef = useRef({ wordIdx: 0, charIdx: TYPING_WORDS[0].length, deleting: false });

  useEffect(() => {
    let timer;
    const tick = () => {
      const s = typingRef.current;
      const word = TYPING_WORDS[s.wordIdx];
      if (!s.deleting && s.charIdx === word.length) {
        timer = setTimeout(() => { s.deleting = true; tick(); }, 2000);
        return;
      }
      if (s.deleting && s.charIdx === 0) {
        s.deleting = false;
        s.wordIdx = (s.wordIdx + 1) % TYPING_WORDS.length;
        timer = setTimeout(tick, 350);
        return;
      }
      s.charIdx += s.deleting ? -1 : 1;
      setTypedWord(TYPING_WORDS[s.wordIdx].slice(0, s.charIdx));
      timer = setTimeout(tick, s.deleting ? 55 : 100);
    };
    timer = setTimeout(() => { typingRef.current.deleting = true; tick(); }, 2500);
    return () => clearTimeout(timer);
  }, []);

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
        const arr = rows || [];
        const boosted = arr.filter((b) => b.active_boost_plan === "diamond" || b.active_boost_plan === "platinum");
        // show boosted first, fill remaining slots from the full list (up to 6 total)
        const seed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, "")) % 9973;
        function hashSlug(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h; }
        const diamond  = boosted.filter((b) => b.active_boost_plan === "diamond").sort((a, b) => ((hashSlug(a.slug) + seed) % 100) - ((hashSlug(b.slug) + seed) % 100));
        const platinum = boosted.filter((b) => b.active_boost_plan === "platinum").sort((a, b) => ((hashSlug(a.slug) + seed) % 100) - ((hashSlug(b.slug) + seed) % 100));
        const ordered = [...diamond, ...platinum];
        const boostedSlugs = new Set(ordered.map((b) => b.slug));
        const fillers = arr.filter((b) => !boostedSlugs.has(b.slug)).slice(0, Math.max(0, 9 - ordered.length));
        setFeatured([...ordered, ...fillers]);
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
              ایمیل تأیید برای شما ارسال شد — لطفاً صندوق ورودی و همچنین پوشه <strong>Spam / Junk</strong> را بررسی کنید.
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
              <span className="hero__typed-word">{typedWord}</span><span className="hero__cursor" aria-hidden="true">|</span>{" "}ایرانی را پیدا کنید
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
              <select
                id="hero-search-city"
                name="city"
                aria-label="شهر"
              >
                <option value="">همه شهرها</option>
                <option value="london">لندن</option>
                <option value="manchester">منچستر</option>
                <option value="birmingham">برمنگام</option>
                <option value="glasgow">گلاسگو</option>
              </select>
              <label htmlFor="hero-search-cat" className="visually-hidden">
                دسته
              </label>
              <select
                id="hero-search-cat"
                name="cat"
                aria-label="دسته"
              >
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

          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <Link
              to="/ai-search"
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.45rem",
                background: "rgba(57,0,77,0.55)",
                border: "1px solid rgba(160,80,255,0.35)",
                borderRadius: "50px",
                color: "rgba(220,180,255,0.95)",
                fontSize: "0.9rem", fontWeight: 600,
                padding: "0.5rem 1.3rem",
                textDecoration: "none",
              }}
            >
              ✨ جستجوی هوشمند با هوش مصنوعی
            </Link>
          </div>
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
            const iconClass = CATEGORY_ICONS[c.name] || DEFAULT_ICON;
            return (
              <Link
                key={c.id}
                className={`category-card category-card--home category-card--cat-${theme}`}
                to={`/listings?cat=${encodeURIComponent(c.name)}`}
              >
                <span className="category-card__icon" aria-hidden="true">
                  <i className={`fas ${iconClass}`} style={{ fontSize: "1.4rem" }}></i>
                </span>
                <span className="category-card__label">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section section--cities" aria-labelledby="cities-title">
        <div className="container">
          <header className="section__head section__head--cities">
            <i className="fas fa-city cities-section__icon" aria-hidden="true"></i>
            <h2 id="cities-title" className="section__title section__title--cities">
              کسب‌وکارهای ایرانی بر اساس شهر
            </h2>
            <p className="section__lead section__lead--cities">
              شهر خود را انتخاب کنید و کسب‌وکارهای ایرانی نزدیک را کشف کنید
            </p>
          </header>
          <div className="cities-grid">
            <Link className="city-card" to="/listings?city=london">
              <i className="fas fa-location-dot city-card__icon" aria-hidden="true"></i>
              <span className="city-card__name">لندن</span>
              <span className="city-card__en">London</span>
            </Link>
            <Link className="city-card" to="/listings?city=manchester">
              <i className="fas fa-building-columns city-card__icon" aria-hidden="true"></i>
              <span className="city-card__name">منچستر</span>
              <span className="city-card__en">Manchester</span>
            </Link>
            <Link className="city-card" to="/listings?city=birmingham">
              <i className="fas fa-landmark city-card__icon" aria-hidden="true"></i>
              <span className="city-card__name">برمنگام</span>
              <span className="city-card__en">Birmingham</span>
            </Link>
            <Link className="city-card" to="/listings?city=glasgow">
              <i className="fas fa-map-location-dot city-card__icon" aria-hidden="true"></i>
              <span className="city-card__name">گلاسگو</span>
              <span className="city-card__en">Glasgow</span>
            </Link>
            <Link className="city-card" to="/listings?city=leeds">
              <i className="fas fa-map-pin city-card__icon" aria-hidden="true"></i>
              <span className="city-card__name">لیدز</span>
              <span className="city-card__en">Leeds</span>
            </Link>
            <Link className="city-card" to="/listings?city=bristol">
              <i className="fas fa-compass city-card__icon" aria-hidden="true"></i>
              <span className="city-card__name">بریستول</span>
              <span className="city-card__en">Bristol</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--home section--register-cta container" aria-labelledby="reg-cta-title">
        <div
          style={{
            background: "linear-gradient(135deg, #f4f0f7 0%, #ede4f4 100%)",
            border: "1px solid rgba(92,31,110,0.15)",
            borderRadius: "var(--radius-lg, 1rem)",
            padding: "2rem 1.5rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <h2 id="reg-cta-title" style={{ margin: "0 0 0.4rem", fontSize: "1.2rem" }}>
              کسب‌وکار ایرانی دارید؟
            </h2>
            <p style={{ margin: 0, color: "#4a3557", fontSize: "0.95rem" }}>
              رایگان ثبت کنید — تنها چند دقیقه، مستقیم از مرورگر.
            </p>
          </div>
          <Link
            to="/onboarding"
            className="btn btn--primary"
            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            ثبت کسب‌وکار رایگان
          </Link>
        </div>
      </section>

      <section className="section section--home section--featured-strip container" aria-labelledby="feat-title">
        <div className="section__head section__head--home" style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
          <span aria-hidden="true" style={{ fontSize: "1.4rem" }}>⭐</span>
          <div>
            <h2 id="feat-title" className="section__title section__title--home" style={{ margin: 0 }}>
              آگهی‌های ویژه
            </h2>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#7c3aed" }}>
              {featured.filter((b) => b.active_boost_plan).length > 0
                ? `${featured.filter((b) => b.active_boost_plan).length} کسب‌وکار برجسته این دوره`
                : "جدیدترین کسب‌وکارهای ثبت‌شده"}
            </p>
          </div>
        </div>
        {featured.length === 0 ? (
          <p className="field-hint">
            هنوز آگهی‌ای ثبت نشده.{" "}
            <Link to="/listings">مشاهدهٔ همهٔ آگهی‌ها</Link>
          </p>
        ) : (
          <div className="hp-listings-grid">
            {featured.map((b) => {
              const href = `/business?slug=${encodeURIComponent(b.slug)}`;
              const cover = String(b.cover_image_url || "").trim();
              const bp = b.active_boost_plan;
              const letter = String(b.name_fa || "?").charAt(0);
              const rating = Number(b.rating) || 0;
              const BOOST_LABEL = { diamond: "💠 الماسی", platinum: "💎 پلاتینیوم", gold: "🥇 طلایی", silver: "🥈 نقره‌ای" };
              return (
                <article key={b.slug} className={`hp-card${bp ? ` hp-card--boost-${bp}` : ""}`}>
                  <Link to={href} style={{ display: "block", flexShrink: 0 }}>
                    <div className="hp-card__media">
                      {cover
                        ? <img className="hp-card__img" src={cover} alt="" loading="lazy" />
                        : <div className="hp-card__placeholder">{letter}</div>
                      }
                      <div className="hp-card__badges">
                        {bp && <span className={`hp-card__badge hp-card__badge--boost-${bp}`}>{BOOST_LABEL[bp]}</span>}
                        {!bp && <span className="hp-card__badge hp-card__badge--featured">Featured</span>}
                      </div>
                      {b.category && <span className="hp-card__cat-tag">{b.category}</span>}
                    </div>
                  </Link>
                  <div className="hp-card__body">
                    <Link to={href} className="hp-card__title">{b.name_fa}</Link>
                    {(b.address || b.city) && (
                      <div className="hp-card__meta">
                        <i className="fa-solid fa-location-dot" aria-hidden="true" />
                        {[b.address, b.city].filter(Boolean).join("، ")}
                      </div>
                    )}
                    {b.phone && (
                      <div className="hp-card__meta">
                        <i className="fa-solid fa-phone" aria-hidden="true" />
                        <span dir="ltr">{b.phone}</span>
                      </div>
                    )}
                    {rating > 0 && (
                      <div className="hp-card__rating">
                        <span className="hp-card__stars">{"★".repeat(Math.min(5, Math.round(rating)))}</span>
                        <span className="hp-card__rating-val">{rating.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="hp-card__footer">
                      <Link to={href} className="hp-card__view">
                        مشاهده آگهی <i className="fa-solid fa-arrow-left" style={{ fontSize: "0.75rem" }} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
