/**
 * ماشین‌حساب نرخ — بدون انتخاب ارز (ارز از والد هماهنگ می‌شود).
 */
export default function ExchangeInlineCalc({
  idPrefix = "ex",
  title = "ماشین‌حساب لحظه‌ای",
  hint = null,
  exchangeMode,
  onExchangeModeChange,
  exchangeAmount,
  onExchangeAmountChange,
  exchangeResult,
  exchangeAmountNum,
  selectedRateNum,
  className = "",
}) {
  const modeId = `${idPrefix}-mode`;
  const amountId = `${idPrefix}-amount`;

  return (
    <div className={`exchange-calc exchange-calc--hero ${className}`.trim()}>
      <h3 className="exchange-calc__title">{title}</h3>
      {hint ? (
        <p className="exchange-calc__hint" dir="rtl">
          {hint}
        </p>
      ) : null}
      <div className="exchange-calc__fields exchange-calc__fields--compact">
        <div className="field">
          <label htmlFor={modeId}>نوع نرخ</label>
          <select id={modeId} value={exchangeMode} onChange={(e) => onExchangeModeChange(e.target.value)} dir="rtl">
            <option value="buy">خرید</option>
            <option value="sell">فروش</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={amountId}>مقدار ارز</label>
          <input
            id={amountId}
            value={exchangeAmount}
            onChange={(e) => onExchangeAmountChange(e.target.value)}
            dir="ltr"
            inputMode="decimal"
            className="exchange-calc__amount-input"
          />
        </div>
      </div>
      <p className="exchange-calc__result exchange-calc__result--hero" dir="ltr">
        {exchangeResult == null || !Number.isFinite(selectedRateNum) || !Number.isFinite(exchangeAmountNum)
          ? "—"
          : `${exchangeAmountNum.toLocaleString("fa-IR", { maximumFractionDigits: 6 })} × ${selectedRateNum.toLocaleString("fa-IR", { maximumFractionDigits: 6 })} = ${exchangeResult.toLocaleString("fa-IR", {
              maximumFractionDigits: 2,
            })} تومان`}
      </p>
    </div>
  );
}
