import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "../api.js";
import { useBusinessCategories } from "../hooks/useBusinessCategories.js";
import DemoBottomNav from "../components/DemoBottomNav.jsx";
import AiSearchModal from "../components/AiSearchModal.jsx";

/* ── Typed-word animation ─────────────────────────────────────── */
const TYPED_WORDS = ["کسب‌وکار", "رستوران", "آرایشگاه", "وکیل", "صرافی", "پزشک", "مکانیک"];
function useTyped(words) {
  const [typedWord, setTypedWord] = useState(words[0]);
  const ref = useRef({ wordIdx: 0, charIdx: words[0].length, deleting: false });
  useEffect(() => {
    let timer;
    const tick = () => {
      const s = ref.current;
      const word = words[s.wordIdx];
      if (!s.deleting && s.charIdx === word.length) {
        timer = setTimeout(() => { s.deleting = true; tick(); }, 2000);
        return;
      }
      if (s.deleting && s.charIdx === 0) {
        s.deleting = false;
        s.wordIdx = (s.wordIdx + 1) % words.length;
        timer = setTimeout(tick, 350);
        return;
      }
      s.charIdx += s.deleting ? -1 : 1;
      setTypedWord(words[s.wordIdx].slice(0, s.charIdx));
      timer = setTimeout(tick, s.deleting ? 55 : 100);
    };
    timer = setTimeout(() => { ref.current.deleting = true; tick(); }, 2500);
    return () => clearTimeout(timer);
  }, [words]);
  return typedWord;
}

/* ── Category icons ───────────────────────────────────────────── */
const CAT_ICONS = {
  "رستوران":"🍽","سلامت":"❤️","خرده‌فروشی":"🛍","خدمات":"🤝","زیبایی":"💅",
  "آموزش":"🎓","خدمات ساختمان":"🔨","فروشگاه":"🏪","مکانیک":"🔧","فرش":"🛋",
  "پیتزا و ساندویچ":"🍕","کلینیک زیبایی":"✂️","کافی شاپ":"☕","سایر خدمات":"🛎",
  "شرکت های صنعتی":"🏭","صرافی":"💱","طلا فروشی و جواهری":"💎","حسابدار":"🧮",
  "شیرینی فروشی":"🎂","خیاطی و مزون":"👗","طراحی سایت و آی تی":"💻",
  "آموزش هنری و علمی":"📚","باربری":"🚚","خدمات مجالس":"🥂","مدرسه":"🏫",
  "مشاور املاک":"🏠","مشاور مهاجرت":"✈️","چاپ و تبلیغات":"🖨",
  "دیجیتال مارکتینگ":"📣","آموزش رانندگی":"🚗","مشاور کسب و کار":"💼",
  "تراپیست":"🧘","محصولات غذایی":"🍎","عکاسی":"📷","باشگاه ورزشی":"🏋️",
  "دامپزشکی و پت شاپ":"🐾","مشاور مالیات":"📊","خشکشویی":"👔",
};
const DEFAULT_ICON = "🏷";

const REVIEWS = [
  { text: "از وقتی آگهی‌مون رو در ایرانیو ثبت کردیم، مشتری‌های جدیدی از این سایت با ما تماس گرفتن. واقعاً مفیده!", name: "علی رضایی", role: "مالک رستوران", city: "لندن" },
  { text: "ایرانیو بهترین جای پیدا کردن کسب‌وکارهای ایرانی در انگلیسه. خیلی راحت می‌شه پیدا کرد.", name: "مریم محمدی", role: "مشتری", city: "منچستر" },
  { text: "به عنوان وکیل مهاجرت، ثبت اطلاعات در ایرانیو خیلی کمک کرد تا با ایرانیان بیشتری ارتباط بگیرم.", name: "رضا کریمی", role: "وکیل مهاجرت", city: "برمینگام" },
];

const BOOST_LABEL = { diamond:"💠 الماسی", platinum:"💎 پلاتینیوم", gold:"🥇 طلایی", silver:"🥈 نقره‌ای" };

