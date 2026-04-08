import { getCatalogEntry } from "./exchangeCurrencyCatalog.js";

export const EXCHANGE_DEFAULT_RATES = [
  { code: "USD", name: "US Dollar", flag: "🇺🇸", buy: "", sell: "", buy_active: true, sell_active: true },
  { code: "EUR", name: "Euro", flag: "🇪🇺", buy: "", sell: "", buy_active: true, sell_active: true },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", buy: "", sell: "", buy_active: true, sell_active: true },
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪", buy: "", sell: "", buy_active: true, sell_active: true },
  { code: "TRY", name: "Turkish Lira", flag: "🇹🇷", buy: "", sell: "", buy_active: true, sell_active: true },
  { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", buy: "", sell: "", buy_active: true, sell_active: true },
];

export const EXCHANGE_PAYMENT_METHODS = [
  { id: "visa", label: "VISA", badgeClassName: "" },
  { id: "mastercard", label: "MasterCard", badgeClassName: "" },
  { id: "bank_transfer", label: "حواله بانکی", badgeClassName: "exchange-pay-badge--muted" },
  { id: "card_to_card", label: "کارت به کارت", badgeClassName: "exchange-pay-badge--muted" },
  { id: "cash", label: "نقدی", badgeClassName: "exchange-pay-badge--muted" },
  { id: "crypto", label: "Crypto", badgeClassName: "" },
];

export const EXCHANGE_DEFAULT_PAYMENT_METHOD_IDS = EXCHANGE_PAYMENT_METHODS.map((m) => m.id);

export const EXCHANGE_FEATURES = [
  { id: "best_rate", label: "بهترین نرخ" },
  { id: "physical_branch", label: "شعبه فیزیکی" },
  { id: "fast_transfer", label: "انتقال سریع" },
];

export const EXCHANGE_DEFAULT_FEATURE_IDS = EXCHANGE_FEATURES.map((f) => f.id);

function normalizeRateRow(row) {
  const code = String(row?.code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{3,10}$/.test(code)) return null;
  const buy = row?.buy == null ? "" : String(row.buy).trim();
  const sell = row?.sell == null ? "" : String(row.sell).trim();
  let name = String(row?.name || "").trim();
  let flag = String(row?.flag || "").trim();
  const cat = getCatalogEntry(code);
  if (cat) {
    if (!name) name = cat.name;
    if (!flag) flag = cat.flag;
  }
  const buy_active = row?.buy_active === false ? false : true;
  const sell_active = row?.sell_active === false ? false : true;
  return { code, name, flag, buy, sell, buy_active, sell_active };
}

export function parseExchangeRatesJson(json) {
  if (!json || typeof json !== "string") return [...EXCHANGE_DEFAULT_RATES];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [...EXCHANGE_DEFAULT_RATES];
    if (arr.length === 0) return [];
    const rows = arr.map(normalizeRateRow).filter(Boolean);
    if (!rows.length) return [...EXCHANGE_DEFAULT_RATES];
    return rows;
  } catch {
    return [...EXCHANGE_DEFAULT_RATES];
  }
}

export function sanitizeExchangeRatesRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeRateRow).filter(Boolean);
}

export function parseExchangePaymentMethodsJson(json) {
  if (!json || typeof json !== "string") return [...EXCHANGE_DEFAULT_PAYMENT_METHOD_IDS];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [...EXCHANGE_DEFAULT_PAYMENT_METHOD_IDS];
    const allowed = new Set(EXCHANGE_DEFAULT_PAYMENT_METHOD_IDS);
    const ids = [];
    for (const raw of arr) {
      const id = String(raw || "").trim().toLowerCase();
      if (!allowed.has(id)) continue;
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  } catch {
    return [...EXCHANGE_DEFAULT_PAYMENT_METHOD_IDS];
  }
}

export function parseExchangeFeaturesJson(json) {
  if (!json || typeof json !== "string") return [...EXCHANGE_DEFAULT_FEATURE_IDS];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [...EXCHANGE_DEFAULT_FEATURE_IDS];
    const allowed = new Set(EXCHANGE_DEFAULT_FEATURE_IDS);
    const ids = [];
    for (const raw of arr) {
      const id = String(raw || "").trim().toLowerCase();
      if (!allowed.has(id)) continue;
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  } catch {
    return [...EXCHANGE_DEFAULT_FEATURE_IDS];
  }
}

