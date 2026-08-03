import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { cn } from "../components/tables/utils.js";
import { apiGet, apiPost } from "../api.js";
import { DEFAULT_HOURS_ROWS } from "../lib/businessProfile.js";
import { LISTING_TERMS_VERSION } from "../lib/listingTerms.js";
import { buildBusinessListingUrl, ensureHttpsUrl } from "../lib/siteUrl.js";
import { ListingTermsScrollBox, ListingTermsCheckbox } from "../components/ListingTermsAgreement.jsx";
import { UK_CITIES } from "../data/ukCities.js";
import RichEditor from "../components/RichEditor.jsx";

// Cloudflare Turnstile Site Key
const TURNSTILE_SITE_KEY = "0x4AAAAAADmEnAaO3lpBKumP";

/** فیلد بدون مقدار در جمع‌بندی — قاب + حاشیهٔ قرمز چشمک‌زن (css/styles.css) */
const ONBOARDING_MISSING_VALUE_CLASS =
  "onboarding-review-value--invalid-blink tw-inline-block tw-min-w-[2rem] tw-rounded-md tw-bg-red-50 tw-px-2 tw-py-1.5 tw-text-red-950 tw-ring-2 tw-ring-inset tw-ring-red-400/75 tw-border tw-border-red-200/90";

/** @param {Record<string, unknown>} row */
function onboardingReviewValueClass(row) {
  const parts = [];
  if (row.valueMultiline) parts.push("tw-whitespace-pre-wrap tw-break-words");
  if (row.valueDir === "ltr") parts.push("tw-text-left [direction:ltr]");
  if (row.valueMono) parts.push("tw-font-mono tw-text-[0.85rem]");
  if (row.valuePhone) parts.push("tw-tracking-wide");
  if (row.emptyValue) parts.push(ONBOARDING_MISSING_VALUE_CLASS);
  return parts.filter(Boolean).join(" ");
}

/**
 * خلاصهٔ مرحلهٔ آخر — فهرست نقطه‌ای: برچسب + مقدار در هر آیتم
 *
 * @param {{
 *   rows: Record<string, unknown>[];
 *   valueRender?: (row: Record<string, unknown>) => import("react").ReactNode;
 * }} props
 */
