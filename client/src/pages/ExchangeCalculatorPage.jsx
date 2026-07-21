import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiGet } from "../api.js";
import {
  averageExchangeRatesFromBusinesses,
  businessHasExchangeRatesData,
  getCalculatorRateOrDemo,
  isExchangeBusiness,
  parseExchangeRatesJson,
  parseLocalizedNumber,
  formatLocalizedNumberFromRaw,
} from "../lib/exchangeRates.js";

const STYLES = `
  .calc-page {
    min-height: calc(100vh - 68px);
    background: linear-gradient(135deg, #020518 0%, #030728 55%, #070c2a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem 5rem;
  }
  .calc-card {
    width: 100%;
    max-width: 420px;
    background: rgba(2, 7, 40, 0.52);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 20px;
    padding: 2.5rem 2rem 2.8rem;
    font-family: inherit;
  }
  .calc-card__title {
    color: #fff;
    font-size: 1.45rem;
    font-weight: 800;
    margin: 0 0 0.35rem;
    text-align: center;
  }
  .calc-card__sub {
    color: rgba(255,255,255,0.5);
    font-size: 0.85rem;
    margin: 0 0 2rem;
    text-align: center;
  }
  .calc-field-label {
    display: block;
    color: rgba(255,255,255,0.7);
    font-size: 0.82rem;
    margin: 0 0 0.38rem 0;
    text-align: right;
  }
  .calc-input-row {
    display: flex;
    align-items: stretch;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 0.5rem;
    direction: ltr;
  }
  .calc-input-row input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    font-size: 1.18rem;
    padding: 0.72rem 1rem;
    min-width: 0;
    font-family: inherit;
    direction: ltr;
    text-align: left;
  }
  .calc-input-row input::placeholder { color: rgba(255,255,255,0.35); }
  .calc-input-row input[readonly] { cursor: default; color: rgba(255,255,255,0.9); }
  .calc-currency-sel {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0 0.85rem;
    border-left: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.06);
    flex-shrink: 0;
    min-width: 6rem;
    direction: ltr;
  }
  .calc-currency-sel select {
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    font-size: 0.92rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    direction: ltr;
    max-width: 70px;
  }
  .calc-currency-sel select option { background: #0c1a3e; color: #fff; }
  .calc-currency-sel__static {
    font-size: 0.88rem;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    direction: ltr;
    white-space: nowrap;
  }
  .calc-flag { font-size: 1.25rem; line-height: 1; flex-shrink: 0; }
  .calc-swap-wrap {
    display: flex;
    justify-content: center;
    margin: 0.5rem 0 0.85rem;
  }
  .calc-swap-btn {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.1);
    color: #fff;
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, transform 0.3s;
    font-family: inherit;
  }
  .calc-swap-btn:hover {
    background: rgba(255,255,255,0.22);
    transform: rotate(180deg);
  }
  .calc-result-box {
    margin-top: 1.4rem;
    background: rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 1.1rem 1.25rem;
    text-align: center;
    border: 1px solid rgba(255,255,255,0.15);
  }
  .calc-result-box__rate {
    color: rgba(255,255,255,0.6);
    font-size: 0.82rem;
    margin: 0 0 0.35rem;
    direction: ltr;
  }
  .calc-result-box__main {
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
    direction: ltr;
    margin: 0;
  }
  .calc-hint {
    color: rgba(255,255,255,0.42);
    font-size: 0.77rem;
    line-height: 1.55;
    margin: 1rem 0 0;
    text-align: right;
    direction: rtl;
  }
  .calc-demo-badge {
    display: inline-block;
    background: rgba(251,191,36,0.18);
    color: #fbbf24;
    font-size: 0.74rem;
    font-weight: 700;
    border-radius: 6px;
    padding: 0.15rem 0.5rem;
    margin-bottom: 0.5rem;
  }
  .calc-nav {
    text-align: center;
    margin-top: 1.5rem;
  }
  .calc-nav a {
    color: rgba(255,255,255,0.45);
    font-size: 0.8rem;
    text-decoration: none;
    transition: color 0.15s;
  }
  .calc-nav a:hover { color: rgba(255,255,255,0.8); }
  .calc-loading {
    text-align: center;
    color: rgba(255,255,255,0.6);
    padding: 2rem 0;
  }
  @media(max-width:480px){
    .calc-card { padding: 1.75rem 1.25rem 2.25rem; }
    .calc-input-row input { font-size: 1rem; padding: 0.65rem 0.75rem; }
  }
`;

