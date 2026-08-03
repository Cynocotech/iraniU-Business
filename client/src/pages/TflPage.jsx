import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiGet } from "../api.js";

// ── Farsi names for TfL lines ────────────────────────────────────────────────
const LINE_FA = {
  bakerloo:           { fa: "باکرلو",              color: "#B36305" },
  central:            { fa: "سنترال",              color: "#E32017" },
  circle:             { fa: "سیرکل",               color: "#FFD300", dark: true },
  district:           { fa: "دیستریکت",            color: "#00782A" },
  "hammersmith-city": { fa: "همرسمیت و سیتی",      color: "#F3A9BB", dark: true },
  jubilee:            { fa: "جوبیلی",              color: "#A0A5A9" },
  metropolitan:       { fa: "مترو‌پولیتن",          color: "#9B0056" },
  northern:           { fa: "نورترن",              color: "#000000" },
  piccadilly:         { fa: "پیکادیلی",            color: "#003688" },
  victoria:           { fa: "ویکتوریا",            color: "#0098D4" },
  "waterloo-city":    { fa: "واترلو و سیتی",       color: "#95CDBA", dark: true },
  dlr:                { fa: "دی‌ال‌آر",            color: "#00A4A7" },
  overground:         { fa: "اورگراند",            color: "#EE7C0E" },
  "elizabeth-line":   { fa: "خط الیزابت",          color: "#6950A1" },
};