export function isExchangeCategory(categoryRaw) {
  const s = String(categoryRaw || "").trim().toLowerCase();
  if (!s) return false;
  return s.includes("صراف") || s.includes("exchange") || s.includes("currency") || s.includes("crypto");
}

/** True if business is an exchange listing: category matches or saved rates JSON has values. */
export function businessHasExchangeRatesData(row) {
  if (!row?.exchange_rates_json) return false;
  try {
    const arr = JSON.parse(String(row.exchange_rates_json));
    if (!Array.isArray(arr)) return false;
    return arr.some((r) => String(r?.buy || "").trim() || String(r?.sell || "").trim());
  } catch {
    return false;
  }
}

export function isExchangeBusiness(row) {
  if (!row) return false;
  if (isExchangeCategory(row.category)) return true;
  return businessHasExchangeRatesData(row);
}

/** تأیید سوپرادمین: صرافی به‌عنوان کسب‌وکار ثبت‌شده (تیک آبی). */
export function isExchangeCompanyVerified(row) {
  return row != null && Number(row.exchange_company_verified) === 1;
}

/** Short Persian name for subtitle «نرخ لحظه‌ای … به تومان» */
export const EXCHANGE_CURRENCY_NAME_FA_SHORT = {
  USD: "دلار",
  EUR: "یورو",
  GBP: "پوند",
  AED: "درهم",
  TRY: "لیر",
  CAD: "دلار کانادا",
};

export function exchangeCurrencyNameFaShort(code, fallbackName) {
  const c = String(code || "")
    .trim()
    .toUpperCase();
  const cat = getCatalogEntry(c);
  if (cat?.nameFa) return cat.nameFa;
  if (c && EXCHANGE_CURRENCY_NAME_FA_SHORT[c]) return EXCHANGE_CURRENCY_NAME_FA_SHORT[c];
  const f = String(fallbackName || "").trim();
  if (f) return f;
  return c || "ارز";
}

/** Parse JSON بدون بازگشت به نرخ‌های پیش‌فرض — خالی یا نامعتبر → []. */
export function parseExchangeRatesJsonOrEmpty(json) {
  if (!json || typeof json !== "string") return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeRateRow).filter(Boolean);
  } catch {
    return [];
  }
}

