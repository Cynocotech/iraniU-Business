import { Link, useSearchParams, useLocation, useOutletContext } from "react-router-dom";
import DOMPurify from "dompurify";
import BusinessReportModal from "../components/BusinessReportModal.jsx";
import Seo from "../components/Seo.jsx";
import { useEffect, useMemo, useState } from "react";
import "./businessCoverHead.desktop.css";
import { apiGet, apiPost, apiPatch, apiPostMultipart } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getSiteUrl } from "../lib/siteUrl.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";
import {
  parseGalleryJson,
  parseHoursJson,
  resolveBusinessImageUrl,
  pickHeroImageUrlFromBusiness,
} from "../lib/businessProfile.js";
import { parseBiolinkJson } from "../lib/biolink.js";
import { useMediaQuery } from "../lib/useMediaQuery.js";
import {
  EXCHANGE_PAYMENT_METHODS,
  exchangeCurrencyNameFaShort,
  formatExchangeRateToman,
  getEffectiveRateRaw,
  isExchangeBusiness,
  isExchangeCompanyVerified,
  isExchangeCategory,
  parseLocalizedNumber,
  parseExchangePaymentMethodsJson,
  parseExchangeRatesJson,
} from "../lib/exchangeRates.js";
import ExchangeInlineCalc from "../components/ExchangeInlineCalc.jsx";
import ExchangeCompanyVerifiedBadge from "../components/ExchangeCompanyVerifiedBadge.jsx";
import ExchangePaymentMethodIcon from "../components/ExchangePaymentMethodIcon.jsx";

const FALLBACK_LONDON_COVER =
  "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600&q=80&auto=format&fit=crop";

const BIZ_STYLES = `
  body.business-page article.section.container {
    padding-bottom: 3rem;
  }
  @media (max-width: 768px) {
    body.business-page .layout-split { grid-template-columns: 1fr; }
  }

  /* ===== Logo upload overlay ===== */
  .biz-hero__logo-img { width: 100%; height: 100%; object-fit: contain; }
  .biz-hero__logo-upload {
    position: absolute; inset: 0; border-radius: 15px;
    background: rgba(0,0,0,0.45); color: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.2rem; font-size: 0.6rem; font-weight: 700; cursor: pointer;
    opacity: 0; transition: opacity 0.18s; border: none; padding: 0;
  }
  .biz-hero__logo:hover .biz-hero__logo-upload { opacity: 1; }
  .biz-hero__logo-upload i { font-size: 1.1rem; }

  /* ===== Email reveal in contact section ===== */
  .contact-email-reveal {
    background: none; border: none; padding: 0; cursor: pointer;
    display: inline-flex; align-items: center; gap: 0.5rem; text-align: start;
  }
  .contact-email-reveal__stars { font-size: 0.95rem; color: #334155; letter-spacing: 1px; }
  .contact-email-reveal__eye { color: #73208a; font-size: 0.95rem; }
  .contact-email-reveal__loading { font-size: 0.82rem; color: #94a3b8; }

  /* ===== Phone reveal in contact section ===== */
  .contact-phone-reveal {
    background: none; border: none; padding: 0; cursor: pointer;
    display: inline-flex; align-items: center; gap: 0.45rem; text-align: start;
  }
  .contact-phone-reveal__masked {
    font-size: 0.95rem; color: #334155; letter-spacing: 1.5px; font-family: monospace;
  }
  .contact-phone-reveal__eye { color: #73208a; font-size: 0.88rem; }

  /* ===== Unclaimed about demo text ===== */
  .profile-about__demo {
    color: #64748b; font-style: italic; line-height: 1.75;
    margin: 0 0 0.6rem; font-size: 0.95rem;
  }
  .profile-about__claim-prompt { margin: 0; font-size: 0.88rem; color: #94a3b8; }

  /* ===== Biolink social icons on directory page ===== */
  .biz-socials { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.85rem 0 0.5rem; }
  .biz-socials__btn {
    width: 2.4rem; height: 2.4rem; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: #f1f5f9; color: #475569;
    text-decoration: none; font-size: 1rem;
    border: 1.5px solid #e2e8f0;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .biz-socials__btn:hover { background: #73208a; color: #fff; border-color: #73208a; }
  .biz-socials__btn--whatsapp:hover { background: #25d366; border-color: #25d366; }
  .biz-socials__btn--instagram:hover { background: linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888); border-color: #dc2743; }
  .biz-socials__btn--telegram:hover { background: #229ed9; border-color: #229ed9; }
  .biz-socials__btn--facebook:hover { background: #1877f2; border-color: #1877f2; }
  .biz-socials__btn--youtube:hover { background: #ff0000; border-color: #ff0000; }
  .biz-socials__btn--tiktok:hover { background: #010101; border-color: #010101; }
  .biz-socials__btn--linkedin:hover { background: #0a66c2; border-color: #0a66c2; }
  .biz-socials__btn--twitter:hover { background: #000; border-color: #000; }
  .biz-socials__btn--discord:hover { background: #5865f2; border-color: #5865f2; }

  .biz-links { display: flex; flex-direction: column; gap: 0.45rem; margin: 0.85rem 0 0.5rem; }
  .biz-links__btn {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.5rem 0.75rem; border-radius: 8px;
    background: #f8fafc; border: 1.5px solid #e2e8f0;
    color: #334155; text-decoration: none; font-size: 0.88rem; font-weight: 600;
    transition: background 0.15s, border-color 0.15s;
  }
  .biz-links__btn:hover { background: #f1e8f7; border-color: #73208a; color: #73208a; }
  .biz-links__btn i { width: 1rem; text-align: center; color: #73208a; flex-shrink: 0; }
  .biz-links__btn--reservation { background: #73208a; border-color: #73208a; color: #fff; }
  .biz-links__btn--reservation i { color: #fff; }
  .biz-links__btn--reservation:hover { background: #5e1870; border-color: #5e1870; color: #fff; }

  /* ===== Redesigned unified hero ===== */
  body.business-page .biz-hero-panel {
    background: transparent;
    border: none !important;
    box-shadow: none !important;
  }

  .biz-hero {
    position: relative;
    width: 100%;
    height: clamp(280px, 44vw, 500px);
    background: #0d0720;
    overflow: hidden;
  }

  .biz-hero__cover {
    position: absolute !important;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
    border-radius: 0 !important;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    transition: transform 0.7s cubic-bezier(0.4,0,0.2,1);
  }
  .biz-hero:hover .biz-hero__cover { transform: scale(1.04); }
  .biz-hero__cover--fallback { filter: brightness(0.6) saturate(0.75); }

  .biz-hero__overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(5,1,16,0.97) 0%,
      rgba(5,1,16,0.72) 28%,
      rgba(5,1,16,0.30) 56%,
      rgba(5,1,16,0.05) 100%
    );
    z-index: 1;
  }

  .biz-hero__bar {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    gap: 1.1rem;
    padding: 3rem 2rem 2rem;
    direction: rtl;
  }

  .biz-hero__logo {
    flex-shrink: 0;
    width: 76px !important;
    height: 76px !important;
    border-radius: 18px !important;
    background: rgba(255,255,255,0.97) !important;
    border: 3px solid rgba(255,255,255,0.82) !important;
    box-shadow: 0 6px 28px rgba(0,0,0,0.50) !important;
    color: var(--color-primary) !important;
    font-size: 2rem !important;
    font-weight: 800;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden;
    position: relative !important;
    margin-bottom: 3px;
  }

  .biz-hero__info { flex: 1; min-width: 0; }

  .biz-hero__name {
    margin: 0 0 0.32rem !important;
    font-size: clamp(1.35rem, 3vw, 2.1rem) !important;
    font-weight: 800 !important;
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff;
    text-shadow: 0 2px 14px rgba(0,0,0,0.7) !important;
    line-height: 1.2 !important;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .biz-hero__lead {
    margin: 0 0 0.22rem;
    font-size: 1rem;
    font-weight: 500;
    color: rgba(255,255,255,0.92);
    text-shadow: 0 1px 6px rgba(0,0,0,0.6);
  }

  .biz-hero__sub {
    margin: 0 0 0.2rem;
    font-size: 0.92rem;
    color: rgba(255,255,255,0.72);
    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }

  .biz-hero__meta {
    margin: 0.35rem 0 0;
    font-size: 0.82rem;
    color: rgba(255,255,255,0.5);
    direction: ltr;
    text-align: right;
  }

  .biz-hero__badges {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .biz-hero__cta { flex-shrink: 0; padding-bottom: 0.2rem; }

  .biz-hero__cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 1.75rem;
    background: linear-gradient(135deg, #f4511e 0%, #e0390f 100%);
    color: #fff !important;
    border-radius: 14px;
    font-size: 1.02rem;
    font-weight: 700;
    text-decoration: none !important;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 22px rgba(244,81,30,0.55);
    white-space: nowrap;
  }
  .biz-hero__cta-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(244,81,30,0.72);
  }

  @media (max-width: 600px) {
    .biz-hero { height: clamp(215px, 62vw, 330px); }
    .biz-hero__bar { padding: 1.25rem 1rem 1.25rem; gap: 0.65rem; }
    .biz-hero__logo {
      width: 56px !important; height: 56px !important;
      font-size: 1.5rem !important; border-radius: 13px !important;
    }
    .biz-hero__name { font-size: 1.15rem !important; }
    .biz-hero__lead, .biz-hero__sub { font-size: 0.84rem; }
    .biz-hero__cta-btn { padding: 0.65rem 1rem; font-size: 0.9rem; border-radius: 10px; }
  }
`;

