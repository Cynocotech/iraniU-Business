/**
 * فهرست مرجع ارزهای فیات و رمز ارز برای انتخاب در پنل صرافی.
 * kind: "fiat" | "crypto"
 */
export const EXCHANGE_CURRENCY_CATALOG = [
  // Major fiat (ISO 4217)
  { code: "USD", name: "US Dollar", nameFa: "دلار آمریکا", flag: "🇺🇸", kind: "fiat" },
  { code: "EUR", name: "Euro", nameFa: "یورو", flag: "🇪🇺", kind: "fiat" },
  { code: "GBP", name: "British Pound", nameFa: "پوند", flag: "🇬🇧", kind: "fiat" },
  { code: "CHF", name: "Swiss Franc", nameFa: "فرانک سوئیس", flag: "🇨🇭", kind: "fiat" },
  { code: "JPY", name: "Japanese Yen", nameFa: "ین ژاپن", flag: "🇯🇵", kind: "fiat" },
  { code: "CNY", name: "Chinese Yuan", nameFa: "یوان چین", flag: "🇨🇳", kind: "fiat" },
  { code: "HKD", name: "Hong Kong Dollar", nameFa: "دلار هنگ‌کنگ", flag: "🇭🇰", kind: "fiat" },
  { code: "SGD", name: "Singapore Dollar", nameFa: "دلار سنگاپور", flag: "🇸🇬", kind: "fiat" },
  { code: "AUD", name: "Australian Dollar", nameFa: "دلار استرالیا", flag: "🇦🇺", kind: "fiat" },
  { code: "CAD", name: "Canadian Dollar", nameFa: "دلار کانادا", flag: "🇨🇦", kind: "fiat" },
  { code: "NZD", name: "New Zealand Dollar", nameFa: "دلار نیوزیلند", flag: "🇳🇿", kind: "fiat" },
  { code: "SEK", name: "Swedish Krona", nameFa: "کرون سوئد", flag: "🇸🇪", kind: "fiat" },
  { code: "NOK", name: "Norwegian Krone", nameFa: "کرون نروژ", flag: "🇳🇴", kind: "fiat" },
  { code: "DKK", name: "Danish Krone", nameFa: "کرون دانمارک", flag: "🇩🇰", kind: "fiat" },
  { code: "PLN", name: "Polish Zloty", nameFa: "زلوتی لهستان", flag: "🇵🇱", kind: "fiat" },
  { code: "CZK", name: "Czech Koruna", nameFa: "کرون چک", flag: "🇨🇿", kind: "fiat" },
  { code: "HUF", name: "Hungarian Forint", nameFa: "فورینت", flag: "🇭🇺", kind: "fiat" },
  { code: "RON", name: "Romanian Leu", nameFa: "لئو رومانی", flag: "🇷🇴", kind: "fiat" },
  { code: "BGN", name: "Bulgarian Lev", nameFa: "لف بلغارستان", flag: "🇧🇬", kind: "fiat" },
  { code: "TRY", name: "Turkish Lira", nameFa: "لیر ترکیه", flag: "🇹🇷", kind: "fiat" },
  { code: "RUB", name: "Russian Ruble", nameFa: "روبل روسیه", flag: "🇷🇺", kind: "fiat" },
  { code: "UAH", name: "Ukrainian Hryvnia", nameFa: "هریونیا", flag: "🇺🇦", kind: "fiat" },
  { code: "AED", name: "UAE Dirham", nameFa: "درهم امارات", flag: "🇦🇪", kind: "fiat" },
  { code: "SAR", name: "Saudi Riyal", nameFa: "ریال سعودی", flag: "🇸🇦", kind: "fiat" },
  { code: "QAR", name: "Qatari Riyal", nameFa: "ریال قطر", flag: "🇶🇦", kind: "fiat" },
  { code: "KWD", name: "Kuwaiti Dinar", nameFa: "دینار کویت", flag: "🇰🇼", kind: "fiat" },
  { code: "BHD", name: "Bahraini Dinar", nameFa: "دینار بحرین", flag: "🇧🇭", kind: "fiat" },
  { code: "OMR", name: "Omani Rial", nameFa: "ریال عمان", flag: "🇴🇲", kind: "fiat" },
  { code: "JOD", name: "Jordanian Dinar", nameFa: "دینار اردن", flag: "🇯🇴", kind: "fiat" },
  { code: "IQD", name: "Iraqi Dinar", nameFa: "دینار عراق", flag: "🇮🇶", kind: "fiat" },
  { code: "IRR", name: "Iranian Rial", nameFa: "ریال ایران", flag: "🇮🇷", kind: "fiat" },
  { code: "AFN", name: "Afghan Afghani", nameFa: "افغانی", flag: "🇦🇫", kind: "fiat" },
  { code: "PKR", name: "Pakistani Rupee", nameFa: "روپیه پاکستان", flag: "🇵🇰", kind: "fiat" },
  { code: "INR", name: "Indian Rupee", nameFa: "روپیه هند", flag: "🇮🇳", kind: "fiat" },
  { code: "BDT", name: "Bangladeshi Taka", nameFa: "تاکا", flag: "🇧🇩", kind: "fiat" },
  { code: "LKR", name: "Sri Lankan Rupee", nameFa: "روپیه سریلانکا", flag: "🇱🇰", kind: "fiat" },
  { code: "THB", name: "Thai Baht", nameFa: "بات تایلند", flag: "🇹🇭", kind: "fiat" },
  { code: "MYR", name: "Malaysian Ringgit", nameFa: "رینگیت", flag: "🇲🇾", kind: "fiat" },
  { code: "IDR", name: "Indonesian Rupiah", nameFa: "روپیه اندونزی", flag: "🇮🇩", kind: "fiat" },
  { code: "PHP", name: "Philippine Peso", nameFa: "پزو فیلیپین", flag: "🇵🇭", kind: "fiat" },
  { code: "VND", name: "Vietnamese Dong", nameFa: "دونگ ویتنام", flag: "🇻🇳", kind: "fiat" },
  { code: "KRW", name: "South Korean Won", nameFa: "وون کره جنوبی", flag: "🇰🇷", kind: "fiat" },
  { code: "TWD", name: "Taiwan Dollar", nameFa: "دلار تایوان", flag: "🇹🇼", kind: "fiat" },
  { code: "MXN", name: "Mexican Peso", nameFa: "پزو مکزیک", flag: "🇲🇽", kind: "fiat" },
  { code: "BRL", name: "Brazilian Real", nameFa: "رئال برزیل", flag: "🇧🇷", kind: "fiat" },
  { code: "ARS", name: "Argentine Peso", nameFa: "پزو آرژانتین", flag: "🇦🇷", kind: "fiat" },
  { code: "CLP", name: "Chilean Peso", nameFa: "پزو شیلی", flag: "🇨🇱", kind: "fiat" },
  { code: "COP", name: "Colombian Peso", nameFa: "پزو کلمبیا", flag: "🇨🇴", kind: "fiat" },
  { code: "PEN", name: "Peruvian Sol", nameFa: "سول پرو", flag: "🇵🇪", kind: "fiat" },
  { code: "ZAR", name: "South African Rand", nameFa: "راند", flag: "🇿🇦", kind: "fiat" },
  { code: "EGP", name: "Egyptian Pound", nameFa: "پوند مصر", flag: "🇪🇬", kind: "fiat" },
  { code: "NGN", name: "Nigerian Naira", nameFa: "نایرا", flag: "🇳🇬", kind: "fiat" },
  { code: "KES", name: "Kenyan Shilling", nameFa: "شیلینگ کنیا", flag: "🇰🇪", kind: "fiat" },
  { code: "ILS", name: "Israeli Shekel", nameFa: "شقل", flag: "🇮🇱", kind: "fiat" },
  { code: "AMD", name: "Armenian Dram", nameFa: "درام ارمنستان", flag: "🇦🇲", kind: "fiat" },
  { code: "GEL", name: "Georgian Lari", nameFa: "لاری گرجستان", flag: "🇬🇪", kind: "fiat" },
  { code: "AZN", name: "Azerbaijani Manat", nameFa: "منات آذربایجان", flag: "🇦🇿", kind: "fiat" },
  { code: "KZT", name: "Kazakhstani Tenge", nameFa: "تنگه", flag: "🇰🇿", kind: "fiat" },
  { code: "UZS", name: "Uzbekistani Som", nameFa: "سوم ازبکستان", flag: "🇺🇿", kind: "fiat" },
  { code: "TMT", name: "Turkmenistan Manat", nameFa: "منات ترکمنستان", flag: "🇹🇲", kind: "fiat" },
  { code: "SYP", name: "Syrian Pound", nameFa: "پوند سوریه", flag: "🇸🇾", kind: "fiat" },
  { code: "LBP", name: "Lebanese Pound", nameFa: "پوند لبنان", flag: "🇱🇧", kind: "fiat" },
  { code: "ISK", name: "Icelandic Krona", nameFa: "کرون ایسلند", flag: "🇮🇸", kind: "fiat" },
  { code: "MAD", name: "Moroccan Dirham", nameFa: "درهم مراکش", flag: "🇲🇦", kind: "fiat" },
  { code: "DZD", name: "Algerian Dinar", nameFa: "دینار الجزایر", flag: "🇩🇿", kind: "fiat" },
  { code: "TND", name: "Tunisian Dinar", nameFa: "دینار تونس", flag: "🇹🇳", kind: "fiat" },
  { code: "XOF", name: "West African CFA", nameFa: "فرانک CFA غرب", flag: "🌍", kind: "fiat" },
  { code: "XAF", name: "Central African CFA", nameFa: "فرانک CFA مرکز", flag: "🌍", kind: "fiat" },
  { code: "CRC", name: "Costa Rican Colon", nameFa: "کولون", flag: "🇨🇷", kind: "fiat" },
  { code: "GTQ", name: "Guatemalan Quetzal", nameFa: "کتزال", flag: "🇬🇹", kind: "fiat" },
  { code: "UYU", name: "Uruguayan Peso", nameFa: "پزو اروگوئه", flag: "🇺🇾", kind: "fiat" },
  { code: "FJD", name: "Fijian Dollar", nameFa: "دلار فیجی", flag: "🇫🇯", kind: "fiat" },
  // Major crypto (tickers)
  { code: "BTC", name: "Bitcoin", nameFa: "بیت‌کوین", flag: "₿", kind: "crypto" },
  { code: "ETH", name: "Ethereum", nameFa: "اتریوم", flag: "Ξ", kind: "crypto" },
  { code: "USDT", name: "Tether USD", nameFa: "تتر", flag: "₮", kind: "crypto" },
  { code: "USDC", name: "USD Coin", nameFa: "یواس‌دی‌سی", flag: "◈", kind: "crypto" },
  { code: "BNB", name: "BNB", nameFa: "بی‌ان‌بی", flag: "◆", kind: "crypto" },
  { code: "XRP", name: "XRP", nameFa: "ریپل", flag: "✕", kind: "crypto" },
  { code: "SOL", name: "Solana", nameFa: "سولانا", flag: "◎", kind: "crypto" },
  { code: "ADA", name: "Cardano", nameFa: "کاردانو", flag: "₳", kind: "crypto" },
  { code: "DOGE", name: "Dogecoin", nameFa: "دوج‌کوین", flag: "Ð", kind: "crypto" },
  { code: "TRX", name: "TRON", nameFa: "ترون", flag: "⊤", kind: "crypto" },
  { code: "DOT", name: "Polkadot", nameFa: "پولکادات", flag: "●", kind: "crypto" },
  { code: "MATIC", name: "Polygon", nameFa: "پالیگان", flag: "⬡", kind: "crypto" },
  { code: "AVAX", name: "Avalanche", nameFa: "آوالانچ", flag: "▲", kind: "crypto" },
  { code: "LTC", name: "Litecoin", nameFa: "لایت‌کوین", flag: "Ł", kind: "crypto" },
  { code: "LINK", name: "Chainlink", nameFa: "چین‌لینک", flag: "⟡", kind: "crypto" },
  { code: "UNI", name: "Uniswap", nameFa: "یونی‌سواپ", flag: "🦄", kind: "crypto" },
  { code: "ATOM", name: "Cosmos", nameFa: "کازموس", flag: "⚛", kind: "crypto" },
  { code: "FIL", name: "Filecoin", nameFa: "فایل‌کوین", flag: "⬡", kind: "crypto" },
  { code: "XLM", name: "Stellar", nameFa: "استلار", flag: "✦", kind: "crypto" },
  { code: "ETC", name: "Ethereum Classic", nameFa: "اتریوم کلاسیک", flag: "Ξ", kind: "crypto" },
  { code: "ALGO", name: "Algorand", nameFa: "الگورند", flag: "Ⱥ", kind: "crypto" },
  { code: "NEAR", name: "NEAR Protocol", nameFa: "نیر", flag: "Ⓝ", kind: "crypto" },
  { code: "APT", name: "Aptos", nameFa: "آپتوس", flag: "◆", kind: "crypto" },
  { code: "ARB", name: "Arbitrum", nameFa: "آربیتروم", flag: "◇", kind: "crypto" },
  { code: "OP", name: "Optimism", nameFa: "اپتیمیسم", flag: "○", kind: "crypto" },
  { code: "SHIB", name: "Shiba Inu", nameFa: "شیبا", flag: "🐕", kind: "crypto" },
  { code: "TON", name: "Toncoin", nameFa: "تون", flag: "💎", kind: "crypto" },
  { code: "HBAR", name: "Hedera", nameFa: "دلار هدرا", flag: "ℏ", kind: "crypto" },
  { code: "VET", name: "VeChain", nameFa: "وی‌چین", flag: "V", kind: "crypto" },
  { code: "QNT", name: "Quant", nameFa: "کوانت", flag: "Q", kind: "crypto" },
  { code: "AAVE", name: "Aave", nameFa: "آوه", flag: "◇", kind: "crypto" },
  { code: "GRT", name: "The Graph", nameFa: "گراف", flag: "⌗", kind: "crypto" },
  { code: "SAND", name: "The Sandbox", nameFa: "سندباکس", flag: "⏹", kind: "crypto" },
  { code: "MANA", name: "Decentraland", nameFa: "مانا", flag: "◇", kind: "crypto" },
  { code: "CRV", name: "Curve", nameFa: "کرو", flag: "⌒", kind: "crypto" },
  { code: "MKR", name: "Maker", nameFa: "میکر", flag: "Ⓜ", kind: "crypto" },
  { code: "SNX", name: "Synthetix", nameFa: "سینتتیکس", flag: "S", kind: "crypto" },
  { code: "COMP", name: "Compound", nameFa: "کامپاند", flag: "C", kind: "crypto" },
  { code: "PEPE", name: "Pepe", nameFa: "پپه", flag: "🐸", kind: "crypto" },
  { code: "BCH", name: "Bitcoin Cash", nameFa: "بیت‌کوین کش", flag: "₿", kind: "crypto" },
  { code: "XMR", name: "Monero", nameFa: "مونرو", flag: "ɱ", kind: "crypto" },
  { code: "ZEC", name: "Zcash", nameFa: "زدکش", flag: "ⓩ", kind: "crypto" },
  { code: "DASH", name: "Dash", nameFa: "دش", flag: "Đ", kind: "crypto" },
];

const catalogByCode = new Map(EXCHANGE_CURRENCY_CATALOG.map((e) => [e.code, e]));

export function getCatalogEntry(code) {
  const c = String(code || "")
    .trim()
    .toUpperCase();
  return catalogByCode.get(c) || null;
}

/**
 * @param {string} query - جستجو در کد، نام انگلیسی یا فارسی
 * @param {"all"|"fiat"|"crypto"} kind
 * @param {number} limit
 */
export function searchExchangeCatalog(query, kind = "all", limit = 40) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  let list = EXCHANGE_CURRENCY_CATALOG;
  if (kind === "fiat") list = list.filter((x) => x.kind === "fiat");
  if (kind === "crypto") list = list.filter((x) => x.kind === "crypto");
  if (!q) return list.slice(0, limit);
  return list
    .filter((x) => {
      const hay = `${x.code} ${x.name} ${x.nameFa || ""}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, limit);
}
