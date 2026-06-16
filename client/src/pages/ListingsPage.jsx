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

function DirectoryAdBanner({ banner, onBannerClick }) {
  if (!banner?.image_url) return null;
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
  const PAGE_SIZE = 9;

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

  const filtered = useMemo(() => filterRows(rows, searchParams), [rows, searchParams]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

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
    <section
      className="section container listings-page listings-page--plain"
      aria-labelledby="listings-title"
    >
      <Seo title={listingsSeo.title} description={listingsSeo.description || SEO_DEFAULT_DESCRIPTION} />
      {fullscreenBanner ? (
        <div className="admin-detail-modal public-fs-banner-modal">
          <div className="admin-detail-modal__backdrop" onClick={() => setFullscreenBanner(null)} />
          <div className="admin-detail-modal__panel public-fs-banner-modal__panel" role="dialog" aria-modal="true" aria-label="تبلیغ تمام‌صفحه">
            <button type="button" className="admin-detail-modal__close" onClick={() => setFullscreenBanner(null)} aria-label="بستن">
              ×
            </button>
            <div className="listings-page__ad-banner-wrap listings-page__ad-banner-wrap--fullscreen">
              <DirectoryAdBanner banner={fullscreenBanner} onBannerClick={() => trackBannerClick(fullscreenBanner.id)} />
            </div>
          </div>
        </div>
      ) : null}
      <div className="listings-page__intro">
        <p className="listings-page__eyebrow">فهرست ایرانیو</p>
        <h1 id="listings-title">لیست کسب‌وکارها</h1>
        <p className="listings-page__intro-lead">جستجو و فیلتر؛ نتایج به‌صورت کارت زیر نمایش داده می‌شوند.</p>
        <div className="listings-page__intro-actions">
          <Link className="btn btn--ghost" to="/exchanges">
            صرافی‌ها
          </Link>
          <Link className="btn btn--accent" to="/">
            بازگشت به خانه
          </Link>
        </div>
      </div>

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
        <div className="listings-toolbar">
          <p className="listings-toolbar__status">
            {loading ? (
              <span className="listings-toolbar__loading">در حال بارگذاری فهرست…</span>
            ) : err ? (
              <span className="listings-error">{err}</span>
            ) : filtered.length === rows.length ? (
              <>
                <span className="listings-toolbar__count">{rows.length}</span>
              </>
            ) : (
              <>
                <span className="listings-toolbar__count">{filtered.length}</span> (با فیلتر جستجو)
              </>
            )}
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
        ) : filtered.length === 0 && !err && rows.length === 0 ? (
          <div className="listings-empty">
            <p>هنوز کسب‌وکاری در فهرست ثبت نشده است.</p>
          </div>
        ) : filtered.length === 0 && !err ? (
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
        {!loading && !err && filtered.length > PAGE_SIZE && (
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
      </div>
    </section>
  );
}
