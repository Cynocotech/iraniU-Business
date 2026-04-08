import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  averageExchangeRatesFromBusinesses,
  formatExchangeRateToman,
  pickBestRateExchangeInList,
} from "../lib/exchangeRates.js";

/**
 * مقایسه نرخ و بهترین‌ها — bottom sheet هم‌سبک ماشین‌حساب، بر اساس همان فهرست فیلترشده.
 */
export default function ExchangeBestRatesSheet({ open, onClose, filtered, loading, err }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const averagedCurrencies = useMemo(() => averageExchangeRatesFromBusinesses(filtered), [filtered]);

  const bestRows = useMemo(() => {
    return averagedCurrencies
      .map((r) => {
        const bestBuy = pickBestRateExchangeInList(filtered, r.code, "buy");
        const bestSell = pickBestRateExchangeInList(filtered, r.code, "sell");
        return { code: r.code, name: r.name, flag: r.flag, bestBuy, bestSell };
      })
      .filter((r) => r.bestBuy || r.bestSell);
  }, [averagedCurrencies, filtered]);

  if (!open) return null;

  return (
    <div className="exchange-calc-modal exchange-calc-modal--sheet exchange-best-rates-sheet" role="presentation">
      <div className="exchange-calc-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="exchange-calc-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exchange-best-rates-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="exchange-calc-modal__handle-bar" aria-hidden="true">
          <span className="exchange-calc-modal__handle" />
        </div>
        <div className="exchange-calc-modal__header">
          <h2 id="exchange-best-rates-sheet-title" className="exchange-calc-modal__heading">
            مقایسه نرخ و بهترین‌ها
          </h2>
          <button type="button" className="exchange-calc-modal__close" onClick={onClose} aria-label="بستن">
            ×
          </button>
        </div>
        <p className="exchange-calc-modal__lead field-hint">
          بهترین نرخ خرید و فروش هر ارز از میان صرافی‌های همین فهرست (با فیلترهای فعلی).
        </p>

        <div className="exchange-calc-modal__scroll">
          {loading ? (
            <div className="exchanges-app__preloader" aria-busy="true">
              <div className="exchanges-app__preloader-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p>در حال بارگذاری…</p>
            </div>
          ) : err ? (
            <p className="listings-error">{err}</p>
          ) : bestRows.length === 0 ? (
            <p className="field-hint">برای نمایش بهترین نرخ‌ها هنوز دادهٔ کافی در این فهرست نیست.</p>
          ) : (
            <div className="exchanges-best-page__grid exchange-best-rates-sheet__grid">
              {bestRows.map((row) => (
                <article key={row.code} className="exchanges-best-page__card">
                  <h3 className="exchanges-best-page__currency">
                    <span aria-hidden="true">{row.flag || "🏳️"}</span>
                    <span dir="ltr">{row.code}</span>
                    {row.name ? <small>{row.name}</small> : null}
                  </h3>

                  <div className="exchanges-best-page__line">
                    <strong>بهترین خرید</strong>
                    {row.bestBuy ? (
                      <>
                        <span dir="ltr">{formatExchangeRateToman(row.bestBuy.raw)}</span>
                        <Link to={`/business?slug=${encodeURIComponent(row.bestBuy.business.slug)}`} onClick={onClose}>
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
                        <Link to={`/business?slug=${encodeURIComponent(row.bestSell.business.slug)}`} onClick={onClose}>
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
          )}

          {!loading && !err ? (
            <p className="exchange-best-rates-sheet__footer-hint field-hint">
              <Link to="/exchanges/best-rates" onClick={onClose}>
                باز کردن صفحهٔ کامل بهترین نرخ‌ها
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