function trackBusinessPhoneClick(slug) {
  if (!slug) return;
  apiPost("/api/phone-click", { slug }).catch(() => {});
}

function resolveBusinessTimeZone(row) {
  const raw = `${row?.city || ""} ${row?.address || ""}`.toLowerCase();
  const map = [
    { keys: ["london", "manchester", "birmingham", "uk", "england"], tz: "Europe/London", label: "وقت محلی (انگلستان)" },
    { keys: ["tehran", "iran", "تهران", "ایران"], tz: "Asia/Tehran", label: "وقت محلی" },
    { keys: ["dubai", "uae", "emirates"], tz: "Asia/Dubai", label: "وقت محلی (امارات)" },
    { keys: ["istanbul", "turkey"], tz: "Europe/Istanbul", label: "وقت محلی (ترکیه)" },
    { keys: ["toronto", "canada"], tz: "America/Toronto", label: "وقت محلی (کانادا)" },
  ];
  const hit = map.find((m) => m.keys.some((k) => raw.includes(k)));
  return hit || { tz: "Europe/London", label: "وقت محلی" };
}

function formatClockForZone(nowMs, timeZone) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(nowMs));
  } catch {
    return "—";
  }
}

/** نرمال‌سازی URL لینک‌های Biolink — افزودن پیشوند مناسب اگر نداشته باشد */
function normalizeLinkUrl(raw, preset) {
  const s = String(raw || "").trim();
  if (!s) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (preset === "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `mailto:${s}`;
  if (preset === "phone" || /^\+?[\d\s\-()]{7,}$/.test(s)) return `tel:${s.replace(/\s/g, "")}`;
  if (preset === "whatsapp" && /^\+?[\d\s\-()]{7,}$/.test(s)) return `https://wa.me/${s.replace(/\D/g, "")}`;
  return `https://${s}`;
}

/** یکدست‌سازی توضیحات: حذف خط خالی پشت‌سرهم، تبدیل \\n ذخیره‌شده به خط جدید */
function normalizeAboutDescription(raw) {
  let s = String(raw ?? "");
  s = s.replace(/\\n/g, "\n");
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** Short lead for profile; full text available on demand (long directory imports). */
function summarizeAboutText(raw, maxLen = 280) {
  const original = normalizeAboutDescription(raw);
  if (!original) return { summary: "", hasMore: false };
  const flat = original
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= maxLen) return { summary: flat, hasMore: false };
  const slice = flat.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxLen * 0.55 ? slice.slice(0, lastSpace) : slice;
  return { summary: `${cut.trim()}…`, hasMore: true };
}

function extractUkPostcode(raw) {
  const m = String(raw || "")
    .toUpperCase()
    .match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/);
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
}

/** "82 St Mary's Pl, London W5 5EX" + "W5 5EX" => "82 St Mary's Pl, London W5" */
function shortenAddressForDisplay(raw, postcode) {
  const address = String(raw || "").trim();
  if (!address || !postcode) return address;
  const outward = postcode.split(" ")[0];
  const escaped = postcode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = address
    .replace(new RegExp(escaped, "gi"), "")
    .replace(/[\s,]+$/, "")
    .trim();
  return outward ? `${stripped} ${outward}`.trim() : stripped;
}

/** Inline SVG defs (IDs match css / legacy business.html) */
function ProfileSprites() {
  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" className="contact-sprite" aria-hidden="true" focusable="false">
        <defs>
          <symbol id="section-about" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-2-7H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
            />
          </symbol>
          <symbol id="section-hours" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM7 12h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"
            />
          </symbol>
          <symbol id="section-gallery" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
            />
          </symbol>
          <symbol id="section-promote" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z"
            />
          </symbol>
          <symbol id="section-careers" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm-6 0h-4V4h4v2z"
            />
          </symbol>
        </defs>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" className="contact-sprite" aria-hidden="true" focusable="false">
        <defs>
          <symbol id="contact-phone" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
            />
          </symbol>
        </defs>
      </svg>
    </>
  );
}

function AdSidebarSlot() {
  useEffect(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }, []);
  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block", width: "300px", height: "250px" }}
      data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
      data-ad-slot="REPLACE_WITH_SLOT_ID"
    />
  );
}