// ── Tube line details ────────────────────────────────────────────────────────
const TUBE_LINES_DETAIL = [
  {
    id: "bakerloo", fa: "باکرلو", color: "#B36305", textDark: false,
    zones: "۱–۵",
    hours: "دو تا شنبه: ۰۵:۰۷–۰۰:۳۰ | یکشنبه: ۰۷:۰۰–۲۳:۳۰",
    tip: "از الفنت اند کاسل در جنوب تا هرو در شمال‌غرب",
    stations: ["الفنت اند کاسل","واترلو","چارینگ کراس","پیکادیلی سیرکوس","آکسفورد سیرکوس","بیکر استریت","پادینگتون","هرو اند ویلداستون"],
  },
  {
    id: "central", fa: "سنترال", color: "#E32017", textDark: false,
    zones: "۱–۶",
    hours: "دو تا شنبه: ۰۵:۰۲–۰۰:۳۰ | Night Tube: جمعه و شنبه",
    tip: "طولانی‌ترین خط مترو لندن — از ایلینگ در غرب تا اپینگ در شرق",
    stations: ["ایلینگ برادوی","نوتینگ هیل گیت","شفرد بوش","آکسفورد سیرکوس","توتنهام کورت رود","بانک","لیورپول استریت","استراتفورد"],
  },
  {
    id: "circle", fa: "سیرکل", color: "#FFD300", textDark: true,
    zones: "۱–۲",
    hours: "دو تا شنبه: ۰۵:۳۰–۰۰:۱۲ | یکشنبه: ۰۷:۰۰–۲۳:۵۴",
    tip: "دایره‌ای — از همرسمیت عبور از پادینگتون، کینگز کراس، تاور هیل و ویکتوریا",
    stations: ["همرسمیت","پادینگتون","ادگور رود","بیکر استریت","کینگز کراس","فارینگدون","لیورپول استریت","تاور هیل","ویکتوریا","ساوت کنزینگتون"],
  },
  {
    id: "district", fa: "دیستریکت", color: "#00782A", textDark: false,
    zones: "۱–۶",
    hours: "دو تا شنبه: ۰۵:۳۰–۰۰:۳۰ | یکشنبه: ۰۷:۰۰–۲۳:۳۰",
    tip: "از ریچموند و ویمبلدون در غرب تا اپمینستر در شرق",
    stations: ["ریچموند / ویمبلدون","ایرل کورت","ساوت کنزینگتون","اسلون اسکوئر","ویکتوریا","وست‌مینستر","امبنکمنت","تاور هیل","اپمینستر"],
  },
  {
    id: "hammersmith-city", fa: "همرسمیت و سیتی", color: "#F3A9BB", textDark: true,
    zones: "۱–۵",
    hours: "دو تا شنبه: ۰۵:۱۷–۰۰:۳۰ | یکشنبه: ۰۷:۰۰–۲۳:۳۰",
    tip: "از همرسمیت در غرب تا بارکینگ در شرق — از طریق ادگور رود و بیکر استریت",
    stations: ["همرسمیت","پادینگتون","ادگور رود","بیکر استریت","کینگز کراس","فارینگدون","لیورپول استریت","وایت‌چپل","بارکینگ"],
  },
  {
    id: "jubilee", fa: "جوبیلی", color: "#A0A5A9", textDark: false,
    zones: "۱–۴",
    hours: "دو تا شنبه: ۰۵:۴۶–۰۰:۳۰ | Night Tube: جمعه و شنبه",
    tip: "از ستنمور در شمال‌غرب تا استراتفورد در شرق — عبور از کنری وارف",
    stations: ["ستنمور","ویمبلی پارک","بیکر استریت","باند استریت","گرین پارک","وست‌مینستر","واترلو","لندن بریج","کنری وارف","استراتفورد"],
  },
  {
    id: "metropolitan", fa: "مترو‌پولیتن", color: "#9B0056", textDark: false,
    zones: "۱–۹",
    hours: "دو تا شنبه: ۰۵:۳۰–۰۰:۳۰ | یکشنبه: ۰۷:۰۰–۲۳:۳۰",
    tip: "قدیمی‌ترین خط مترو جهان — از الدگیت تا آمرشام، واتفورد و اوکسبریج",
    stations: ["الدگیت","لیورپول استریت","مورگیت","کینگز کراس","بیکر استریت","فینچلی رود","ویمبلی پارک","هرو-آن-دی-هیل","اوکسبریج / آمرشام / واتفورد"],
  },
  {
    id: "northern", fa: "نورترن", color: "#000000", textDark: false,
    zones: "۱–۵",
    hours: "دو تا شنبه: ۰۵:۱۵–۰۰:۳۰ | Night Tube: جمعه و شنبه",
    tip: "از شمال (هیگ بارنت / ادگور) تا جنوب (مُردن) — دو شاخه در مرکز",
    stations: ["هیگ بارنت / ادگور","گلدرز گرین","کمدن تاون","یوستون","کینگز کراس","لندن بریج","بانک","واترلو","الفنت اند کاسل","مُردن"],
  },
  {
    id: "piccadilly", fa: "پیکادیلی", color: "#003688", textDark: false,
    zones: "۱–۶",
    hours: "دو تا شنبه: ۰۵:۰۲–۰۰:۳۰ | Night Tube: جمعه و شنبه",
    tip: "🛫 مستقیم به فرودگاه هیترو — ترمینال ۱و۲و۳ تا ترمینال ۵",
    stations: ["هیترو ترمینال ۵","هیترو ترمینال ۱و۲و۳","ایرل کورت","نایتسبریج","هاید پارک کرنر","گرین پارک","پیکادیلی سیرکوس","لستر اسکوئر","کاونت گاردن","هولبورن","کینگز کراس","فینزبری پارک","کاکفاسترز"],
  },
  {
    id: "victoria", fa: "ویکتوریا", color: "#0098D4", textDark: false,
    zones: "۱–۳",
    hours: "دو تا شنبه: ۰۵:۰۰–۰۰:۳۰ | Night Tube: جمعه و شنبه",
    tip: "از بریکستون در جنوب تا والتمستو در شمال‌شرق — یکی از سریع‌ترین خطوط",
    stations: ["بریکستون","استاکول","واکسهال","پیملیکو","ویکتوریا","گرین پارک","آکسفورد سیرکوس","وارن استریت","یوستون","کینگز کراس","هایبری اند ایزلینگتون","سون سیسترز","توتنهام هیل","والتمستو سنترال"],
  },
  {
    id: "waterloo-city", fa: "واترلو و سیتی", color: "#95CDBA", textDark: true,
    zones: "۱",
    hours: "دو تا جمعه: ۰۶:۰۰–۰۰:۳۰ | شنبه: ۰۷:۳۰–۲۱:۳۱ | یکشنبه: تعطیل ❌",
    tip: "فقط ۲ ایستگاه — سریع‌ترین مسیر بین واترلو و مرکز مالی (سیتی)",
    stations: ["واترلو","بانک"],
  },
  {
    id: "dlr", fa: "دی‌ال‌آر (DLR)", color: "#00A4A7", textDark: false,
    zones: "۱–۴",
    hours: "دو تا شنبه: ۰۵:۳۰–۰۰:۳۰ | یکشنبه: ۰۷:۳۰–۲۳:۳۰",
    tip: "قطار بدون راننده — از بانک تا گرینویچ، ووئیچ ارسنال و بکتون",
    stations: ["بانک / تاور گیتوی","لیم‌هاوس","وست‌فری","کنری وارف","ایل‌اند گاردنز","کاتی سارک","گرینویچ","لوئیشام / ووئیچ ارسنال / بکتون"],
  },
  {
    id: "overground", fa: "اورگراند", color: "#EE7C0E", textDark: false,
    zones: "۱–۶",
    hours: "متفاوت بر اساس مسیر — معمولاً ۰۵:۳۰–۰۰:۳۰",
    tip: "شبکه‌ای از خطوط سطحی در سراسر لندن — ۶ خط با رنگ‌های مختلف",
    stations: ["ریچموند","کلاپهام جانکشن","داستون جانکشن","هکنی سنترال","استراتفورد","پکهام ری","کریستال پالاس","ویمبلی سنترال"],
  },
  {
    id: "elizabeth-line", fa: "خط الیزابت", color: "#6950A1", textDark: false,
    zones: "۱–۹",
    hours: "دو تا شنبه: ۰۶:۰۰–۲۳:۳۰ | یکشنبه: ۰۸:۰۰–۲۳:۰۰",
    tip: "✨ جدیدترین خط (۲۰۲۲) — از هیترو و ریدینگ تا ابی وود و سنفورد",
    stations: ["هیترو ترمینال ۲و۳","هیترو ترمینال ۴","هیترو ترمینال ۵","پادینگتون","باند استریت","توتنهام کورت رود","فارینگدون","لیورپول استریت","وایت‌چپل","کنری وارف","ابی وود / سنفورد"],
  },
];

const MODE_FA = {
  tube: "مترو", bus: "اتوبوس", walking: "پیاده‌روی",
  dlr: "دی‌ال‌آر", overground: "اورگراند", "elizabeth-line": "خط الیزابت",
  "national-rail": "قطار ملی", "tflrail": "تی‌اف‌ال ریل", cable: "تله‌کابین",
};

