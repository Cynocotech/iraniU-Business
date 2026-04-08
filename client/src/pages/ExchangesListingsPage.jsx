import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ExchangeBestRatesSheet from "../components/ExchangeBestRatesSheet.jsx";
import ExchangeCalcModal from "../components/ExchangeCalcModal.jsx";
import ListingCard from "../components/ListingCard.jsx";
import Seo from "../components/Seo.jsx";
import { apiGet, apiPost } from "../api.js";
import { getListingsLocationFromForm } from "../lib/listingsSearchNavigate.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import { filterListingsByCategoryParams } from "../lib/categoryFilters.js";
import {
  averageExchangeRatesFromBusinesses,
  formatExchangeRateToman,
  isExchangeBusiness,
  parseExchangeRatesJson,
  pickBestRateExchangeInList,
} from "../lib/exchangeRates.js";

function filterExchangeRows(rows, searchParams) {
  const only = (Array.isArray(rows) ? rows : []).filter(isExchangeBusiness);
  return filterListingsByCategoryParams(only, searchParams);
}

const EXCHANGE_CITY_LABELS = {
  london: "لندن",
  manchester: "منچستر",
  birmingham: "برمنگام",
  glasgow: "گلاسگو",
};

function faDigits(n) {
  return Number(n).toLocaleString("fa-IR");
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

function ExchangeAdBanner({ banner, onBannerClick }) {
  if (!banner?.image_url) return null;
  const link = String(banner.link_url || "").trim();
  const external = /^https?:\/\//i.test(link);
  const label = banner.title || "بنر تبلیغاتی";
  if (link) {
    return (
      <a className="exchanges-app__ad-banner" href={link} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} aria-label={label} onClick={onBannerClick}>
        <span className="ad-badge-sponsor">Sponsored</span>
        <img src={banner.image_url} alt={label} loading="lazy" decoding="async" />
      </a>
    );
  }
  return (
    <div className="exchanges-app__ad-banner" aria-label={label} onClick={onBannerClick}>
      <span className="ad-badge-sponsor">Sponsored</span>
      <img src={banner.image_url} alt={label} loading="lazy" decoding="async" />
    </div>
  );
}

