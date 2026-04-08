import { useMemo, useState } from "react";
import { searchExchangeCatalog, getCatalogEntry } from "../lib/exchangeCurrencyCatalog.js";
import { formatNumberInputWithThousands } from "../lib/exchangeRates.js";

function emptyRowFromCatalog(entry) {
  return {
    code: entry.code,
    name: entry.name,
    flag: entry.flag,
    buy: "",
    sell: "",
    buy_active: true,
    sell_active: true,
  };
}

export default function ExchangeRatesEditor({ rows, setRows }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [customCode, setCustomCode] = useState("");
  const [customName, setCustomName] = useState("");

  const suggestions = useMemo(() => searchExchangeCatalog(query, kind, 36), [query, kind]);

  const codesInUse = useMemo(() => new Set(rows.map((r) => r.code)), [rows]);

  const addEntry = (entry) => {
    if (codesInUse.has(entry.code)) return;
    setRows((prev) => [...prev, emptyRowFromCatalog(entry)]);
    setQuery("");
  };

  const addCustom = () => {
    const code = String(customCode || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{3,10}$/.test(code)) return;
    if (codesInUse.has(code)) return;
    const cat = getCatalogEntry(code);
    const name = String(customName || "").trim() || cat?.name || code;
    const flag = cat?.flag || "🏳️";
    setRows((prev) => [
      ...prev,
      { code, name, flag, buy: "", sell: "", buy_active: true, sell_active: true },
    ]);
    setCustomCode("");
    setCustomName("");
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const patchRow = (index, patch) => {
    setRows((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  return (
    <div className="exchange-rates-editor">
      <div className="exchange-rates-editor__filters">
        <div className="field field--block">
          <span className="exchange-rates-editor__filter-label">نوع</span>
          <div className="exchange-rates-editor__kind-toggle" role="group" aria-label="فیلتر فیات یا رمز ارز">
            <button
              type="button"
              className={`btn btn--ghost${kind === "all" ? " is-active" : ""}`}
              onClick={() => setKind("all")}
            >
              همه
            </button>
            <button
              type="button"
              className={`btn btn--ghost${kind === "fiat" ? " is-active" : ""}`}
              onClick={() => setKind("fiat")}
            >
              فیات
            </button>
            <button
              type="button"
              className={`btn btn--ghost${kind === "crypto" ? " is-active" : ""}`}
              onClick={() => setKind("crypto")}
            >
              رمز ارز
            </button>
          </div>
        </div>
        <div className="field field--block">
          <label htmlFor="ex-cat-search">جستجوی ارز (کد یا نام)</label>
          <input
            id="ex-cat-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مثلاً GBP، یورو، BTC، تتر…"
            autoComplete="off"
            dir="ltr"
            className="exchange-rates-editor__search"
          />
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="exchange-rates-editor__suggestions" role="listbox" aria-label="نتایج جستجو">
          {suggestions.map((s) => (
            <button
              key={s.code}
              type="button"
              role="option"
              className="exchange-rates-editor__suggestion"
              disabled={codesInUse.has(s.code)}
              onClick={() => addEntry(s)}
            >
              <span className="exchange-rates-editor__sug-flag" aria-hidden>
                {s.flag}
              </span>
              <span className="exchange-rates-editor__sug-code" dir="ltr">
                {s.code}
              </span>
              <span className="exchange-rates-editor__sug-name">{s.nameFa || s.name}</span>
              <span className={`exchange-rates-editor__sug-kind exchange-rates-editor__sug-kind--${s.kind}`}>
                {s.kind === "crypto" ? "رمز ارز" : "فیات"}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="exchange-rates-editor__custom">
        <p className="field-hint exchange-rates-editor__custom-hint">ارز در لیست نیست؟ کد (۳ تا ۱۰ کاراکتر لاتین) و نام را وارد کنید.</p>
        <div className="exchange-rates-editor__custom-row">
          <div className="field">
            <label htmlFor="ex-custom-code">کد</label>
            <input
              id="ex-custom-code"
              dir="ltr"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder="USDT"
              maxLength={10}
            />
          </div>
          <div className="field">
            <label htmlFor="ex-custom-name">نام نمایشی</label>
            <input
              id="ex-custom-name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="مثلاً تتر"
            />
          </div>
          <div className="field exchange-rates-editor__custom-add">
            <span className="visually-hidden">افزودن</span>
            <button type="button" className="btn btn--accent" onClick={addCustom}>
              افزودن
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="field-hint exchange-rates-editor__empty">هنوز ارزی اضافه نشده — از جستجو یا «افزودن سفارشی» استفاده کنید.</p>
      ) : (
        <div className="table-wrap exchange-rates-editor__table-wrap">
          <table className="data-table exchange-rates-editor__table" dir="ltr">
            <thead>
              <tr>
                <th scope="col" className="exchange-rates-editor__th-narrow" />
                <th scope="col">پرچم</th>
                <th scope="col">کد</th>
                <th scope="col">نام</th>
                <th scope="col">خرید فعال</th>
                <th scope="col">مبلغ خرید</th>
                <th scope="col">فروش فعال</th>
                <th scope="col">مبلغ فروش</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.code}-${i}`}>
                  <td>
                    <button type="button" className="btn btn--ghost exchange-rates-editor__remove" onClick={() => removeRow(i)} title="حذف">
                      ×
                    </button>
                  </td>
                  <td style={{ fontSize: "1.15rem" }}>{row.flag || "🏳️"}</td>
                  <td>
                    <strong dir="ltr">{row.code}</strong>
                  </td>
                  <td>{row.name || "—"}</td>
                  <td>
                    <label className="exchange-rates-editor__check">
                      <input
                        type="checkbox"
                        checked={row.buy_active !== false}
                        onChange={(e) => patchRow(i, { buy_active: e.target.checked })}
                      />
                      <span>فعال</span>
                    </label>
                  </td>
                  <td>
                    <input
                      value={row.buy ?? ""}
                      onChange={(e) => patchRow(i, { buy: formatNumberInputWithThousands(e.target.value) })}
                      inputMode="decimal"
                      placeholder="0"
                      dir="ltr"
                      disabled={row.buy_active === false}
                      className="exchange-rates-editor__rate-input"
                    />
                  </td>
                  <td>
                    <label className="exchange-rates-editor__check">
                      <input
                        type="checkbox"
                        checked={row.sell_active !== false}
                        onChange={(e) => patchRow(i, { sell_active: e.target.checked })}
                      />
                      <span>فعال</span>
                    </label>
                  </td>
                  <td>
                    <input
                      value={row.sell ?? ""}
                      onChange={(e) => patchRow(i, { sell: formatNumberInputWithThousands(e.target.value) })}
                      inputMode="decimal"
                      placeholder="0"
                      dir="ltr"
                      disabled={row.sell_active === false}
                      className="exchange-rates-editor__rate-input"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
