import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import ExchangeInlineCalc from "../components/ExchangeInlineCalc.jsx";
import { apiGet } from "../api.js";
import {
  averageExchangeRatesFromBusinesses,
  businessHasExchangeRatesData,
  getCalculatorRateOrDemo,
  isExchangeBusiness,
  parseExchangeRatesJson,
} from "../lib/exchangeRates.js";

export default function ExchangeCalculatorPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exchangeMode, setExchangeMode] = useState("buy");
  const [exchangeAmount, setExchangeAmount] = useState("1");
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState("USD");

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiGet("/api/businesses")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setErr("خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => (Array.isArray(rows) ? rows.filter(isExchangeBusiness) : []), [rows]);

  const ratesForCalc = useMemo(() => {
    const averaged = averageExchangeRatesFromBusinesses(filtered);
    if (averaged.length > 0) return averaged;
    if (!filtered.length) return parseExchangeRatesJson(null);
    return parseExchangeRatesJson(filtered[0]?.exchange_rates_json);
  }, [filtered]);

  const selectedRate =
    ratesForCalc.find((r) => r.code === selectedCurrencyCode) || ratesForCalc[0] || null;

  const { rateNum: selectedRateNum, isDemo: rateIsDemo } = useMemo(
    () => getCalculatorRateOrDemo(selectedRate, exchangeMode),
    [selectedRate, exchangeMode]
  );

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

  const calcHint = useMemo(() => {
    const withData = filtered.filter(businessHasExchangeRatesData);
    if (withData.length >= 2) {
      return `میانگین نرخ از ${withData.length} صرافی؛ برای نرخ قطعی همان لحظه با صرافی تماس بگیرید یا صفحهٔ آگهی را ببینید.`;
    }
    if (withData.length === 1) {
      const name = (withData[0].name_fa || withData[0].slug || "").trim() || "صرافی";
      return `فقط این صرافی در فهرست نرخ ثبت کرده — همان نرخ (میانگین تک‌صرافی). برای نرخ قطعی صفحهٔ «${name}» را ببینید.`;
    }
    if (filtered.length) {
      return "هیچ صرافی در فهرست فعلی نرخ ثبت نکرده — اعداد نمونه‌ای برای نمایش ماشین‌حساب است؛ برای نرخ دقیق صفحهٔ آگهی را باز کنید.";
    }
    return "پس از ثبت نرخ توسط صرافی‌ها، میانگین واقعی اینجا نمایش داده می‌شود.";
  }, [filtered]);

  return (
    <section
      className="section container exchanges-app exchange-calc-page listings-page listings-page--plain"
      aria-labelledby="exchange-calc-page-title"
    >
      <Seo
        title="ماشین‌حساب نرخ ارز — ایرانیو"
        description="محاسبه تقریبی بر اساس میانگین نرخ‌های ثبت‌شده در ایرانیو."
      />
      <h1 id="exchange-calc-page-title" className="exchange-calc-page__title">
        ماشین‌حساب نرخ ارز
      </h1>
      <p className="field-hint exchange-calc-page__lead">
        بر اساس میانگین نرخ‌های ثبت‌شده توسط صرافی‌های فعال در سایت. برای معامل واقعی حتماً با صرافی تماس بگیرید.
      </p>
      <p className="exchange-calc-page__nav-hint field-hint">
        <Link to="/exchanges">← بازگشت به فهرست صرافی‌ها</Link>
        {" · "}
        <Link to="/exchanges/best-rates">مقایسه بهترین نرخ‌ها</Link>
      </p>

      {loading ? (
        <div className="exchanges-app__preloader" aria-busy="true">
          <div className="exchanges-app__preloader-dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <p>در حال بارگذاری…</p>
        </div>
      ) : err ? (
        <p className="listings-error">{err}</p>
      ) : !selectedRate ? (
        <p className="field-hint">داده‌ای برای محاسبه نیست.</p>
      ) : (
        <>
          <section className="exchange-calc-page__panel dashboard-panel" aria-label="انتخاب ارز">
            <p className="exchanges-app__currency-mini-label" id="ex-calc-curr-label">
              ارز
            </p>
            <div className="exchanges-app__currency-strip" role="listbox" aria-labelledby="ex-calc-curr-label">
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
            idPrefix="ex-calc-page"
            hint={calcHint}
            exchangeMode={exchangeMode}
            onExchangeModeChange={setExchangeMode}
            exchangeAmount={exchangeAmount}
            onExchangeAmountChange={setExchangeAmount}
            exchangeResult={exchangeResult}
            exchangeAmountNum={exchangeAmountNum}
            selectedRateNum={selectedRateNum}
            rateIsDemo={rateIsDemo}
          />
        </>
      )}

    </section>
  );
}
