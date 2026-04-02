import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiGet, apiPost } from "../api.js";
import { DEFAULT_HOURS_ROWS } from "../lib/businessProfile.js";
import { LISTING_TERMS_VERSION } from "../lib/listingTerms.js";
import { ListingTermsScrollBox, ListingTermsCheckbox } from "../components/ListingTermsAgreement.jsx";

const STEPS = [
  { id: "identity", title: "نام و نامک" },
  { id: "contact", title: "تماس و مکان" },
  { id: "profile", title: "معرفی و لینک‌ها" },
  { id: "review", title: "ثبت" },
];

function slugPatternOk(s) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
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

  const [slug, setSlug] = useState("");
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

  useEffect(() => {
    apiGet("/api/categories")
      .then((rows) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]));
  }, []);

  const canGoNext = () => {
    if (step === 0) {
      const s = slug.trim().toLowerCase();
      return s.length > 0 && nameFa.trim().length > 0 && slugPatternOk(s);
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
        isHttpUrl(googleReviewUrl) &&
        cta.trim().length > 0
      );
    }
    return true;
  };

  const next = () => {
    setMsg(null);
    if (step === 0 && !canGoNext()) {
      setMsg({
        ok: false,
        text: "نامک فقط با حروف انگلیسی کوچک، اعداد و خط تیره است (مثلاً my-cafe-london).",
      });
      return;
    }
    if (step === 1 && !canGoNext()) {
      setMsg({
        ok: false,
        text: "شهر، تلفن، آدرس و ایمیل تماس (معتبر) را پر کنید.",
      });
      return;
    }
    if (step === 2 && !canGoNext()) {
      setMsg({
        ok: false,
        text: "دسته، محدودهٔ قیمت، عنوان لیست، توضیحات، لینک معتبر Google و دکمهٔ فراخوان را پر کنید.",
      });
      return;
    }
    setStep((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const back = () => {
    setMsg(null);
    setStep((i) => Math.max(i - 1, 0));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const s = slug.trim().toLowerCase();
    if (!slugPatternOk(s) || !nameFa.trim()) {
      setMsg({ ok: false, text: "نام و نامک را درست پر کنید." });
      setSaving(false);
      return;
    }
    if (
      !city.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !emailOk(listingContactEmail) ||
      !category.trim() ||
      !priceRange.trim() ||
      !listingTitle.trim() ||
      !description.trim() ||
      !isHttpUrl(googleReviewUrl) ||
      !cta.trim()
    ) {
      setMsg({ ok: false, text: "همهٔ فیلدهای مراحل قبل را کامل کنید." });
      setSaving(false);
      return;
    }
    if (!termsAccepted) {
      setMsg({ ok: false, text: "برای ثبت باید شرایط و قوانین ثبت آگهی را بپذیرید." });
      setSaving(false);
      return;
    }
    const hours_json = JSON.stringify(
      DEFAULT_HOURS_ROWS.map((r) => ({ day: r.day, hours: r.hours }))
    );
    const gallery_json = JSON.stringify(["", "", "", ""]);
    const payload = {
      slug: s,
      name_fa: nameFa.trim(),
      description: description.trim(),
      category: category.trim(),
      city: city.trim(),
      phone: phone.trim(),
      address: address.trim(),
      google_review_url: googleReviewUrl.trim(),
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
    try {
      const created = await apiPost("/api/businesses", payload);
      if (created && created.listing_approval === "pending") {
        navigate("/", { replace: true, state: { listingPendingReview: true } });
        return;
      }
      navigate(`/business?slug=${encodeURIComponent(s)}`, {
        state: { onboardingComplete: true },
      });
    } catch (err) {
      const t = String(err.message || "");
      let text = t;
      if (t.includes("slug_taken")) text = "این نامک قبلاً گرفته شده؛ نامک دیگری انتخاب کنید.";
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
            <h2 className="onboarding-panel-title">نام نمایشی و آدرس اینترنتی</h2>
            <p className="field-hint" style={{ marginTop: 0 }}>
              نامک در آدرس سایت دیده می‌شود و بعد از ثبت به‌سادگی عوض نمی‌شود.
            </p>
            <div className="form-grid">
              <div className="field field--block">
                <label htmlFor="onb-slug">نامک (انگلیسی)</label>
                <input
                  id="onb-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  lang="en"
                  dir="ltr"
                  autoComplete="off"
                  placeholder="my-business-london"
                  required
                />
              </div>
              <div className="field field--block">
                <label htmlFor="onb-name">نام کسب‌وکار (فارسی)</label>
                <input id="onb-name" value={nameFa} onChange={(e) => setNameFa(e.target.value)} required />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="onboarding-panel-title">تماس و مکان</h2>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="onb-city">شهر</label>
                <input id="onb-city" value={city} onChange={(e) => setCity(e.target.value)} lang="en" dir="ltr" required />
              </div>
              <div className="field">
                <label htmlFor="onb-phone">تلفن</label>
                <input id="onb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" required />
              </div>
              <div className="field field--block">
                <label htmlFor="onb-list-email">ایمیل تماس (برای اطلاع تأیید یا رد آگهی)</label>
                <input
                  id="onb-list-email"
                  type="email"
                  value={listingContactEmail}
                  onChange={(e) => setListingContactEmail(e.target.value)}
                  dir="ltr"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="field field--block">
                <label htmlFor="onb-address">آدرس کامل</label>
                <textarea id="onb-address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="onboarding-panel-title">معرفی و لینک‌ها</h2>
            <div className="form-grid">
              <div className="field field--block">
                <label htmlFor="onb-cat">دسته</label>
                <select id="onb-cat" value={category} onChange={(e) => setCategory(e.target.value)} required>
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
              <div className="field">
                <label htmlFor="onb-price">محدودهٔ قیمت</label>
                <input
                  id="onb-price"
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  dir="ltr"
                  placeholder="£10–25"
                  required
                />
              </div>
              <div className="field field--block">
                <label htmlFor="onb-list-title">عنوان کوتاه در لیست</label>
                <input
                  id="onb-list-title"
                  value={listingTitle}
                  onChange={(e) => setListingTitle(e.target.value)}
                  placeholder="مثلاً غذای خانگی ایرانی در منچستر"
                  required
                />
              </div>
              <div className="field field--block">
                <label htmlFor="onb-desc">توضیحات</label>
                <textarea
                  id="onb-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="خدمات، ویژگی‌ها، محله…"
                  required
                />
              </div>
              <div className="field field--block">
                <label htmlFor="onb-greview">لینک صفحهٔ نظر Google (اختیاری)</label>
                <input
                  id="onb-greview"
                  type="url"
                  value={googleReviewUrl}
                  onChange={(e) => setGoogleReviewUrl(e.target.value)}
                  dir="ltr"
                  placeholder="https://g.page/.../review"
                />
              </div>
              <div className="field field--block">
                <label htmlFor="onb-cta">دکمهٔ فراخوان</label>
                <input
                  id="onb-cta"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
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

            <section
              className="onboarding-review-card"
              aria-labelledby="onboarding-summary-heading"
              aria-describedby="onboarding-summary-desc"
            >
              <div className="onboarding-review-card__header">
                <h3 id="onboarding-summary-heading" className="onboarding-review-card__title">
                  خلاصهٔ اطلاعات
                </h3>
                <p id="onboarding-summary-desc" className="onboarding-review-card__sub">
                  مرور نهایی فیلدهای ثبت‌شده قبل از ارسال
                </p>
              </div>
              <div className="onboarding-review-card__body onboarding-review-card__body--table">
                <table className="onboarding-summary-table">
                  <tbody>
                    <tr>
                      <th scope="row">نامک</th>
                      <td lang="en" dir="ltr" className="onboarding-summary-table__mono">
                        {slug.trim().toLowerCase() || "—"}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">نام</th>
                      <td>{nameFa.trim() || "—"}</td>
                    </tr>
                    <tr>
                      <th scope="row">شهر / تلفن</th>
                      <td>
                        {[city.trim(), phone.trim()].filter(Boolean).length ? (
                          <>
                            {city.trim() && <span>{city.trim()}</span>}
                            {city.trim() && phone.trim() ? <span className="onboarding-summary-table__sep"> · </span> : null}
                            {phone.trim() && (
                              <span dir="ltr" className="onboarding-summary-table__phone">
                                {phone.trim()}
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">دسته</th>
                      <td>{category.trim() || "—"}</td>
                    </tr>
                    <tr>
                      <th scope="row">ایمیل اطلاع‌رسانی</th>
                      <td dir="ltr">{listingContactEmail.trim() || "—"}</td>
                    </tr>
                    {listingTitle.trim() ? (
                      <tr>
                        <th scope="row">عنوان در لیست</th>
                        <td>{listingTitle.trim()}</td>
                      </tr>
                    ) : null}
                    {address.trim() ? (
                      <tr>
                        <th scope="row">آدرس</th>
                        <td className="onboarding-summary-table__multiline">{address.trim()}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="onboarding-review-card onboarding-review-card--terms"
              aria-labelledby="onboarding-terms-heading"
              aria-describedby="onboarding-terms-desc"
            >
              <div className="onboarding-review-card__header">
                <h3 id="onboarding-terms-heading" className="onboarding-review-card__title">
                  شرایط قانونی
                </h3>
                <p id="onboarding-terms-desc" className="onboarding-review-card__sub">
                  متن قوانین را در باکس زیر بخوانید؛ سپس در ردیف پذیرش، موافقت خود را ثبت کنید.
                </p>
              </div>
              <div className="onboarding-review-card__body onboarding-review-card__body--terms">
                <ListingTermsScrollBox id="onboarding-listing-terms" />
              </div>
              <div className="onboarding-review-card__footer onboarding-review-card__footer--accept">
                <ListingTermsCheckbox
                  id="onboarding-terms-cb"
                  checked={termsAccepted}
                  onChange={setTermsAccepted}
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
            <button type="submit" className="btn btn--primary" disabled={saving || !termsAccepted}>
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