function OnboardingReviewKvList({ rows, valueRender }) {
  return (
    <div className="onboarding-review-kv tw-rounded-md tw-border tw-border-slate-200 tw-bg-white tw-px-3 tw-py-2 sm:tw-px-4">
      <ul
        className={cn(
          "onboarding-review-kv__list tw-m-0 tw-list-outside tw-list-disc tw-space-y-3 tw-py-1",
          "tw-ps-5 tw-pe-1 sm:tw-ps-6 tw-marker:text-slate-400"
        )}
      >
        {rows.map((row, i) => {
          const content = valueRender ? valueRender(row) : defaultReviewValue(row);
          return (
            <li
              key={`${String(row.label)}-${i}`}
              className="onboarding-review-kv__item tw-pb-0.5 tw-leading-relaxed"
            >
              <div
                className={cn(
                  "onboarding-review-kv__row",
                  row.valueMultiline && "onboarding-review-kv__row--stack"
                )}
              >
                <span className="onboarding-review-kv__label-wrap">
                  <span className="onboarding-review-kv__label">{row.label}</span>
                  <span className="onboarding-review-kv__colon" aria-hidden="true">
                    :
                  </span>
                </span>
                <span
                  className={cn(
                    "onboarding-review-kv__value tw-min-w-0 tw-font-medium tw-leading-relaxed tw-text-slate-800",
                    row.valueMultiline ? "tw-w-full tw-whitespace-pre-wrap tw-ps-0.5" : "tw-ps-0.5",
                    onboardingReviewValueClass(row)
                  )}
                >
                  {content}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** بستهٔ پایه — امکانات به‌صورت فهرست نقطه‌ای با تیک */
function OnboardingReviewPackageBullets() {
  return (
    <div className="onboarding-review-package tw-rounded-md tw-border tw-border-slate-200 tw-bg-white tw-px-3 tw-py-3 sm:tw-px-4">
      <p className="tw-mb-3 tw-text-sm tw-font-medium tw-leading-relaxed tw-text-slate-600">
        آگهی شما با بستهٔ پایه ثبت می‌شود.
      </p>
      <ul
        className={cn(
          "tw-m-0 tw-list-outside tw-list-disc tw-space-y-2.5 tw-py-0",
          "tw-ps-5 tw-pe-1 sm:tw-ps-6",
          "tw-marker:text-slate-400"
        )}
      >
        {ONBOARDING_PRICING_ROWS.map((row, i) => (
          <li
            key={`pkg-${i}`}
            className="tw-flex tw-flex-wrap tw-items-baseline tw-gap-x-2 tw-text-[0.9375rem] tw-leading-relaxed tw-text-slate-800"
          >
            <span className="onboarding-review-package__feature tw-min-w-0">{row.feature}</span>
            <span className="onboarding-review-package__colon" aria-hidden="true">
              :
            </span>
            <span
              className="tw-inline-flex tw-shrink-0 tw-items-center tw-justify-center tw-rounded-md tw-bg-emerald-50 tw-px-2 tw-py-0.5 tw-text-sm tw-font-bold tw-text-emerald-700 tw-ring-1 tw-ring-emerald-200/80"
              aria-label="شامل است"
            >
              ✓
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function defaultReviewValue(row) {
  const v = row.value;
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  return v;
}

const ONBOARDING_PRICING_ROWS = [
  { feature: "ثبت آگهی و نمایش در فهرست پس از تأیید مدیر", base: "✓" },
  { feature: "صفحهٔ اختصاصی با آدرس ثابت", base: "✓" },
  { feature: "دسترسی به پنل مدیریت پس از ادعای مالکیت", base: "✓" },
];

function suggestSlugFromPlaceName(name) {
  const base = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (base.length >= 2) return base.slice(0, 48);
  return `biz-${Date.now().toString(36).slice(-10)}`;
}

const STEPS = [
  { id: "identity", title: "نام کسب‌وکار" },
  { id: "contact", title: "تماس و مکان" },
  { id: "profile", title: "معرفی و لینک‌ها" },
  { id: "review", title: "جمع‌بندی" },
];

function slugPatternOk(s) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

function autoSlugFromNameFa(nameFa) {
  return suggestSlugFromPlaceName(String(nameFa || "").trim()).toLowerCase();
}

function isPhoneOk(s) {
  const digits = String(s || "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function isUkPostcodeFormat(s) {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i.test(String(s || "").trim());
}

function isFarsiText(s) {
  const t = String(s || "").trim();
  if (!t) return true;
  // Allow Farsi/Arabic letters, Persian digits, spaces, common Persian punctuation, ZWNJ/ZWJ
  return /^[؀-ۿ‌‍\s.,\-()«»!؟،؛٪0-9]+$/.test(t);
}

function emailOk(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function isHttpUrl(s) {
  try {
    const u = new URL(String(s || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function BusinessOnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [nameFa, setNameFa] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameFaTouched, setNameFaTouched] = useState(false);
  const [nameEnTouched, setNameEnTouched] = useState(false);
  const [nameFaStatus, setNameFaStatus] = useState(/** @type {"idle"|"checking"|"available"|"taken"} */ ("idle"));
  const [slugStatus, setSlugStatus] = useState(/** @type {"idle"|"checking"|"available"|"taken"} */ ("idle"));
  const [emailStatus, setEmailStatus] = useState(/** @type {"idle"|"checking"|"available"|"taken"|"invalid"} */ ("idle"));
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [postcodeTouched, setPostcodeTouched] = useState(false);
  const [postcodeStatus, setPostcodeStatus] = useState(/** @type {"idle"|"checking"|"found"|"not_found"} */ ("idle"));
  const [postcodeInfo, setPostcodeInfo] = useState(/** @type {string|null} */ (null));
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [category, setCategory] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [description, setDescription] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [listingContactEmail, setListingContactEmail] = useState("");
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState(UK_CITIES);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileWidgetId = useRef(null);
  /** کلیدهای فیلدی که پس از «بعدی»/«ثبت» خالی/نامعتبر مانده‌اند — حاشیهٔ قرمز چشمک‌زن */
  const [invalidFields, setInvalidFields] = useState(/** @type {string[]} */ ([]));

  const clearFieldInvalid = (key) => {
    setInvalidFields((prev) => prev.filter((k) => k !== key));
  };

  // Load Cloudflare Turnstile script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch {}
    };
  }, []);

  // Initialize Turnstile widget once the review/terms step is shown
  useEffect(() => {
    if (step !== 3) return;
    const checkAndRender = () => {
      if (window.turnstile && !turnstileWidgetId.current) {
        try {
          turnstileWidgetId.current = window.turnstile.render("#cf-turnstile-onboarding", {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token) => setCaptchaToken(token),
            "error-callback": () => {
              setCaptchaToken("");
              setMsg({ ok: false, text: "خطا در بارگذاری تأیید امنیتی. لطفاً صفحه را رفرش کنید." });
            },
            theme: "light",
            language: "fa",
          });
        } catch (e) {
          console.error("Turnstile render error:", e);
        }
      }
    };

    const timer = setInterval(checkAndRender, 100);
    const timeout = setTimeout(() => clearInterval(timer), 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
      if (turnstileWidgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetId.current);
          turnstileWidgetId.current = null;
        } catch {}
      }
    };
  }, [step]);

  useEffect(() => {
    apiGet("/api/categories")
      .then((rows) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    apiGet("/api/cities")
      .then((d) => setCities(Array.from(new Set([...UK_CITIES, ...(Array.isArray(d) ? d : [])])).sort()))
      .catch(() => setCities(UK_CITIES));
  }, []);

  useEffect(() => {
    const name = nameFa.trim();
    if (!name || !isFarsiText(name)) { setNameFaStatus("idle"); return; }
    setNameFaStatus("checking");
    const timer = setTimeout(() => {
      apiGet(`/api/businesses/check-name-fa?name=${encodeURIComponent(name)}`)
        .then((d) => setNameFaStatus(d.available ? "available" : "taken"))
        .catch(() => setNameFaStatus("idle"));
    }, 500);
    return () => clearTimeout(timer);
  }, [nameFa]);

  useEffect(() => {
    const slug = suggestSlugFromPlaceName(nameEn.trim()) || autoSlugFromNameFa(nameFa);
    if (!slug || !slugPatternOk(slug)) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const timer = setTimeout(() => {
      apiGet(`/api/businesses/check-slug?slug=${encodeURIComponent(slug)}`)
        .then((d) => setSlugStatus(d.available ? "available" : "taken"))
        .catch(() => setSlugStatus("idle"));
    }, 500);
    return () => clearTimeout(timer);
  }, [nameEn, nameFa]);

  useEffect(() => {
    const email = listingContactEmail.trim().toLowerCase();
    if (!email) { setEmailStatus("idle"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailStatus("invalid"); return; }
    setEmailStatus("checking");
    const timer = setTimeout(() => {
      apiGet(`/api/businesses/check-email?email=${encodeURIComponent(email)}`)
        .then((d) => setEmailStatus(d.available ? "available" : "taken"))
        .catch(() => setEmailStatus("idle"));
    }, 500);
    return () => clearTimeout(timer);
  }, [listingContactEmail]);

  useEffect(() => {
    const pc = postcode.trim().toUpperCase();
    if (!pc) { setPostcodeStatus("idle"); setPostcodeInfo(null); return; }
    if (!isUkPostcodeFormat(pc)) { setPostcodeStatus("idle"); setPostcodeInfo(null); return; }
    setPostcodeStatus("checking");
    const timer = setTimeout(() => {
      fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.status === 200 && d.result) {
            const district = d.result.admin_district || d.result.parish || "";
            setPostcodeInfo(district);
            setPostcodeStatus("found");
            if (district && !city) setCity(district);
          } else {
            setPostcodeStatus("not_found");
            setPostcodeInfo(null);
          }
        })
        .catch(() => { setPostcodeStatus("not_found"); setPostcodeInfo(null); });
    }, 600);
    return () => clearTimeout(timer);
  }, [postcode]);

  const derivedSlugPreview = useMemo(() => {
    const fromEn = suggestSlugFromPlaceName(nameEn.trim());
    return fromEn || autoSlugFromNameFa(nameFa);
  }, [nameEn, nameFa]);

  const listingPageUrlPreview = useMemo(
    () => buildBusinessListingUrl(derivedSlugPreview),
    [derivedSlugPreview]
  );

  const renderLinkReviewValue = useMemo(
    () => (row) => {
      const v = String(row.value ?? "").trim();
      if (!v) return "—";
      const href = ensureHttpsUrl(v);
      if (isHttpUrl(href)) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="tw-break-all tw-text-slate-700 tw-underline tw-underline-offset-2 tw-decoration-slate-300 hover:tw-text-slate-900"
          >
            {href}
          </a>
        );
      }
      return v;
    },
    []
  );

  const identityRows = useMemo(
    () => [
      {
        label: "آدرس صفحه (خودکار)",
        value: listingPageUrlPreview || "—",
        valueDir: "ltr",
        valueMono: true,
        emptyValue: !listingPageUrlPreview,
      },
      {
        label: "نام کسب‌وکار (فارسی)",
        value: nameFa.trim() || "—",
        emptyValue: !nameFa.trim(),
      },
      {
        label: "نام کسب‌وکار (انگلیسی)",
        value: nameEn.trim() || "—",
        valueDir: "ltr",
        emptyValue: !nameEn.trim(),
      },
    ],
    [listingPageUrlPreview, nameFa, nameEn]
  );

  const contactRows = useMemo(
    () => [
      { label: "شهر", value: city.trim() || "—", valueDir: "ltr", emptyValue: !city.trim() },
      {
        label: "تلفن",
        value: phone.trim() || "—",
        valueDir: "ltr",
        valuePhone: true,
        emptyValue: !phone.trim(),
      },
      {
        label: "ایمیل اطلاع‌رسانی",
        value: listingContactEmail.trim() || "—",
        valueDir: "ltr",
        emptyValue: !listingContactEmail.trim(),
      },
      {
        label: "آدرس کامل",
        value: address.trim() || "—",
        valueMultiline: true,
        emptyValue: !address.trim(),
      },
    ],
    [city, phone, listingContactEmail, address]
  );

  const listingRows = useMemo(
    () => [
      { label: "دسته", value: category.trim() || "—", emptyValue: !category.trim() },
      { label: "عنوان در لیست", value: listingTitle.trim() || "—", emptyValue: !listingTitle.trim() },
      {
        label: "توضیحات",
        value: description.trim() || "—",
        valueMultiline: true,
        emptyValue: !description.trim(),
      },
    ],
    [category, listingTitle, description]
  );

  const linkRows = useMemo(
    () => [
      {
        label: "لینک صفحهٔ نظر / نقشه",
        value: googleReviewUrl.trim() || "",
        emptyValue: !googleReviewUrl.trim(),
      },
    ],
    [googleReviewUrl]
  );

  const canGoNext = () => {
    if (step === 0) {
      return nameFa.trim().length > 0 && isFarsiText(nameFa) && nameFaStatus === "available" && nameEn.trim().length > 0 && slugStatus !== "taken" && slugStatus !== "checking";
    }
    if (step === 1) {
      return (
        city.trim().length > 0 &&
        isPhoneOk(phone) &&
        address.trim().length > 0 &&
        emailStatus === "available"
      );
    }
    if (step === 2) {
      return (
        category.trim().length > 0 &&
        listingTitle.trim().length > 0 &&
        description.trim().length > 0 &&
        isHttpUrl(ensureHttpsUrl(googleReviewUrl))
      );
    }
    return true;
  };

  const next = () => {
    setMsg(null);
    if (step === 0 && !canGoNext()) {
      setNameFaTouched(true);
      setNameEnTouched(true);
      const keys = [];
      if (!nameFa.trim() || !isFarsiText(nameFa) || nameFaStatus === "taken") keys.push("nameFa");
      if (!nameEn.trim() || slugStatus === "taken") keys.push("nameEn");
      setInvalidFields(keys);
      setMsg({
        ok: false,
        text: !nameFa.trim()
          ? "نام فارسی کسب‌وکار را وارد کنید."
          : !isFarsiText(nameFa)
          ? "نام کسب‌وکار (فارسی) باید فقط با حروف فارسی نوشته شود."
          : nameFaStatus === "taken"
          ? "این نام فارسی قبلاً در سیستم ثبت شده است."
          : nameFaStatus === "checking"
          ? "لطفاً منتظر بمانید تا بررسی نام تمام شود."
          : slugStatus === "taken"
          ? "این آدرس صفحه قبلاً استفاده شده؛ نام انگلیسی دیگری وارد کنید."
          : slugStatus === "checking"
          ? "لطفاً منتظر بمانید تا بررسی آدرس تمام شود."
          : "نام کسب‌وکار (فارسی و انگلیسی) را وارد کنید.",
      });
      return;
    }
    if (step === 1 && !canGoNext()) {
      setEmailTouched(true);
      setPhoneTouched(true);
      const keys = [];
      if (!city.trim()) keys.push("city");
      if (!isPhoneOk(phone)) keys.push("phone");
      if (!address.trim()) keys.push("address");
      if (emailStatus !== "available") keys.push("listingContactEmail");
      setInvalidFields(keys);
      const emailErr = emailStatus === "taken"
        ? "این ایمیل قبلاً در سیستم ثبت شده است."
        : emailStatus === "invalid" || emailStatus === "idle"
        ? "ایمیل تماس معتبر وارد کنید."
        : emailStatus === "checking"
        ? "لطفاً منتظر بمانید تا بررسی ایمیل تمام شود."
        : null;
      setMsg({
        ok: false,
        text: emailErr || "شهر، تلفن، آدرس و ایمیل تماس را کامل و معتبر وارد کنید.",
      });
      return;
    }
    if (step === 2 && !canGoNext()) {
      const keys = [];
      if (!category.trim()) keys.push("category");
      if (!listingTitle.trim()) keys.push("listingTitle");
      if (!description.trim()) keys.push("description");
      if (!isHttpUrl(ensureHttpsUrl(googleReviewUrl))) keys.push("googleReviewUrl");
      setInvalidFields(keys);
      setMsg({
        ok: false,
        text: "دسته، عنوان لیست، توضیحات و لینک معتبر Google را پر کنید.",
      });
      return;
    }
    setInvalidFields([]);
    setStep((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const back = () => {
    setMsg(null);
    setInvalidFields([]);
    setStep((i) => Math.max(i - 1, 0));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setInvalidFields([]);

    const invalidKeys = [];
    if (!nameFa.trim() || !isFarsiText(nameFa)) invalidKeys.push("nameFa");
    if (!nameEn.trim()) invalidKeys.push("nameEn");
    if (!city.trim()) invalidKeys.push("city");
    if (!isPhoneOk(phone)) invalidKeys.push("phone");
    if (!address.trim()) invalidKeys.push("address");
    if (emailStatus !== "available") invalidKeys.push("listingContactEmail");
    if (!category.trim()) invalidKeys.push("category");
    if (!listingTitle.trim()) invalidKeys.push("listingTitle");
    if (!description.trim()) invalidKeys.push("description");
    if (!isHttpUrl(ensureHttpsUrl(googleReviewUrl))) invalidKeys.push("googleReviewUrl");

    const firstErrorStep = (() => {
      if (!nameFa.trim() || !nameEn.trim()) return 0;
      if (!city.trim() || !isPhoneOk(phone) || !address.trim() || emailStatus !== "available") return 1;
      if (
        !category.trim() ||
        !listingTitle.trim() ||
        !description.trim() ||
        !isHttpUrl(ensureHttpsUrl(googleReviewUrl))
      )
        return 2;
      return null;
    })();

    if (invalidKeys.length > 0) {
      setInvalidFields(invalidKeys);
      if (firstErrorStep !== null) setStep(firstErrorStep);
      setMsg({ ok: false, text: "همهٔ فیلدهای مراحل قبل را کامل کنید." });
      setSaving(false);
      return;
    }
    if (!termsAccepted) {
      setInvalidFields(["termsAccepted"]);
      setMsg({ ok: false, text: "برای ثبت باید شرایط و قوانین ثبت آگهی را بپذیرید." });
      setSaving(false);
      return;
    }
    if (!captchaToken) {
      setMsg({ ok: false, text: "لطفاً تأیید امنیتی (Captcha) را تکمیل کنید." });
      setSaving(false);
      return;
    }
    const hours_json = JSON.stringify(
      DEFAULT_HOURS_ROWS.map((r) => ({ day: r.day, hours: r.hours }))
    );
    const gallery_json = JSON.stringify(["", "", "", ""]);
    const basePayload = {
      name_fa: nameFa.trim(),
      name_en: nameEn.trim(),
      description: description.trim(),
      category: category.trim(),
      city: city.trim(),
      phone: phone.trim(),
      address: address.trim(),
      postcode: postcode.trim(),
      google_review_url: ensureHttpsUrl(googleReviewUrl.trim()),
      listing_title: listingTitle.trim(),
      hours_json,
      gallery_json,
      status: "active",
      accept_listing_terms: true,
      listing_terms_version: LISTING_TERMS_VERSION,
      listing_contact_email: listingContactEmail.trim(),
      captcha_token: captchaToken,
    };
    let slugAttempt = suggestSlugFromPlaceName(nameEn.trim()) || autoSlugFromNameFa(nameFa);
    if (!slugPatternOk(slugAttempt)) {
      slugAttempt = `biz-${Date.now().toString(36)}`;
    }
    try {
      let created;
      let finalSlug = slugAttempt;
      for (let i = 0; i < 12; i++) {
        try {
          created = await apiPost("/api/businesses", { ...basePayload, slug: finalSlug });
          break;
        } catch (err) {
          const t = String(err.message || "");
          if (!t.includes("slug_taken") || i === 11) throw err;
          finalSlug = `${autoSlugFromNameFa(nameFa)}-${Date.now().toString(36).slice(-8)}`;
        }
      }
      if (created && created.listing_approval === "pending") {
        navigate("/", { replace: true, state: { listingPendingReview: true } });
        return;
      }
      navigate(`/business?slug=${encodeURIComponent(finalSlug)}`, {
        state: { onboardingComplete: true },
      });
    } catch (err) {
      const t = String(err.message || "");
      let text = t;
      if (t.includes("slug_taken")) text = "ساخت آدرس صفحه با خطا مواجه شد؛ دوباره تلاش کنید.";
      else if (t.includes("invalid_slug")) text = "فرمت نامک نامعتبر است.";
      else if (t.includes("missing_slug_or_name")) text = "نامک و نام کسب‌وکار الزامی است.";
      else if (t.includes("invalid_json_field")) text = "خطا در دادهٔ ساختاری؛ دوباره تلاش کنید.";
      else if (t.includes("terms_not_accepted")) text = "پذیرش شرایط و قوانین در سرور الزامی است.";
      else if (t.includes("terms_version_mismatch")) text = "نسخهٔ شرایط عوض شده؛ صفحه را رفرش کنید و دوباره تلاش کنید.";
      else if (t.includes("invalid_listing_contact_email")) text = "ایمیل تماس برای اطلاع‌رسانی نامعتبر است.";
      else if (t.includes("missing_listing_contact_email")) text = "ایمیل تماس برای اطلاع‌رسانی الزامی است.";
      else if (t.includes("missing_business_fields")) text = "همهٔ فیلدهای الزامی را پر کنید.";
      else if (t.includes("invalid_google_review_url")) text = "لینک صفحهٔ نظر Google باید یک آدرس http یا https معتبر باشد.";
      setMsg({ ok: false, text });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Seo
        title="ثبت کسب‌وکار"
        noindex
        description="ثبت آگهی جدید در ایرانیو؛ پس از تأیید مدیر در فهرست نمایش داده می‌شود."
      />
    <div className="container onboarding-page" style={{ padding: "2rem 0", maxWidth: "40rem" }}>
      <div className="onboarding-banner">
        <span className="onboarding-banner__icon" aria-hidden="true">
          <i className="fa-solid fa-store" />
        </span>
        <div className="onboarding-banner__text">
          <strong>ثبت رایگان کسب‌وکار در ایرانیو</strong>
          <span>کسب‌وکار خود را به فهرست اضافه کنید و در معرض دید کاربران ایرانی قرار بگیرید</span>
        </div>
      </div>

      <div className="dashboard-panel onboarding-intro">
        <header style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ margin: "0 0 0.35rem" }}>ثبت کسب‌وکار</h1>
          <p className="field-hint" style={{ margin: 0 }}>
            چند مرحلهٔ کوتاه؛ آگهی با بستهٔ پایه و بدون مالک ثبت می‌شود. پس از ارسال، <strong>تا تأیید مدیر در سایت نمایش داده نمی‌شود</strong>.
            ایمیل تماس برای ارسال نتیجهٔ تأیید یا رد آگهی <strong>الزامی</strong> است.
            بعد از تأیید می‌توانید از صفحهٔ آگهی <strong>ادعای مالکیت</strong> کنید و پس از آن از <Link to="/dashboard">پنل کسب‌وکار</Link> برای مدیریت آگهی استفاده کنید.
          </p>
        </header>

        <ol className="onboarding-steps" aria-label="مراحل ثبت">
          {STEPS.map((st, i) => (
            <li
              key={st.id}
              className={
                "onboarding-steps__item" +
                (i === step ? " onboarding-steps__item--active" : "") +
                (i < step ? " onboarding-steps__item--done" : "")
              }
            >
              <span className="onboarding-steps__num" aria-hidden="true">
                {i + 1}
              </span>
              {st.title}
            </li>
          ))}
        </ol>
      </div>

      <form className="dashboard-panel" onSubmit={step === STEPS.length - 1 ? submit : (e) => e.preventDefault()}>
        {step === 0 && (
          <>
            <h2 className="onboarding-panel-title">نام کسب‌وکار</h2>
            <p className="field-hint" style={{ marginTop: 0 }}>
              آدرس صفحهٔ شما در سایت <strong>به‌صورت خودکار</strong> از روی نام انگلیسی ساخته می‌شود.
            </p>

            <div className="form-grid">
              <div
                className={cn("field field--block", invalidFields.includes("nameFa") && "field--invalid-blink")}
              >
                <label htmlFor="onb-name">نام کسب‌وکار (فارسی)</label>
                <input
                  id="onb-name"
                  value={nameFa}
                  onChange={(e) => {
                    setNameFa(e.target.value);
                    clearFieldInvalid("nameFa");
                  }}
                  onBlur={() => setNameFaTouched(true)}
                  required
                  maxLength={100}
                />
                {nameFaTouched && !nameFa.trim() && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#dc2626" }}>
                    نام فارسی کسب‌وکار الزامی است
                  </span>
                )}
                {nameFa.trim() && !isFarsiText(nameFa) && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#dc2626" }}>
                    لطفاً فقط از حروف فارسی استفاده کنید
                  </span>
                )}
                {nameFa.trim() && isFarsiText(nameFa) && nameFaStatus === "checking" && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block" }}>بررسی نام…</span>
                )}
                {nameFa.trim() && isFarsiText(nameFa) && nameFaStatus === "available" && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#16a34a" }}>این نام در دسترس است</span>
                )}
                {nameFa.trim() && isFarsiText(nameFa) && nameFaStatus === "taken" && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#dc2626" }}>این نام قبلاً ثبت شده است</span>
                )}
              </div>

              <div
                className={cn("field field--block", invalidFields.includes("nameEn") && "field--invalid-blink")}
              >
                <label htmlFor="onb-name-en">
                  Business Name in English
                  {derivedSlugPreview && (
                    <span style={{ display: "block", fontWeight: 400, color: "#64748b", fontSize: "0.8rem", fontFamily: "monospace", marginTop: "0.1rem", wordBreak: "break-all" }}>
                      slug: {derivedSlugPreview}
                    </span>
                  )}
                </label>
                <input
                  id="onb-name-en"
                  value={nameEn}
                  dir="ltr"
                  placeholder="e.g. Reza Barber Shop"
                  onChange={(e) => {
                    setNameEn(e.target.value);
                    clearFieldInvalid("nameEn");
                  }}
                  onBlur={() => setNameEnTouched(true)}
                  required
                  maxLength={100}
                />
                {nameEnTouched && !nameEn.trim() && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#dc2626" }}>
                    Business name in English is required
                  </span>
                )}
                {slugStatus === "checking" && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block" }}>بررسی آدرس…</span>
                )}
                {slugStatus === "available" && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#16a34a" }}>
                    این آدرس در دسترس است
                  </span>
                )}
                {slugStatus === "taken" && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#dc2626" }}>
                    این آدرس قبلاً استفاده شده — نام انگلیسی دیگری وارد کنید
                  </span>
                )}
              </div>

              {derivedSlugPreview && (
                <div className="field field--block">
                  <label>آدرس صفحه (خودکار)</label>
                  <input
                    value={listingPageUrlPreview}
                    dir="ltr"
                    readOnly
                    style={{ background: "#f1f5f9", color: "#64748b", cursor: "default" }}
                    aria-label="آدرس خودکار صفحه"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="onboarding-panel-title">تماس و مکان</h2>
            <div className="form-grid">

              {/* Postcode — moved first; triggers city auto-fill */}
              <div className="field">
                <label htmlFor="onb-postcode">Postcode</label>
                <input
                  id="onb-postcode"
                  value={postcode}
                  onChange={(e) => {
                    setPostcode(e.target.value.toUpperCase());
                    setPostcodeTouched(true);
                  }}
                  onBlur={() => setPostcodeTouched(true)}
                  dir="ltr"
                  placeholder="e.g. SW1A 1AA"
                  maxLength={12}
                />
                {postcodeStatus === "checking" && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block" }}>بررسی کد پستی…</span>
                )}
                {postcodeStatus === "found" && postcodeInfo && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#16a34a" }}>
                    {postcodeInfo} — شهر به‌صورت خودکار انتخاب شد
                  </span>
                )}
                {postcodeStatus === "not_found" && postcode.trim() && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#dc2626" }}>
                    کد پستی یافت نشد — آدرس را به‌صورت دستی وارد کنید
                  </span>
                )}
              </div>

              {/* City */}
              <div className={cn("field", invalidFields.includes("city") && "field--invalid-blink")}>
                <label htmlFor="onb-city">شهر</label>
                <select
                  id="onb-city"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    clearFieldInvalid("city");
                  }}
                  lang="en"
                  dir="ltr"
                  required
                >
                  <option value="">— انتخاب شهر —</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {city && !cities.includes(city) ? <option value={city}>{city}</option> : null}
                </select>
              </div>

              {/* Address — manual (full address lookup requires paid API) */}
              <div className={cn("field field--block", invalidFields.includes("address") && "field--invalid-blink")}>
                <label htmlFor="onb-address">آدرس کامل</label>
                <textarea
                  id="onb-address"
                  rows={3}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    clearFieldInvalid("address");
                  }}
                  dir="ltr"
                  placeholder="e.g. 10 Downing Street, London"
                  required
                  maxLength={300}
                />
              </div>

              {/* Phone — numeric only */}
              <div className={cn("field", invalidFields.includes("phone") && "field--invalid-blink")}>
                <label htmlFor="onb-phone">تلفن</label>
                <input
                  id="onb-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d\s+\-()]/g, "");
                    setPhone(val);
                    clearFieldInvalid("phone");
                  }}
                  onBlur={() => setPhoneTouched(true)}
                  dir="ltr"
                  placeholder="e.g. 020 7946 0958"
                  required
                  maxLength={30}
                />
                {phoneTouched && !isPhoneOk(phone) && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#dc2626" }}>
                    شماره تلفن معتبر وارد کنید (فقط عدد)
                  </span>
                )}
              </div>

              {/* Email with uniqueness check */}
              <div
                className={cn("field field--block", invalidFields.includes("listingContactEmail") && "field--invalid-blink")}
              >
                <label htmlFor="onb-list-email">ایمیل تماس (برای اطلاع تأیید یا رد آگهی)</label>
                <input
                  id="onb-list-email"
                  type="email"
                  value={listingContactEmail}
                  onChange={(e) => {
                    setListingContactEmail(e.target.value);
                    clearFieldInvalid("listingContactEmail");
                  }}
                  onBlur={() => setEmailTouched(true)}
                  dir="ltr"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  maxLength={200}
                />
                {emailStatus === "checking" && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block" }}>بررسی ایمیل…</span>
                )}
                {emailStatus === "available" && emailTouched && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#16a34a" }}>
                    این ایمیل قابل استفاده است
                  </span>
                )}
                {emailStatus === "taken" && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#dc2626" }}>
                    این ایمیل قبلاً در سیستم ثبت شده است
                  </span>
                )}
                {emailStatus === "invalid" && emailTouched && (
                  <span className="field-hint" style={{ marginTop: "0.25rem", display: "block", color: "#dc2626" }}>
                    فرمت ایمیل نامعتبر است
                  </span>
                )}
              </div>

            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="onboarding-panel-title">معرفی و لینک‌ها</h2>
            <div className="form-grid">
              <div className={cn("field field--block", invalidFields.includes("category") && "field--invalid-blink")}>
                <label htmlFor="onb-cat">دسته</label>
                <select
                  id="onb-cat"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    clearFieldInvalid("category");
                  }}
                  required
                >
                  <option value="">— انتخاب دسته —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {category && !categories.some((c) => c.name === category) ? (
                    <option value={category}>{category}</option>
                  ) : null}
                </select>
                <span className="field-hint">مثال: رستوران، کلینیک — از فهرست مدیریت‌شدهٔ سایت.</span>
              </div>
              <div className={cn("field field--block", invalidFields.includes("listingTitle") && "field--invalid-blink")}>
                <label htmlFor="onb-list-title">عنوان کوتاه در لیست</label>
                <input
                  id="onb-list-title"
                  value={listingTitle}
                  onChange={(e) => {
                    setListingTitle(e.target.value);
                    clearFieldInvalid("listingTitle");
                  }}
                  maxLength={160}
                  placeholder="مثلاً غذای خانگی ایرانی در منچستر"
                  required
                />
              </div>
              <div className={cn("field field--block", invalidFields.includes("description") && "field--invalid-blink")}>
                <label>توضیحات</label>
                <RichEditor
                  value={description}
                  onChange={(html) => { setDescription(html); clearFieldInvalid("description"); }}
                  placeholder="خدمات، ویژگی‌ها، محله…"
                  minHeight={160}
                />
              </div>
              <div className={cn("field field--block", invalidFields.includes("googleReviewUrl") && "field--invalid-blink")}>
                <label htmlFor="onb-greview">لینک صفحهٔ Google Maps / نظرات *</label>
                <input
                  id="onb-greview"
                  type="url"
                  value={googleReviewUrl}
                  onChange={(e) => {
                    setGoogleReviewUrl(e.target.value);
                    clearFieldInvalid("googleReviewUrl");
                  }}
                  onBlur={() => {
                    setGoogleReviewUrl((prev) => ensureHttpsUrl(String(prev).trim()));
                  }}
                  dir="ltr"
                  placeholder="https://maps.google.com/maps?cid=..."
                  required
                  maxLength={500}
                />
                <span className="field-hint" style={{ color: "#6b5f75" }}>
                  مثال: <span dir="ltr" style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>https://g.page/r/XXXXXXXXXXXX/review</span>
                  {" · "}در Google Maps، روی کسب‌وکار خود کلیک کنید، سپس «Share» → «Copy link» را بزنید.
                </span>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="onboarding-panel-title">جمع‌بندی و شرایط قانونی</h2>

            <div className="onboarding-review-summary" aria-labelledby="onboarding-summary-heading">
              <header className="onboarding-review-summary__intro" id="onboarding-summary-heading">
                <h3 className="onboarding-review-summary__title">خلاصهٔ اطلاعات</h3>
                <p className="onboarding-review-summary__lead">
                  مرور نهایی فیلدهای ثبت‌شده قبل از ارسال. برای اصلاح، از دکمهٔ «قبلی» استفاده کنید.
                </p>
              </header>

              <section
                className="onboarding-review-block onboarding-review-block--clean"
                aria-labelledby="sum-sec-identity"
              >
                <div className="onboarding-review-block__head">
                  <h4 id="sum-sec-identity" className="onboarding-review-block__title">
                    <span className="onboarding-review-block__step" aria-hidden="true">
                      ۱
                    </span>
                    <span className="onboarding-review-block__title-label">هویت و آدرس صفحه</span>
                  </h4>
                </div>
                <div className="onboarding-review-block__kv-wrap">
                  <OnboardingReviewKvList rows={identityRows} />
                </div>
              </section>

              <section
                className="onboarding-review-block onboarding-review-block--clean"
                aria-labelledby="sum-sec-contact"
              >
                <div className="onboarding-review-block__head">
                  <h4 id="sum-sec-contact" className="onboarding-review-block__title">
                    <span className="onboarding-review-block__step" aria-hidden="true">
                      ۲
                    </span>
                    <span className="onboarding-review-block__title-label">تماس و مکان</span>
                  </h4>
                </div>
                <div className="onboarding-review-block__kv-wrap">
                  <OnboardingReviewKvList rows={contactRows} />
                </div>
              </section>

              <section
                className="onboarding-review-block onboarding-review-block--clean"
                aria-labelledby="sum-sec-listing"
              >
                <div className="onboarding-review-block__head">
                  <h4 id="sum-sec-listing" className="onboarding-review-block__title">
                    <span className="onboarding-review-block__step" aria-hidden="true">
                      ۳
                    </span>
                    <span className="onboarding-review-block__title-label">معرفی در لیست</span>
                  </h4>
                </div>
                <div className="onboarding-review-block__kv-wrap">
                  <OnboardingReviewKvList rows={listingRows} />
                </div>
              </section>

              <section
                className="onboarding-review-block onboarding-review-block--clean"
                aria-labelledby="sum-sec-links"
              >
                <div className="onboarding-review-block__head">
                  <h4 id="sum-sec-links" className="onboarding-review-block__title">
                    <span className="onboarding-review-block__step" aria-hidden="true">
                      ۴
                    </span>
                    <span className="onboarding-review-block__title-label">لینک Google</span>
                  </h4>
                </div>
                <div className="onboarding-review-block__kv-wrap">
                  <OnboardingReviewKvList rows={linkRows} valueRender={renderLinkReviewValue} />
                </div>
              </section>

              <section
                className="onboarding-review-block onboarding-review-block--clean"
                aria-labelledby="sum-sec-pricing"
              >
                <div className="onboarding-review-block__head">
                  <h4 id="sum-sec-pricing" className="onboarding-review-block__title onboarding-review-block__title--no-step">
                    <span className="onboarding-review-block__title-label">بستهٔ پایه — امکانات</span>
                  </h4>
                </div>
                <div className="onboarding-review-block__kv-wrap">
                  <OnboardingReviewPackageBullets />
                </div>
              </section>
            </div>

            <section
              className="onboarding-review-card onboarding-review-card--terms onboarding-review-card--legal onboarding-review-card--clean"
              aria-labelledby="onboarding-terms-heading"
              aria-describedby="onboarding-terms-desc"
            >
              <div className="onboarding-review-card__header">
                <h3 id="onboarding-terms-heading" className="onboarding-review-card__title">
                  <span className="onboarding-review-block__step onboarding-review-block__step--in-heading" aria-hidden="true">
                    ۵
                  </span>
                  <span className="onboarding-review-block__title-label">شرایط قانونی</span>
                </h3>
                <p id="onboarding-terms-desc" className="onboarding-review-card__sub">
                  متن زیر را بخوانید؛ سپس با تأیید پایین، موافقت خود را ثبت کنید.
                </p>
              </div>
              <div className="onboarding-review-card__body onboarding-review-card__body--terms">
                <ListingTermsScrollBox id="onboarding-listing-terms" />
              </div>
              <div
                className={cn(
                  "onboarding-review-card__footer onboarding-review-card__footer--accept",
                  invalidFields.includes("termsAccepted") && "onboarding-terms-accept--invalid-blink"
                )}
              >
                <ListingTermsCheckbox
                  id="onboarding-terms-cb"
                  checked={termsAccepted}
                  onChange={(v) => {
                    setTermsAccepted(v);
                    if (v) clearFieldInvalid("termsAccepted");
                  }}
                  disabled={saving}
                />
              </div>
            </section>

            <div id="cf-turnstile-onboarding" style={{ marginTop: "1rem", marginBottom: "1rem" }}></div>

            <p className="field-hint onboarding-review-footnote">
              پس از ثبت، آگهی تا <strong>تأیید مدیر</strong> در فهرست و جستجو دیده نمی‌شود. بعد از تأیید می‌توانید برای مدیریت
              بیشتر از <Link to="/dashboard">پنل کسب‌وکار</Link> (پس از ادعای مالکیت) استفاده کنید.
            </p>
          </>
        )}

        {msg && !msg.ok && (
          <p className="field-hint" role="alert" style={{ color: "var(--color-danger, #b00020)" }}>
            {msg.text}
          </p>
        )}

        <div className="dashboard-actions dashboard-actions--inline" style={{ borderTop: "none" }}>
          {step > 0 && (
            <button type="button" className="btn btn--ghost" onClick={back} disabled={saving}>
              قبلی
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button type="button" className="btn btn--primary" onClick={next}>
              بعدی
            </button>
          )}
          {step === STEPS.length - 1 && (
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "در حال ثبت…" : "ثبت آگهی"}
            </button>
          )}
        </div>
      </form>

      <p className="field-hint" style={{ marginTop: "1rem" }}>
        <Link to="/listings">بازگشت به فهرست</Link>
        {" · "}
        <Link to="/">خانه</Link>
      </p>
    </div>
    </>
  );
}
