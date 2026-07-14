import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ListingCard from "../components/ListingCard.jsx";
import Seo from "../components/Seo.jsx";
import { apiGet, apiPost } from "../api.js";
import { getListingsLocationFromForm } from "../lib/listingsSearchNavigate.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import { filterListingsByCategoryParams, LEGACY_CATEGORY_SELECT_OPTIONS } from "../lib/categoryFilters.js";
import { useBusinessCategories } from "../hooks/useBusinessCategories.js";

function filterRows(rows, searchParams) {
  return filterListingsByCategoryParams(rows, searchParams);
}

function dailyBannerSeenKey(scope) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `iraniu_fs_seen_${scope}_${y}-${m}-${day}`;
}

function getDailyBannerSeenCount(scope, bannerId) {
  try {
    const raw = localStorage.getItem(dailyBannerSeenKey(scope));
    const map = raw ? JSON.parse(raw) : {};
    const n = Number(map?.[String(bannerId)] || 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function incrementDailyBannerSeenCount(scope, bannerId) {
  try {
    const k = dailyBannerSeenKey(scope);
    const raw = localStorage.getItem(k);
    const map = raw ? JSON.parse(raw) : {};
    const key = String(bannerId);
    const n = Number(map?.[key] || 0);
    map[key] = Number.isFinite(n) ? n + 1 : 1;
    localStorage.setItem(k, JSON.stringify(map));
  } catch {}
}

function AdSenseSlot({ code }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }, []);
  const insHtml = String(code || "").replace(/<script[\s\S]*?<\/script>/gi, "").trim();
  if (!insHtml) return null;
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: insHtml }} />;
}

function DirectoryAdBanner({ banner, onBannerClick }) {
  const hasImage = !!banner?.image_url;
  const hasAdsense = !hasImage && !!banner?.adsense_code;
  if (!hasImage && !hasAdsense) return null;

  if (hasAdsense) {
    return (
      <div className="listings-page__ad-banner listings-page__ad-banner--adsense" aria-label="آگهی">
        <span className="ad-badge-sponsor">Sponsored</span>
        <AdSenseSlot code={banner.adsense_code} />
      </div>
    );
  }

  const link = String(banner.link_url || "").trim();
  const external = /^https?:\/\//i.test(link);
  const label = banner.title || "بنر تبلیغاتی";
  if (link) {
    return (
      <a
        className="listings-page__ad-banner"
        href={link}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        aria-label={label}
        onClick={onBannerClick}
      >
        <span className="ad-badge-sponsor">Sponsored</span>
        <img src={banner.image_url} alt={label} loading="lazy" decoding="async" />
      </a>
    );
  }
  return (
    <div className="listings-page__ad-banner" aria-label={label} onClick={onBannerClick}>
      <span className="ad-badge-sponsor">Sponsored</span>
      <img src={banner.image_url} alt={label} loading="lazy" decoding="async" />
    </div>
  );
}

