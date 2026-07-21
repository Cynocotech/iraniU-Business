import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiGet } from "../api.js";
import {
  averageExchangeRatesFromBusinesses,
  formatExchangeRateToman,
  isExchangeBusiness,
  pickBestRateExchangeInList,
} from "../lib/exchangeRates.js";

const STYLES = `
  .best-rates-page {
    min-height: calc(100vh - 68px);
    background: linear-gradient(160deg, #020518 0%, #030728 60%, #070c2a 100%);
  }
  .best-rates-hero {
    padding: 3.2rem 1.5rem 2.8rem;
    text-align: center;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .best-rates-hero__eyebrow {
    display: inline-flex; align-items: center; gap: 0.4rem;
    color: rgba(167,139,250,0.9); font-size: 0.82rem; font-weight: 700;
    letter-spacing: 0.05em; text-transform: uppercase;
    background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.3);
    border-radius: 50px; padding: 0.28rem 0.85rem; margin-bottom: 1rem;
  }
  .best-rates-hero__title {
    color: #fff; font-size: clamp(1.7rem,4vw,2.5rem); font-weight: 800;
    margin: 0 0 0.7rem; line-height: 1.2;
  }
  .best-rates-hero__sub {
    color: rgba(255,255,255,0.55); font-size: 0.98rem; line-height: 1.65;
    margin: 0 0 1.6rem; max-width: 500px; margin-inline: auto;
  }
  .best-rates-hero__nav {
    display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;
  }
  .best-rates-hero__nav a {
    color: rgba(255,255,255,0.5); font-size: 0.85rem; text-decoration: none;
    padding: 0.4rem 0.9rem; border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.12);
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .best-rates-hero__nav a:hover {
    color: #fff; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.06);
  }

  .best-rates-body {
    max-width: 1100px; margin: 0 auto; padding: 2.5rem 1.25rem 5rem;
  }
  .best-rates-section-label {
    color: rgba(255,255,255,0.35); font-size: 0.78rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    margin: 0 0 1.25rem; display: flex; align-items: center; gap: 0.6rem;
  }
  .best-rates-section-label::after {
    content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.08);
  }

  .best-rates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
    gap: 1.1rem;
  }

  .best-rates-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    overflow: hidden;
    transition: border-color 0.2s, background 0.2s;
  }
  .best-rates-card:hover {
    border-color: rgba(124,58,237,0.4);
    background: rgba(124,58,237,0.06);
  }

  .best-rates-card__head {
    display: flex; align-items: center; gap: 0.85rem;
    padding: 1rem 1.1rem 0.85rem;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .best-rates-card__flag {
    font-size: 2rem; line-height: 1; flex-shrink: 0;
  }
  .best-rates-card__code {
    color: #fff; font-size: 1.3rem; font-weight: 800; display: block;
    direction: ltr; text-align: left;
  }
  .best-rates-card__name {
    color: rgba(255,255,255,0.45); font-size: 0.8rem; display: block; margin-top: 0.1rem;
  }

  .best-rates-card__body {
    display: grid; grid-template-columns: 1fr 1fr;
  }
  .best-rates-card__side {
    padding: 0.9rem 1rem;
  }
  .best-rates-card__side + .best-rates-card__side {
    border-right: 1px solid rgba(255,255,255,0.07);
  }
  .best-rates-card__side-label {
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em;
    margin: 0 0 0.45rem; display: flex; align-items: center; gap: 0.35rem;
  }
  .best-rates-card__side-label--buy { color: #34d399; }
  .best-rates-card__side-label--sell { color: #60a5fa; }
  .best-rates-card__dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }
  .best-rates-card__dot--buy { background: #34d399; }
  .best-rates-card__dot--sell { background: #60a5fa; }

  .best-rates-card__rate {
    color: #fff; font-size: 1.05rem; font-weight: 700;
    direction: ltr; display: block; margin-bottom: 0.3rem;
  }
  .best-rates-card__rate--empty { color: rgba(255,255,255,0.25); font-weight: 400; }
  .best-rates-card__unit {
    color: rgba(255,255,255,0.35); font-size: 0.72rem; display: block; margin-bottom: 0.45rem;
  }
  .best-rates-card__exchange-link {
    display: inline-block;
    color: rgba(167,139,250,0.8); font-size: 0.75rem; text-decoration: none;
    background: rgba(124,58,237,0.15); border-radius: 4px;
    padding: 0.18rem 0.5rem; transition: color 0.15s, background 0.15s;
    max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .best-rates-card__exchange-link:hover { color: #c4b5fd; background: rgba(124,58,237,0.3); }
  .best-rates-card__no-data {
    color: rgba(255,255,255,0.2); font-size: 0.8rem;
  }

  .best-rates-loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 5rem 1rem; gap: 1rem;
    color: rgba(255,255,255,0.45); font-size: 0.95rem;
  }
  .best-rates-spinner {
    width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.1);
    border-top-color: #7c3aed; border-radius: 50%;
    animation: best-rates-spin 0.8s linear infinite;
  }
  @keyframes best-rates-spin { to { transform: rotate(360deg); } }

  .best-rates-empty {
    text-align: center; padding: 4rem 1rem;
    color: rgba(255,255,255,0.35); font-size: 0.95rem;
  }

  @media (max-width: 480px) {
    .best-rates-hero { padding: 2.2rem 1rem 2rem; }
    .best-rates-body { padding: 1.5rem 0.85rem 4rem; }
    .best-rates-grid { grid-template-columns: 1fr; }
    .best-rates-card__rate { font-size: 0.95rem; }
  }
`;

