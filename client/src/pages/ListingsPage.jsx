import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ListingCard from "../components/ListingCard.jsx";
import Seo from "../components/Seo.jsx";
import { apiGet } from "../api.js";
import { getListingsLocationFromForm } from "../lib/listingsSearchNavigate.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import { filterListingsByCategoryParams, LEGACY_CATEGORY_SELECT_OPTIONS } from "../lib/categoryFilters.js";
import { useBusinessCategories } from "../hooks/useBusinessCategories.js";

function filterRows(rows, searchParams) {
  return filterListingsByCategoryParams(rows, searchParams);
}

export default function ListingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { categories: categoryOptions } = useBusinessCategories();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiGet("/api/businesses")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setErr("خطا در بارگذاری"))
      .finally(() => setLoading(false));
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
              <option value="london">لندن</option>
              <option value="manchester">منچستر</option>
              <option value="birmingham">برمنگام</option>
              <option value="glasgow">گلاسگو</option>
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
                <span className="listings-toolbar__count">{rows.length}</span> مورد
              </>
            ) : (
              <>
                <span className="listings-toolbar__count">{filtered.length}</span> مورد از {rows.length} (با فیلتر جستجو)
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
            {pagedRows.map((b) => (
              <ListingCard key={b.slug} b={b} />
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
