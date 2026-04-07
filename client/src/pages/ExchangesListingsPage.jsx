import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ListingCard from "../components/ListingCard.jsx";
import Seo from "../components/Seo.jsx";
import ExchangeInlineCalc from "../components/ExchangeInlineCalc.jsx";
import { apiGet } from "../api.js";
import { getListingsLocationFromForm } from "../lib/listingsSearchNavigate.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import { filterListingsByCategoryParams } from "../lib/categoryFilters.js";
import {
  averageExchangeRatesFromBusinesses,
  businessHasExchangeRatesData,
  formatExchangeRateToman,
  getEffectiveRateRaw,
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

export default function ExchangesListingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [exchangeMode, setExchangeMode] = useState("buy");
  const [exchangeAmount, setExchangeAmount] = useState("1");
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState("USD");
  const [calcSheetOpen, setCalcSheetOpen] = useState(false);
  const PAGE_SIZE = 9;

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiGet("/api/businesses")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setErr("خطا در بارگذاری"))
      .finally(() => setLoading(false));
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
  const selectedRateRaw = getEffectiveRateRaw(selectedRate, exchangeMode);
  const selectedRateNum = Number.parseFloat(String(selectedRateRaw || "").replace(",", "."));
  const exchangeAmountNum = Number.parseFloat(String(exchangeAmount || "").replace(",", "."));
  const exchangeResult =
    Number.isFinite(selectedRateNum) && Number.isFinite(exchangeAmountNum)
      ? selectedRateNum * exchangeAmountNum
      : null;

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

  useEffect(() => {
    if (!calcSheetOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setCalcSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [calcSheetOpen]);

  const qDefault = searchParams.get("q") || "";
  const cityDefault = searchParams.get("city") || "";

  const hasActiveFilters = Boolean(qDefault.trim() || cityDefault);

  const bestRatePick = useMemo(
    () => pickBestRateExchangeInList(filtered, selectedCurrencyCode, exchangeMode),
    [filtered, selectedCurrencyCode, exchangeMode]
  );

  const calcHint = useMemo(() => {
    const withData = filtered.filter(businessHasExchangeRatesData);
    if (withData.length >= 2) {
      return `میانگین نرخ از ${withData.length} صرافی در همین فهرست؛ برای نرخ قطعی همان لحظه با صرافی تماس بگیرید یا صفحهٔ آگهی را ببینید.`;
    }
    if (withData.length === 1) {
      const name = (withData[0].name_fa || withData[0].slug || "").trim() || "صرافی";
      return `فقط این صرافی در فهرست نرخ ثبت کرده — همان نرخ (میانگین تک‌صرافی). برای نرخ قطعی صفحهٔ «${name}» را ببینید.`;
    }
    if (filtered.length) {
      return "هیچ صرافی در این فهرست نرخ ثبت نکرده — نمایش نمونه؛ برای نرخ دقیق صفحهٔ آگهی را باز کنید.";
    }
    return "پس از نمایش صرافی‌ها، میانگین از نرخ‌های ثبت‌شده محاسبه می‌شود.";
  }, [filtered]);

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
      <h1 id="exchanges-title" className="visually-hidden">
        {seo.title}
      </h1>

      <nav className="exchanges-app__float-nav" aria-label="ناوبری سریع صرافی‌ها">
        <a className="exchanges-app__float-btn" href="#exchange-list-section">
          لیست صرافی‌ها
        </a>
        <Link className="exchanges-app__float-btn" to="/exchanges/best-rates">
          مقایسه نرخ و بهترین‌ها
        </Link>
      </nav>

      <div className="exchanges-app__hero">
        <div className="exchanges-app__filter-card">
          <div className="exchanges-app__filter-card-header">
            <span className="exchanges-app__filter-card-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="exchanges-app__filter-card-headlines">
              <p className="exchanges-app__filter-card-kicker">فیلتر نتایج</p>
              <p className="exchanges-app__filter-card-title exchanges-app__filter-card-title--compact">
                جستجو بر اساس نام و شهر
              </p>
            </div>
          </div>

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
              <button type="submit" className="btn btn--primary exchanges-app__submit">
                اعمال فیلتر
              </button>
            </div>
          </form>
        </div>

        {!loading && !err && bestRatePick && selectedRate ? (
          <aside
            id="exchange-best-rates-section"
            className="exchanges-app__best-widget-shell"
            aria-label="بهترین نرخ در فهرست فعلی"
          >
            <div className="exchanges-app__best-widget-body">
              <p className="exchanges-app__best-widget-kicker">بهترین نرخ در این فهرست</p>
              <p className="exchanges-app__best-widget-meta">
                {exchangeMode === "buy" ? "خرید" : "فروش"} ·{" "}
                <span dir="ltr" className="exchanges-app__best-widget-ccy">
                  {selectedCurrencyCode}
                </span>
              </p>
              <div className="exchanges-app__best-widget-head">
                {(bestRatePick.business.cover_image_url || "").trim() ? (
                  <img
                    className="exchanges-app__best-widget-logo"
                    src={bestRatePick.business.cover_image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="exchanges-app__best-widget-logo exchanges-app__best-widget-logo--fallback" aria-hidden>
                    {String(bestRatePick.business.name_fa || "E").trim().charAt(0)}
                  </span>
                )}
                <p className="exchanges-app__best-widget-name">{bestRatePick.business.name_fa}</p>
              </div>
              <p className="exchanges-app__best-widget-rate" dir="ltr">
                {formatExchangeRateToman(bestRatePick.raw)}
              </p>
              <Link
                className="btn btn--ghost exchanges-app__best-widget-link"
                to={`/business?slug=${encodeURIComponent(bestRatePick.business.slug)}`}
              >
                مشاهدهٔ صرافی
              </Link>
            </div>
          </aside>
        ) : null}
      </div>

      <div id="exchange-list-section" className="exchanges-app__body">
        <div className="listings-toolbar exchanges-app__toolbar">
          <p className="listings-toolbar__status">
            {loading ? (
              <span className="listings-toolbar__loading">در حال بارگذاری…</span>
            ) : err ? (
              <span className="listings-error">{err}</span>
            ) : (
              <>
                <span className="listings-toolbar__count">{filtered.length}</span> صرافی
                {filtered.length !== rows.length ? (
                  <span className="field-hint" style={{ marginInlineStart: "0.35rem" }}>
                    (از {rows.length} آگهی)
                  </span>
                ) : null}
              </>
            )}
          </p>
        </div>

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
            {pagedRows.map((b) => (
              <div key={b.slug} className="exchanges-app__card">
                <ListingCard b={b} titleHeading="h2" variant="exchange" />
              </div>
            ))}
          </div>
        )}
        {!loading && !err && filtered.length > PAGE_SIZE && (
          <nav className="listings-pagination exchanges-app__pagination" aria-label="صفحه‌بندی">
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

      {!loading && !err && selectedRate ? (
        <>
          <button
            type="button"
            className="exchanges-app__calc-fab"
            onClick={() => setCalcSheetOpen(true)}
            aria-label="باز کردن ماشین‌حساب لحظه‌ای"
          >
            ماشین‌حساب لحظه‌ای
          </button>

          {calcSheetOpen ? (
            <div
              className="exchanges-app__sheet-overlay exchanges-app__sheet-overlay--wide-calc"
              onClick={() => setCalcSheetOpen(false)}
              role="presentation"
            >
              <section
                className="exchanges-app__sheet exchanges-app__sheet--wide"
                role="dialog"
                aria-modal="true"
                aria-label="ماشین‌حساب لحظه‌ای"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="exchanges-app__sheet-head">
                  <h2>ماشین‌حساب لحظه‌ای</h2>
                  <button type="button" className="btn btn--ghost" onClick={() => setCalcSheetOpen(false)}>
                    بستن
                  </button>
                </div>
                <section className="exchanges-app__currency-mini exchanges-app__currency-mini--sheet" aria-labelledby="ex-list-curr-label-sheet">
                  <p className="exchanges-app__currency-mini-label" id="ex-list-curr-label-sheet">
                    ارز برای محاسبه
                  </p>
                  <div className="exchanges-app__currency-strip" role="listbox" aria-labelledby="ex-list-curr-label-sheet">
                    {ratesForCalc.map((row) => {
                      const selected = selectedCurrencyCode === row.code;
                      return (
                        <button
                          key={row.code}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={`exchanges-app__currency-chip${selected ? " exchanges-app__currency-chip--selected" : ""}`}
                          onClick={() => setSelectedCurrencyCode(row.code)}
                        >
                          <span className="exchanges-app__currency-chip-flag" aria-hidden>
                            {row.flag || "🏳️"}
                          </span>
                          <span className="exchanges-app__currency-chip-body">
                            <span className="exchanges-app__currency-chip-code" dir="ltr">
                              {row.code}
                            </span>
                            {row.name ? <span className="exchanges-app__currency-chip-name">{row.name}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <ExchangeInlineCalc
                  idPrefix="ex-list-sheet"
                  hint={calcHint}
                  exchangeMode={exchangeMode}
                  onExchangeModeChange={setExchangeMode}
                  exchangeAmount={exchangeAmount}
                  onExchangeAmountChange={setExchangeAmount}
                  exchangeResult={exchangeResult}
                  exchangeAmountNum={exchangeAmountNum}
                  selectedRateNum={selectedRateNum}
                />
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