export default function ListingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { categories: categoryOptions } = useBusinessCategories();
  const [rows, setRows] = useState([]);
  const [directoryBanners, setDirectoryBanners] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [fullscreenBanner, setFullscreenBanner] = useState(null);
  const [sortBy, setSortBy] = useState("default");
  const PAGE_SIZE = 12;

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiGet("/api/businesses")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setErr("خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiGet("/api/directory-banners")
      .then((d) => setDirectoryBanners(Array.isArray(d) ? d : []))
      .catch(() => setDirectoryBanners([]));
  }, []);

  const featuredRows = useMemo(() => {
    const boosted = rows.filter((b) => b.active_boost_plan === "diamond" || b.active_boost_plan === "platinum");
    // daily shuffle within each tier so all businesses get fair rotation
    const seed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, "")) % 9973;
    function hashSlug(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h; }
    const diamond  = boosted.filter((b) => b.active_boost_plan === "diamond").sort((a, b) => ((hashSlug(a.slug) + seed) % 100) - ((hashSlug(b.slug) + seed) % 100));
    const platinum = boosted.filter((b) => b.active_boost_plan === "platinum").sort((a, b) => ((hashSlug(a.slug) + seed) % 100) - ((hashSlug(b.slug) + seed) % 100));
    return [...diamond, ...platinum];
  }, [rows]);

  const filtered = useMemo(() => filterRows(rows, searchParams), [rows, searchParams]);
  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "rating") arr.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    if (sortBy === "name") arr.sort((a, b) => (a.name_fa || "").localeCompare(b.name_fa || "", "fa"));
    return arr;
  }, [filtered, sortBy]);
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedFiltered.slice(start, start + PAGE_SIZE);
  }, [sortedFiltered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const qDefault = searchParams.get("q") || "";
  const cityDefault = searchParams.get("city") || "";
  const catDefault = searchParams.get("cat") || "";
  const cityOptions = useMemo(() => {
    const seen = new Set();
    for (const b of rows) {
      const city = String(b?.city || "").trim();
      if (!city || /^test$/i.test(city) || /[؀-ۿ]/.test(city)) continue;
      seen.add(city);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const normalizedDirectoryBanners = useMemo(
    () =>
      (Array.isArray(directoryBanners) ? directoryBanners : [])
        .filter((b) => String(b?.image_url || "").trim())
        .map((b) => ({
          ...b,
          placement:
            String(b?.placement || "").trim().toLowerCase() === "top"
              ? "top"
              : String(b?.placement || "").trim().toLowerCase() === "fullscreen"
                ? "fullscreen"
                : "between",
        })),
    [directoryBanners]
  );
  const topBanners = useMemo(
    () => normalizedDirectoryBanners.filter((b) => b.placement === "top"),
    [normalizedDirectoryBanners]
  );
  const betweenBanners = useMemo(
    () => normalizedDirectoryBanners.filter((b) => b.placement === "between"),
    [normalizedDirectoryBanners]
  );
  const fullscreenBanners = useMemo(
    () => normalizedDirectoryBanners.filter((b) => b.placement === "fullscreen"),
    [normalizedDirectoryBanners]
  );
  const betweenBannerSlotsCount = useMemo(
    () => Math.floor(Math.max(0, pagedRows.length) / 2),
    [pagedRows.length]
  );
  const betweenBannersForPage = useMemo(
    () => betweenBanners.slice(0, betweenBannerSlotsCount),
    [betweenBanners, betweenBannerSlotsCount]
  );
  const trackBannerClick = (bannerId) => {
    const id = Number.parseInt(String(bannerId || "0"), 10);
    if (!Number.isFinite(id) || id <= 0) return;
    apiPost("/api/banner-clicks", { banner_id: id }).catch(() => {});
  };

  useEffect(() => {
    if (!fullscreenBanners.length) {
      setFullscreenBanner(null);
      return;
    }
    const next = fullscreenBanners.find((b) => {
      const cap = Math.max(1, Number.parseInt(String(b?.daily_user_cap || "2"), 10) || 2);
      return getDailyBannerSeenCount("directory", b.id) < cap;
    });
    if (!next) return;
    incrementDailyBannerSeenCount("directory", next.id);
    setFullscreenBanner(next);
  }, [fullscreenBanners]);

  const listingsSeo = useMemo(() => {
    const q = (searchParams.get("q") || "").trim();
    const city = (searchParams.get("city") || "").trim();
    const cat = (searchParams.get("cat") || "").trim();
    const parts = [];
    if (q) parts.push(`«${q}»`);
    if (city) parts.push(city);
    if (cat) parts.push(cat);
    const title =
      parts.length > 0 ? `لیست کسب‌وکارها (${parts.join(" · ")})` : "لیست کسب‌وکارها";
    const desc =
      parts.length > 0
        ? `نتایج فیلترشده در ایرانیو: ${parts.join("، ")}. جستجو در فهرست کسب‌وکارهای ایرانی در بریتانیا.`
        : "جستجو و فیلتر بر اساس نام، شهر و دسته؛ کارت‌های کسب‌وکار ایرانی در بریتانیا.";
    return { title, description: desc.slice(0, 320) };
  }, [searchParams]);

  return (
    <>
      <style>{`
        .listings-hero { background: linear-gradient(135deg,#1a0a2e 0%,#3a0a5e 100%); padding: 3.5rem 1.5rem 2.5rem; }
        .listings-hero__inner { max-width: 1200px; margin: 0 auto; }
        .listings-hero__eyebrow { color: rgba(200,160,255,0.75); font-size: 0.82rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 0.5rem; }
        .listings-hero__h1 { color: #fff; font-size: clamp(1.6rem,4vw,2.4rem); font-weight: 800; margin: 0 0 0.4rem; }
        .listings-hero__sub { color: rgba(255,255,255,0.6); font-size: 0.95rem; margin: 0 0 1.5rem; }
        .listings-hero__actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .listings-main { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
        @media(max-width:768px){ .listings-main { padding: 1.5rem 1rem 3rem; } }
      `}</style>

      <Seo title={listingsSeo.title} description={listingsSeo.description || SEO_DEFAULT_DESCRIPTION} />

      {/* Hero bar */}
      <div className="listings-hero">
        <div className="listings-hero__inner">
          <p className="listings-hero__eyebrow">فهرست ایرانیو</p>
          <h1 className="listings-hero__h1" id="listings-title">لیست کسب‌وکارها</h1>
          <p className="listings-hero__sub">جستجو و فیلتر در میان کسب‌وکارهای ایرانی در بریتانیا</p>
          <div className="listings-hero__actions">
            <Link to="/exchanges" className="demo-btn demo-btn--outline">صرافی‌ها</Link>
            <Link to="/onboarding" className="demo-btn demo-btn--accent">ثبت کسب‌وکار رایگان</Link>
            <Link to="/ai-search" className="demo-btn demo-btn--outline">✨ جستجوی هوشمند</Link>
          </div>
        </div>
      </div>

      {/* Fullscreen banner modal */}
      {fullscreenBanner ? (
        <div className="admin-detail-modal public-fs-banner-modal">
          <div className="admin-detail-modal__backdrop" onClick={() => setFullscreenBanner(null)} />
          <div className="admin-detail-modal__panel public-fs-banner-modal__panel" role="dialog" aria-modal="true" aria-label="تبلی�� تمام‌صفحه">
            <button type="button" className="admin-detail-modal__close" onClick={() => setFullscreenBanner(null)} aria-label="بستن">
              ×
            </button>
            <div className="listings-page__ad-banner-wrap listings-page__ad-banner-wrap--fullscreen">
              <DirectoryAdBanner banner={fullscreenBanner} onBannerClick={() => trackBannerClick(fullscreenBanner.id)} />
            </div>
          </div>
        </div>
      ) : null}

      {featuredRows.length > 0 && (
        <div className="listings-featured-band" aria-labelledby="featured-listings-title">
          <div className="listings-featured-band__inner">
            <div className="featured-section__head">
              <span className="featured-section__icon" aria-hidden="true">⭐</span>
              <div>
                <h2 id="featured-listings-title" className="featured-section__title">آگهی‌های ویژه</h2>
                <p className="featured-section__sub">{featuredRows.length} کسب‌وکار برجسته این دوره</p>
              </div>
            </div>
            <div className="hp-listings-grid">
              {featuredRows.map((b) => {
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
          </div>
        </div>
      )}

      <main className="listings-main" aria-labelledby="listings-title">

      <form
        key={searchParams.toString()}
        method="get"
        className="listings-search"
        role="search"
        aria-label="جستجو و فیلتر کسب‌وکارها"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(getListingsLocationFromForm(e.currentTarget));
        }}
      >
        <input type="hidden" name="adv" value="" />
        <div className="listings-search__row">
          <div className="field field--q">
            <label htmlFor="listings-q">نام یا کلمه کلیدی</label>
            <input
              type="search"
              id="listings-q"
              name="q"
              placeholder="مثلاً رستوران، وکیل، سوپرمارکت…"
              autoComplete="off"
              defaultValue={qDefault}
            />
          </div>
          <div className="field">
            <label htmlFor="listings-city">شهر</label>
            <select id="listings-city" name="city" aria-label="شهر" defaultValue={cityDefault}>
              <option value="">همه شهرها</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="listings-cat">دسته</label>
            <select id="listings-cat" name="cat" aria-label="دسته" defaultValue={catDefault}>
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
          </div>
          <div className="listings-search__actions">
            <button type="submit" className="btn btn--primary">
              اعمال فیلتر
            </button>
          </div>
        </div>
      </form>

      <div className="listings-results-root">
        <>
            {!loading && !err && (
              <div className="listings-sort-bar">
                <span className="listings-sort-bar__count">
                  <i className="fa-solid fa-list" aria-hidden="true" />
                  {sortedFiltered.length !== rows.length
                    ? <>{sortedFiltered.length} نتیجه (از {rows.length} آگهی)</>
                    : <>{rows.length} کسب‌وکار</>
                  }
                </span>
                <select
                  className="listings-sort-bar__select"
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                  aria-label="مرتب‌سازی"
                >
                  <option value="default">مرتب‌سازی: پیش‌فرض</option>
                  <option value="rating">بالاترین امتیاز</option>
                  <option value="name">نام (الف-ی)</option>
                </select>
              </div>
            )}
            <div className="listings-toolbar">
              <p className="listings-toolbar__status">
                {loading ? (
                  <span className="listings-toolbar__loading">در حال بارگذاری فهرست…</span>
                ) : err ? (
                  <span className="listings-error">{err}</span>
                ) : null}
              </p>
            </div>

            {loading ? (
              <div className="listing-cards listing-cards--skeleton" aria-busy="true" aria-label="بارگذاری">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="listing-card listing-card--skeleton">
                    <div className="listing-card__media listing-card__skeleton-shimmer" />
                    <div className="listing-card__body">
                      <div className="listing-card__skeleton-line listing-card__skeleton-line--title" />
                      <div className="listing-card__skeleton-line" />
                      <div className="listing-card__skeleton-line listing-card__skeleton-line--short" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedFiltered.length === 0 && !err && rows.length === 0 ? (
              <div className="listings-empty">
                <p>هنوز کسب‌وکاری در فهرست ثبت نشده است.</p>
              </div>
            ) : sortedFiltered.length === 0 && !err ? (
              <div className="listings-empty">
                <p>موردی با این فیلترها پیدا نشد. عبارت جستجو یا دسته را عوض کنید.</p>
              </div>
            ) : (
              <div className="listing-cards">
                {!loading && !err && topBanners[0] ? (
                  <div className="listings-page__ad-banner-wrap listings-page__ad-banner-wrap--top">
                    <DirectoryAdBanner banner={topBanners[0]} onBannerClick={() => trackBannerClick(topBanners[0]?.id)} />
                  </div>
                ) : null}
                {pagedRows.map((b, idx) => (
                  <Fragment key={b.slug}>
                    <div className="listings-page__stack-item">
                      <ListingCard b={b} />
                    </div>
                    {idx % 2 === 1 && betweenBannersForPage[Math.floor(idx / 2)] ? (
                      <div className="listings-page__ad-banner-wrap listings-page__ad-banner-wrap--between">
                        <DirectoryAdBanner
                          banner={betweenBannersForPage[Math.floor(idx / 2)]}
                          onBannerClick={() => trackBannerClick(betweenBannersForPage[Math.floor(idx / 2)]?.id)}
                        />
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            )}
            {!loading && !err && sortedFiltered.length > PAGE_SIZE && (
              <nav className="listings-pagination" aria-label="صفحه‌بندی">
                <button
                  type="button"
                  className="btn btn--ghost listings-pagination__btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  قبلی
                </button>
                <p className="listings-pagination__status">
                  صفحه {safePage} از {totalPages}
                </p>
                <button
                  type="button"
                  className="btn btn--ghost listings-pagination__btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  بعدی
                </button>
              </nav>
            )}
          </>
      </div>
      </main>
    </>
  );
}