export default function BusinessPage() {
  const { setHeaderLogoHref } = useOutletContext() ?? {};
  const { me } = useAuth();
  const [params, setSearchParams] = useSearchParams();
  const location = useLocation();
  const slug = params.get("slug") || "clinic-pars";
  const [b, setB] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [showOnboardingWelcome, setShowOnboardingWelcome] = useState(
    () => !!location.state?.onboardingComplete
  );
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [exchangeContactSheetOpen, setExchangeContactSheetOpen] = useState(false);
  const [exchangeCalcSheetOpen, setExchangeCalcSheetOpen] = useState(false);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [exchangeMode, setExchangeMode] = useState("buy");
  const [exchangeAmount, setExchangeAmount] = useState("1");
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState("USD");
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    setAboutExpanded(false);
    setExchangeContactSheetOpen(false);
    setExchangeCalcSheetOpen(false);
    setLightboxIndex(null);
    setHeaderLogoHref?.("/");
  }, [slug, setHeaderLogoHref]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex]);

  useEffect(() => {
    const t = window.setInterval(() => setClockNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    setB(null);
    setLoadState("loading");
    setPhoneRevealed(false);
    setMobileRevealed(false);
    apiGet(`/api/businesses/${encodeURIComponent(slug)}`)
      .then((row) => {
        setB(row);
        setLoadState("ok");
      })
      .catch(() => {
        setB(null);
        setLoadState("error");
      });
  }, [slug]);

  useEffect(() => {
    if (loadState !== "ok" || !b) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("report") !== "1") return;
    setReportOpen(true);
    sp.delete("report");
    setSearchParams(sp, { replace: true });
  }, [loadState, b, setSearchParams]);

  const logoMark = useMemo(() => {
    if (!b?.name_fa) return "؟";
    const t = b.name_fa.trim();
    return t ? [...t][0] : "؟";
  }, [b]);

  useEffect(() => {
    document.body.classList.add("business-page");
    return () => {
      document.body.classList.remove(
        "business-page",
        "business-page--unclaimed",
        "business-page--claimed",
        "business-page--exchange-detail"
      );
    };
  }, []);

  useEffect(() => {
    if (!b) return;
    const claimed = !!b.claimed;
    document.body.classList.toggle("business-page--claimed", claimed);
    document.body.classList.toggle("business-page--unclaimed", !claimed);
    document.body.classList.toggle("business-page--exchange-detail", isExchangeBusiness(b));
    return () => {
      document.body.classList.remove("business-page--claimed", "business-page--unclaimed", "business-page--exchange-detail");
    };
  }, [b]);

  useEffect(() => {
    if (!setHeaderLogoHref) return;
    if (loadState !== "ok" || !b) {
      return;
    }
    setHeaderLogoHref(isExchangeBusiness(b) ? "/exchanges" : "/");
    return () => setHeaderLogoHref("/");
  }, [loadState, b, setHeaderLogoHref]);

  const businessSeoDescription = useMemo(() => {
    if (!b) return SEO_DEFAULT_DESCRIPTION;
    const norm = normalizeAboutDescription(b.description);
    const flat = norm.replace(/\s+/g, " ").trim();
    if (flat) return flat.slice(0, 320);
    const line = [b.listing_title, b.category, b.city].filter(Boolean).join(" — ");
    return `${b.name_fa || "کسب‌وکار"}${line ? ` — ${line}` : ""}`.slice(0, 320);
  }, [b]);

  const [revealedIds, setRevealedIds] = useState(new Set());
  const [revealedEmail, setRevealedEmail] = useState(null);
  const [emailRevealing, setEmailRevealing] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [mobileRevealed, setMobileRevealed] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  useEffect(() => { setLogoUrl(b?.logo_url || ""); }, [b?.logo_url]);
  const biolinkData = useMemo(() => parseBiolinkJson(b?.biolink_json), [b?.biolink_json]);
  const biolinkSocials = useMemo(
    () => (biolinkData.socialLinks || []).filter((s) => s.enabled !== false && s.url && s.iconClass),
    [biolinkData]
  );
  const biolinkLinks = useMemo(
    () => (biolinkData.links || []).filter((l) => l.enabled !== false && l.url),
    [biolinkData]
  );

  const maskPhone = (num) => {
    const s = String(num).trim();
    if (s.length <= 3) return s;
    return s.slice(0, 3) + " " + "*".repeat(Math.max(4, s.length - 3));
  };

  const reservationLink = String(b?.reservation_link || "").trim();
  const twilioModuleOn = b?.twilio_module_enabled !== false;
  const trackedEnabled = twilioModuleOn && !!b?.call_tracking_enabled;
  const trackedNumber = String(b?.call_tracking_number || "").trim();
  const phoneForCall = trackedEnabled && trackedNumber ? trackedNumber : String(b?.phone || "").trim();
  const showExchangeContactFab = isExchangeBusiness(b) && !!phoneForCall;

  const coverView = useMemo(() => {
    if (!b) return { url: FALLBACK_LONDON_COVER, fallback: true };
    const custom = pickHeroImageUrlFromBusiness(b);
    if (custom) return { url: resolveBusinessImageUrl(custom), fallback: false };
    return { url: FALLBACK_LONDON_COVER, fallback: true };
  }, [b]);

  const businessJsonLd = useMemo(() => {
    if (!b) return null;
    const site = getSiteUrl();
    const url = site ? `${site}/business?slug=${encodeURIComponent(b.slug)}` : undefined;
    let imageUrl = coverView.url;
    if (imageUrl && !/^https?:\/\//i.test(imageUrl) && site) {
      imageUrl = `${site}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
    }
    const addr = {};
    if (b.address) addr.streetAddress = String(b.address).trim();
    if (b.city) addr.addressLocality = String(b.city).trim();
    const out = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: (b.name_fa || "").trim() || "کسب‌وکار",
      ...(url ? { url } : {}),
      ...(imageUrl && /^https?:\/\//i.test(imageUrl) ? { image: imageUrl } : {}),
      ...(b.phone && String(b.phone).trim() ? { telephone: String(b.phone).trim() } : {}),
    };
    if (Object.keys(addr).length) {
      out.address = { "@type": "PostalAddress", ...addr };
    }
    return out;
  }, [b, coverView.url]);

  const leadTitleRaw = b?.listing_title && String(b.listing_title).trim() ? String(b.listing_title).trim() : "";
  const leadTitle = leadTitleRaw && leadTitleRaw !== String(b?.name_fa || "").trim() ? leadTitleRaw : "";
  const secondLine =
    (b?.subtitle && String(b.subtitle).trim()) ||
    [b?.category, b?.city].filter(Boolean).join(" — ") ||
    (b?.address ? String(b.address).trim() : "");
  const metaParts = [
    b?.rating != null ? `${Number(b?.rating).toFixed(1)} ★` : "",
  ].filter(Boolean);
  const isActive = !b?.status || String(b.status).toLowerCase() === "active";

  const hoursRows = parseHoursJson(b?.hours_json);
  const gallerySlots = parseGalleryJson(b?.gallery_json);
  const exchangeRatesRows = parseExchangeRatesJson(b?.exchange_rates_json);
  const exchangePaymentMethods = parseExchangePaymentMethodsJson(b?.payment_methods_json);
  const showExchangeSection = isExchangeCategory(b?.category) || exchangeRatesRows.some((r) => r.buy || r.sell);
  const exchangeTodayRateEnabled = Number(b?.exchange_today_rate_enabled) !== 0;
  const exchangePostcode = b?.postcode?.trim() || extractUkPostcode(b?.address);
  const exchangeMapQuery = exchangePostcode || [b?.address, b?.city].filter(Boolean).join(", ").trim();
  const mapEmbedUrl = exchangeMapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(exchangeMapQuery)}&output=embed`
    : "";
  const directionsUrl =
    b?.google_review_url ||
    (exchangeMapQuery
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(exchangeMapQuery)}`
      : "");
  const addressLine = shortenAddressForDisplay(b?.address, exchangePostcode);
  const selectedRate =
    exchangeRatesRows.find((r) => r.code === selectedCurrencyCode) || exchangeRatesRows[0] || null;
  const showExchangeCalcFab = isExchangeBusiness(b) && !!selectedRate;
  const selectedRateRaw = getEffectiveRateRaw(selectedRate, exchangeMode);
  const selectedRateNum = parseLocalizedNumber(selectedRateRaw);
  const exchangeAmountNum = parseLocalizedNumber(exchangeAmount);
  const exchangeResult =
    Number.isFinite(selectedRateNum) && Number.isFinite(exchangeAmountNum)
      ? selectedRateNum * exchangeAmountNum
      : null;
  const showPromo = !!(b?.promo_title?.trim() || b?.promo_description?.trim());
  const careersBody = b?.careers_text && String(b.careers_text).trim();
  const careersSubtitle = b?.careers_title && String(b.careers_title).trim();
  const showCareers = !!careersBody;

  const aboutLead = useMemo(() => summarizeAboutText(b?.description), [b?.description]);
  const descriptionNormalized = useMemo(() => normalizeAboutDescription(b?.description), [b?.description]);
  const desktopLayout = useMediaQuery("(min-width: 1024px)");
  const exchangeBusinessTime = useMemo(() => resolveBusinessTimeZone(b), [b?.city, b?.address]);
  const exchangeLocalTimeText = useMemo(
    () => formatClockForZone(clockNowMs, exchangeBusinessTime.tz),
    [clockNowMs, exchangeBusinessTime.tz]
  );
  const iranTimeText = useMemo(() => formatClockForZone(clockNowMs, "Asia/Tehran"), [clockNowMs]);
  const categoryOnly =
    b?.category && String(b.category).trim() ? String(b.category).trim() : "";
  /** Desktop bar: category, else subtitle / location line (same as mobile second line). */
  const desktopBarSubtitle = categoryOnly || secondLine || "";

  useEffect(() => {
    if (!exchangeRatesRows.length) return;
    if (exchangeRatesRows.some((r) => r.code === selectedCurrencyCode)) return;
    setSelectedCurrencyCode(exchangeRatesRows[0].code);
  }, [exchangeRatesRows, selectedCurrencyCode]);

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

  if (loadState === "loading") {
    return (
      <>
        <style>{BIZ_STYLES}</style>
        <Seo title="پروفایل کسب‌وکار" description={SEO_DEFAULT_DESCRIPTION} />
        <article className="section container" dir="rtl" lang="fa" style={{ padding: "2rem 0" }}>
          <p className="field-hint">در حال بارگذاری…</p>
        </article>
      </>
    );
  }

  if (loadState === "error" || !b) {
    return (
      <>
        <style>{BIZ_STYLES}</style>
        <Seo
          title="کسب‌وکار پیدا نشد"
          noindex
          description="این آگهی در فهرست نیست یا آدرس نامعتبر است."
        />
        <article className="section container" dir="rtl" lang="fa" style={{ padding: "2rem 0" }}>
          <h1 style={{ color: "#fff" }}>کسب‌وکار پیدا نشد</h1>
          <p className="field-hint">آدرس نامعتبر است یا داده‌ای برای این شناسه نیست.</p>
          <p>
            <Link to="/listings">بازگشت به لیست</Link>
          </p>
        </article>
      </>
    );
  }

  const claimHref = `/claim?slug=${encodeURIComponent(b.slug)}&business=${encodeURIComponent(b.name_fa)}`;
  const isSuperAdmin = me?.role === "superadmin";
  const isOwner = isSuperAdmin || (me?.role === "manager" && Number(b.manager_id) === Number(me?.user?.id));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const data = await apiPostMultipart("/api/upload/business-image", fd);
      const url = data?.url || data?.imageUrl || "";
      if (!url) throw new Error("no url");
      await apiPatch(`/api/businesses/${encodeURIComponent(b.slug)}`, { logo_url: url });
      setLogoUrl(url);
    } catch { /* ignore */ }
    setLogoUploading(false);
    e.target.value = "";
  };


  return (
    <>
      <style>{BIZ_STYLES}</style>
      <Seo
        title={`${b.name_fa} — پروفایل کسب‌وکار`}
        description={businessSeoDescription}
        image={coverView.url}
        jsonLd={businessJsonLd}
      />
    <article className="section container" dir="rtl" lang="fa">
      <nav className="business-breadcrumb" aria-label="مسیر صفحه">
        <Link className="business-breadcrumb__link" to="/listings">
          <i className="fa-solid fa-store" aria-hidden="true" />
          بازگشت به فهرست
        </Link>
        <span className="business-breadcrumb__sep" aria-hidden="true">·</span>
        <Link className="business-breadcrumb__link" to="/">
          <i className="fa-solid fa-house" aria-hidden="true" />
          خانه
        </Link>
      </nav>
      {showOnboardingWelcome && (
        <div
          className="onboarding-success-banner"
          role="status"
          style={{
            marginBottom: "1rem",
            padding: "0.85rem 1rem",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>آگهی شما ثبت شد.</strong> می‌توانید جزئیات بیشتر را بعداً تکمیل کنید یا{" "}
            <Link to={`/claim?slug=${encodeURIComponent(b.slug)}&business=${encodeURIComponent(b.name_fa)}`}>
              مالکیت را ادعا
            </Link>{" "}
            کنید.
          </p>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ marginTop: "0.5rem" }}
            onClick={() => setShowOnboardingWelcome(false)}
          >
            بستن
          </button>
        </div>
      )}
      {!b.claimed && !isExchangeBusiness(b) && (
        <div className="claim-banner" role="region" aria-label="درخواست صفحه مدیریت">
          <p className="claim-banner__text">
            <strong>این کسب‌وکار هنوز به حساب هیچ مدیری وصل نشده است.</strong>
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn btn--primary" id="biz-claim-link" to={claimHref}>
              درخواست صفحه مدیریت
            </Link>
          </div>
        </div>
      )}

      <div className="profile-panel biz-hero-panel">
        {isExchangeBusiness(b) && !isExchangeCompanyVerified(b) ? (
          <div className="exchange-private-alert exchange-private-alert--hero" role="alert">
            <strong>توجه:</strong> این صرافی در ایرانیو به‌عنوان کسب‌وکار ثبت‌شده (شرکت) تأیید نشده است؛ ممکن است فعالیت
            شخصی یا غیررسمی باشد. پیش از هر معامله، هویت و اعتبار طرف مقابل را بررسی کنید و در صورت تردید مستقیماً تماس
            بگیرید.
          </div>
        ) : null}
        {isExchangeBusiness(b) ? (
          <div className="exchange-world-clock" role="status" aria-live="polite">
            <div className="exchange-world-clock__item">
              <span className="exchange-world-clock__label">
                <i className="fa-solid fa-location-dot exchange-world-clock__ico" aria-hidden="true" />
                {exchangeBusinessTime.label}
              </span>
              <strong className="exchange-world-clock__time" dir="ltr">
                <i className="fa-regular fa-clock exchange-world-clock__time-ico" aria-hidden="true" />
                {exchangeLocalTimeText}
              </strong>
            </div>
            <div className="exchange-world-clock__item exchange-world-clock__item--iran">
              <span className="exchange-world-clock__label">
                <i className="fa-solid fa-earth-asia exchange-world-clock__ico" aria-hidden="true" />
                وقت ایران
              </span>
              <strong className="exchange-world-clock__time" dir="ltr">
                <i className="fa-regular fa-clock exchange-world-clock__time-ico" aria-hidden="true" />
                {iranTimeText}
              </strong>
            </div>
          </div>
        ) : null}

        {/* Redesigned hero — full-bleed cover + overlaid info bar */}
        <div className="biz-hero" id="biz-profile-cover">
          <div
            className={`biz-hero__cover profile-cover${coverView.fallback ? " biz-hero__cover--fallback profile-cover--fallback" : ""}`}
            aria-hidden="true"
            style={{ backgroundImage: `url(${coverView.url})` }}
          />
          <div className="biz-hero__overlay" aria-hidden="true" />
          <div className="biz-hero__bar">
            <div className="biz-hero__logo" id="biz-profile-logo" aria-hidden="true">
              {logoUrl
                ? <img src={logoUrl} alt="" className="biz-hero__logo-img" />
                : logoMark}
              {isOwner && (
                <label className="biz-hero__logo-upload" title="تغییر لوگو">
                  <i className={`fa-solid ${logoUploading ? "fa-spinner fa-spin" : "fa-camera"}`} />
                  <span>{logoUploading ? "…" : "لوگو"}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleLogoUpload} disabled={logoUploading} />
                </label>
              )}
            </div>
            <div className="biz-hero__info">
              <h1 id="biz-name" className="biz-hero__name">
                <span>{b.name_fa}</span>
                {isExchangeBusiness(b) && isExchangeCompanyVerified(b) ? <ExchangeCompanyVerifiedBadge /> : null}
              </h1>
              {leadTitle && (
                <p className="biz-hero__lead" id="biz-listing-title">{leadTitle}</p>
              )}
              {secondLine && (
                <p className="biz-hero__sub" id="biz-subtitle">{secondLine}</p>
              )}
              {metaParts.length > 0 && (
                <p className="biz-hero__meta" id="biz-meta" lang="en">{metaParts.join(" · ")}</p>
              )}
              {(!isActive || b.claimed) && (
                <div className="biz-hero__badges">
                  {!isActive && <span className="badge">غیرفعال</span>}
                  {!!b.claimed && <span className="badge badge--claimed-owner">مالک ثبت‌شده</span>}
                </div>
              )}
            </div>
            {isActive && phoneForCall && (
              <div className="biz-hero__cta">
                <a
                  className="biz-hero__cta-btn"
                  href={`tel:${String(phoneForCall).replace(/\s/g, "")}`}
                  onClick={() => trackBusinessPhoneClick(b.slug)}
                >
                  <i className="fa-solid fa-phone" aria-hidden="true" />
                  تماس
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="layout-split">
        <div>
          <ProfileSprites />

          {showPromo && (
            <section
              className="profile-panel profile-body profile-promo"
              id="biz-promo-section"
              aria-labelledby="promo-section-title"
            >
              <h2 id="promo-section-title" className="profile-section-heading">
                <span className="profile-section-heading__icon" aria-hidden="true">
                  <svg className="profile-section-heading__svg" aria-hidden="true">
                    <use href="#section-promote" />
                  </svg>
                </span>
                پیشنهاد و تبلیغ
              </h2>
              {b.promo_title && b.promo_title.trim() && (
                <h3 className="profile-promo__title" id="biz-promo-title">
                  {b.promo_title.trim()}
                </h3>
              )}
              {b.promo_description && b.promo_description.trim() && (
                <div
                  className="profile-promo__desc rich-html"
                  id="biz-promo-desc"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(b.promo_description.trim()) }}
                />
              )}
            </section>
          )}

          {showExchangeSection && (
            <section className="profile-panel profile-body exchange-panel" id="biz-exchange-section" aria-label="نرخ ارز صرافی">
              {exchangeTodayRateEnabled ? (
                <div className="exchange-panel__hero exchange-panel__hero--with-calc">
                  <h2 id="exchange-title" className="profile-section-heading">
                    نرخ ویژه امروز
                  </h2>
                  <p className="field-hint exchange-panel__lead">
                    نرخ‌ها توسط صرافی ثبت می‌شوند. برای معاملهٔ قطعی، قبل از مراجعه با صرافی تماس بگیرید.
                  </p>

                  {selectedRate ? (
                    <div className="exchange-hero-stack">
                      <div className="exchange-featured">
                        <div className="exchange-featured__currency field field--block">
                          <label htmlFor="exchange-currency">ارز</label>
                          <select
                            id="exchange-currency"
                            className="exchange-featured__select"
                            value={selectedRate.code}
                            onChange={(e) => setSelectedCurrencyCode(e.target.value)}
                            dir="ltr"
                          >
                            {exchangeRatesRows.map((row) => (
                              <option key={row.code} value={row.code}>
                                {row.flag || "🏳️"} {row.code}
                                {row.name ? ` — ${row.name}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="exchange-featured__subtitle">
                          نرخ لحظه‌ای{" "}
                          <span dir="ltr" className="exchange-featured__currency-name">
                            {exchangeCurrencyNameFaShort(selectedRate.code, selectedRate.name)}
                          </span>{" "}
                          به تومان
                        </p>
                        <ul className="exchange-featured__rates" aria-label="نرخ خرید و فروش">
                          {selectedRate.buy_active !== false ? (
                            <li className="exchange-featured__rate-line exchange-featured__rate-line--buy">
                              <span className="exchange-featured__rate-label exchange-featured__rate-label--buy">خرید</span>
                              <span className="exchange-featured__rate-value exchange-featured__rate-value--buy" dir="ltr">
                                {formatExchangeRateToman(selectedRate.buy)}
                              </span>
                            </li>
                          ) : null}
                          {selectedRate.sell_active !== false ? (
                            <li className="exchange-featured__rate-line exchange-featured__rate-line--sell">
                              <span className="exchange-featured__rate-label exchange-featured__rate-label--sell">فروش</span>
                              <span className="exchange-featured__rate-value exchange-featured__rate-value--sell" dir="ltr">
                                {formatExchangeRateToman(selectedRate.sell)}
                              </span>
                            </li>
                          ) : null}
                        </ul>
                      </div>

                      <ExchangeInlineCalc
                        idPrefix="biz-ex"
                        exchangeMode={exchangeMode}
                        onExchangeModeChange={setExchangeMode}
                        exchangeAmount={exchangeAmount}
                        onExchangeAmountChange={setExchangeAmount}
                        exchangeResult={exchangeResult}
                        exchangeAmountNum={exchangeAmountNum}
                        selectedRateNum={selectedRateNum}
                        selectedRateRaw={selectedRateRaw}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="exchange-panel__table-block">
                <div className="table-wrap exchange-table-wrap">
                  <table className="data-table exchange-rates-table">
                    <thead>
                      <tr>
                        <th scope="col">پرچم</th>
                        <th scope="col">ارز</th>
                        <th scope="col" className="exchange-rate-col--buy">
                          خرید
                        </th>
                        <th scope="col" className="exchange-rate-col--sell">
                          فروش
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {exchangeRatesRows.map((row) => (
                        <tr key={row.code}>
                          <td style={{ fontSize: "1.15rem" }} dir="ltr">
                            {row.flag || "🏳️"}
                          </td>
                          <td dir="ltr">
                            {row.code}
                            {row.name ? <span className="exchange-rates-table__name"> — {row.name}</span> : null}
                          </td>
                          <td dir="ltr" className="exchange-rate-col--buy">
                            {row.buy_active === false ? "—" : formatExchangeRateToman(row.buy)}
                          </td>
                          <td dir="ltr" className="exchange-rate-col--sell">
                            {row.sell_active === false ? "—" : formatExchangeRateToman(row.sell)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="exchange-featured__pay" style={{ marginTop: "0.75rem" }}>
                <span className="exchange-featured__pay-title">پرداخت با</span>
                <div className="exchange-featured__pay-badges" aria-label="روش‌های پرداخت">
                  {exchangePaymentMethods.length ? (
                    exchangePaymentMethods.map((methodId) => {
                      const method = EXCHANGE_PAYMENT_METHODS.find((m) => m.id === methodId);
                      if (!method) return null;
                      return (
                        <span key={method.id} className={`exchange-pay-badge ${method.badgeClassName || ""}`.trim()}>
                          <ExchangePaymentMethodIcon methodId={method.id} />
                          {method.label}
                        </span>
                      );
                    })
                  ) : (
                    <span className="exchange-pay-badge exchange-pay-badge--muted">ثبت نشده</span>
                  )}
                </div>
              </div>
              {mapEmbedUrl ? (
                <div className="exchange-panel__map-wrap" aria-label="موقعیت صرافی روی نقشه">
                  <p className="exchange-panel__map-title">
                    موقعیت روی نقشه
                    {exchangePostcode ? (
                      <span className="exchange-panel__map-postcode" dir="ltr">
                        {exchangePostcode}
                      </span>
                    ) : null}
                  </p>
                  <div className="exchange-panel__map-frame-wrap">
                    <iframe
                      title={`Google Map ${b?.name_fa || "Exchange"}`}
                      src={mapEmbedUrl}
                      className="exchange-panel__map-frame"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                </div>
              ) : null}
            </section>
          )}

          <section
            className="profile-panel profile-body profile-about profile-about--compact"
            aria-labelledby="about-title"
          >
            <h2 id="about-title" className="profile-section-heading">
              <span className="profile-section-heading__icon" aria-hidden="true">
                <svg className="profile-section-heading__svg" aria-hidden="true">
                  <use href="#section-about" />
                </svg>
              </span>
              در یک نگاه
            </h2>
            {!b.claimed ? (
              <>
                <p className="profile-about__demo">
                  در این بخش می‌توانید اطلاعات کاملی درباره کسب‌وکار خود، خدمات، محصولات، سابقه فعالیت و مزایای رقابتی خود را معرفی کنید. هرچه توضیحات شما کامل‌تر و دقیق‌تر باشد، مشتریان راحت‌تر با برند شما آشنا شده و با اطمینان بیشتری با شما تماس خواهند گرفت.
                </p>
                <p className="profile-about__claim-prompt">
                  <Link to={claimHref} className="profile-about__claim-link">
                    مالکیت این آگهی را ادعا کنید
                  </Link>
                  {" "}تا بتوانید این متن را با اطلاعات واقعی کسب‌وکارتان جایگزین کنید.
                </p>
              </>
            ) : !aboutLead.summary ? (
              <p className="profile-about__empty">توضیحی ثبت نشده است.</p>
            ) : (
              <>
                {aboutExpanded && aboutLead.hasMore ? (
                  <div
                    id="biz-about"
                    className="rich-html profile-about__full"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(descriptionNormalized) }}
                  />
                ) : (
                  <div
                    id="biz-about"
                    className="rich-html profile-about__summary"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(aboutLead.summary) }}
                  />
                )}
                {aboutLead.hasMore && (
                  <button
                    type="button"
                    className="profile-about__toggle"
                    onClick={() => setAboutExpanded((v) => !v)}
                    aria-expanded={aboutExpanded}
                  >
                    {aboutExpanded ? "نمایش خلاصه" : "ادامهٔ متن"}
                  </button>
                )}
              </>
            )}
          </section>

          {showCareers && (
            <section
              className="profile-panel profile-body profile-careers"
              id="biz-careers-section"
              aria-labelledby="careers-section-title"
            >
              <h2 id="careers-section-title" className="profile-section-heading">
                <span className="profile-section-heading__icon" aria-hidden="true">
                  <svg className="profile-section-heading__svg" aria-hidden="true">
                    <use href="#section-careers" />
                  </svg>
                </span>
                فرصت‌های شغلی
              </h2>
              {careersSubtitle ? (
                <h3 className="profile-careers__subtitle" id="biz-careers-custom-title">
                  {careersSubtitle}
                </h3>
              ) : null}
              <div
                id="biz-careers"
                className="rich-html"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(careersBody) }}
              />
            </section>
          )}

          <section className="profile-panel profile-body" id="biz-hours-section" aria-labelledby="hours-title">
            <button
              type="button"
              className="profile-section-heading profile-section-heading--accordion"
              id="hours-title"
              aria-expanded={hoursExpanded}
              aria-controls="biz-hours-grid"
              onClick={() => setHoursExpanded((v) => !v)}
            >
              <span className="profile-section-heading__icon" aria-hidden="true">
                <svg className="profile-section-heading__svg" aria-hidden="true">
                  <use href="#section-hours" />
                </svg>
              </span>
              ساعات کاری
              <i className="fa-solid fa-chevron-down profile-section-heading__chevron" aria-hidden="true" />
            </button>
            {hoursExpanded && (
              <div className="biz-hours-grid" id="biz-hours-grid" role="list" aria-label="ساعات باز بودن به تفکیک روز">
                {hoursRows.map((row, i) => (
                  <div key={`${row.day}-${i}`} className="biz-hours-row" role="listitem">
                    <span className="biz-hours-day">{row.day}</span>
                    <span className="biz-hours-value">{row.hours || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {!isExchangeBusiness(b) ? (
            <section className="profile-panel profile-body" id="biz-gallery-section" aria-labelledby="gallery-title">
              <h2 id="gallery-title" className="profile-section-heading">
                <span className="profile-section-heading__icon" aria-hidden="true">
                  <svg className="profile-section-heading__svg" aria-hidden="true">
                    <use href="#section-gallery" />
                  </svg>
                </span>
                گالری
              </h2>
              {(() => {
                const filledSlots = gallerySlots
                  .map((url, i) => ({ url: resolveBusinessImageUrl(String(url || "").trim()), origIndex: i }))
                  .filter((s) => s.url);
                return (
                  <div className="gallery" id="biz-gallery" role="list">
                    {gallerySlots.map((url, i) => {
                      const resolved = resolveBusinessImageUrl(String(url || "").trim());
                      const lightIdx = filledSlots.findIndex((s) => s.origIndex === i);
                      return resolved ? (
                        <button
                          key={i}
                          type="button"
                          className="gallery__item gallery__item--clickable"
                          role="listitem"
                          aria-label={`بزرگ‌نمایی تصویر ${lightIdx + 1}`}
                          style={{
                            backgroundImage: `url(${resolved})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                          onClick={() => setLightboxIndex(lightIdx)}
                        />
                      ) : (
                        <div key={i} className="gallery__item" role="listitem" />
                      );
                    })}
                  </div>
                );
              })()}
            </section>
          ) : null}

        </div>

        <aside aria-label={isExchangeBusiness(b) ? "اقدامات" : "تماس و تبلیغات"}>
          <section className="profile-panel profile-body">
            {!isExchangeBusiness(b) ? (
              <>
                <h2 className="contact-panel__title">
                  <span className="contact-list__icon-wrap" aria-hidden="true">
                    <svg className="contact-list__svg" aria-hidden="true">
                      <use href="#contact-phone" />
                    </svg>
                  </span>
                  تماس
                </h2>
                <ul className="contact-list" id="biz-contact">
                  {phoneForCall ? (
                    <li className="contact-list__item">
                      <span className="contact-list__icon-wrap" aria-hidden="true">
                        <svg className="contact-list__svg" aria-hidden="true">
                          <use href="#contact-phone" />
                        </svg>
                      </span>
                      <div className="contact-list__main">
                        {phoneRevealed ? (
                          <a
                            href={`tel:${String(phoneForCall).replace(/\s/g, "")}`}
                            className="phone-ltr"
                            dir="ltr"
                            onClick={() => trackBusinessPhoneClick(b.slug)}
                          >
                            {phoneForCall}
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="contact-phone-reveal"
                            dir="ltr"
                            onClick={() => { setPhoneRevealed(true); trackBusinessPhoneClick(b.slug); }}
                            title="نمایش شماره تلفن"
                          >
                            <span className="contact-phone-reveal__masked">{maskPhone(phoneForCall)}</span>
                            <i className="fa-solid fa-eye contact-phone-reveal__eye" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </li>
                  ) : (
                    <li className="contact-list__item">
                      <span className="contact-list__icon-wrap" aria-hidden="true">
                        <svg className="contact-list__svg" aria-hidden="true">
                          <use href="#contact-phone" />
                        </svg>
                      </span>
                      <div className="contact-list__main">
                        <span className="field-hint">شماره ثبت نشده</span>
                      </div>
                    </li>
                  )}
                  {b.mobile && String(b.mobile).trim() && (
                    <li className="contact-list__item">
                      <span className="contact-list__icon-wrap" aria-hidden="true">
                        <svg className="contact-list__svg" aria-hidden="true">
                          <use href="#contact-phone" />
                        </svg>
                      </span>
                      <div className="contact-list__main">
                        {mobileRevealed ? (
                          <a
                            href={`tel:${String(b.mobile).replace(/\s/g, "")}`}
                            className="phone-ltr"
                            dir="ltr"
                          >
                            {b.mobile}
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="contact-phone-reveal"
                            dir="ltr"
                            onClick={() => setMobileRevealed(true)}
                            title="نمایش موبایل"
                          >
                            <span className="contact-phone-reveal__masked">{maskPhone(b.mobile)}</span>
                            <i className="fa-solid fa-eye contact-phone-reveal__eye" aria-hidden="true" />
                          </button>
                        )}
                        <span className="field-hint" style={{ marginRight: "0.4rem" }}>موبایل</span>
                      </div>
                    </li>
                  )}
                  {addressLine ? (
                    <li className="contact-list__item contact-list__item--map">
                      <div className="contact-map-head">
                        <span className="contact-list__icon-wrap" aria-hidden="true">
                          <i className="fa-solid fa-location-dot" />
                        </span>
                        <div className="contact-list__main">
                          <div className="contact-map-address" dir="ltr">
                            {addressLine}
                          </div>
                          {exchangePostcode ? (
                            <span className="contact-map-postcode" dir="ltr">
                              {exchangePostcode}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {mapEmbedUrl ? (
                        <div className="contact-map-frame-wrap">
                          <iframe
                            title={`نقشهٔ ${b?.name_fa || "کسب‌وکار"}`}
                            src={mapEmbedUrl}
                            className="contact-map-frame"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                          />
                        </div>
                      ) : null}
                      {directionsUrl ? (
                        <a
                          className="btn btn--primary btn--block"
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <i className="fa-solid fa-diamond-turn-right" aria-hidden="true" /> مسیریابی به این مکان
                        </a>
                      ) : null}
                    </li>
                  ) : null}
                </ul>
              </>
            ) : null}

            {(reservationLink || biolinkLinks.length > 0 || biolinkSocials.length > 0) && (
              <div style={{ marginTop: "0.85rem" }}>
                {(reservationLink || biolinkLinks.length > 0) && (
                  <div className="biz-links">
                    {reservationLink && (
                      <a
                        href={reservationLink}
                        className="biz-links__btn biz-links__btn--reservation"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <i className="fa-solid fa-calendar-check" aria-hidden="true" />
                        رزرو آنلاین
                      </a>
                    )}
                    {biolinkLinks.map((lnk) => {
                      const href = normalizeLinkUrl(lnk.url, lnk.preset);
                      const isLocal = /^(mailto:|tel:)/i.test(href);
                      return (
                        <a
                          key={lnk.id}
                          href={href}
                          className="biz-links__btn"
                          {...(!isLocal && { target: "_blank", rel: "noopener noreferrer" })}
                        >
                          <i className={lnk.iconClass} aria-hidden="true" />
                          {lnk.label || lnk.preset}
                        </a>
                      );
                    })}
                  </div>
                )}
                {biolinkSocials.length > 0 && (
                  <div className="biz-socials">
                    {biolinkSocials.map((s) => {
                      const href = normalizeLinkUrl(s.url, s.preset);
                      const isLocal = /^(mailto:|tel:)/i.test(href);
                      return (
                        <a
                          key={s.id}
                          href={href}
                          className={`biz-socials__btn biz-socials__btn--${s.preset}`}
                          {...(!isLocal && { target: "_blank", rel: "noopener noreferrer" })}
                          aria-label={s.preset}
                          title={s.preset}
                        >
                          <i className={s.iconClass} aria-hidden="true" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <p style={{ marginTop: isExchangeBusiness(b) ? 0 : "0.75rem" }}>
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => setReportOpen(true)}
              >
                <i className="fa-solid fa-flag" aria-hidden="true" /> گزارش مشکل در این آگهی
              </button>
            </p>
          </section>
          {!isExchangeBusiness(b) ? (
            <div className="ad-slot ad-slot--sidebar" role="complementary" aria-label="تبلیغات">
              <AdSidebarSlot />
            </div>
          ) : null}
        </aside>
      </div>

      {!isExchangeBusiness(b) ? (
        <p style={{ marginTop: "1.5rem" }}>
          <Link className="btn btn--ghost btn--block" to="/listings">
            <i className="fa-solid fa-arrow-right" aria-hidden="true" /> بازگشت به لیست
          </Link>
        </p>
      ) : null}

      {showExchangeContactFab || showExchangeCalcFab ? (
        <>
          <div className={`exchange-fab-row${showExchangeContactFab && showExchangeCalcFab ? "" : " exchange-fab-row--single"}`}>
            {showExchangeCalcFab ? (
              <button
                type="button"
                className="exchange-contact-fab exchange-contact-fab--calc"
                onClick={() => setExchangeCalcSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={exchangeCalcSheetOpen}
              >
                ماشین حساب لحظه ای
              </button>
            ) : null}
            {showExchangeContactFab ? (
              <button
                type="button"
                className="exchange-contact-fab"
                onClick={() => setExchangeContactSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={exchangeContactSheetOpen}
              >
                تماس با صرافی
              </button>
            ) : null}
          </div>
          {exchangeContactSheetOpen ? (
            <div
              className="exchange-contact-sheet__overlay"
              role="presentation"
              onClick={() => setExchangeContactSheetOpen(false)}
            >
              <section
                className="exchange-contact-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="اطلاعات تماس صرافی"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="exchange-contact-sheet__handle" aria-hidden="true" />
                <div className="exchange-contact-sheet__head">
                  <h3>اطلاعات تماس</h3>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setExchangeContactSheetOpen(false)}
                  >
                    بستن
                  </button>
                </div>
                <a
                  href={`tel:${String(phoneForCall).replace(/\s/g, "")}`}
                  className="exchange-contact-sheet__call"
                  dir="ltr"
                  onClick={() => trackBusinessPhoneClick(b.slug)}
                >
                  {phoneForCall}
                </a>
              </section>
            </div>
          ) : null}
          {exchangeCalcSheetOpen ? (
            <div
              className="exchange-contact-sheet__overlay"
              role="presentation"
              onClick={() => setExchangeCalcSheetOpen(false)}
            >
              <section
                className="exchange-contact-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="ماشین حساب لحظه ای"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="exchange-contact-sheet__handle" aria-hidden="true" />
                <div className="exchange-contact-sheet__head">
                  <h3>ماشین حساب لحظه ای</h3>
                  <button type="button" className="btn btn--ghost" onClick={() => setExchangeCalcSheetOpen(false)}>
                    بستن
                  </button>
                </div>
                <div className="field field--block exchange-contact-sheet__currency">
                  <label htmlFor="exchange-currency-sheet">ارز برای محاسبه</label>
                  <select
                    id="exchange-currency-sheet"
                    value={selectedCurrencyCode}
                    onChange={(e) => setSelectedCurrencyCode(e.target.value)}
                    dir="ltr"
                  >
                    {exchangeRatesRows.map((row) => (
                      <option key={row.code} value={row.code}>
                        {row.flag || "🏳️"} {row.code}
                        {row.name ? ` — ${row.name}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <ExchangeInlineCalc
                  idPrefix="biz-ex-sheet"
                  exchangeMode={exchangeMode}
                  onExchangeModeChange={setExchangeMode}
                  exchangeAmount={exchangeAmount}
                  onExchangeAmountChange={setExchangeAmount}
                  exchangeResult={exchangeResult}
                  exchangeAmountNum={exchangeAmountNum}
                  selectedRateNum={selectedRateNum}
                  selectedRateRaw={selectedRateRaw}
                />
              </section>
            </div>
          ) : null}
        </>
      ) : null}

      <BusinessReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        slug={b.slug}
        businessName={b.name_fa}
      />

      {b?.google_review_url && isActive && (
        <a
          className={`google-review-fab${(showExchangeContactFab || showExchangeCalcFab) ? " google-review-fab--above-exchange" : ""}`}
          href={b.google_review_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="نظر در Google"
        >
          <svg className="google-review-fab__icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="google-review-fab__label">نظر در Google</span>
        </a>
      )}

      {lightboxIndex !== null && (() => {
        const filledSlots = parseGalleryJson(b?.gallery_json)
          .map((url) => resolveBusinessImageUrl(String(url || "").trim()))
          .filter(Boolean);
        const total = filledSlots.length;
        const src = filledSlots[lightboxIndex] ?? null;
        if (!src) return null;
        return (
          <div
            className="lightbox-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="بزرگ‌نمایی تصویر"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              type="button"
              className="lightbox-close"
              aria-label="بستن"
              onClick={() => setLightboxIndex(null)}
            >
              ✕
            </button>
            {total > 1 && (
              <button
                type="button"
                className="lightbox-prev"
                aria-label="تصویر قبلی"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + total) % total); }}
              >
                ‹
              </button>
            )}
            <img
              className="lightbox-img"
              src={src}
              alt={`تصویر ${lightboxIndex + 1} از ${total}`}
              onClick={(e) => e.stopPropagation()}
            />
            {total > 1 && (
              <button
                type="button"
                className="lightbox-next"
                aria-label="تصویر بعدی"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % total); }}
              >
                ›
              </button>
            )}
            {total > 1 && (
              <span className="lightbox-counter">{lightboxIndex + 1} / {total}</span>
            )}
          </div>
        );
      })()}
    </article>
    </>
  );
}
