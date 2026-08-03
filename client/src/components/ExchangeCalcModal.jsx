import { useEffect, useMemo, useState } from "react";
import { businessHasExchangeRatesData, getCalculatorRateOrDemo, parseLocalizedNumber, formatLocalizedNumberFromRaw } from "../lib/exchangeRates.js";

const MODAL_STYLES = `
  .calc-modal-overlay {
    position: fixed; inset: 0; z-index: 10060;
    display: flex; align-items: flex-end; justify-content: center;
  }
  .calc-modal-backdrop {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
  }
  .calc-modal-panel {
    position: relative; z-index: 1;
    width: 100%; max-width: 480px;
    background: rgba(3, 7, 40, 0.92);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 20px 20px 0 0;
    padding: 0 1.5rem 2.5rem;
    max-height: 90vh;
    overflow-y: auto;
  }
  .calc-modal-handle { display: flex; justify-content: center; padding: 0.75rem 0 0.25rem; }
  .calc-modal-handle span { width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.25); }
  .calc-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0 1rem; }
  .calc-modal-head h2 { color: #fff; font-size: 1.1rem; font-weight: 700; margin: 0; }
  .calc-modal-close { background: rgba(255,255,255,0.1); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .calc-m-field-label { display: block; color: rgba(255,255,255,0.65); font-size: 0.8rem; margin: 0 0 0.32rem; text-align: right; }
  .calc-m-input-row { display: flex; align-items: stretch; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; overflow: hidden; margin-bottom: 0.45rem; direction: ltr; }
  .calc-m-input-row input { flex: 1; background: transparent; border: none; outline: none; color: #fff; font-size: 1.1rem; padding: 0.65rem 0.85rem; min-width: 0; font-family: inherit; direction: ltr; }
  .calc-m-input-row input::placeholder { color: rgba(255,255,255,0.3); }
  .calc-m-input-row input[readonly] { color: rgba(255,255,255,0.88); cursor: default; }
  .calc-m-currency-sel { display: flex; align-items: center; gap: 0.35rem; padding: 0 0.75rem; border-left: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); flex-shrink: 0; min-width: 5.5rem; direction: ltr; }
  .calc-m-currency-sel select { background: transparent; border: none; outline: none; color: #fff; font-size: 0.88rem; font-weight: 700; font-family: inherit; cursor: pointer; max-width: 62px; }
  .calc-m-currency-sel select option { background: #0c1a3e; color: #fff; }
  .calc-m-currency-sel__static { font-size: 0.85rem; font-weight: 700; color: rgba(255,255,255,0.8); white-space: nowrap; }
  .calc-m-flag { font-size: 1.15rem; line-height: 1; flex-shrink: 0; }
  .calc-m-swap-wrap { display: flex; justify-content: center; margin: 0.45rem 0 0.7rem; }
  .calc-m-swap-btn { width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.28); background: rgba(255,255,255,0.09); color: #fff; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.3s; }
  .calc-m-swap-btn:hover { background: rgba(255,255,255,0.2); transform: rotate(180deg); }
  .calc-m-rate-box { margin-top: 1.1rem; background: rgba(255,255,255,0.1); border-radius: 10px; padding: 0.85rem 1rem; text-align: center; border: 1px solid rgba(255,255,255,0.12); }
  .calc-m-rate-box__label { color: rgba(255,255,255,0.55); font-size: 0.78rem; margin: 0 0 0.25rem; direction: ltr; }
  .calc-m-rate-box__val { color: #fff; font-size: 1rem; font-weight: 700; direction: ltr; margin: 0; }
  .calc-m-hint { color: rgba(255,255,255,0.38); font-size: 0.74rem; line-height: 1.5; margin: 0.85rem 0 0; text-align: right; direction: rtl; }
  .calc-m-chips-label { color: rgba(255,255,255,0.6); font-size: 0.78rem; margin: 0 0 0.5rem; text-align: right; direction: rtl; }
  .calc-m-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 1rem; }
  .calc-m-chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.65rem; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.75); font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: background 0.15s; font-family: inherit; }
  .calc-m-chip--selected { background: rgba(124,58,237,0.5); border-color: rgba(124,58,237,0.7); color: #fff; }
`;