/* ══════════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════════ */
const S = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.hp { font-family: 'Yekan Bakh', 'Nunito', Tahoma, sans-serif; color: #444; background: #fff; min-height: 100vh; direction: rtl; }
@font-face { font-family: 'Yekan Bakh'; font-weight:400; src: url('/fonts/YekanBakh-Regular.otf') format('opentype'); }
@font-face { font-family: 'Yekan Bakh'; font-weight:700; src: url('/fonts/YekanBakh-Bold.otf') format('opentype'); }
@font-face { font-family: 'Yekan Bakh'; font-weight:800; src: url('/fonts/YekanBakh-ExtraBlack.otf') format('opentype'); }

/* ── NAV ── */
.hp-nav { position:fixed; top:0; left:0; right:0; z-index:1000; background:#fff; box-shadow:0 2px 12px rgba(0,0,0,0.08); height:68px; }
.hp-nav__inner { max-width:1200px; margin:0 auto; padding:0 1.5rem; height:100%; display:flex; align-items:center; justify-content:space-between; gap:1.5rem; }
.hp-nav__logo img { height:36px; display:block; }
.hp-nav__links { display:flex; align-items:center; gap:0.15rem; }
.hp-nav__links a { color:#444; text-decoration:none; padding:0.4rem 0.8rem; border-radius:6px; font-size:0.88rem; font-weight:600; transition:color 0.2s,background 0.2s; }
.hp-nav__links a:hover { color:#73208a; background:#f6f0fa; }
.hp-nav__links a.hp-nav--active { color:#73208a; }
.hp-nav__actions { display:flex; gap:0.6rem; align-items:center; }
.hp-nav__burger { display:none; background:none; border:none; font-size:1.3rem; color:#444; cursor:pointer; padding:0.4rem; border-radius:6px; }
.hp-nav__burger:hover { background:#f5f5f5; }

/* mobile menu */
.hp-mmenu { display:none; position:fixed; top:68px; left:0; right:0; z-index:999; background:#fff; border-bottom:2px solid #f0f0f0; padding:1rem 1.5rem 1.5rem; flex-direction:column; gap:0.2rem; box-shadow:0 8px 24px rgba(0,0,0,0.1); }
.hp-mmenu--open { display:flex; }
.hp-mmenu a { color:#444; text-decoration:none; padding:0.7rem 0.85rem; border-radius:8px; font-size:0.95rem; font-weight:600; display:flex; align-items:center; gap:0.5rem; }
.hp-mmenu a:hover { background:#f6f0fa; color:#73208a; }
.hp-mmenu a i { color:#73208a; width:18px; text-align:center; }
.hp-mmenu__sep { height:1px; background:#f0f0f0; margin:0.5rem 0; }
.hp-mmenu__btns { display:flex; flex-direction:column; gap:0.5rem; margin-top:0.25rem; }

/* ── BTN ── */
.hp-btn { display:inline-flex; align-items:center; gap:0.4rem; padding:0.5rem 1.2rem; border-radius:8px; font-size:0.88rem; font-weight:700; cursor:pointer; text-decoration:none; border:none; transition:all 0.2s; font-family:inherit; white-space:nowrap; }
.hp-btn--orange { background:#73208a; color:#fff; }
.hp-btn--orange:hover { background:#5a1a6e; transform:translateY(-1px); box-shadow:0 4px 14px rgba(115,32,138,0.35); }
.hp-btn--ghost { background:transparent; color:#73208a; border:2px solid #73208a; }
.hp-btn--ghost:hover { background:#f6f0fa; }
.hp-btn--white { background:#fff; color:#73208a; font-weight:700; }
.hp-btn--white:hover { background:#f6f0fa; }
.hp-btn--dark { background:#1e2d3d; color:#fff; }
.hp-btn--dark:hover { background:#162330; transform:translateY(-1px); }
.hp-btn--lg { padding:0.7rem 1.8rem; font-size:0.95rem; border-radius:10px; }

/* ── HERO ── */
.hp-hero { position:relative; min-height:600px; display:flex; align-items:center; overflow:hidden; margin-top:68px; padding:5rem 1.5rem 4rem; }
.hp-hero__bg { position:absolute; inset:0; background:linear-gradient(135deg,#1a0a2e 0%,#3a0a5e 100%); }
.hp-hero__bg::after { content:''; position:absolute; inset:0; background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
.hp-hero__inner { position:relative; z-index:1; max-width:800px; margin:0 auto; width:100%; text-align:center; }
.hp-hero__badge { display:inline-block; background:rgba(255,255,255,0.15); color:rgba(255,255,255,0.9); border:1px solid rgba(255,255,255,0.3); font-size:0.78rem; font-weight:700; padding:0.3rem 1rem; border-radius:99px; margin-bottom:1.25rem; letter-spacing:0.06em; }
.hp-btn--cta { background:#ff6b35; color:#fff; }
.hp-btn--cta:hover { background:#e85c28; transform:translateY(-1px); box-shadow:0 4px 14px rgba(255,107,53,0.35); }
.hp-hero__h1 { color:#fff; font-size:clamp(1.9rem,5vw,3rem); font-weight:800; line-height:1.25; margin-bottom:0.75rem; }
.hp-hero__typed { color:#ff6b35; border-bottom:3px solid rgba(255,107,53,0.5); padding-bottom:2px; }
.hp-hero__cursor { display:inline-block; color:#ff6b35; font-weight:300; margin-inline:1px; animation:hp-cursor-blink 0.85s step-end infinite; }
@keyframes hp-cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
.hp-hero__sub { color:rgba(255,255,255,0.6); font-size:1rem; margin-bottom:2.5rem; }

/* search box — glassmorphic */
.hp-hero__box { background:rgba(255,255,255,0.1); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.2); border-radius:20px; padding:1.35rem; box-shadow:0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18); }
.hp-hero__tabs { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem; justify-content:center; }
.hp-hero__tab { padding:0.35rem 0.9rem; border-radius:99px; font-size:0.8rem; font-weight:700; font-family:"Yekan Bakh",sans-serif; cursor:pointer; border:1.5px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.12); color:rgba(255,255,255,0.85); transition:all 0.18s; }
.hp-hero__tab:hover, .hp-hero__tab--active { background:#ff6b35; color:#fff; border-color:#ff6b35; }
.hp-hero__row { display:grid; grid-template-columns:2fr 1fr 1fr auto; gap:0.75rem; }
.hp-hero__input, .hp-hero__select { width:100%; padding:0.7rem 1rem; border-radius:10px; border:1.5px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.18); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); font-size:0.9rem; font-family:inherit; color:#fff; outline:none; transition:border-color 0.2s,background 0.2s; }
.hp-hero__input::placeholder { color:rgba(255,255,255,0.55); }
.hp-hero__select option { background:#3d1049; color:#fff; }
.hp-hero__input:focus, .hp-hero__select:focus { border-color:#ff6b35; background:rgba(255,255,255,0.25); }
.hp-hero__input::placeholder { color:#aaa; }
.hp-hero__ai-row { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.65rem; }
.hp-hero__ai-chip { display:inline-flex; align-items:center; gap:0.4rem; padding:0.3rem 0.75rem; border-radius:20px; border:1.5px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.6); font-size:0.78rem; font-weight:600; font-family:inherit; cursor:pointer; transition:all 0.2s; }
.hp-hero__ai-chip--on { border-color:#ff6b35; background:rgba(255,107,53,0.18); color:#ff6b35; }
.hp-hero__ai-dot { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.25); transition:background 0.2s; }
.hp-hero__ai-dot--on { background:#ff6b35; box-shadow:0 0 6px rgba(255,107,53,0.7); }
.hp-hero__ai-hint { font-size:0.74rem; color:rgba(255,255,255,0.45); }

/* ── STATS BAR ── */
.hp-stats { background:#fff; border-bottom:1px solid #f0f0f0; padding:1.5rem 1.5rem; }
.hp-stats__inner { max-width:1200px; margin:0 auto; display:flex; align-items:center; justify-content:center; gap:0; }
.hp-stats__item { flex:1; text-align:center; padding:0.5rem 1rem; border-left:1px solid #f0f0f0; }
.hp-stats__item:last-child { border-left:none; }
.hp-stats__item { display:flex; flex-direction:column; align-items:center; }
.hp-stats__icon { font-size:1.4rem; color:#73208a; margin-bottom:0.35rem; }
.hp-stats__num { font-size:1.8rem; font-weight:800; color:#1e2d3d; display:block; line-height:1; }
.hp-stats__label { font-size:0.8rem; color:#999; margin-top:0.25rem; }

/* ── SECTION SHELL ── */
.hp-sec { padding:4.5rem 1.5rem; }
.hp-sec--gray { background:#f8f9fc; }
.hp-sec--dark { background:#1e2d3d; }
.hp-sec__inner { max-width:1200px; margin:0 auto; }
.hp-sec__head { text-align:center; margin-bottom:2.75rem; }
.hp-sec__eyebrow { font-size:0.78rem; font-weight:700; color:#73208a; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:0.5rem; }
.hp-sec__title { font-size:clamp(1.4rem,3vw,1.85rem); font-weight:800; color:#1e2d3d; margin-bottom:0.6rem; }
.hp-sec--dark .hp-sec__title { color:#fff; }
.hp-sec__sub { font-size:0.93rem; color:#888; max-width:500px; margin:0 auto; line-height:1.6; }
.hp-sec--dark .hp-sec__sub { color:rgba(255,255,255,0.5); }
.hp-sec__more { text-align:center; margin-top:2.5rem; }

/* ── CATEGORY CARDS ── */
.hp-cat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:1rem; }
.hp-cat-card { background:#fff; border:1.5px solid #f0f0f0; border-radius:14px; padding:1.4rem 0.75rem 1.1rem; text-align:center; text-decoration:none; color:#333; transition:all 0.22s; display:flex; flex-direction:column; align-items:center; gap:0.55rem; cursor:pointer; }
.hp-cat-card:hover { border-color:#73208a; box-shadow:0 8px 28px rgba(115,32,138,0.13); transform:translateY(-3px); }
.hp-cat-card__icon { width:52px; height:52px; border-radius:14px; background:#f6f0fa; display:flex; align-items:center; justify-content:center; font-size:1.55rem; transition:background 0.2s; }
.hp-cat-card:hover .hp-cat-card__icon { background:#ede0f5; }
.hp-cat-card__name { font-size:0.8rem; font-weight:700; color:#333; }
.hp-cat-card__count { font-size:0.72rem; color:#73208a; font-weight:600; background:#f6f0fa; padding:0.15rem 0.55rem; border-radius:99px; }

/* ── LISTING CARDS ── */
.hp-listings-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; }
.hp-card { background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.07); border:1px solid #f0f0f0; transition:transform 0.22s,box-shadow 0.22s; display:flex; flex-direction:column; }
.hp-card:hover { transform:translateY(-4px); box-shadow:0 12px 40px rgba(0,0,0,0.13); }
.hp-card__media { position:relative; height:200px; background:linear-gradient(135deg,#e8f4ff,#dde8f5); flex-shrink:0; overflow:hidden; }
.hp-card__img { width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.35s; }
.hp-card:hover .hp-card__img { transform:scale(1.04); }
.hp-card__placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:3rem; font-weight:800; color:rgba(30,45,61,0.15); }
.hp-card__badges { position:absolute; top:0.75rem; right:0.75rem; display:flex; flex-direction:column; gap:0.35rem; align-items:flex-start; }
.hp-card__badge { font-size:0.7rem; font-weight:700; padding:0.22rem 0.6rem; border-radius:6px; }
.hp-card__badge--featured { background:#73208a; color:#fff; }
.hp-card__badge--open { background:#22c55e; color:#fff; }
.hp-card__badge--boost-diamond  { background:#ecfeff; color:#0891b2; border:1px solid #a5f3fc; }
.hp-card__badge--boost-platinum { background:#ede9fe; color:#5b21b6; border:1px solid #c4b5fd; }
.hp-card__badge--boost-gold     { background:#fffbeb; color:#b45309; border:1px solid #fcd34d; }
.hp-card__badge--boost-silver   { background:#f3f4f6; color:#374151; border:1px solid #d1d5db; }
.hp-card__cat-tag { position:absolute; bottom:0.75rem; right:0.75rem; background:rgba(30,45,61,0.75); color:#fff; font-size:0.7rem; font-weight:700; padding:0.22rem 0.6rem; border-radius:6px; backdrop-filter:blur(4px); }
.hp-card__body { padding:1.1rem 1.25rem 1.25rem; flex:1; display:flex; flex-direction:column; gap:0.35rem; }
.hp-card__title { font-size:1rem; font-weight:800; color:#1e2d3d; text-decoration:none; }
.hp-card__title:hover { color:#73208a; }
.hp-card__meta { display:flex; align-items:center; gap:0.35rem; font-size:0.82rem; color:#888; }
.hp-card__meta i { color:#73208a; font-size:0.75rem; }
.hp-card__rating { display:flex; align-items:center; gap:0.35rem; margin-top:0.25rem; }
.hp-card__stars { color:#fbbf24; font-size:0.85rem; letter-spacing:-0.03em; }
.hp-card__rating-val { font-size:0.82rem; font-weight:700; color:#1e2d3d; }
.hp-card__rating-count { font-size:0.78rem; color:#aaa; }
.hp-card__footer { margin-top:auto; padding-top:0.85rem; border-top:1px solid #f5f5f5; }
.hp-card__view { display:flex; align-items:center; justify-content:center; gap:0.4rem; width:100%; padding:0.6rem 1rem; border-radius:10px; background:#73208a; color:#fff; font-size:0.85rem; font-weight:700; text-decoration:none; transition:background 0.18s; }
.hp-card__view:hover { background:#5a1a6e; color:#fff; }

/* boost animation on cards */
@keyframes hp-pulse-diamond  { 0%,100%{box-shadow:0 0 0 0 rgba(8,145,178,0.5),0 2px 16px rgba(0,0,0,0.07)}  50%{box-shadow:0 0 0 6px rgba(8,145,178,0),0 8px 28px rgba(8,145,178,0.2)} }
@keyframes hp-pulse-platinum { 0%,100%{box-shadow:0 0 0 0 rgba(109,40,217,0.45),0 2px 16px rgba(0,0,0,0.07)} 50%{box-shadow:0 0 0 6px rgba(109,40,217,0),0 8px 28px rgba(109,40,217,0.2)} }
.hp-card--boost-diamond  { border-color:#67e8f9; animation:hp-pulse-diamond  2.2s ease-in-out infinite; }
.hp-card--boost-platinum { border:2px solid transparent !important; background:linear-gradient(#fff,#fff) padding-box,conic-gradient(from var(--plat-angle,0deg),transparent 0deg,transparent 265deg,rgba(196,181,253,0.7) 285deg,#a78bfa 300deg,#e0d7ff 312deg,#a78bfa 324deg,rgba(196,181,253,0.7) 342deg,transparent 360deg) border-box !important; box-shadow:0 0 16px rgba(139,92,246,0.2),0 4px 16px rgba(0,0,0,0.07) !important; animation:plat-border-spin 3s linear infinite !important; overflow:hidden !important; }
.hp-card--boost-gold     { border-color:#fcd34d; border-width:2px; }
.hp-card--boost-silver   { border-color:#d1d5db; border-width:2px; }

/* ── CITY CARDS ── */
.hp-city-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:1rem; }
.hp-city-card { position:relative; border-radius:14px; overflow:hidden; height:130px; text-decoration:none; display:block; }
.hp-city-card__bg { position:absolute; inset:0; background:linear-gradient(135deg,#1e2d3d,#2d4a6e); background-size:cover; background-position:center; transition:transform 0.35s; }
.hp-city-card:hover .hp-city-card__bg { transform:scale(1.07); }
.hp-city-card__overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.1) 60%); }
.hp-city-card__body { position:absolute; bottom:0; right:0; left:0; padding:0.75rem 0.9rem; }
.hp-city-card__name { color:#fff; font-weight:800; font-size:0.95rem; display:block; }
.hp-city-card__count { color:rgba(255,255,255,0.7); font-size:0.75rem; margin-top:0.15rem; }

/* ── TESTIMONIALS ── */
.hp-testi-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1.25rem; }
.hp-testi { background:#fff; border:1.5px solid #f0f0f0; border-radius:16px; padding:1.6rem; display:flex; flex-direction:column; gap:1rem; }
.hp-testi:hover { border-color:#d4b8e0; box-shadow:0 6px 24px rgba(115,32,138,0.1); }
.hp-testi__quote { color:#73208a; font-size:2.5rem; line-height:1; margin-bottom:-0.5rem; }
.hp-testi__text { font-size:0.9rem; color:#555; line-height:1.7; flex:1; }
.hp-testi__stars { color:#fbbf24; font-size:0.9rem; letter-spacing:0.05em; }
.hp-testi__author { display:flex; align-items:center; gap:0.75rem; padding-top:0.75rem; border-top:1px solid #f5f5f5; }
.hp-testi__avatar { width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg,#73208a,#5a1a6e); color:#fff; font-weight:800; font-size:1rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.hp-testi__name { font-weight:700; font-size:0.88rem; color:#1e2d3d; }
.hp-testi__role { font-size:0.78rem; color:#aaa; }

/* ── CTA BAND ── */
.hp-cta { background:linear-gradient(135deg,#73208a 0%,#5a1a6e 100%); padding:4.5rem 1.5rem; text-align:center; }
.hp-cta__inner { max-width:640px; margin:0 auto; }
.hp-cta__h2 { color:#fff; font-size:clamp(1.5rem,4vw,2.2rem); font-weight:800; margin-bottom:0.75rem; }
.hp-cta__sub { color:rgba(255,255,255,0.75); font-size:0.97rem; line-height:1.7; margin-bottom:2rem; }
.hp-cta__btns { display:flex; gap:1rem; justify-content:center; flex-wrap:wrap; }

/* ── NEWSLETTER ── */
.hp-news { background:#f8f9fc; padding:3.5rem 1.5rem; text-align:center; border-top:1px solid #eee; }
.hp-news__inner { max-width:480px; margin:0 auto; }
.hp-news__title { font-size:1.2rem; font-weight:800; color:#1e2d3d; margin-bottom:0.5rem; }
.hp-news__sub { font-size:0.88rem; color:#888; margin-bottom:1.25rem; }
.hp-news__form { display:flex; gap:0.5rem; }
.hp-news__email { flex:1; padding:0.7rem 1rem; border:1.5px solid #e0e0e0; border-radius:8px; font-size:0.9rem; font-family:inherit; color:#333; outline:none; }
.hp-news__email:focus { border-color:#73208a; }

/* ── FOOTER ── */
.hp-footer { background:linear-gradient(135deg,#1a0a2e 0%,#3a0a5e 100%); color:rgba(255,255,255,0.65); padding:4rem 1.5rem 2rem; }
.hp-footer__inner { max-width:1200px; margin:0 auto; }
.hp-footer__grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:2.5rem; margin-bottom:3rem; }
.hp-footer__logo img { height:36px; margin-bottom:1rem; }
.hp-footer__desc { font-size:0.88rem; line-height:1.7; color:rgba(255,255,255,0.45); margin-bottom:1.25rem; }
.hp-footer__social { display:flex; gap:0.5rem; }
.hp-footer__soc-btn { width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.07); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.5); font-size:0.85rem; text-decoration:none; transition:background 0.2s,color 0.2s; }
.hp-footer__soc-btn:hover { background:#73208a; color:#fff; }
.hp-footer__col-title { color:#fff; font-size:0.92rem; font-weight:700; margin-bottom:1.1rem; }
.hp-footer__links { list-style:none; display:flex; flex-direction:column; gap:0.55rem; }
.hp-footer__links a { color:rgba(255,255,255,0.5); text-decoration:none; font-size:0.86rem; font-family:inherit; transition:color 0.18s; display:flex; align-items:center; gap:0.4rem; }
.hp-footer__links a::before { content:'›'; color:#73208a; font-size:1rem; }
.hp-footer__links a:hover { color:#73208a; }
.hp-footer__bottom { border-top:1px solid rgba(255,255,255,0.07); padding-top:1.75rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; font-size:0.82rem; color:rgba(255,255,255,0.3); }
.hp-footer__bottom a { color:rgba(255,255,255,0.4); text-decoration:none; }
.hp-footer__bottom a:hover { color:#73208a; }

/* ── RESPONSIVE ── */
@media(max-width:768px){
  .hp-nav__links,.hp-nav__actions { display:none; }
  .hp-nav__burger { display:flex; }
  .hp-hero__row { grid-template-columns:1fr 1fr; }
  .hp-hero__row > :nth-child(1) { grid-column:1/-1; }
  .hp-hero__row > :last-child { grid-column:1/-1; }
  .hp-footer { display:none; }
  .hp { padding-bottom: calc(4rem + env(safe-area-inset-bottom, 0px)); }
  .hp-listings-grid { grid-template-columns:1fr 1fr; }
  @media(max-width:520px) { .hp-listings-grid { grid-template-columns:1fr; } }
  .hp-stats__inner { flex-wrap:wrap; }
  .hp-stats__item { min-width:33%; border-left:none; border-bottom:1px solid #f0f0f0; padding:0.75rem; }
}
@media(max-width:480px){
  .hp-cat-grid { grid-template-columns:repeat(3,1fr); }
  .hp-footer__grid { grid-template-columns:1fr; }
  .hp-city-grid { grid-template-columns:1fr 1fr; }
  .hp-hero__tabs { gap:0.35rem; }
  .hp-hero__tab { font-size:0.73rem; padding:0.3rem 0.7rem; }
}

/* ── Ad Network Section ── */
.hp-adnet { background:linear-gradient(150deg,#0d0520 0%,#1a0a2e 45%,#2d0f4e 100%); padding:5rem 1.5rem; overflow:hidden; position:relative; }
.hp-adnet::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 80% 55% at 50% 50%,rgba(115,32,138,0.18) 0%,transparent 70%); pointer-events:none; }
.hp-adnet__inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:4rem; align-items:center; position:relative; z-index:1; }
.hp-adnet__eyebrow { font-size:0.75rem; font-weight:700; color:#ff6b35; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem; }
.hp-adnet__h2 { font-size:clamp(1.6rem,3vw,2.2rem); font-weight:800; color:#fff; margin:0 0 1rem; line-height:1.35; }
.hp-adnet__sub { color:rgba(255,255,255,0.58); font-size:0.95rem; line-height:1.75; margin:0 0 2rem; }
.hp-adnet__feats { list-style:none; padding:0; margin:0 0 2.5rem; display:flex; flex-direction:column; gap:0.85rem; }
.hp-adnet__feat { display:flex; align-items:flex-start; gap:0.7rem; color:rgba(255,255,255,0.82); font-size:0.9rem; line-height:1.5; }
.hp-adnet__feat i { color:#ff6b35; font-size:0.85rem; margin-top:0.2rem; flex-shrink:0; }
.hp-adnet__cta { display:inline-flex; align-items:center; gap:0.5rem; background:#ff6b35; color:#fff; font-size:0.95rem; font-weight:700; font-family:inherit; padding:0.8rem 2rem; border-radius:12px; text-decoration:none; transition:background 0.2s,transform 0.2s; border:none; cursor:pointer; }
.hp-adnet__cta:hover { background:#e85c28; transform:translateY(-2px); }
.hp-adnet__map { position:relative; }
.hp-adnet__map svg { width:100%; height:auto; display:block; }
@keyframes adnet-ring  { 0%{r:7;opacity:.7} 100%{r:22;opacity:0} }
@keyframes adnet-ring2 { 0%{r:7;opacity:.5} 100%{r:30;opacity:0} }
@keyframes adnet-hub   { 0%,100%{opacity:.6} 50%{opacity:1} }
@keyframes adnet-line  { 0%{stroke-dashoffset:300} 100%{stroke-dashoffset:0} }
@keyframes adnet-dot   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }
@keyframes adnet-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
.hp-adnet__map { animation:adnet-float 6s ease-in-out infinite; }
@media(max-width:860px) {
  .hp-adnet__inner { grid-template-columns:1fr; gap:2.5rem; }
  .hp-adnet__map { order:-1; max-width:480px; margin:0 auto; }
}

/* ── Featured Carousel ── */
.hp-carousel { position:relative; }
.hp-carousel__viewport { overflow:hidden; }
.hp-carousel__slide { display:none; }
.hp-carousel__slide--active { display:block; animation:hp-car-in 0.38s ease; }
@keyframes hp-car-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.hp-carousel__controls { display:flex; align-items:center; justify-content:center; gap:0.75rem; margin-top:1rem; }
.hp-carousel__btn { display:flex; align-items:center; justify-content:center; width:2.2rem; height:2.2rem; border-radius:50%; border:1.5px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.08); color:#fff; cursor:pointer; font-size:0.85rem; transition:background 0.2s,border-color 0.2s; }
.hp-carousel__btn:hover { background:#ff6b35; border-color:#ff6b35; }
.hp-carousel__dots { display:flex; align-items:center; gap:0.45rem; }
.hp-carousel__dot { width:0.5rem; height:0.5rem; border-radius:50%; border:none; padding:0; background:rgba(255,255,255,0.3); cursor:pointer; transition:background 0.2s,transform 0.2s; }
.hp-carousel__dot--active { background:#ff6b35; transform:scale(1.35); }
`;

/* ── CITY GRADIENTS for cards without photos ─── */
const CITY_GRADIENTS = [
  "linear-gradient(135deg,#1e3a5f,#2d6a9f)",
  "linear-gradient(135deg,#3d1a5e,#7c3aed)",
  "linear-gradient(135deg,#1a3d2b,#16a34a)",
  "linear-gradient(135deg,#5e1a1a,#dc2626)",
  "linear-gradient(135deg,#3d3800,#d97706)",
  "linear-gradient(135deg,#003d3d,#0891b2)",
];

export default function HomePageDemo() {
  const navigate = useNavigate();
  const { categories } = useBusinessCategories();
  const [businesses, setBusinesses] = useState([]);
  const [cityImagesDb, setCityImagesDb] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [activeTab, setActiveTab] = useState("همه");
  const typed = useTyped(TYPED_WORDS);

  useEffect(() => {
    apiGet("/api/businesses").then((r) => setBusinesses(Array.isArray(r) ? r : [])).catch(() => {});
    apiGet("/api/city-images").then((d) => setCityImagesDb(typeof d === "object" && d ? d : {})).catch(() => {});
  }, []);

  /* Boost-sorted featured */
  const featured = useMemo(() => {
    const seed = Number(new Date().toISOString().slice(0,10).replace(/-/g,"")) % 9973;
    const h = (s) => { let x=0; for(let i=0;i<s.length;i++) x=(x*31+s.charCodeAt(i))&0xffff; return x; };
    const diamond  = businesses.filter(b=>b.active_boost_plan==="diamond").sort((a,b)=>((h(a.slug)+seed)%100)-((h(b.slug)+seed)%100));
    const platinum = businesses.filter(b=>b.active_boost_plan==="platinum").sort((a,b)=>((h(a.slug)+seed)%100)-((h(b.slug)+seed)%100));
    const boosted = [...diamond,...platinum];
    const rest = businesses.filter(b=>!boosted.find(x=>x.slug===b.slug)).slice(0, Math.max(0, 9-boosted.length));
    return [...boosted,...rest].slice(0,9);
  }, [businesses]);

  /* Cities with count */
  const cities = useMemo(() => {
    const map = {};
    for (const b of businesses) {
      const c = String(b.city||"").trim();
      if (!c || /[؀-ۿ]/.test(c)) continue;
      map[c] = (map[c]||0)+1;
    }
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6);
  }, [businesses]);

  /* Category counts */
  const catCounts = useMemo(() => {
    const m = {};
    for (const b of businesses) if (b.category) m[b.category] = (m[b.category]||0)+1;
    return m;
  }, [businesses]);

  /* Top categories (with count) */
  const topCats = useMemo(() => {
    return [...categories]
      .sort((a,b)=>(catCounts[b.name]||0)-(catCounts[a.name]||0))
      .slice(0,10);
  }, [categories, catCounts]);

  const heroTabs = ["همه", ...topCats.slice(0,4).map(c=>c.name)];

  function handleSearch(e) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (searchQ) { p.set("q",searchQ); p.set("ai","1"); }
    if (searchCity) p.set("city",searchCity);
    if (activeTab !== "همه") p.set("cat", activeTab);
    navigate(`/listings?${p.toString()}`);
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="hp" dir="rtl" lang="fa">
      <style>{S}</style>

      {/* ── NAVBAR ── */}
      <nav className="hp-nav" aria-label="منوی اصلی">
        <div className="hp-nav__inner">
          <Link to="/" className="hp-nav__logo" onClick={closeMenu}>
            <img src="/images/iraniu-logo-header.png" alt="ایرانیو" />
          </Link>
          <div className="hp-nav__links">
            <Link to="/" className="hp-nav--active">خانه</Link>
            <Link to="/listings">آگهی‌ها</Link>
            <Link to="/exchanges">صرافی‌ها</Link>
            <Link to="/blog">وبلاگ</Link>
            <Link to="/tfl">🚇 حمل‌ونقل</Link>
            <Link to="/boost-plans">پلن‌های تبلیغاتی</Link>
          </div>
          <div className="hp-nav__actions">
            <Link to="/login" className="hp-btn hp-btn--ghost">ورود</Link>
            <Link to="/onboarding" className="hp-btn hp-btn--orange">ثبت کسب‌وکار</Link>
          </div>
          <button type="button" className="hp-nav__burger" onClick={() => setMenuOpen(v=>!v)} aria-label="منو">
            <i className={`fa-solid ${menuOpen?"fa-xmark":"fa-bars"}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`hp-mmenu${menuOpen?" hp-mmenu--open":""}`}>
        {[{to:"/",label:"خانه",icon:"fa-house"},{to:"/listings",label:"آگهی‌ها",icon:"fa-store"},{to:"/exchanges",label:"صرافی‌ها",icon:"fa-coins"},{to:"/blog",label:"وبلاگ",icon:"fa-newspaper"},{to:"/tfl",label:"حمل‌ونقل لندن",icon:"fa-bus"},{to:"/boost-plans",label:"پلن‌های تبلیغاتی",icon:"fa-bolt"}].map(l=>(
          <Link key={l.to} to={l.to} onClick={closeMenu}><i className={`fa-solid ${l.icon}`}/>{l.label}</Link>
        ))}
        <div className="hp-mmenu__sep"/>
        <div className="hp-mmenu__btns">
          <Link to="/login" className="hp-btn hp-btn--ghost" onClick={closeMenu} style={{justifyContent:"center"}}>ورود</Link>
          <Link to="/onboarding" className="hp-btn hp-btn--orange" onClick={closeMenu} style={{justifyContent:"center"}}>ثبت کسب‌وکار</Link>
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="hp-hero" aria-labelledby="hero-title">
        <div className="hp-hero__bg" aria-hidden="true"/>
        <div className="hp-hero__inner">
          <span className="hp-hero__badge">🇬🇧 کسب‌وکارهای ایرانی در بریتانیا</span>
          <h1 id="hero-title" className="hp-hero__h1">
            <span className="hp-hero__typed">{typed}</span><span className="hp-hero__cursor" aria-hidden="true">|</span>{" "}ایرانی را پیدا کنید
          </h1>
          <p className="hp-hero__sub">بیش از ۸۰۰ کسب‌وکار ایرانی در سراسر بریتانیا</p>

          <div className="hp-hero__box">
            {/* Category filter tabs */}
            <div className="hp-hero__tabs" role="tablist" aria-label="فیلتر دسته">
              {heroTabs.map(tab=>(
                <button
                  key={tab} type="button" role="tab"
                  className={`hp-hero__tab${activeTab===tab?" hp-hero__tab--active":""}`}
                  onClick={()=>setActiveTab(tab)}
                >
                  {tab === "همه" ? "همه دسته‌ها" : tab}
                </button>
              ))}
            </div>
            {/* Search form */}
            <form onSubmit={handleSearch}>
              <div className="hp-hero__row">
                <input
                  type="search" className="hp-hero__input"
                  placeholder="نام، شغل یا کلمه کلیدی…"
                  value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                  autoComplete="off"
                />
                <select className="hp-hero__select" value={searchCity} onChange={e=>setSearchCity(e.target.value)} aria-label="شهر">
                  <option value="">همه شهرها</option>
                  <option value="london">لندن</option>
                  <option value="manchester">منچستر</option>
                  <option value="birmingham">برمینگام</option>
                  <option value="glasgow">گلاسگو</option>
                  <option value="leeds">لیدز</option>
                  <option value="bristol">بریستول</option>
                </select>
                <select className="hp-hero__select" value={activeTab==="همه"?"":activeTab} onChange={e=>{setActiveTab(e.target.value||"همه");}} aria-label="دسته">
                  <option value="">همه دسته‌ها</option>
                  {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <button type="submit" className="hp-btn hp-btn--cta hp-btn--lg">
                  <i className="fa-solid fa-search" aria-hidden="true"/>
                  جستجو
                </button>
              </div>
            </form>

            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "0.5rem", width: "100%", marginTop: "0.75rem",
                background: "rgba(57,0,77,0.6)",
                border: "1.5px solid rgba(160,80,255,0.45)",
                borderRadius: "12px",
                color: "rgba(220,180,255,0.95)",
                fontFamily: "inherit", fontSize: "0.95rem", fontWeight: 600,
                padding: "0.75rem 1rem", cursor: "pointer",
              }}
            >
              ✨ جستجوی هوشمند با هوش مصنوعی
            </button>

          </div>
        </div>
      </section>

      {aiModalOpen && <AiSearchModal onClose={() => setAiModalOpen(false)} />}

      {/* ── STATS BAR ── */}
      <div className="hp-stats">
        <div className="hp-stats__inner">
          {[
            { num: businesses.length || "۸۰۰+", label: "کسب‌وکار ثبت‌شده",  icon: "fa-store" },
            { num: categories.length || "۴۰+",  label: "دسته‌بندی",          icon: "fa-layer-group" },
            { num: cities.length   || "۱۲+",   label: "شهر در بریتانیا",    icon: "fa-location-dot" },
            { num: featured.filter(b=>b.active_boost_plan).length || "۰", label: "آگهی برجسته فعال", icon: "fa-bolt" },
          ].map((s,i)=>(
            <div key={i} className="hp-stats__item">
              <i className={`fa-solid ${s.icon} hp-stats__icon`} aria-hidden="true"/>
              <span className="hp-stats__num">{typeof s.num === "number" ? s.num.toLocaleString("fa-IR") : s.num}</span>
              <div className="hp-stats__label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── POPULAR CATEGORIES ── */}
      {topCats.length > 0 && (
        <section className="hp-sec hp-sec--gray" aria-labelledby="cats-title">
          <div className="hp-sec__inner">
            <div className="hp-sec__head">
              <p className="hp-sec__eyebrow">مرور بر اساس دسته</p>
              <h2 id="cats-title" className="hp-sec__title">محبوب‌ترین دسته‌بندی‌ها</h2>
              <p className="hp-sec__sub">از رستوران و صرافی تا وکیل و پزشک — همه را اینجا پیدا کنید</p>
            </div>
            <div className="hp-cat-grid">
              {topCats.map(c=>(
                <Link key={c.id} to={`/listings?cat=${encodeURIComponent(c.name)}`} className="hp-cat-card">
                  <div className="hp-cat-card__icon">{CAT_ICONS[c.name]||DEFAULT_ICON}</div>
                  <span className="hp-cat-card__name">{c.name}</span>
                  {catCounts[c.name] && <span className="hp-cat-card__count">{catCounts[c.name]} آگهی</span>}
                </Link>
              ))}
            </div>
            <div className="hp-sec__more">
              <Link to="/listings" className="hp-btn hp-btn--dark">مشاهده همه دسته‌ها</Link>
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURED LISTINGS ── */}
      <section className="hp-sec" aria-labelledby="featured-title">
        <div className="hp-sec__inner">
          <div className="hp-sec__head">
            <p className="hp-sec__eyebrow">
              {featured.some(b=>b.active_boost_plan) ? "آگهی‌های برجسته" : "کسب‌وکارهای پرطرفدار"}
            </p>
            <h2 id="featured-title" className="hp-sec__title">
              {featured.some(b=>b.active_boost_plan) ? "آگهی‌های ویژه این دوره" : "بیشترین بازدید"}
            </h2>
            <p className="hp-sec__sub">کسب‌وکارهای ایرانی با بالاترین کیفیت و بیشترین تعامل</p>
          </div>
          <div className="hp-listings-grid">
            {featured.map(b=>{
              const href = `/business?slug=${encodeURIComponent(b.slug)}`;
              const cover = String(b.cover_image_url||"").trim();
              const bp = b.active_boost_plan;
              const letter = String(b.name_fa||"?").charAt(0);
              const rating = Number(b.rating)||0;
              return (
                <article key={b.slug} className={`hp-card${bp?` hp-card--boost-${bp}`:""}`}>
                  <Link to={href} style={{display:"block",flexShrink:0}}>
                    <div className="hp-card__media">
                      {cover
                        ? <img className="hp-card__img" src={cover} alt="" loading="lazy"/>
                        : <div className="hp-card__placeholder">{letter}</div>
                      }
                      <div className="hp-card__badges">
                        {bp && <span className={`hp-card__badge hp-card__badge--boost-${bp}`}>{BOOST_LABEL[bp]}</span>}
                        {!bp && <span className="hp-card__badge hp-card__badge--featured">Featured</span>}
                      </div>
                      {b.category && <span className="hp-card__cat-tag">{b.category}</span>}
                    </div>
                  </Link>
                  <div className="hp-card__body">
                    <Link to={href} className="hp-card__title">{b.name_fa}</Link>
                    {(b.address||b.city) && (
                      <div className="hp-card__meta">
                        <i className="fa-solid fa-location-dot"/>
                        {[b.address,b.city].filter(Boolean).join("، ")}
                      </div>
                    )}
                    {b.phone && (
                      <div className="hp-card__meta">
                        <i className="fa-solid fa-phone"/>
                        <span dir="ltr">{b.phone}</span>
                      </div>
                    )}
                    {rating > 0 && (
                      <div className="hp-card__rating">
                        <span className="hp-card__stars">{"★".repeat(Math.min(5,Math.round(rating)))}</span>
                        <span className="hp-card__rating-val">{rating.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="hp-card__footer">
                      <Link to={href} className="hp-card__view">
                        مشاهده آگهی <i className="fa-solid fa-arrow-left" style={{fontSize:"0.75rem"}}/>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hp-sec__more">
            <Link to="/listings" className="hp-btn hp-btn--orange hp-btn--lg">مشاهده همه آگهی‌ها</Link>
          </div>
        </div>
      </section>

      {/* ── AD NETWORK ── */}
      <section className="hp-adnet" aria-labelledby="adnet-title">
        <div className="hp-adnet__inner">

          {/* Text column */}
          <div className="hp-adnet__text">
            <p className="hp-adnet__eyebrow">
              <i className="fa-solid fa-broadcast-tower" aria-hidden="true"/>
              شبکه تبلیغاتی ایرانیو
            </p>
            <h2 id="adnet-title" className="hp-adnet__h2">
              آگهی شما در تمام<br/>نقاط کلیدی لندن
            </h2>
            <p className="hp-adnet__sub">
              با شبکه تبلیغاتی ایرانیو، کسب‌وکارتان در پُرترافیک‌ترین مناطق لندن به جامعه ایرانی معرفی می‌شود — از West End تا Canary Wharf.
            </p>
            <ul className="hp-adnet__feats">
              <li className="hp-adnet__feat"><i className="fa-solid fa-circle-check"/><span>نمایش هدفمند به ایرانیان مقیم بریتانیا</span></li>
              <li className="hp-adnet__feat"><i className="fa-solid fa-circle-check"/><span>پوشش ۱۲+ شهر بزرگ بریتانیا</span></li>
              <li className="hp-adnet__feat"><i className="fa-solid fa-circle-check"/><span>آمار بازدید و کلیک لحظه‌ای</span></li>
              <li className="hp-adnet__feat"><i className="fa-solid fa-circle-check"/><span>بودجه انعطاف‌پذیر برای همه کسب‌وکارها</span></li>
            </ul>
            <Link to="/boost-plans" className="hp-adnet__cta">
              <i className="fa-solid fa-bolt" aria-hidden="true"/>
              شروع تبلیغات
            </Link>
          </div>

          {/* London map SVG */}
          <div className="hp-adnet__map" aria-hidden="true">
            <svg viewBox="0 0 560 380" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Background */}
              <rect width="560" height="380" rx="20" fill="#0d0822"/>

              {/* Subtle grid */}
              {[60,120,180,240,300,360,420,480].map(x=>(
                <line key={`vg${x}`} x1={x} y1="0" x2={x} y2="380" stroke="rgba(196,181,253,0.05)" strokeWidth="1"/>
              ))}
              {[50,100,150,200,250,300,350].map(y=>(
                <line key={`hg${y}`} x1="0" y1={y} x2="560" y2={y} stroke="rgba(196,181,253,0.05)" strokeWidth="1"/>
              ))}

              {/* Thames river */}
              <path d="M 20 252 Q 100 244 180 240 Q 260 236 330 238 Q 400 240 460 250 Q 505 258 545 268"
                stroke="#3b82f6" strokeWidth="7" strokeLinecap="round" opacity="0.35"/>
              <path d="M 20 252 Q 100 244 180 240 Q 260 236 330 238 Q 400 240 460 250 Q 505 258 545 268"
                stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" strokeDasharray="8 6"/>
              <text x="355" y="256" fill="rgba(96,165,250,0.5)" fontSize="9" fontStyle="italic">Thames</text>

              {/* Connection lines from hub (Westminster ~260,208) to each node */}
              {[
                [95,205],[148,182],[198,152],[232,108],[310,122],[372,140],[350,178],[448,198],[295,230],[168,232],[270,278]
              ].map(([x,y],i)=>(
                <line key={`ln${i}`} x1="260" y1="208" x2={x} y2={y}
                  stroke="rgba(196,181,253,0.25)" strokeWidth="1.2"
                  strokeDasharray="300" strokeDashoffset="300"
                  style={{animation:`adnet-line 1.2s ease forwards`,animationDelay:`${0.2+i*0.1}s`}}/>
              ))}

              {/* Ad location dots */}
              {[
                { cx:95,  cy:205, label:"Hammersmith",  delay:0   },
                { cx:148, cy:182, label:"Kensington",   delay:0.1 },
                { cx:198, cy:152, label:"West End",     delay:0.2 },
                { cx:232, cy:108, label:"Camden",       delay:0.3 },
                { cx:310, cy:122, label:"Islington",    delay:0.4 },
                { cx:372, cy:140, label:"Shoreditch",   delay:0.5 },
                { cx:350, cy:178, label:"City",         delay:0.6 },
                { cx:448, cy:198, label:"Canary Wharf", delay:0.7 },
                { cx:295, cy:230, label:"South Bank",   delay:0.3 },
                { cx:168, cy:232, label:"Chelsea",      delay:0.2 },
                { cx:270, cy:278, label:"Brixton",      delay:0.5 },
              ].map(({cx,cy,label,delay})=>(
                <g key={label}>
                  {/* pulse rings */}
                  <circle cx={cx} cy={cy} r="7" fill="rgba(255,107,53,0.15)">
                    <animate attributeName="r" values="7;22;7" dur="2.4s" repeatCount="indefinite" begin={`${delay}s`}/>
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" begin={`${delay}s`}/>
                  </circle>
                  {/* dot */}
                  <circle cx={cx} cy={cy} r="5" fill="#ff6b35" opacity="0.9"/>
                  <circle cx={cx} cy={cy} r="2.5" fill="#fff"/>
                  {/* label */}
                  <text x={cx} y={cy-12} fill="rgba(255,255,255,0.65)" fontSize="8.5" textAnchor="middle" fontFamily="sans-serif">{label}</text>
                </g>
              ))}

              {/* Central hub — Westminster */}
              <circle cx="260" cy="208" r="26" fill="rgba(115,32,138,0.15)">
                <animate attributeName="r" values="26;38;26" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.5;0.1;0.5" dur="3s" repeatCount="indefinite"/>
              </circle>
              <circle cx="260" cy="208" r="14" fill="rgba(115,32,138,0.4)" stroke="rgba(196,181,253,0.5)" strokeWidth="1.5"/>
              <circle cx="260" cy="208" r="7" fill="#c4b5fd"/>
              <circle cx="260" cy="208" r="3.5" fill="#fff"/>
              <text x="260" y="232" fill="rgba(196,181,253,0.8)" fontSize="9" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">Westminster</text>

              {/* Corner badge */}
              <rect x="16" y="14" width="120" height="28" rx="8" fill="rgba(255,107,53,0.15)" stroke="rgba(255,107,53,0.3)" strokeWidth="1"/>
              <text x="76" y="32" fill="#ff6b35" fontSize="10" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">● LIVE — ۱۲ منطقه</text>
            </svg>
          </div>

        </div>
      </section>

      {/* ── CTA BAND ── */}
      <div className="hp-cta">
        <div className="hp-cta__inner">
          <h2 className="hp-cta__h2">کسب‌وکار ایرانی دارید؟</h2>
          <p className="hp-cta__sub">رایگان ثبت کنید — تنها چند دقیقه طول می‌کشد. به هزاران ایرانی در بریتانیا معرفی شوید و با پلن‌های تبلیغاتی آگهی‌تان را برجسته کنید.</p>
          <div className="hp-cta__btns">
            <Link to="/onboarding" className="hp-btn hp-btn--white hp-btn--lg">ثبت کسب‌وکار رایگان</Link>
            <Link to="/boost-plans" className="hp-btn hp-btn--lg" style={{background:"rgba(255,255,255,0.15)",color:"#fff",border:"1.5px solid rgba(255,255,255,0.4)"}}>پلن‌های تبلیغاتی</Link>
          </div>
        </div>
      </div>

      {/* ── POPULAR CITIES ── */}
      {cities.length > 0 && (
        <section className="hp-sec hp-sec--gray" aria-labelledby="cities-title">
          <div className="hp-sec__inner">
            <div className="hp-sec__head">
              <p className="hp-sec__eyebrow">بر اساس موقعیت</p>
              <h2 id="cities-title" className="hp-sec__title">محبوب‌ترین شهرها</h2>
              <p className="hp-sec__sub">کسب‌وکارهای ایرانی را در شهر خود پیدا کنید</p>
            </div>
            <div className="hp-city-grid">
              {cities.map(([city,count],i)=>{
                const img = cityImagesDb?.[city.toLowerCase()];
                return (
                  <Link key={city} to={`/listings?city=${encodeURIComponent(city)}`} className="hp-city-card">
                    <div
                      className="hp-city-card__bg"
                      style={img ? {backgroundImage:`url(${img})`,backgroundSize:"cover"} : {background:CITY_GRADIENTS[i%CITY_GRADIENTS.length]}}
                    />
                    <div className="hp-city-card__overlay"/>
                    <div className="hp-city-card__body">
                      <span className="hp-city-card__name">{city}</span>
                      <span className="hp-city-card__count">{count} کسب‌وکار</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ── */}
      <section className="hp-sec" aria-labelledby="testi-title">
        <div className="hp-sec__inner">
          <div className="hp-sec__head">
            <p className="hp-sec__eyebrow">نظرات کاربران</p>
            <h2 id="testi-title" className="hp-sec__title">آنچه درباره ما می‌گویند</h2>
            <p className="hp-sec__sub">تجربه واقعی کسب‌وکارها و مشتریان ایرانیو</p>
          </div>
          <div className="hp-testi-grid">
            {REVIEWS.map(r=>(
              <div key={r.name} className="hp-testi">
                <div className="hp-testi__quote">"</div>
                <p className="hp-testi__text">{r.text}</p>
                <div className="hp-testi__stars">★★★★★</div>
                <div className="hp-testi__author">
                  <div className="hp-testi__avatar">{r.name.charAt(0)}</div>
                  <div>
                    <p className="hp-testi__name">{r.name}</p>
                    <p className="hp-testi__role">{r.role} — {r.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ── */}
      <div className="hp-news">
        <div className="hp-news__inner">
          <h3 className="hp-news__title">عضویت در خبرنامه ایرانیو</h3>
          <p className="hp-news__sub">از جدیدترین آگهی‌ها و تخفیف‌های ویژه باخبر شوید</p>
          <form className="hp-news__form" onSubmit={e=>{e.preventDefault();}}>
            <input type="email" className="hp-news__email" placeholder="آدرس ایمیل شما" dir="ltr"/>
            <button type="submit" className="hp-btn hp-btn--orange">عضویت</button>
          </form>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="hp-footer">
        <div className="hp-footer__inner">
          <div className="hp-footer__grid">
            <div>
              <div className="hp-footer__logo"><img src="/images/iraniu-logo-header.png" alt="ایرانیو"/></div>
              <p className="hp-footer__desc">ایرانیو — فهرست جامع کسب‌وکارهای ایرانی در بریتانیا. از رستوران و صرافی گرفته تا وکیل و پزشک.</p>
              <div className="hp-footer__social">
                <a href="#" className="hp-footer__soc-btn" aria-label="فیسبوک"><i className="fa-brands fa-facebook-f"/></a>
                <a href="#" className="hp-footer__soc-btn" aria-label="توییتر"><i className="fa-brands fa-twitter"/></a>
                <a href="#" className="hp-footer__soc-btn" aria-label="اینستاگرام"><i className="fa-brands fa-instagram"/></a>
              </div>
            </div>
            <div>
              <h4 className="hp-footer__col-title">لینک‌های مفید</h4>
              <ul className="hp-footer__links">
                <li><Link to="/">خانه</Link></li>
                <li><Link to="/listings">آگهی‌ها</Link></li>
                <li><Link to="/exchanges">صرافی‌ها</Link></li>
                <li><Link to="/onboarding">ثبت کسب‌وکار</Link></li>
                <li><Link to="/blog">وبلاگ</Link></li>
                <li><Link to="/tfl">حمل‌ونقل لندن</Link></li>
                <li><Link to="/boost-plans">پلن‌های تبلیغاتی</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="hp-footer__col-title">پنل کاربری</h4>
              <ul className="hp-footer__links">
                <li><Link to="/dashboard">داشبورد</Link></li>
                <li><Link to="/login">ورود</Link></li>
                <li><Link to="/manager-signup">ثبت‌نام</Link></li>
                <li><Link to="/dashboard/wallet">کیف پول</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="hp-footer__col-title">تماس</h4>
              <ul className="hp-footer__links">
                <li><a href="mailto:info@iraniu.uk">info@iraniu.uk</a></li>
                <li><Link to="/listings">فهرست آگهی‌ها</Link></li>
              </ul>
            </div>
          </div>
          <div className="hp-footer__bottom">
            <span>© {new Date().getFullYear()} ایرانیو — کلیه حقوق محفوظ است</span>
            <Link to="/boost-plans">پلن‌های تبلیغاتی</Link>
          </div>
        </div>
      </footer>
      <DemoBottomNav />
    </div>
  );
}