export default function ExchangeCalculatorPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState("USD");
  const [amount, setAmount] = useState("1");
  const [isSwapped, setIsSwapped] = useState(false);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiGet("/api/businesses?slim=1")
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

  useEffect(() => {
    if (!ratesForCalc.length) return;
    if (ratesForCalc.some((r) => r.code === selectedCurrencyCode)) return;
    setSelectedCurrencyCode(ratesForCalc[0].code);
  }, [ratesForCalc, selectedCurrencyCode]);

  // When NOT swapped: foreign → Toman (use buy rate: bureau buys foreign from you)
  // When swapped: Toman → foreign (use sell rate: bureau sells foreign to you)
  const mode = isSwapped ? "sell" : "buy";

  const selectedRate = useMemo(
    () => ratesForCalc.find((r) => r.code === selectedCurrencyCode) || ratesForCalc[0] || null,
    [ratesForCalc, selectedCurrencyCode]
  );

  const { rateNum, raw: rateRaw, isDemo: rateIsDemo } = useMemo(
    () => getCalculatorRateOrDemo(selectedRate, mode),
    [selectedRate, mode]
  );

  const amountNum = parseLocalizedNumber(amount);
  const result = useMemo(() => {
    if (!Number.isFinite(rateNum) || !Number.isFinite(amountNum)) return null;
    return !isSwapped ? rateNum * amountNum : rateNum > 0 ? amountNum / rateNum : null;
  }, [rateNum, amountNum, isSwapped]);

  const resultDisplay = result != null
    ? result.toLocaleString("fa-IR", { maximumFractionDigits: !isSwapped ? 0 : 6 })
    : "—";

  const rateDisplay = formatLocalizedNumberFromRaw(rateRaw || (Number.isFinite(rateNum) ? String(rateNum) : ""), {
    fallback: "—",
    maxFractionDigits: 2,
  });

  const calcHint = useMemo(() => {
    const withData = filtered.filter(businessHasExchangeRatesData);
    if (withData.length >= 2) return `میانگین نرخ از ${withData.length} صرافی؛ برای نرخ قطعی با صرافی تماس بگیرید.`;
    if (withData.length === 1) return `نرخ تک‌صرافی — برای نرخ دقیق صفحهٔ آگهی را باز کنید.`;
    return "نرخ نمونه‌ای؛ پس از ثبت نرخ توسط صرافی‌ها اعداد واقعی نمایش داده می‌شود.";
  }, [filtered]);

  const fromCurrency = !isSwapped ? selectedRate : null;
  const toCurrency = isSwapped ? selectedRate : null;

  return (
    <>
      <style>{STYLES}</style>
      <Seo title="ماشین‌حساب نرخ ارز — ایرانیو" description="محاسبه تقریبی بر اساس میانگین نرخ‌های ثبت‌شده در ایرانیو." />

      <div className="calc-page">
        <div className="calc-card" dir="rtl" lang="fa">
          <h1 className="calc-card__title">ماشین‌حساب نرخ ارز</h1>
          <p className="calc-card__sub">میانگین نرخ صرافی‌های ایرانی در بریتانیا</p>

          {loading ? (
            <div className="calc-loading">
              <p>در حال بارگذاری…</p>
            </div>
          ) : err ? (
            <p style={{ color: "#f87171", textAlign: "center" }}>{err}</p>
          ) : !selectedRate ? (
            <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>داده‌ای موجود نیست.</p>
          ) : (
            <>
              {rateIsDemo && <div style={{ textAlign: "center" }}><span className="calc-demo-badge">نرخ نمونه</span></div>}

              {/* From field */}
              <label className="calc-field-label">
                {!isSwapped ? "مقدار ارز خارجی" : "مقدار (تومان)"}
              </label>
              <div className="calc-input-row">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  placeholder="مقدار"
                  dir="ltr"
                />
                <div className="calc-currency-sel">
                  {!isSwapped ? (
                    <>
                      <span className="calc-flag">{fromCurrency?.flag || "🏳️"}</span>
                      <select
                        value={selectedCurrencyCode}
                        onChange={(e) => setSelectedCurrencyCode(e.target.value)}
                        aria-label="انتخاب ارز"
                      >
                        {ratesForCalc.map((r) => (
                          <option key={r.code} value={r.code}>{r.code}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <span className="calc-flag">🇮🇷</span>
                      <span className="calc-currency-sel__static">IRR</span>
                    </>
                  )}
                </div>
              </div>

              {/* Swap button */}
              <div className="calc-swap-wrap">
                <button
                  type="button"
                  className="calc-swap-btn"
                  onClick={() => setIsSwapped((v) => !v)}
                  aria-label="جابجا کردن جهت تبدیل"
                  title="جابجا کردن"
                >
                  <i className="fa-solid fa-right-left" aria-hidden="true" style={{ transform: "rotate(90deg)" }} />
                </button>
              </div>

              {/* To field */}
              <label className="calc-field-label">
                {!isSwapped ? "معادل (تومان)" : "معادل ارز خارجی"}
              </label>
              <div className="calc-input-row">
                <input
                  type="text"
                  value={resultDisplay}
                  readOnly
                  dir="ltr"
                  aria-label="نتیجه تبدیل"
                />
                <div className="calc-currency-sel">
                  {isSwapped ? (
                    <>
                      <span className="calc-flag">{toCurrency?.flag || "🏳️"}</span>
                      <select
                        value={selectedCurrencyCode}
                        onChange={(e) => setSelectedCurrencyCode(e.target.value)}
                        aria-label="انتخاب ارز"
                      >
                        {ratesForCalc.map((r) => (
                          <option key={r.code} value={r.code}>{r.code}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <span className="calc-flag">🇮🇷</span>
                      <span className="calc-currency-sel__static">تومان</span>
                    </>
                  )}
                </div>
              </div>

              {/* Rate display */}
              <div className="calc-result-box">
                <p className="calc-result-box__rate" dir="ltr">
                  {mode === "buy" ? "نرخ خرید" : "نرخ فروش"} · {selectedCurrencyCode} / تومان
                </p>
                <p className="calc-result-box__main" dir="ltr">
                  1 {selectedCurrencyCode} = {rateDisplay} تومان
                </p>
              </div>

              <p className="calc-hint">{calcHint}</p>
            </>
          )}

          <div className="calc-nav">
            <Link to="/exchanges">← صرافی‌ها</Link>
            {" · "}
            <Link to="/exchanges/best-rates">بهترین نرخ‌ها</Link>
          </div>
        </div>
      </div>
    </>
  );
}