const SEV_FA = {
  "Good Service": "سرویس عادی ✓",
  "Minor Delays": "تأخیر جزئی ⚠",
  "Severe Delays": "تأخیر شدید ✗",
  "Part Suspended": "تعلیق جزئی ✗",
  "Suspended": "متوقف ✗",
  "Part Closure": "بسته جزئی ✗",
  "Planned Closure": "بسته برنامه‌ریزی‌شده",
  "Service Closed": "سرویس بسته",
  "Reduced Service": "سرویس محدود",
  "Bus Service": "سرویس اتوبوس",
  "No Issues": "بدون مشکل ✓",
};

// ── Important places ─────────────────────────────────────────────────────────
const PLACES = [
  // Airports
  { id: "51.4700,-0.4543",   fa: "✈ فرودگاه هیترو (همه ترمینال‌ها)", cat: "airport", note: "با مترو پیکادیلی یا خط الیزابت" },
  { id: "51.1481,-0.1903",   fa: "✈ فرودگاه گتویک", cat: "airport", note: "قطار گتویک اکسپرس از ویکتوریا" },
  { id: "51.8860,0.2389",    fa: "✈ فرودگاه استنستد", cat: "airport", note: "قطار استنستد اکسپرس از لیورپول استریت" },
  { id: "51.8745,-0.3677",   fa: "✈ فرودگاه لوتن", cat: "airport", note: "قطار تامس‌لاین از سنت پنکراس" },
  // Hospitals
  { id: "51.5531,-0.1655",   fa: "🏥 بیمارستان رویال فری", cat: "hospital", note: "مترو: Belsize Park خط نورترن" },
  { id: "51.4833,-0.1833",   fa: "🏥 بیمارستان چلسی و وست‌مینستر", cat: "hospital", note: "مترو: Fulham Broadway خط دیستریکت" },
  { id: "51.5155,-0.1757",   fa: "🏥 بیمارستان سنت مری (پادینگتون)", cat: "hospital", note: "مترو: Paddington" },
  { id: "51.5246,-0.1340",   fa: "🏥 بیمارستان یونیورسیتی کالج (UCH)", cat: "hospital", note: "مترو: Warren Street" },
  { id: "51.4735,-0.1828",   fa: "🏥 بیمارستان کینگز کالج", cat: "hospital", note: "قطار: Denmark Hill" },
  // Government / Iranian community
  { id: "51.4994,-0.1749",   fa: "🇮🇷 سفارت ایران در لندن", cat: "community", note: "مترو: Gloucester Road" },
  { id: "51.4981,-0.1289",   fa: "🏛 اداره مهاجرت (Home Office)", cat: "government", note: "مترو: Pimlico" },
  { id: "51.4989,-0.1378",   fa: "🪪 اداره پاسپورت (Passport Office)", cat: "government", note: "مترو: Victoria" },
  { id: "51.5136,-0.0886",   fa: "⚖ دادگاه عالی (Royal Courts of Justice)", cat: "government", note: "مترو: Temple" },
  { id: "51.5034,-0.1276",   fa: "🏛 پارلمان بریتانیا (Westminster)", cat: "government", note: "مترو: Westminster" },
  // Community & Shopping
  { id: "51.5199,-0.1700",   fa: "🛍 خیابان ادگوار رود (مرکز ایرانی-عربی)", cat: "community", note: "مترو: Edgware Road" },
  { id: "51.5072,-0.2215",   fa: "🛍 وست‌فیلد لندن (شپرد بوش)", cat: "shopping", note: "مترو: Shepherd's Bush" },
  { id: "51.5427,-0.0060",   fa: "🛍 وست‌فیلد استرتفورد", cat: "shopping", note: "مترو: Stratford" },
  { id: "51.5012,-0.1800",   fa: "🏘 کنزینگتون (جامعه ایرانی)", cat: "community", note: "مترو: High Street Kensington" },
  { id: "51.5072,-0.0760",   fa: "🛒 بازار پوتیکو بلو (Portobello Road)", cat: "shopping", note: "مترو: Notting Hill Gate" },
  // Tourism
  { id: "51.5080,-0.1281",   fa: "📸 میدان ترافالگار", cat: "tourism", note: "مترو: Charing Cross" },
  { id: "51.5014,-0.1419",   fa: "👑 کاخ باکینگهام", cat: "tourism", note: "مترو: St James's Park" },
  { id: "51.5194,-0.1270",   fa: "🏺 موزه بریتانیا", cat: "tourism", note: "مترو: Tottenham Court Road" },
  { id: "51.5073,-0.1657",   fa: "🌳 پارک هاید", cat: "tourism", note: "مترو: Hyde Park Corner" },
  { id: "51.5033,-0.1195",   fa: "🎡 چرخ لندن (London Eye)", cat: "tourism", note: "مترو: Waterloo یا Westminster" },
  { id: "51.5081,-0.0759",   fa: "🗼 برج لندن", cat: "tourism", note: "مترو: Tower Hill" },
  // Transport hubs
  { id: "51.4965,-0.1447",   fa: "🚉 ایستگاه ویکتوریا", cat: "transport", note: "مترو + اتوبوس + قطار ملی" },
  { id: "51.5154,-0.1755",   fa: "🚉 ایستگاه پادینگتون", cat: "transport", note: "مترو + هیترو اکسپرس" },
  { id: "51.5308,-0.1238",   fa: "🚉 ایستگاه کینگز کراس / سنت پنکراس", cat: "transport", note: "۶ خط مترو + قطار ملی + یوروستار" },
  { id: "51.5031,-0.1132",   fa: "🚉 ایستگاه واترلو", cat: "transport", note: "بزرگ‌ترین ایستگاه لندن" },
  { id: "51.5178,-0.1060",   fa: "🚉 ایستگاه لندن بریج", cat: "transport", note: "مترو + قطار ملی" },
];

