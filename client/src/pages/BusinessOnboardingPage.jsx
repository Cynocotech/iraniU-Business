import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { cn } from "../components/tables/utils.js";
import { apiGet, apiPost } from "../api.js";
import { DEFAULT_HOURS_ROWS } from "../lib/businessProfile.js";
import { LISTING_TERMS_VERSION } from "../lib/listingTerms.js";
import { buildBusinessListingUrl, ensureHttpsUrl } from "../lib/siteUrl.js";
import { ListingTermsScrollBox, ListingTermsCheckbox } from "../components/ListingTermsAgreement.jsx";

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
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [description, setDescription] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [cta, setCta] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [listingContactEmail, setListingContactEmail] = useState("");
  const [categories, setCategories] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  /** کلیدهای فیلدی که پس از «بعدی»/«ثبت» خالی/نامعتبر مانده‌اند — حاشیهٔ قرمز چشمک‌زن */
  const [invalidFields, setInvalidFields] = useState(/** @type {string[]} */ ([]));

  const clearFieldInvalid = (key) => {
    setInvalidFields((prev) => prev.filter((k) => k !== key));
  };

  useEffect(() => {
    apiGet("/api/categories")
      .then((rows) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]));
  }, []);

  const derivedSlugPreview = useMemo(() => autoSlugFromNameFa(nameFa), [nameFa]);

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
        label: "نام کسب‌وکار",
        value: nameFa.trim() || "—",
        emptyValue: !nameFa.trim(),
      },
    ],
    [listingPageUrlPreview, nameFa]
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
      {
        label: "محدودهٔ قیمت",
        value: priceRange.trim() || "—",
        valueDir: "ltr",
        emptyValue: !priceRange.trim(),
      },
      { label: "عنوان در لیست", value: listingTitle.trim() || "—", emptyValue: !listingTitle.trim() },
      {
        label: "توضیحات",
        value: description.trim() || "—",
        valueMultiline: true,
        emptyValue: !description.trim(),
      },
      { label: "دکمهٔ فراخوان", value: cta.trim() || "—", emptyValue: !cta.trim() },
    ],
    [category, priceRange, listingTitle, description, cta]
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
      return nameFa.trim().length > 0;
    }
    if (step === 1) {
      return (
        city.trim().length > 0 &&
        phone.trim().length > 0 &&
        address.trim().length > 0 &&
        emailOk(listingContactEmail)
      );
    }
    if (step === 2) {
      return (
        category.trim().length > 0 &&
        priceRange.trim().length > 0 &&
        listingTitle.trim().length > 0 &&
        description.trim().length > 0 &&
        isHttpUrl(ensureHttpsUrl(googleReviewUrl)) &&
        cta.trim().length > 0
      );
    }
    return true;
  };

  const next = () => {
    setMsg(null);
    if (step === 0 && !canGoNext()) {
      setInvalidFields(["nameFa"]);
      setMsg({
        ok: false,
        text: "نام کسب‌وکار را وارد کنید.",
      });
      return;
    }
    if (step === 1 && !canGoNext()) {
      const keys = [];
      if (!city.trim()) keys.push("city");
      if (!phone.trim()) keys.push("phone");
      if (!address.trim()) keys.push("address");
      if (!listingContactEmail.trim() || !emailOk(listingContactEmail)) keys.push("listingContactEmail");
      setInvalidFields(keys);
      setMsg({
        ok: false,
        text: "شهر، تلفن، آدرس و ایمیل تماس (معتبر) را پر کنید.",
      });
      return;
    }
    if (step === 2 && !canGoNext()) {
      const keys = [];
      if (!category.trim()) keys.push("category");
      if (!priceRange.trim()) keys.push("priceRange");
      if (!listingTitle.trim()) keys.push("listingTitle");
      if (!description.trim()) keys.push("description");
      if (!isHttpUrl(ensureHttpsUrl(googleReviewUrl))) keys.push("googleReviewUrl");
      if (!cta.trim()) keys.push("cta");
      setInvalidFields(keys);
      setMsg({
        ok: false,
        text: "دسته، محدودهٔ قیمت، عنوان لیست، توضیحات، لینک معتبر Google و دکمهٔ فراخوان را پر کنید.",
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
    if (!nameFa.trim()) invalidKeys.push("nameFa");
    if (!city.trim()) invalidKeys.push("city");
    if (!phone.trim()) invalidKeys.push("phone");
    if (!address.trim()) invalidKeys.push("address");
    if (!listingContactEmail.trim() || !emailOk(listingContactEmail)) invalidKeys.push("listingContactEmail");
    if (!category.trim()) invalidKeys.push("category");
    if (!priceRange.trim()) invalidKeys.push("priceRange");
    if (!listingTitle.trim()) invalidKeys.push("listingTitle");
    if (!description.trim()) invalidKeys.push("description");
    if (!isHttpUrl(ensureHttpsUrl(googleReviewUrl))) invalidKeys.push("googleReviewUrl");
    if (!cta.trim()) invalidKeys.push("cta");

    const firstErrorStep = (() => {
      if (!nameFa.trim()) return 0;
      if (!city.trim() || !phone.trim() || !address.trim() || !emailOk(listingContactEmail)) return 1;
      if (
        !category.trim() ||
        !priceRange.trim() ||
        !listingTitle.trim() ||
        !description.trim() ||
        !isHttpUrl(ensureHttpsUrl(googleReviewUrl)) ||
        !cta.trim()
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
    const hours_json = JSON.stringify(
      DEFAULT_HOURS_ROWS.map((r) => ({ day: r.day, hours: r.hours }))
    );
    const gallery_json = JSON.stringify(["", "", "", ""]);
    const basePayload = {
      name_fa: nameFa.trim(),
      description: description.trim(),
      category: category.trim(),
      city: city.trim(),
      phone: phone.trim(),
      address: address.trim(),
      google_review_url: ensureHttpsUrl(googleReviewUrl.trim()),
      listing_title: listingTitle.trim(),
      cta: cta.trim(),
      price_range: priceRange.trim(),
      hours_json,
      gallery_json,
      status: "active",
      accept_listing_terms: true,
      listing_terms_version: LISTING_TERMS_VERSION,
      listing_contact_email: listingContactEmail.trim(),
    };
    let slugAttempt = autoSlugFromNameFa(nameFa);
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

      <form className="dashboard-panel" onSubmit={step === STEPS.length - 1 ? submit : (e) => e.preventDefault()}>
        {step === 0 && (
          <>
            <h2 className="onboarding-panel-title">نام کسب‌وکار</h2>
            <p className="field-hint" style={{ marginTop: 0 }}>
              آدرس صفحهٔ شما در سایت <strong>به‌صورت خودکار</strong> از روی نام ساخته می‌شود (حروف لاتین یا شناسهٔ کوتاه).
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
                  required
                />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="onboarding-panel-title">تماس و مکان</h2>
            <div className="form-grid">
              <div className={cn("field", invalidFields.includes("city") && "field--invalid-blink")}>
                <label htmlFor="onb-city">شهر</label>
                <input
                  id="onb-city"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    clearFieldInvalid("city");
                  }}
                  lang="en"
                  dir="ltr"
                  required
                />
              </div>
              <div className={cn("field", invalidFields.includes("phone") && "field--invalid-blink")}>
                <label htmlFor="onb-phone">تلفن</label>
                <input
                  id="onb-phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    clearFieldInvalid("phone");
                  }}
                  dir="ltr"
                  required
                />
              </div>
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
                  dir="ltr"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
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
                  required
                />
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
              <div className={cn("field", invalidFields.includes("priceRange") && "field--invalid-blink")}>
                <label htmlFor="onb-price">محدودهٔ قیمت</label>
                <input
                  id="onb-price"
                  value={priceRange}
                  onChange={(e) => {
                    setPriceRange(e.target.value);
                    clearFieldInvalid("priceRange");
                  }}
                  dir="ltr"
                  placeholder="£10–25"
                  required
                />
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
                  placeholder="مثلاً غذای خانگی ایرانی در منچستر"
                  required
                />
              </div>
              <div className={cn("field field--block", invalidFields.includes("description") && "field--invalid-blink")}>
                <label htmlFor="onb-desc">توضیحات</label>
                <textarea
                  id="onb-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    clearFieldInvalid("description");
                  }}
                  placeholder="خدمات، ویژگی‌ها، محله…"
                  required
                />
              </div>
              <div className={cn("field field--block", invalidFields.includes("googleReviewUrl") && "field--invalid-blink")}>
                <label htmlFor="onb-greview">لینک صفحهٔ نظر Google (الزامی برای ثبت)</label>
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
                  placeholder="https://g.page/.../review"
                />
              </div>
              <div className={cn("field field--block", invalidFields.includes("cta") && "field--invalid-blink")}>
                <label htmlFor="onb-cta">دکمهٔ فراخوان</label>
                <input
                  id="onb-cta"
                  value={cta}
                  onChange={(e) => {
                    setCta(e.target.value);
                    clearFieldInvalid("cta");
                  }}
                  placeholder="مثلاً رزرو، تماس، وب‌سایت"
                  required
                />
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
