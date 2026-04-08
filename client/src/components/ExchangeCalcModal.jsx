import { useEffect, useMemo, useState } from "react";
import ExchangeInlineCalc from "./ExchangeInlineCalc.jsx";
import { businessHasExchangeRatesData, getCalculatorRateOrDemo, parseLocalizedNumber } from "../lib/exchangeRates.js";

/**
 * ماشین‌حساب نرخ در مودال — همان منطق صفحهٔ /exchanges/calculator، با state ارز/خریدفروش از والد.
 */
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
  const [exchangeAmount, setExchangeAmount] = useState("1");

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

  const selectedRate = useMemo(
    () => ratesForCalc.find((r) => r.code === selectedCurrencyCode) || ratesForCalc[0] || null,
    [ratesForCalc, selectedCurrencyCode]
  );

  const { rateNum: selectedRateNum, raw: selectedRateRaw, isDemo: rateIsDemo } = useMemo(
    () => getCalculatorRateOrDemo(selectedRate, exchangeMode),
    [selectedRate, exchangeMode]
  );

  const exchangeAmountNum = parseLocalizedNumber(exchangeAmount);
  const exchangeResult =
    Number.isFinite(selectedRateNum) && Number.isFinite(exchangeAmountNum)
      ? selectedRateNum * exchangeAmountNum
      : null;

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

  if (!open) return null;

  return (
    <div className="exchange-calc-modal exchange-calc-modal--sheet" role="presentation">
      <div className="exchange-calc-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="exchange-calc-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exchange-calc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="exchange-calc-modal__handle-bar" aria-hidden="true">
          <span className="exchange-calc-modal__handle" />
        </div>
        <div className="exchange-calc-modal__header">
          <h2 id="exchange-calc-modal-title" className="exchange-calc-modal__heading">
            ماشین‌حساب نرخ
          </h2>
          <button type="button" className="exchange-calc-modal__close" onClick={onClose} aria-label="بستن">
            ×
          </button>
        </div>
        <p className="exchange-calc-modal__lead field-hint">
          بر اساس میانگین نرخ‌های همین فهرست. برای معامل واقعی با صرافی تماس بگیرید.
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
          ) : !selectedRate ? (
            <p className="field-hint">داده‌ای برای محاسبه نیست.</p>
          ) : (
            <>
              <section className="exchange-calc-modal__currencies" aria-label="انتخاب ارز">
                <p className="exchanges-app__currency-mini-label" id="ex-calc-modal-curr-label">
                  ارز
                </p>
                <div className="exchanges-app__currency-strip" role="listbox" aria-labelledby="ex-calc-modal-curr-label">
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
                        <span className="exchanges-app__currency-chip-flag" aria-hidden="true">
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
                idPrefix="ex-calc-modal"
                hint={calcHint}
                exchangeMode={exchangeMode}
                onExchangeModeChange={setExchangeMode}
                exchangeAmount={exchangeAmount}
                onExchangeAmountChange={setExchangeAmount}
                exchangeResult={exchangeResult}
                exchangeAmountNum={exchangeAmountNum}
                selectedRateNum={selectedRateNum}
                selectedRateRaw={selectedRateRaw}
                rateIsDemo={rateIsDemo}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