const CAT_FA = {
  airport: "فرودگاه‌ها", hospital: "بیمارستان‌ها", government: "ادارات دولتی",
  community: "جامعه ایرانی", shopping: "خرید", tourism: "گردشگری", transport: "ایستگاه‌های مهم",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function modeIcon(mode) {
  if (!mode) return "🚇";
  const m = mode.toLowerCase();
  if (m === "walking") return "🚶";
  if (m === "bus") return "🚌";
  if (m.includes("tube") || m.includes("metro")) return "🚇";
  if (m === "dlr") return "🚈";
  if (m.includes("overground")) return "🚆";
  if (m.includes("elizabeth")) return "🟣";
  if (m.includes("rail")) return "🚆";
  return "🚇";
}
function durationFa(mins) {
  if (!mins) return "";
  if (mins < 60) return `${mins} دقیقه`;
  return `${Math.floor(mins / 60)} ساعت و ${mins % 60} دقیقه`;
}
function timeFa(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

// ── Line Status widget ────────────────────────────────────────────────────────
function LineStatus() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet("/api/tfl/status")
      .then(setLines)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "#64748b", padding: "1rem 0" }}>در حال بارگذاری وضعیت خطوط…</p>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
      {lines.map((l) => {
        const info = LINE_FA[l.id] || { fa: l.name, color: "#73208a" };
        const ok = l.severity >= 10;
        return (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.85rem", borderRadius: 10, background: ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}` }}>
            <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: info.color, flexShrink: 0, border: "1.5px solid rgba(0,0,0,0.15)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#0f172a" }}>{info.fa}</div>
              <div style={{ fontSize: "0.72rem", color: ok ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
                {SEV_FA[l.status] || l.status}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Journey Planner ───────────────────────────────────────────────────────────
function JourneyPlanner() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  function useGPS() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFrom(`${pos.coords.latitude},${pos.coords.longitude}`);
        setGpsLoading(false);
      },
      () => { setErr("دسترسی به موقعیت مکانی رد شد."); setGpsLoading(false); }
    );
  }

  async function plan(e) {
    e.preventDefault();
    if (!from || !to) return;
    setLoading(true); setErr(null); setResult(null);
    try {
      const data = await apiGet(`/api/tfl/journey?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setResult(data);
    } catch (ex) {
      setErr(ex.message || "خطا در برنامه‌ریزی مسیر. لطفاً دوباره امتحان کنید.");
    } finally {
      setLoading(false);
    }
  }

  const journeys = result?.journeys?.slice(0, 3) || [];

  return (
    <div>
      <form onSubmit={plan} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {/* From */}
        <div>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "0.3rem" }}>مبدأ (از کجا؟)</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={from.includes(",") && from.split(",").length === 2 ? "📍 موقعیت مکانی فعلی شما" : from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="آدرس، کد پستی یا نام ایستگاه به انگلیسی…"
              style={{ flex: 1, padding: "0.6rem 0.9rem", borderRadius: 10, border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "0.88rem", outline: "none", direction: "ltr" }}
            />
            <button type="button" onClick={useGPS} disabled={gpsLoading} title="استفاده از موقعیت مکانی"
              style={{ padding: "0.6rem 0.85rem", borderRadius: 10, border: "1.5px solid #73208a", background: "#f3e8ff", color: "#73208a", cursor: "pointer", fontSize: "1rem", whiteSpace: "nowrap", fontWeight: 700 }}>
              {gpsLoading ? "⏳" : "📍 موقعیت من"}
            </button>
          </div>
        </div>

        {/* To */}
        <div>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "0.3rem" }}>مقصد (به کجا؟)</label>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: "100%", padding: "0.6rem 0.9rem", borderRadius: 10, border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "0.88rem", background: "#fff", outline: "none" }}
          >
            <option value="">— مقصد را انتخاب کنید —</option>
            {Object.entries(CAT_FA).map(([cat, catFa]) => (
              <optgroup key={cat} label={catFa}>
                {PLACES.filter((p) => p.cat === cat).map((p) => (
                  <option key={p.id} value={p.id}>{p.fa}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <button type="submit" disabled={!from || !to || loading}
          style={{ padding: "0.75rem", borderRadius: 12, border: "none", background: loading ? "#a78bfa" : "#73208a", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: "1rem", cursor: loading ? "default" : "pointer", transition: "background 0.15s" }}>
          {loading ? "⏳ در حال جستجوی مسیر…" : "🔍 پیدا کردن مسیر"}
        </button>
      </form>

      {err && (
        <div style={{ marginTop: "1rem", padding: "0.85rem 1rem", borderRadius: 10, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", fontWeight: 600 }}>
          {err}
        </div>
      )}

      {journeys.length > 0 && (
        <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#1e293b" }}>
            {journeys.length} مسیر پیشنهادی یافت شد:
          </h3>
          {journeys.map((j, ji) => (
            <div key={ji} style={{ background: "#f8faff", border: "1.5px solid #e0e7ff", borderRadius: 14, padding: "1rem 1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <span style={{ background: "#73208a", color: "#fff", borderRadius: 20, padding: "0.25rem 0.8rem", fontSize: "0.78rem", fontWeight: 800 }}>
                  مسیر {ji + 1}
                </span>
                <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>
                  ⏱ {durationFa(j.duration)}
                </span>
                {j.startDateTime && (
                  <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    حرکت: {timeFa(j.startDateTime)} — رسیدن: {timeFa(j.arrivalDateTime)}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {j.legs?.map((leg, li) => {
                  const modeName = leg.mode?.name || "";
                  const modeLabel = MODE_FA[modeName] || modeName;
                  return (
                    <div key={li} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "1.2rem", marginTop: "0.05rem", flexShrink: 0 }}>{modeIcon(modeName)}</span>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b" }}>
                          {modeLabel === "پیاده‌روی"
                            ? `🚶 پیاده‌روی — ${durationFa(leg.duration)}`
                            : `${modeLabel}: ${leg.departurePoint?.commonName || ""}`}
                        </div>
                        {leg.instruction?.summary && modeName !== "walking" && (
                          <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.15rem", direction: "ltr", textAlign: "left" }}>
                            {leg.instruction.summary}
                          </div>
                        )}
                        {modeName !== "walking" && leg.arrivalPoint?.commonName && (
                          <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: "0.1rem" }}>
                            تا ایستگاه: <strong>{leg.arrivalPoint.commonName}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tube Lines tab ───────────────────────────────────────────────────────────
function TubeLines() {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {TUBE_LINES_DETAIL.map((line) => {
        const isOpen = open === line.id;
        const fg = line.textDark ? "#1e293b" : "#fff";
        return (
          <div key={line.id} style={{ borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.09)" }}>
            {/* Header */}
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : line.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1.1rem", background: line.color, border: "none", cursor: "pointer", textAlign: "right" }}
            >
              <span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.3)", flexShrink: 0, border: `2px solid ${fg}` }} />
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: "0.95rem", color: fg, fontFamily: "inherit" }}>{line.fa}</span>
                <span style={{ fontSize: "0.75rem", color: line.textDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)", fontFamily: "inherit" }}>زون {line.zones}</span>
              </div>
              <span style={{ color: fg, fontSize: "0.85rem", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div style={{ background: "#fff", padding: "1rem 1.25rem", borderTop: `2px solid ${line.color}` }}>
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: "#4b5563", lineHeight: 1.6 }}>
                  {line.tip}
                </p>

                {/* Station trail */}
                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.8rem", color: "#374151" }}>ایستگاه‌های کلیدی:</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", alignItems: "center" }}>
                    {line.stations.map((st, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <span style={{ padding: "0.2rem 0.6rem", borderRadius: 20, background: "#f1f5f9", border: `1.5px solid ${line.color}`, fontSize: "0.75rem", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>
                          {st}
                        </span>
                        {i < line.stations.length - 1 && (
                          <span style={{ color: line.color, fontWeight: 700, fontSize: "0.8rem" }}>←</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hours */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div style={{ padding: "0.4rem 0.75rem", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.75rem", color: "#374151", lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 700 }}>🕐 ساعت کار: </span>{line.hours}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Maps tab ─────────────────────────────────────────────────────────────────
const MAPS = [
  {
    title: "نقشه مترو لندن (Tube Map)",
    desc: "نقشه رسمی همه خطوط مترو، DLR، اورگراند و خط الیزابت — برای دانلود یا مشاهده آنلاین",
    color: "#003688",
    links: [
      { label: "مشاهده نقشه تعاملی TfL", href: "https://tfl.gov.uk/maps/track/tube", icon: "🗺" },
      { label: "دانلود PDF نقشه مترو", href: "https://tfl.gov.uk/cdn/static/cms/documents/standard-tube-map.pdf", icon: "📥" },
    ],
  },
  {
    title: "نقشه خط الیزابت (Elizabeth Line)",
    desc: "نقشه جداگانه خط الیزابت — جدیدترین خط لندن از هیترو تا ابی وود",
    color: "#6950A1",
    links: [
      { label: "مشاهده نقشه خط الیزابت", href: "https://tfl.gov.uk/maps/track/elizabeth-line", icon: "🟣" },
    ],
  },
  {
    title: "نقشه اورگراند (Overground)",
    desc: "نقشه شبکه اورگراند — ۶ خط در سراسر لندن",
    color: "#EE7C0E",
    links: [
      { label: "مشاهده نقشه اورگراند", href: "https://tfl.gov.uk/maps/track/london-overground", icon: "🚆" },
    ],
  },
  {
    title: "نقشه دسترسی برای ویلچر (Step-free)",
    desc: "نقشه ایستگاه‌های بدون پله — مناسب برای افراد با محدودیت حرکتی",
    color: "#0098D4",
    links: [
      { label: "نقشه Step-free", href: "https://tfl.gov.uk/maps/track/step-free-tube-guide", icon: "♿" },
    ],
  },
  {
    title: "نقشه قطارهای ملی (National Rail)",
    desc: "نقشه شبکه قطار سراسر انگلستان — برای سفرهای خارج از لندن",
    color: "#c00",
    links: [
      { label: "نقشه قطارهای ملی", href: "https://www.nationalrail.co.uk/travel-information/maps-of-the-national-rail-network/", icon: "🚄" },
    ],
  },
  {
    title: "نقشه اتوبوس‌های لندن",
    desc: "نقشه خطوط اتوبوس در مناطق مختلف لندن",
    color: "#DC241F",
    links: [
      { label: "نقشه‌های اتوبوس TfL", href: "https://tfl.gov.uk/maps/bus", icon: "🚌" },
    ],
  },
];

// ── Main page ────────────────────────────────────────────────────────────────
export default function TflPage() {
  const [activeTab, setActiveTab] = useState("journey");

  const tabs = [
    { id: "journey", label: "🗺 مسیریاب" },
    { id: "status",  label: "🚇 وضعیت خطوط" },
    { id: "lines",   label: "🛤 خطوط قطار" },
    { id: "maps",    label: "🗾 نقشه‌ها" },
    { id: "places",  label: "📍 مقصدهای مهم" },
    { id: "guide",   label: "📖 راهنمای سفر" },
  ];

  return (
    <>
      <Seo
        title="راهنمای حمل‌ونقل لندن به فارسی"
        description="مسیریاب TfL لندن به فارسی — مترو، اتوبوس، DLR، خط الیزابت. مسیر به بیمارستان‌ها، فرودگاه‌ها، سفارت ایران و مکان‌های مهم لندن به زبان فارسی."
        keywords="حمل‌ونقل لندن, مترو لندن فارسی, TfL فارسی, مسیریاب لندن, اتوبوس لندن, راهنمای مترو"
      />

      {/* ── Hero ── */}
      <div style={{ background: "linear-gradient(135deg, #0a1628 0%, #003688 60%, #0a1628 100%)", padding: "3.5rem 1.5rem 2.5rem", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(220,36,31,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,160,226,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", padding: "0.3rem 1rem", borderRadius: 20, background: "rgba(220,36,31,0.2)", border: "1px solid rgba(220,36,31,0.4)" }}>
            <span style={{ fontSize: "1.4rem" }}>🚇</span>
            <span style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 700 }}>Transport for London — به فارسی</span>
          </div>
          <h1 style={{ fontSize: "clamp(1.7rem, 5vw, 2.6rem)", fontWeight: 900, color: "#fff", margin: "0 0 0.75rem", lineHeight: 1.35 }}>
            راهنمای کامل حمل‌ونقل لندن
            <br />
            <span style={{ background: "linear-gradient(90deg, #DC241F, #00A0E2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              برای فارسی‌زبانان
            </span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.95rem", maxWidth: 520, margin: "0 auto 2rem", lineHeight: 1.8 }}>
            مسیریاب، وضعیت زنده مترو، راهنمای رسیدن به بیمارستان‌ها، فرودگاه‌ها، سفارت ایران و مکان‌های مهم لندن — همه به زبان فارسی
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            {[
              { icon: "🚇", val: "۱۱ خط", label: "مترو" },
              { icon: "🚌", val: "۷۰۰+", label: "خط اتوبوس" },
              { icon: "📍", val: "۳۰+", label: "مقصد مهم" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.3rem" }}>{s.icon}</div>
                <strong style={{ color: "#fff", display: "block", fontSize: "1.1rem" }}>{s.val}</strong>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              style={{ flex: "0 0 auto", padding: "0.85rem 1.25rem", border: "none", background: "none", fontFamily: "inherit", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", color: activeTab === t.id ? "#003688" : "#64748b", borderBottom: activeTab === t.id ? "3px solid #003688" : "3px solid transparent", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* ── Journey Planner tab ── */}
        {activeTab === "journey" && (
          <div>
            <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>🗺 مسیریاب TfL</h2>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.85rem", color: "#64748b" }}>
              موقعیت خود را انتخاب کنید و مقصد را از لیست بزنید تا مسیر کامل با مترو و اتوبوس برایتان نمایش داده شود.
            </p>
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 20px rgba(0,0,0,0.08)", padding: "1.5rem" }}>
              <JourneyPlanner />
            </div>

            {/* Emergency box */}
            <div style={{ marginTop: "1.5rem", background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 14, padding: "1rem 1.25rem" }}>
              <p style={{ margin: "0 0 0.5rem", fontWeight: 800, color: "#9a3412" }}>🚨 اورژانس و اطلاعات مهم</p>
              <ul style={{ margin: 0, paddingRight: "1.2rem", lineHeight: 2, fontSize: "0.88rem", color: "#7c2d12" }}>
                <li>اورژانس: <strong style={{ direction: "ltr", display: "inline-block" }}>999</strong></li>
                <li>پلیس غیر اورژانس: <strong style={{ direction: "ltr", display: "inline-block" }}>101</strong></li>
                <li>TfL اطلاعات: <strong style={{ direction: "ltr", display: "inline-block" }}>0343 222 1234</strong></li>
                <li>تاکسی بلک‌کب: در کنار خیابان دست بلند کنید</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Line Status tab ── */}
        {activeTab === "status" && (
          <div>
            <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>🚇 وضعیت زنده خطوط مترو</h2>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.85rem", color: "#64748b" }}>
              وضعیت لحظه‌ای خطوط مترو، DLR، اورگراند و خط الیزابت از سیستم TfL.
            </p>
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 20px rgba(0,0,0,0.08)", padding: "1.5rem" }}>
              <LineStatus />
            </div>

            {/* Line map guide */}
            <div style={{ marginTop: "1.5rem", background: "#fff", borderRadius: 16, boxShadow: "0 2px 20px rgba(0,0,0,0.08)", padding: "1.5rem" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>رنگ‌بندی خطوط مترو</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" }}>
                {Object.entries(LINE_FA).map(([id, info]) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.45rem 0.7rem", borderRadius: 8, background: "#f8fafc" }}>
                    <span style={{ display: "inline-block", width: 22, height: 8, borderRadius: 4, background: info.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}>{info.fa}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tube Lines tab ── */}
        {activeTab === "lines" && (
          <div>
            <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>🛤 خطوط مترو و قطار لندن</h2>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.85rem", color: "#64748b" }}>
              روی هر خط کلیک کنید تا ایستگاه‌های کلیدی و ساعات کار را ببینید.
            </p>
            <TubeLines />

            {/* Night Tube note */}
            <div style={{ marginTop: "1.5rem", background: "#0f172a", borderRadius: 14, padding: "1rem 1.25rem" }}>
              <p style={{ margin: "0 0 0.5rem", fontWeight: 800, color: "#f8fafc", fontSize: "0.9rem" }}>🌙 Night Tube — مترو شبانه</p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
                جمعه و شنبه شب، این خطوط ۲۴ ساعته کار می‌کنند:
                <br />
                <strong style={{ color: "#E32017" }}>سنترال</strong> ·{" "}
                <strong style={{ color: "#0098D4" }}>ویکتوریا</strong> ·{" "}
                <strong style={{ color: "#A0A5A9" }}>جوبیلی</strong> ·{" "}
                <strong style={{ color: "#000" }}>نورترن</strong> ·{" "}
                <strong style={{ color: "#003688" }}>پیکادیلی</strong>
              </p>
            </div>
          </div>
        )}

        {/* ── Maps tab ── */}
        {activeTab === "maps" && (
          <div>
            <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>🗾 نقشه‌های حمل‌ونقل لندن</h2>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.85rem", color: "#64748b" }}>
              لینک دانلود و مشاهده نقشه‌های رسمی TfL — نقشه‌ها به زبان انگلیسی هستند اما توضیحات بالا کمک می‌کنند.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {MAPS.map((m) => (
                <div key={m.title} style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 14px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                  <div style={{ background: m.color, padding: "0.85rem 1.1rem" }}>
                    <p style={{ margin: 0, fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>{m.title}</p>
                  </div>
                  <div style={{ padding: "0.85rem 1.1rem" }}>
                    <p style={{ margin: "0 0 0.85rem", fontSize: "0.82rem", color: "#4b5563", lineHeight: 1.6 }}>{m.desc}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {m.links.map((lk) => (
                        <a key={lk.href} href={lk.href} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.9rem", borderRadius: 10, background: "#f8fafc", border: `1.5px solid ${m.color}`, color: m.color, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none", transition: "background 0.15s", fontFamily: "inherit" }}>
                          <span>{lk.icon}</span> {lk.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tips */}
            <div style={{ marginTop: "1.5rem", background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 14, padding: "1rem 1.25rem" }}>
              <p style={{ margin: "0 0 0.5rem", fontWeight: 800, color: "#1e40af" }}>💡 راهنمای استفاده از نقشه</p>
              <ul style={{ margin: 0, paddingRight: "1.2rem", lineHeight: 2, fontSize: "0.85rem", color: "#1e3a8a" }}>
                <li>نقشه مترو رایگان در همه ایستگاه‌ها موجود است — از کارمندان بخواهید.</li>
                <li>در اپ TfL Go یا Google Maps می‌توانید نقشه تعاملی با مسیریاب ببینید.</li>
                <li>هر خط در نقشه با رنگ مشخص شده — رنگ‌های بالای صفحه را مطالعه کنید.</li>
                <li>Zone (زون) نشان‌دهنده فاصله از مرکز لندن است — زون ۱ مرکز است.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Important Places tab ── */}
        {activeTab === "places" && (
          <div>
            <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>📍 مقصدهای مهم لندن</h2>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.85rem", color: "#64748b" }}>
              برای برنامه‌ریزی مسیر، روی دکمه «برنامه‌ریزی مسیر» کلیک کنید.
            </p>
            {Object.entries(CAT_FA).map(([cat, catFa]) => {
              const catPlaces = PLACES.filter((p) => p.cat === cat);
              if (!catPlaces.length) return null;
              return (
                <div key={cat} style={{ marginBottom: "1.75rem" }}>
                  <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 800, color: "#003688", borderBottom: "2px solid #e0e7ff", paddingBottom: "0.4rem" }}>
                    {catFa}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {catPlaces.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderRadius: 12, background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>{p.fa}</div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.15rem" }}>{p.note}</div>
                        </div>
                        <button type="button"
                          onClick={() => setActiveTab("journey")}
                          style={{ padding: "0.4rem 0.85rem", borderRadius: 8, border: "1.5px solid #003688", background: "#eff6ff", color: "#003688", fontFamily: "inherit", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                          🗺 برنامه‌ریزی مسیر
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Guide tab ── */}
        {activeTab === "guide" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>📖 راهنمای جامع حمل‌ونقل لندن به فارسی</h2>
              <p style={{ margin: "0 0 1.5rem", fontSize: "0.85rem", color: "#64748b" }}>هر آنچه برای سفر در لندن باید بدانید.</p>
            </div>

            {[
              {
                icon: "💳", title: "کارت اویستر (Oyster Card) چیست؟",
                items: [
                  "اویستر یک کارت پرداخت هوشمند است که برای مترو، اتوبوس، DLR، اورگراند و خط الیزابت استفاده می‌شود.",
                  "در هر ایستگاه مترو و دفاتر پست قابل تهیه است — هزینه کارت: ۷ پوند (قابل استرداد)",
                  "سقف روزانه (Daily Cap) دارد: حداکثر مبلغی که در یک روز پرداخت می‌کنید محدود است.",
                  "کارت‌های بانکی بی‌سیم (Contactless) نیز مستقیم کار می‌کنند — مثل اویستر.",
                  "بدون کارت، بلیت کاغذی ۲ تا ۳ برابر گران‌تر است!",
                ],
              },
              {
                icon: "🚇", title: "نحوه استفاده از مترو",
                items: [
                  "کارت اویستر یا کارت بانکی بی‌سیم را هنگام ورود و خروج به روی دستگاه زرد رنگ بزنید (Touch in / Touch out).",
                  "اگر فراموش کنید Touch out کنید، بیشترین کرایه ممکن کسر می‌شود.",
                  "ساعات اوج (Peak): دوشنبه تا جمعه ۶:۳۰-۹:۳۰ و ۱۶:۰۰-۱۹:۰۰ — گران‌تر است.",
                  "اتوبوس‌های قرمز: فقط با اویستر یا کارت بانکی — پول نقد قبول نمی‌شود!",
                  "نقشه مترو رایگان در همه ایستگاه‌ها موجود است — بخواهید.",
                ],
              },
              {
                icon: "🚌", title: "راهنمای اتوبوس",
                items: [
                  "هنگام سوار شدن فقط یک بار کارت بزنید (Touch in) — هنگام پیاده شدن نیازی نیست.",
                  "در یک ساعت، تعویض اتوبوس رایگان است (Hopper fare).",
                  "شماره اتوبوس روی علامت ایستگاه نوشته است.",
                  "TfL Arrivals: در گوگل بنویسید «bus [شماره ایستگاه] arrivals» تا زمان دقیق آمدن را ببینید.",
                  "نزدیک‌ترین توقفگاه را در اپ TfL Go یا Google Maps جستجو کنید.",
                ],
              },
              {
                icon: "✈", title: "رفتن به فرودگاه‌ها",
                items: [
                  "هیترو: خط پیکادیلی (آبی تیره) از مرکز لندن — حدود ۵۰ دقیقه | یا خط الیزابت (بنفش) — سریع‌تر",
                  "گتویک: قطار Gatwick Express از ایستگاه ویکتوریا — ۳۰ دقیقه",
                  "استنستد: قطار Stansted Express از Liverpool Street — ۴۷ دقیقه",
                  "لوتن: قطار Thameslink از St Pancras International + شاتل",
                  "توصیه: حداقل ۳ ساعت قبل از پرواز به فرودگاه برسید.",
                ],
              },
              {
                icon: "🌙", title: "حمل‌ونقل شبانه",
                items: [
                  "Night Tube: جمعه و شنبه شب تمام شب کار می‌کند — خطوط Central، Jubilee، Northern، Piccadilly، Victoria",
                  "Night Bus: اتوبوس‌های N با N شروع می‌شوند — تمام شب کار می‌کنند",
                  "اتوبوس N97 مستقیم به هیترو می‌رود از مرکز لندن",
                  "تاکسی بلک‌کب: ۲۴ ساعته — دست بالا بگیرید اگر چراغ زرد بالا روشن است",
                  "Uber و تاکسی آنلاین: در لندن بسیار رایج است",
                ],
              },
              {
                icon: "♿", title: "دسترسی برای افراد با محدودیت حرکتی",
                items: [
                  "ایستگاه‌های Step-free (بدون پله): به نقشه TfL مراجعه کنید — نماد ♿ دارند",
                  "تمام اتوبوس‌های لندن دارای کمپ برای ویلچر هستند",
                  "خط الیزابت بیشترین ایستگاه بدون پله را دارد",
                  "با TfL تماس بگیرید: ۰۳۴۳ ۲۲۲ ۱۲۳۴ — راهنمایی ویژه ارائه می‌دهند",
                ],
              },
              {
                icon: "💡", title: "نکات مهم و کاربردی",
                items: [
                  "زمان رفتن به ایستگاه، سمت راست بایستید روی پله برقی — سمت چپ برای عبور است.",
                  "در مترو از کوله‌پشتی حذر کنید — فضا کم است و دیگران را آزار می‌دهد.",
                  "در اتوبوس‌های دوطبقه، طبقه بالا منظره بهتری دارد!",
                  "اپ رسمی: TfL Go — نقشه زنده و اعلان‌های تأخیر",
                  "Wi-Fi رایگان در همه ایستگاه‌های مترو موجود است.",
                  "گم شدید؟ از هر کارمند TfL با لباس آبی کمک بخواهید — مؤدب و کمک‌رسان هستند.",
                ],
              },
            ].map((section) => (
              <div key={section.title} style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.07)", padding: "1.25rem 1.5rem" }}>
                <h3 style={{ margin: "0 0 0.9rem", fontSize: "1rem", fontWeight: 800, color: "#003688", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>{section.icon}</span> {section.title}
                </h3>
                <ul style={{ margin: 0, paddingRight: "1.1rem", lineHeight: 2.1, color: "#374151", fontSize: "0.88rem" }}>
                  {section.items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            ))}

            {/* Useful links */}
            <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
              <h3 style={{ margin: "0 0 0.9rem", fontSize: "1rem", fontWeight: 800, color: "#1e40af" }}>🔗 لینک‌های مفید TfL</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  { href: "https://tfl.gov.uk/plan-a-journey/", label: "مسیریاب رسمی TfL" },
                  { href: "https://tfl.gov.uk/tube-dlr-overground/status/", label: "وضعیت زنده خطوط" },
                  { href: "https://tfl.gov.uk/fares/", label: "تعرفه‌ها و نرخ‌ها" },
                  { href: "https://tfl.gov.uk/travel-information/zones/", label: "نقشه زون‌های مترو" },
                ].map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                    style={{ color: "#1d4ed8", fontWeight: 600, fontSize: "0.88rem", direction: "ltr", display: "inline-block" }}>
                    ← {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