function parseStoredRateNumber(raw) {
  const n = Number.parseFloat(String(raw ?? "").replace(/,/g, ".").replace(/\s/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function arithmeticMean(values) {
  if (!values.length) return null;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function formatAveragedRate(n) {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100000) / 100000;
  return String(rounded);
}

/**
 * میانگین نرخ خرید و فروش هر ارز از همهٔ صرافی‌هایی که نرخ ثبت کرده‌اند (فهرست فیلترشده).
 */
export function averageExchangeRatesFromBusinesses(businesses) {
  const list = Array.isArray(businesses) ? businesses : [];
  const withData = list.filter(businessHasExchangeRatesData);
  const byCode = new Map();

  for (const b of withData) {
    const rows = parseExchangeRatesJsonOrEmpty(b.exchange_rates_json);
    for (const row of rows) {
      if (!row?.code) continue;
      const code = row.code;
      if (!byCode.has(code)) {
        byCode.set(code, {
          buyVals: [],
          sellVals: [],
          name: String(row.name || "").trim(),
          flag: String(row.flag || "").trim(),
        });
      }
      const bucket = byCode.get(code);
      if (!bucket.name && row.name) bucket.name = String(row.name).trim();
      if (!bucket.flag && row.flag) bucket.flag = String(row.flag).trim();

      if (row.buy_active !== false) {
        const n = parseStoredRateNumber(row.buy);
        if (n != null) bucket.buyVals.push(n);
      }
      if (row.sell_active !== false) {
        const n = parseStoredRateNumber(row.sell);
        if (n != null) bucket.sellVals.push(n);
      }
    }
  }

  const codes = [...byCode.keys()].sort();
  const out = [];
  for (const code of codes) {
    const bucket = byCode.get(code);
    const cat = getCatalogEntry(code);
    const name = bucket.name || cat?.name || "";
    const flag = bucket.flag || cat?.flag || "";
    const buyAvg = arithmeticMean(bucket.buyVals);
    const sellAvg = arithmeticMean(bucket.sellVals);
    out.push({
      code,
      name,
      flag,
      buy: buyAvg != null ? formatAveragedRate(buyAvg) : "",
      sell: sellAvg != null ? formatAveragedRate(sellAvg) : "",
      buy_active: bucket.buyVals.length > 0,
      sell_active: bucket.sellVals.length > 0,
    });
  }

  return out;
}

/** نرخ مؤثر برای ماشین‌حساب با توجه به فعال بودن خرید/فروش */
export function getEffectiveRateRaw(row, mode) {
  if (!row) return "";
  if (mode === "buy") {
    if (row.buy_active === false) return "";
    return row.buy == null ? "" : String(row.buy).trim();
  }
  if (row.sell_active === false) return "";
  return row.sell == null ? "" : String(row.sell).trim();
}

/** نرخ‌های نمونه (تومان) وقتی هنوز صرافی نرخ ثبت نکرده — فقط برای نمایش ماشین‌حساب */
const CALC_DEMO_TOMAN = {
  USD: { buy: 92000, sell: 91500 },
  EUR: { buy: 100800, sell: 100200 },
  GBP: { buy: 117500, sell: 117000 },
  AED: { buy: 25100, sell: 24800 },
  TRY: { buy: 2850, sell: 2820 },
  CAD: { buy: 67800, sell: 67500 },
};

/**
 * اگر نرخ واقعی نبود، مقدار نمونه برمی‌گردد تا ماشین‌حساب «—» نشود.
 * @returns {{ rateNum: number | null, raw: string, isDemo: boolean }}
 */
export function getCalculatorRateOrDemo(row, mode) {
  if (!row) return { rateNum: null, raw: "", isDemo: false };
  const raw = getEffectiveRateRaw(row, mode);
  const n = Number.parseFloat(String(raw || "").replace(/,/g, ".").replace(/\s/g, ""));
  if (Number.isFinite(n) && n > 0) return { rateNum: n, raw: String(raw).trim(), isDemo: false };
  const code = String(row.code || "")
    .trim()
    .toUpperCase();
  const d = CALC_DEMO_TOMAN[code];
  if (!d) return { rateNum: null, raw: "", isDemo: false };
  const v = mode === "sell" ? d.sell : d.buy;
  return { rateNum: v, raw: String(v), isDemo: true };
}

/**
 * صرافی با بهترین نرخ در فهرست برای یک ارز و نوع نرخ:
 * خرید — بالاتر بهتر؛ فروش — پایین‌تر بهتر (برای خرید ارز از صرافی).
 */
export function pickBestRateExchangeInList(businesses, currencyCode, mode) {
  const code = String(currencyCode || "")
    .trim()
    .toUpperCase();
  if (!code) return null;
  const m = mode === "sell" ? "sell" : "buy";
  const list = Array.isArray(businesses) ? businesses : [];
  let best = null;
  for (const biz of list) {
    if (!businessHasExchangeRatesData(biz)) continue;
    const rows = parseExchangeRatesJsonOrEmpty(biz.exchange_rates_json);
    const row = rows.find((r) => r.code === code);
    if (!row) continue;
    const raw = getEffectiveRateRaw(row, m);
    const n = Number.parseFloat(String(raw || "").replace(",", "."));
    if (!Number.isFinite(n)) continue;
    const isBetter = (candidate, current) => {
      if (m === "buy") return candidate > current;
      return candidate < current;
    };
    if (!best || isBetter(n, best.rateNum)) {
      best = { business: biz, rateNum: n, raw: String(raw).trim() };
    }
  }
  return best;
}

/** Formats a stored rate for display as «۱۸۵ تومان» (Persian digits). */
export function formatExchangeRateToman(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const n = Number.parseFloat(raw.replace(/,/g, ".").replace(/\s/g, ""));
  if (!Number.isFinite(n)) return raw;
  const formatted = n.toLocaleString("fa-IR", {
    maximumFractionDigits: n % 1 === 0 ? 0 : 4,
    minimumFractionDigits: 0,
  });
  return `${formatted} تومان`;
}
