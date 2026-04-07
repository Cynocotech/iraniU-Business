import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiGet } from "../api.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import {
  averageExchangeRatesFromBusinesses,
  formatExchangeRateToman,
  isExchangeBusiness,
  pickBestRateExchangeInList,
} from "../lib/exchangeRates.js";

export default function ExchangeBestRatesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiGet("/api/businesses")
      .then((data) => setRows(Array.isArray(data) ? data.filter(isExchangeBusiness) : []))
      .catch(() => setErr("خطا در بارگذاری نرخ‌ها"))
      .finally(() => setLoading(false));
  }, []);

  const averagedCurrencies = useMemo(() => averageExchangeRatesFromBusinesses(rows), [rows]);
  const bestRows = useMemo(() => {
    return averagedCurrencies
      .map((r) => {
        const bestBuy = pickBestRateExchangeInList(rows, r.code, "buy");
        const bestSell = pickBestRateExchangeInList(rows, r.code, "sell");
        return { code: r.code, name: r.name, flag: r.flag, bestBuy, bestSell };
      })
      .filter((r) => r.bestBuy || r.bestSell);
  }, [averagedCurrencies, rows]);

  return (
    <section className="section container exchanges-best-page" aria-labelledby="best-rates-title">
      <Seo
        title="بهترین نرخ صرافی‌ها — ایرانیو"
        description="مقایسه بهترین نرخ خرید و فروش ارز در صرافی‌های ثبت‌شده در ایرانیو."
      />
      <h1 id="best-rates-title">بهترین نرخ‌ها</h1>
      <p className="field-hint" style={{ marginBottom: "0.85rem" }}>
        بهترین نرخ خرید/فروش هر ارز از میان صرافی‌های همین فهرست محاسبه می‌شود.
      </p>

      {loading ? <p className="field-hint">در حال بارگذاری…</p> : null}
      {!loading && err ? <p className="field-hint">{err}</p> : null}

      {!loading && !err && bestRows.length === 0 ? (
        <p className="field-hint">برای نمایش بهترین نرخ‌ها هنوز دادهٔ کافی ثبت نشده است.</p>
      ) : null}

      {!loading && !err && bestRows.length > 0 ? (
        <div className="exchanges-best-page__grid">
          {bestRows.map((row) => (
            <article key={row.code} className="exchanges-best-page__card">
              <h2 className="exchanges-best-page__currency">
                <span aria-hidden>{row.flag || "🏳️"}</span>
                <span dir="ltr">{row.code}</span>
                {row.name ? <small>{row.name}</small> : null}
              </h2>

              <div className="exchanges-best-page__line">
                <strong>بهترین خرید</strong>
                {row.bestBuy ? (
                  <>
                    <span dir="ltr">{formatExchangeRateToman(row.bestBuy.raw)}</span>
                    <Link to={`/business?slug=${encodeURIComponent(row.bestBuy.business.slug)}`}>
                      {row.bestBuy.business.name_fa}
                    </Link>
                  </>
                ) : (
                  <span>ثبت نشده</span>
                )}
              </div>

              <div className="exchanges-best-page__line">
                <strong>بهترین فروش</strong>
                {row.bestSell ? (
                  <>
                    <span dir="ltr">{formatExchangeRateToman(row.bestSell.raw)}</span>
                    <Link to={`/business?slug=${encodeURIComponent(row.bestSell.business.slug)}`}>
                      {row.bestSell.business.name_fa}
                    </Link>
                  </>
                ) : (
                  <span>ثبت نشده</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