export default function ExchangeCalcModal({
  open,
  onClose,
  filtered,
  ratesForCalc,
  selectedCurrencyCode,
  setSelectedCurrencyCode,
  exchangeMode,
  setExchangeMode,
  loading,
  err,
}) {
  const [amount, setAmount] = useState("1");
  const [isSwapped, setIsSwapped] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

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

  const rateDisplay = formatLocalizedNumberFromRaw(
    rateRaw || (Number.isFinite(rateNum) ? String(rateNum) : ""),
    { fallback: "—", maxFractionDigits: 2 }
  );

  const calcHint = useMemo(() => {
    const withData = filtered.filter(businessHasExchangeRatesData);
    if (withData.length >= 2) return `میانگین نرخ از ${withData.length} صرافی؛ برای نرخ قطعی با صرافی تماس بگیرید.`;
    if (withData.length === 1) return `نرخ تک‌صرافی — برای نرخ دقیق صفحهٔ آگهی را باز کنید.`;
    return "نرخ نمونه‌ای — اعداد واقعی پس از ثبت نرخ توسط صرافی‌ها نمایش داده می‌شود.";
  }, [filtered]);

  if (!open) return null;

  return (
    <>
      <style>{MODAL_STYLES}</style>
      <div className="calc-modal-overlay" role="presentation">
        <div className="calc-modal-backdrop" onClick={onClose} aria-hidden="true" />
        <div
          className="calc-modal-panel"
          role="dialog"
          aria-modal="true"
          aria-label="ماشین‌حساب نرخ ارز"
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
          lang="fa"
        >
          <div className="calc-modal-handle"><span /></div>
          <div className="calc-modal-head">
            <h2>ماشین‌حساب نرخ ارز</h2>
            <button type="button" className="calc-modal-close" onClick={onClose} aria-label="بستن">×</button>
          </div>

          {loading ? (
            <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "2rem 0" }}>در حال بارگذاری…</p>
          ) : err ? (
            <p style={{ color: "#f87171", textAlign: "center" }}>{err}</p>
          ) : !selectedRate ? (
            <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>داده‌ای موجود نیست.</p>
          ) : (
            <>
              {/* Currency chips */}
              {ratesForCalc.length > 1 && (
                <>
                  <p className="calc-m-chips-label">انتخاب ارز</p>
                  <div className="calc-m-chips">
                    {ratesForCalc.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        className={`calc-m-chip${selectedCurrencyCode === r.code ? " calc-m-chip--selected" : ""}`}
                        onClick={() => setSelectedCurrencyCode(r.code)}
                      >
                        <span>{r.flag || "🏳️"}</span>
                        <span dir="ltr">{r.code}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* From field */}
              <label className="calc-m-field-label">
                {!isSwapped ? "مقدار ارز خارجی" : "مقدار (تومان)"}
              </label>
              <div className="calc-m-input-row">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  placeholder="مقدار"
                  dir="ltr"
                />
                <div className="calc-m-currency-sel">
                  {!isSwapped ? (
                    <>
                      <span className="calc-m-flag">{selectedRate?.flag || "🏳️"}</span>
                      <select value={selectedCurrencyCode} onChange={(e) => setSelectedCurrencyCode(e.target.value)} aria-label="ارز">
                        {ratesForCalc.map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
                      </select>
                    </>
                  ) : (
                    <><span className="calc-m-flag">🇮🇷</span><span className="calc-m-currency-sel__static">IRR</span></>
                  )}
                </div>
              </div>

              {/* Swap button */}
              <div className="calc-m-swap-wrap">
                <button type="button" className="calc-m-swap-btn" onClick={() => setIsSwapped((v) => !v)} aria-label="جابجا کردن">
                  <i className="fa-solid fa-right-left" aria-hidden="true" style={{ transform: "rotate(90deg)" }} />
                </button>
              </div>

              {/* To field */}
              <label className="calc-m-field-label">
                {!isSwapped ? "معادل (تومان)" : "معادل ارز خارجی"}
              </label>
              <div className="calc-m-input-row">
                <input type="text" value={resultDisplay} readOnly dir="ltr" aria-label="نتیجه" />
                <div className="calc-m-currency-sel">
                  {isSwapped ? (
                    <>
                      <span className="calc-m-flag">{selectedRate?.flag || "🏳️"}</span>
                      <select value={selectedCurrencyCode} onChange={(e) => setSelectedCurrencyCode(e.target.value)} aria-label="ارز">
                        {ratesForCalc.map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
                      </select>
                    </>
                  ) : (
                    <><span className="calc-m-flag">🇮🇷</span><span className="calc-m-currency-sel__static">تومان</span></>
                  )}
                </div>
              </div>

              {/* Rate box */}
              <div className="calc-m-rate-box">
                <p className="calc-m-rate-box__label">{mode === "buy" ? "نرخ خرید" : "نرخ فروش"} · {selectedCurrencyCode} / تومان</p>
                <p className="calc-m-rate-box__val">1 {selectedCurrencyCode} = {rateDisplay} تومان</p>
              </div>

              <p className="calc-m-hint">{calcHint}</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