export default function ExchangeBestRatesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiGet("/api/businesses?slim=1")
      .then((data) => setRows(Array.isArray(data) ? data.filter(isExchangeBusiness) : []))
      .catch(() => setErr("خطا در بارگذاری نرخ‌ها"))
      .finally(() => setLoading(false));
  }, []);

  const averagedCurrencies = useMemo(() => averageExchangeRatesFromBusinesses(rows), [rows]);

  const bestRows = useMemo(() => {
    return averagedCurrencies
      .map((r) => ({
        code: r.code,
        name: r.name,
        flag: r.flag,
        bestBuy: pickBestRateExchangeInList(rows, r.code, "buy"),
        bestSell: pickBestRateExchangeInList(rows, r.code, "sell"),
      }))
      .filter((r) => r.bestBuy || r.bestSell);
  }, [averagedCurrencies, rows]);

  return (
    <>
      <style>{STYLES}</style>
      <Seo
        title="بهترین نرخ صرافی‌ها — ایرانیو"
        description="مقایسه بهترین نرخ خرید و فروش ارز در صرافی‌های ثبت‌شده در ایرانیو."
      />

      <div className="best-rates-page" dir="rtl" lang="fa">
        {/* Hero */}
        <div className="best-rates-hero">
          <div className="best-rates-hero__eyebrow">
            <i className="fa-solid fa-chart-bar" aria-hidden="true" />
            مقایسه نرخ‌ها
          </div>
          <h1 id="best-rates-title" className="best-rates-hero__title">بهترین نرخ‌های ارز</h1>
          <p className="best-rates-hero__sub">
            بهترین نرخ خرید و فروش هر ارز از میان تمام صرافی‌های ایرانیو در بریتانیا
          </p>
          <div className="best-rates-hero__nav">
            <Link to="/exchanges">← صرافی‌ها</Link>
            <Link to="/exchanges/calculator">ماشین‌حساب ارز</Link>
          </div>
        </div>

        {/* Body */}
        <div className="best-rates-body">
          {loading && (
            <div className="best-rates-loading">
              <div className="best-rates-spinner" aria-hidden="true" />
              <span>در حال بارگذاری نرخ‌ها…</span>
            </div>
          )}

          {!loading && err && (
            <div className="best-rates-empty">{err}</div>
          )}

          {!loading && !err && bestRows.length === 0 && (
            <div className="best-rates-empty">
              هنوز داده‌ای برای نمایش بهترین نرخ‌ها ثبت نشده است.
            </div>
          )}

          {!loading && !err && bestRows.length > 0 && (
            <>
              <p className="best-rates-section-label">نرخ‌ها بر اساس آخرین اطلاعات ثبت‌شده توسط صرافی‌ها</p>
              <div className="best-rates-grid">
                {bestRows.map((row) => (
                  <article key={row.code} className="best-rates-card">
                    {/* Currency header */}
                    <div className="best-rates-card__head">
                      <span className="best-rates-card__flag" aria-hidden="true">{row.flag || "🏳️"}</span>
                      <div>
                        <span className="best-rates-card__code" dir="ltr">{row.code}</span>
                        {row.name && <span className="best-rates-card__name">{row.name}</span>}
                      </div>
                    </div>

                    {/* Buy / Sell columns */}
                    <div className="best-rates-card__body">
                      {/* Buy side */}
                      <div className="best-rates-card__side">
                        <p className="best-rates-card__side-label best-rates-card__side-label--buy">
                          <span className="best-rates-card__dot best-rates-card__dot--buy" aria-hidden="true" />
                          خرید
                        </p>
                        {row.bestBuy ? (
                          <>
                            <span className="best-rates-card__rate" dir="ltr">
                              {formatExchangeRateToman(row.bestBuy.raw)}
                            </span>
                            <span className="best-rates-card__unit">تومان</span>
                            <Link
                              className="best-rates-card__exchange-link"
                              to={`/business?slug=${encodeURIComponent(row.bestBuy.business.slug)}`}
                            >
                              {row.bestBuy.business.name_fa || row.bestBuy.business.slug}
                            </Link>
                          </>
                        ) : (
                          <>
                            <span className="best-rates-card__rate best-rates-card__rate--empty">—</span>
                            <span className="best-rates-card__no-data">ثبت نشده</span>
                          </>
                        )}
                      </div>

                      {/* Sell side */}
                      <div className="best-rates-card__side">
                        <p className="best-rates-card__side-label best-rates-card__side-label--sell">
                          <span className="best-rates-card__dot best-rates-card__dot--sell" aria-hidden="true" />
                          فروش
                        </p>
                        {row.bestSell ? (
                          <>
                            <span className="best-rates-card__rate" dir="ltr">
                              {formatExchangeRateToman(row.bestSell.raw)}
                            </span>
                            <span className="best-rates-card__unit">تومان</span>
                            <Link
                              className="best-rates-card__exchange-link"
                              to={`/business?slug=${encodeURIComponent(row.bestSell.business.slug)}`}
                            >
                              {row.bestSell.business.name_fa || row.bestSell.business.slug}
                            </Link>
                          </>
                        ) : (
                          <>
                            <span className="best-rates-card__rate best-rates-card__rate--empty">—</span>
                            <span className="best-rates-card__no-data">ثبت نشده</span>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
