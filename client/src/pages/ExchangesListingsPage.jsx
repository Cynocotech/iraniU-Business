import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ExchangeBestRatesSheet from "../components/ExchangeBestRatesSheet.jsx";
import ExchangeCalcModal from "../components/ExchangeCalcModal.jsx";
import ListingCard from "../components/ListingCard.jsx";
import Seo from "../components/Seo.jsx";
import { apiGet, apiPost } from "../api.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import {
  averageExchangeRatesFromBusinesses,
  formatExchangeRateToman,
  isExchangeBusiness,
  parseExchangeRatesJson,
  pickBestRateExchangeInList,
} from "../lib/exchangeRates.js";

function filterExchangeRows(rows, searchParams) {
  let out = (Array.isArray(rows) ? rows : []).filter(isExchangeBusiness);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const city = (searchParams.get("city") || "").trim().toLowerCase();
  // On /exchanges we intentionally ignore generic `cat` query param,
  // because legacy links like ?cat=food can hide all exchanges.
  if (city) {
    out = out.filter((b) => String(b?.city || "").toLowerCase().includes(city));
  }
  if (q) {
    out = out.filter((b) => {
      const blob = `${b?.name_fa || ""} ${b?.category || ""} ${b?.listing_title || ""} ${b?.address || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }
  return out;
}

const EXCHANGE_CITY_LABELS = {
  london: "لندن",
  manchester: "منچستر",
  birmingham: "برمنگام",
  glasgow: "گلاسگو",
};
const BEST_RATE_TAG_SRC = "/images/exchange-best-tag.png?v=20260408-1";

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

function ExchangeAdBanner({ banner, onBannerClick }) {
  const hasImage = !!banner?.image_url;
  const hasAdsense = !hasImage && !!banner?.adsense_code;
  if (!hasImage && !hasAdsense) return null;

  if (hasAdsense) {
    return (
      <div className="exchanges-app__ad-banner exchanges-app__ad-banner--adsense" aria-label="آگهی">
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
  const [showCalcFab, setShowCalcFab] = useState(false);
  const PAGE_SIZE = 9;

  useEffect(() => {
    const onScroll = () => setShowCalcFab(window.scrollY > 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiGet("/api/businesses?slim=1")
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
    <>
      <style>{`
        .exchanges-hero { background: linear-gradient(135deg,#0c0820 0%,#1e0a4e 45%,#0c1830 100%); padding: 3.5rem 1.5rem 3rem; text-align: center; }
        .exchanges-hero__inner { max-width: 700px; margin: 0 auto; }
        .exchanges-hero__title { color: #fff; font-size: clamp(1.7rem,4vw,2.6rem); margin: 0 0 0.85rem; font-weight: 800; }
        .exchanges-hero__sub { color: rgba(255,255,255,0.72); font-size: 1.02rem; line-height: 1.75; margin: 0 0 2rem; }
        .exchanges-hero__actions { display: flex; gap: 0.85rem; justify-content: center; flex-wrap: wrap; }
        .exchanges-hero__btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.72rem 1.6rem; border-radius: 8px; font-size: 0.95rem; font-weight: 700; cursor: pointer; border: none; font-family: inherit; background: linear-gradient(135deg,#7c3aed,#5c1f6e); color: #fff; transition: transform .15s, box-shadow .15s; }
        .exchanges-hero__btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(124,58,237,0.4); }
        .exchanges-hero__btn--outline { background: transparent; border: 2px solid rgba(255,255,255,0.38); color: #fff; }
        .exchanges-hero__btn--outline:hover { background: rgba(255,255,255,0.1); box-shadow: none; transform: none; }
        .exchanges-app__banner-row { display: grid; grid-template-columns: repeat(3,1fr); gap: var(--space-sm); margin-bottom: var(--space-sm); }
        .exchanges-app__card-row { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,300px),1fr)); gap: var(--space-md); }
        .exchanges-app__card-slot { display: flex; flex-direction: column; gap: var(--space-sm); }
        .exchanges-app__mobile-ad { display: none; }
        .exchanges-calc-fab { display: none; }
        @media(max-width:768px){
          .exchanges-app__banner-row { display: none; }
          .exchanges-app__card-row { grid-template-columns: 1fr; }
          .exchanges-app__mobile-ad { display: block; }
          .exchanges-calc-fab {
            display: flex; align-items: center; gap: 0.55rem;
            position: fixed; bottom: 1.25rem; left: 50%; transform: translateX(-50%) translateY(90px);
            z-index: 200;
            background: linear-gradient(135deg,#7c3aed,#5c1f6e);
            color: #fff; border: none; border-radius: 50px;
            padding: 0.78rem 1.6rem; font-size: 0.97rem; font-weight: 700;
            font-family: inherit; cursor: pointer; white-space: nowrap;
            box-shadow: 0 6px 24px rgba(92,31,110,0.55);
            transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
          }
          .exchanges-calc-fab--visible {
            transform: translateX(-50%) translateY(0);
          }
          .exchanges-calc-fab:hover { box-shadow: 0 8px 30px rgba(92,31,110,0.7); }
        }
      `}</style>

      {/* Hero */}
      <div className="exchanges-hero">
        <div className="exchanges-hero__inner">
          <h1 id="exchanges-title" className="exchanges-hero__title">صرافی‌ها و نرخ ارز</h1>
          <p className="exchanges-hero__sub">مقایسه نرخ‌های ارز و بهترین صرافی‌های ایرانی در بریتانیا. بهترین نرخ خرید و فروش را در یک نگاه ببینید.</p>
          <div className="exchanges-hero__actions">
            <button className="exchanges-hero__btn" onClick={() => { setCalcModalOpen(false); setBestRatesSheetOpen(true); }}>
              <i className="fa-solid fa-chart-line" aria-hidden="true" /> مقایسه بهترین نرخ‌ها
            </button>
            <button className="exchanges-hero__btn exchanges-hero__btn--outline" onClick={() => { setBestRatesSheetOpen(false); setCalcModalOpen(true); }}>
              <i className="fa-solid fa-calculator" aria-hidden="true" /> ماشین‌حساب ارز
            </button>
          </div>
        </div>
      </div>

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

{!loading && !err && (bestSellPick || bestBuyPick) ? (
          <div className="exchanges-app__hero">
            <aside
              id="exchange-best-rates-section"
              className="exchanges-app__best-widget-shell"
              aria-label="بهترین نرخ در فهرست فعلی"
            >
              <img className="exchanges-app__best-widget-tag" src={BEST_RATE_TAG_SRC} alt="" aria-hidden="true" loading="lazy" decoding="async" />
              <div className="exchanges-app__best-widget-body exchanges-app__best-widget-body--dual">
                {bestTitlePick ? (
                  <Link className="exchanges-app__best-widget-title-logo-link" to={`/business?slug=${encodeURIComponent(bestTitlePick.business.slug)}`} aria-label={`مشاهده صرافی: ${bestTitlePick.business.name_fa || "صرافی"}`}>
                    {(bestTitlePick.business.cover_image_url || "").trim() ? (
                      <img className="exchanges-app__best-widget-title-logo" src={bestTitlePick.business.cover_image_url} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span className="exchanges-app__best-widget-title-logo exchanges-app__best-widget-title-logo--fallback" aria-hidden>{String(bestTitlePick.business.name_fa || "E").trim().charAt(0)}</span>
                    )}
                  </Link>
                ) : null}
                <div className="exchanges-app__best-widget-dual">
                  {bestSellPick ? (
                    <Link className="exchanges-app__best-side exchanges-app__best-side--sell" to={`/business?slug=${encodeURIComponent(bestSellPick.business.slug)}`} aria-label={`بهترین نرخ فروش: ${bestSellPick.business.name_fa || "صرافی"}`}>
                      <span className="exchanges-app__best-side-label"><i className="fa-solid fa-arrow-up-right-dots exchanges-app__best-side-ico" aria-hidden="true" />فروش</span>
                      <span className="exchanges-app__best-side-ccy" dir="ltr">{widgetCurrencyCode}</span>
                      <span className="exchanges-app__best-side-rate" dir="ltr">{formatExchangeRateToman(bestSellPick.raw)}</span>
                    </Link>
                  ) : (
                    <span className="exchanges-app__best-side exchanges-app__best-side--sell"><span className="exchanges-app__best-side-label"><i className="fa-solid fa-arrow-up-right-dots exchanges-app__best-side-ico" aria-hidden="true" />فروش</span><span className="exchanges-app__best-side-ccy" dir="ltr">{widgetCurrencyCode}</span><span className="exchanges-app__best-side-rate" dir="ltr">—</span></span>
                  )}
                  {bestBuyPick ? (
                    <Link className="exchanges-app__best-side exchanges-app__best-side--buy" to={`/business?slug=${encodeURIComponent(bestBuyPick.business.slug)}`} aria-label={`بهترین نرخ خرید: ${bestBuyPick.business.name_fa || "صرافی"}`}>
                      <span className="exchanges-app__best-side-label"><i className="fa-solid fa-arrow-down-wide-short exchanges-app__best-side-ico" aria-hidden="true" />خرید</span>
                      <span className="exchanges-app__best-side-ccy" dir="ltr">{widgetCurrencyCode}</span>
                      <span className="exchanges-app__best-side-rate" dir="ltr">{formatExchangeRateToman(bestBuyPick.raw)}</span>
                    </Link>
                  ) : (
                    <span className="exchanges-app__best-side exchanges-app__best-side--buy"><span className="exchanges-app__best-side-label"><i className="fa-solid fa-arrow-down-wide-short exchanges-app__best-side-ico" aria-hidden="true" />خرید</span><span className="exchanges-app__best-side-ccy" dir="ltr">{widgetCurrencyCode}</span><span className="exchanges-app__best-side-rate" dir="ltr">—</span></span>
                  )}
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        <div id="exchange-list-section" className="exchanges-app__body">
          {err ? <p className="listings-error exchanges-app__list-err">{err}</p> : null}

          {loading ? (
            <div className="exchanges-app__preloader" aria-busy="true" aria-label="در حال بارگذاری صرافی‌ها">
              <div className="exchanges-app__preloader-dots" aria-hidden><span /><span /><span /></div>
              <p>در حال بارگذاری لیست صرافی‌ها…</p>
            </div>
          ) : filtered.length === 0 && !err && rows.length === 0 ? (
            <div className="listings-empty exchanges-app__empty"><p>هنوز آگهی‌ای در سایت ثبت نشده است.</p></div>
          ) : filtered.length === 0 && !err ? (
            <div className="listings-empty exchanges-app__empty"><p>صرافی‌ای با این فیلتر پیدا نشد.</p><p><Link to="/listings">لیست عمومی</Link></p></div>
          ) : (
            <div className="exchanges-app__list">
              {!loading && !err && topBanners.length > 0 && (
                <div className="exchanges-app__banner-row">
                  {Array.from({ length: 3 }, (_, j) => topBanners[j % topBanners.length]).map((b, j) => (
                    <div key={`top-${b.id}-${j}`} className="exchanges-app__ad-banner-wrap">
                      <ExchangeAdBanner banner={b} onBannerClick={() => trackBannerClick(b.id)} />
                    </div>
                  ))}
                </div>
              )}
              {(() => {
                const CHUNK = 3;
                const result = [];
                for (let i = 0; i < pagedRows.length; i += CHUNK) {
                  const cardChunk = pagedRows.slice(i, i + CHUNK);
                  if (betweenBanners.length > 0) {
                    result.push(
                      <div key={`banners-${i}`} className="exchanges-app__banner-row">
                        {Array.from({ length: 3 }, (_, j) => betweenBanners[(i + j) % betweenBanners.length]).map((b, j) => (
                          <div key={`between-${b.id}-${i}-${j}`} className="exchanges-app__ad-banner-wrap">
                            <ExchangeAdBanner banner={b} onBannerClick={() => trackBannerClick(b.id)} />
                          </div>
                        ))}
                      </div>
                    );
                  }
                  result.push(
                    <div key={`cards-${i}`} className="exchanges-app__card-row">
                      {cardChunk.map((b, j) => (
                        <div key={b.slug} className="exchanges-app__card-slot">
                          <div className="exchanges-app__card">
                            <ListingCard b={b} titleHeading="h2" variant="exchange" />
                          </div>
                          {betweenBanners.length > 0 && (
                            <div className="exchanges-app__mobile-ad">
                              <ExchangeAdBanner
                                banner={betweenBanners[(i + j) % betweenBanners.length]}
                                onBannerClick={() => trackBannerClick(betweenBanners[(i + j) % betweenBanners.length].id)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }
                return result;
              })()}
            </div>
          )}
          {!loading && !err && filtered.length > PAGE_SIZE && (
            <nav className="exchanges-app__pagination-bar" aria-label="صفحه‌بندی">
              <button type="button" className="exchanges-app__page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} aria-label="صفحه قبلی">
                <i className="fa-solid fa-chevron-right" aria-hidden="true" /><span>قبلی</span>
              </button>
              <div className="exchanges-app__page-indicator">
                <span className="exchanges-app__page-indicator-label">صفحه</span>
                <span className="exchanges-app__page-indicator-num">{faDigits(safePage)}</span>
                <span className="exchanges-app__page-indicator-sep" aria-hidden="true">/</span>
                <span className="exchanges-app__page-indicator-total">{faDigits(totalPages)}</span>
              </div>
              <button type="button" className="exchanges-app__page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} aria-label="صفحه بعدی">
                <span>بعدی</span><i className="fa-solid fa-chevron-left" aria-hidden="true" />
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

      <button
        type="button"
        className={`exchanges-calc-fab${showCalcFab ? " exchanges-calc-fab--visible" : ""}`}
        onClick={() => { setBestRatesSheetOpen(false); setCalcModalOpen(true); }}
        aria-label="باز کردن ماشین‌حساب ارز"
      >
        <i className="fa-solid fa-calculator" aria-hidden="true" />
        ماشین‌حساب ارز
      </button>
    </>
  );
}