export default function ExchangesListingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [exchangeBanners, setExchangeBanners] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [exchangeMode, setExchangeMode] = useState("buy");
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState("USD");
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [bestRatesSheetOpen, setBestRatesSheetOpen] = useState(false);
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
    apiGet("/api/exchange-banners")
      .then((d) => setExchangeBanners(Array.isArray(d) ? d : []))
      .catch(() => setExchangeBanners([]));
  }, []);

  const filtered = useMemo(() => filterExchangeRows(rows, searchParams), [rows, searchParams]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const ratesForCalc = useMemo(() => {
    const averaged = averageExchangeRatesFromBusinesses(filtered);
    if (averaged.length > 0) return averaged;
    if (!filtered.length) return parseExchangeRatesJson(null);
    return parseExchangeRatesJson(filtered[0]?.exchange_rates_json);
  }, [filtered]);

  const selectedRate =
    ratesForCalc.find((r) => r.code === selectedCurrencyCode) || ratesForCalc[0] || null;

  useEffect(() => {
    if (!ratesForCalc.length) return;
    if (ratesForCalc.some((r) => r.code === selectedCurrencyCode)) return;
    setSelectedCurrencyCode(ratesForCalc[0].code);
  }, [ratesForCalc, selectedCurrencyCode]);

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

  useEffect(() => {
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const qDefault = searchParams.get("q") || "";
  const cityDefault = searchParams.get("city") || "";
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(() => Boolean(cityDefault));

  useEffect(() => {
    if (cityDefault) setShowAdvancedFilters(true);
  }, [cityDefault]);

  const hasActiveFilters = Boolean(qDefault.trim() || cityDefault);
  const normalizedExchangeBanners = useMemo(
    () =>
      (Array.isArray(exchangeBanners) ? exchangeBanners : [])
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
    [exchangeBanners]
  );
  const topBanners = useMemo(() => normalizedExchangeBanners.filter((b) => b.placement === "top"), [normalizedExchangeBanners]);
  const betweenBanners = useMemo(
    () => normalizedExchangeBanners.filter((b) => b.placement === "between"),
    [normalizedExchangeBanners]
  );
  const fullscreenBanners = useMemo(
    () => normalizedExchangeBanners.filter((b) => b.placement === "fullscreen"),
    [normalizedExchangeBanners]
  );
  const betweenBannersForPage = useMemo(
    () => betweenBanners.slice(0, Math.max(0, pagedRows.length)),
    [betweenBanners, pagedRows.length]
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
      return getDailyBannerSeenCount("exchange", b.id) < cap;
    });
    if (!next) return;
    incrementDailyBannerSeenCount("exchange", next.id);
    setFullscreenBanner(next);
  }, [fullscreenBanners]);

  const widgetCurrencyCode = useMemo(() => {
    if (ratesForCalc.some((r) => r.code === "USD")) return "USD";
    return ratesForCalc[0]?.code || selectedCurrencyCode || "USD";
  }, [ratesForCalc, selectedCurrencyCode]);
  const bestSellPick = useMemo(
    () => pickBestRateExchangeInList(filtered, widgetCurrencyCode, "sell"),
    [filtered, widgetCurrencyCode]
  );
  const bestBuyPick = useMemo(
    () => pickBestRateExchangeInList(filtered, widgetCurrencyCode, "buy"),
    [filtered, widgetCurrencyCode]
  );
  const bestTitlePick = bestSellPick || bestBuyPick || null;

  const seo = useMemo(() => {
    const q = (searchParams.get("q") || "").trim();
    const city = (searchParams.get("city") || "").trim();
    const parts = [];
    if (q) parts.push(`«${q}»`);
    if (city) parts.push(city);
    const title =
      parts.length > 0 ? `صرافی‌ها و نرخ ارز (${parts.join(" · ")})` : "صرافی‌ها و نرخ ارز — ایرانیو";
    const desc =
      parts.length > 0
        ? `فهرست صرافی‌ها و خدمات ارزی ایرانیو${parts.length ? ` — ${parts.join("، ")}` : ""}.`
        : "فهرست جداگانهٔ صرافی‌ها و خدمات تبادل ارز؛ جستجو بر اساس نام و شهر.";
    return { title, description: desc.slice(0, 320) };
  }, [searchParams]);

  return (
    <section
      className="section container exchanges-app listings-page listings-page--plain listings-page--exchanges"
      aria-labelledby="exchanges-title"
    >
      <Seo title={seo.title} description={seo.description || SEO_DEFAULT_DESCRIPTION} />
      {fullscreenBanner ? (
        <div className="admin-detail-modal public-fs-banner-modal">
          <div className="admin-detail-modal__backdrop" onClick={() => setFullscreenBanner(null)} />
          <div className="admin-detail-modal__panel public-fs-banner-modal__panel" role="dialog" aria-modal="true" aria-label="تبلیغ تمام‌صفحه">
            <button type="button" className="admin-detail-modal__close" onClick={() => setFullscreenBanner(null)} aria-label="بستن">
              ×
            </button>
            <div className="exchanges-app__ad-banner-wrap exchanges-app__ad-banner-wrap--fullscreen">
              <ExchangeAdBanner banner={fullscreenBanner} onBannerClick={() => trackBannerClick(fullscreenBanner.id)} />
            </div>
          </div>
        </div>
      ) : null}
      <h1 id="exchanges-title" className="visually-hidden">
        {seo.title}
      </h1>

      <nav className="exchanges-app__float-nav" aria-label="ناوبری سریع صرافی‌ها">
        <a className="exchanges-app__float-btn" href="#exchange-list-section">
          <span className="exchanges-app__float-btn-inner">
            <i className="fa-solid fa-list-ul exchanges-app__float-ico" aria-hidden="true" />
            <span className="exchanges-app__float-label">لیست صرافی‌ها</span>
          </span>
        </a>
        <button
          type="button"
          className="exchanges-app__float-btn exchanges-app__float-btn--action"
          onClick={() => {
            setCalcModalOpen(false);
            setBestRatesSheetOpen(true);
          }}
        >
          <span className="exchanges-app__float-btn-inner">
            <i className="fa-solid fa-chart-line exchanges-app__float-ico" aria-hidden="true" />
            <span className="exchanges-app__float-label">مقایسه نرخ و بهترین‌ها</span>
          </span>
        </button>
        <button
          type="button"
          className="exchanges-app__float-btn exchanges-app__float-btn--action"
          onClick={() => {
            setBestRatesSheetOpen(false);
            setCalcModalOpen(true);
          }}
        >
          <span className="exchanges-app__float-btn-inner">
            <i className="fa-solid fa-calculator exchanges-app__float-ico" aria-hidden="true" />
            <span className="exchanges-app__float-label">ماشین‌حساب نرخ</span>
          </span>
        </button>
      </nav>

      <div className="exchanges-app__hero">
        <div className="exchanges-app__filter-card">
          {hasActiveFilters ? (
            <div className="exchanges-app__filter-chips" aria-label="فیلترهای فعال">
              {qDefault.trim() ? (
                <span className="exchanges-app__filter-chip">
                  <span className="exchanges-app__filter-chip-key">جستجو</span>
                  <span className="exchanges-app__filter-chip-val" dir="auto">
                    {qDefault.trim()}
                  </span>
                </span>
              ) : null}
              {cityDefault ? (
                <span className="exchanges-app__filter-chip">
                  <span className="exchanges-app__filter-chip-key">شهر</span>
                  <span className="exchanges-app__filter-chip-val">{EXCHANGE_CITY_LABELS[cityDefault] || cityDefault}</span>
                </span>
              ) : null}
              <Link className="exchanges-app__filter-clear" to="/exchanges">
                حذف فیلترها
              </Link>
            </div>
          ) : null}

          <form
            key={searchParams.toString()}
            method="get"
            className="exchanges-app__search exchanges-app__search--in-card"
            role="search"
            aria-label="جستجو در صرافی‌ها"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(getListingsLocationFromForm(e.currentTarget, "/exchanges"));
            }}
          >
            <input type="hidden" name="adv" value="" />
            <div className="exchanges-app__search-row">
              <div className="field field--block exchanges-app__field">
                <label htmlFor="exchanges-q">جستجو</label>
                <input
                  type="search"
                  id="exchanges-q"
                  name="q"
                  placeholder="نام، شهر، کلمه…"
                  autoComplete="off"
                  defaultValue={qDefault}
                  className="exchanges-app__input"
                />
              </div>
              {showAdvancedFilters ? (
                <div className="field field--block exchanges-app__field">
                  <label htmlFor="exchanges-city">شهر</label>
                  <select id="exchanges-city" name="city" aria-label="شهر" defaultValue={cityDefault} className="exchanges-app__input">
                    <option value="">همه شهرها</option>
                    <option value="london">لندن</option>
                    <option value="manchester">منچستر</option>
                    <option value="birmingham">برمنگام</option>
                    <option value="glasgow">گلاسگو</option>
                  </select>
                </div>
              ) : (
                <input type="hidden" name="city" value={cityDefault} />
              )}
              <div className="exchanges-app__search-tools">
                <button
                  type="button"
                  className="btn btn--ghost exchanges-app__filters-toggle"
                  aria-expanded={showAdvancedFilters}
                  onClick={() => setShowAdvancedFilters((v) => !v)}
                >
                  {showAdvancedFilters ? "بستن فیلترها" : "فیلترها"}
                </button>
                {showAdvancedFilters ? (
                  <button type="submit" className="btn btn--primary exchanges-app__submit">
                    اعمال فیلتر
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </div>

        {!loading && !err && (bestSellPick || bestBuyPick) ? (
          <aside
            id="exchange-best-rates-section"
            className="exchanges-app__best-widget-shell"
            aria-label="بهترین نرخ در فهرست فعلی"
          >
            <img
              className="exchanges-app__best-widget-tag"
              src="/images/exchange-best-tag.png"
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
            <div className="exchanges-app__best-widget-body exchanges-app__best-widget-body--dual">
              {bestTitlePick ? (
                <Link
                  className="exchanges-app__best-widget-title-logo-link"
                  to={`/business?slug=${encodeURIComponent(bestTitlePick.business.slug)}`}
                  aria-label={`مشاهده صرافی: ${bestTitlePick.business.name_fa || "صرافی"}`}
                >
                  {(bestTitlePick.business.cover_image_url || "").trim() ? (
                    <img
                      className="exchanges-app__best-widget-title-logo"
                      src={bestTitlePick.business.cover_image_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="exchanges-app__best-widget-title-logo exchanges-app__best-widget-title-logo--fallback" aria-hidden>
                      {String(bestTitlePick.business.name_fa || "E").trim().charAt(0)}
                    </span>
                  )}
                </Link>
              ) : null}
              <p className="exchanges-app__best-widget-kicker">بهترین نرخ در این فهرست</p>
              <div className="exchanges-app__best-widget-dual">
                {bestSellPick ? (
                  <Link
                    className="exchanges-app__best-side exchanges-app__best-side--sell"
                    to={`/business?slug=${encodeURIComponent(bestSellPick.business.slug)}`}
                    aria-label={`بهترین نرخ فروش: ${bestSellPick.business.name_fa || "صرافی"}`}
                  >
                    <span className="exchanges-app__best-side-label">
                      <i className="fa-solid fa-arrow-up-right-dots exchanges-app__best-side-ico" aria-hidden="true" />
                      فروش
                    </span>
                    <span className="exchanges-app__best-side-rate" dir="ltr">
                      {formatExchangeRateToman(bestSellPick.raw)}
                    </span>
                  </Link>
                ) : null}
                {bestBuyPick ? (
                  <Link
                    className="exchanges-app__best-side exchanges-app__best-side--buy"
                    to={`/business?slug=${encodeURIComponent(bestBuyPick.business.slug)}`}
                    aria-label={`بهترین نرخ خرید: ${bestBuyPick.business.name_fa || "صرافی"}`}
                  >
                    <span className="exchanges-app__best-side-label">
                      <i className="fa-solid fa-arrow-down-wide-short exchanges-app__best-side-ico" aria-hidden="true" />
                      خرید
                    </span>
                    <span className="exchanges-app__best-side-rate" dir="ltr">
                      {formatExchangeRateToman(bestBuyPick.raw)}
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <div id="exchange-list-section" className="exchanges-app__body">
        {err ? <p className="listings-error exchanges-app__list-err">{err}</p> : null}

        {loading ? (
          <div className="exchanges-app__preloader" aria-busy="true" aria-label="در حال بارگذاری صرافی‌ها">
            <div className="exchanges-app__preloader-dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p>در حال بارگذاری لیست صرافی‌ها…</p>
          </div>
        ) : filtered.length === 0 && !err && rows.length === 0 ? (
          <div className="listings-empty exchanges-app__empty">
            <p>هنوز آگهی‌ای در سایت ثبت نشده است.</p>
          </div>
        ) : filtered.length === 0 && !err ? (
          <div className="listings-empty exchanges-app__empty">
            <p>صرافی‌ای با این فیلتر پیدا نشد.</p>
            <p>
              <Link to="/listings">لیست عمومی</Link>
            </p>
          </div>
        ) : (
          <div className="exchanges-app__list listing-cards">
            {!loading && !err && topBanners[0] ? (
              <div className="exchanges-app__ad-banner-wrap exchanges-app__ad-banner-wrap--top">
                <ExchangeAdBanner banner={topBanners[0]} onBannerClick={() => trackBannerClick(topBanners[0]?.id)} />
              </div>
            ) : null}
            {pagedRows.map((b, idx) => (
              <div key={b.slug} className="exchanges-app__list-stack-item">
                <div className="exchanges-app__card">
                  <ListingCard b={b} titleHeading="h2" variant="exchange" />
                </div>
                {betweenBannersForPage[idx] ? (
                  <div className="exchanges-app__ad-banner-wrap exchanges-app__ad-banner-wrap--between">
                    <ExchangeAdBanner banner={betweenBannersForPage[idx]} onBannerClick={() => trackBannerClick(betweenBannersForPage[idx]?.id)} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {!loading && !err && filtered.length > PAGE_SIZE && (
          <nav className="exchanges-app__pagination-bar" aria-label="صفحه‌بندی">
            <button
              type="button"
              className="exchanges-app__page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="صفحه قبلی"
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true" />
              <span>قبلی</span>
            </button>
            <div className="exchanges-app__page-indicator">
              <span className="exchanges-app__page-indicator-label">صفحه</span>
              <span className="exchanges-app__page-indicator-num">{faDigits(safePage)}</span>
              <span className="exchanges-app__page-indicator-sep" aria-hidden="true">
                /
              </span>
              <span className="exchanges-app__page-indicator-total">{faDigits(totalPages)}</span>
            </div>
            <button
              type="button"
              className="exchanges-app__page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="صفحه بعدی"
            >
              <span>بعدی</span>
              <i className="fa-solid fa-chevron-left" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>

      <ExchangeBestRatesSheet
        open={bestRatesSheetOpen}
        onClose={() => setBestRatesSheetOpen(false)}
        filtered={filtered}
        loading={loading}
        err={err}
      />

      <ExchangeCalcModal
        open={calcModalOpen}
        onClose={() => setCalcModalOpen(false)}
        filtered={filtered}
        ratesForCalc={ratesForCalc}
        selectedCurrencyCode={selectedCurrencyCode}
        setSelectedCurrencyCode={setSelectedCurrencyCode}
        exchangeMode={exchangeMode}
        setExchangeMode={setExchangeMode}
        loading={loading}
        err={err}
      />
    </section>
  );
}
