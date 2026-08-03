import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../../api.js";
import { DEFAULT_HOURS_ROWS } from "../../lib/businessProfile.js";
import { LISTING_TERMS_VERSION } from "../../lib/listingTerms.js";
import { ListingTermsScrollBox, ListingTermsCheckbox } from "../../components/ListingTermsAgreement.jsx";
import Seo from "../../components/Seo.jsx";
import { normalizeBusinessSlugInput } from "../../lib/businessSlugInput.js";
import { UK_CITIES } from "../../data/ukCities.js";

const EXCHANGE_CATEGORY = "صرافی";

/**
 * افزودن آگهی صرافی — فقط از دپارتمان صرافی؛ دسته همیشه «صرافی».
 */
export default function AdminAddExchangePage() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState("");
  const [nameFa, setNameFa] = useState("");
  const [description, setDescription] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [listingContactEmail, setListingContactEmail] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("https://www.google.com/maps");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [status, setStatus] = useState("active");
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    document.documentElement.scrollTo(0, 0);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      setMsg("برای ایجاد آگهی باید شرایط و قوانین را بپذیرید.");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const slugNorm = normalizeBusinessSlugInput(slug);
      if (!slugNorm) {
        setMsg("نامک را فقط با حروف انگلیسی کوچک، عدد و خط تیره وارد کنید.");
        setSaving(false);
        return;
      }
      const hours_json = JSON.stringify(
        DEFAULT_HOURS_ROWS.map((r) => ({ day: r.day, hours: r.hours }))
      );
      const gallery_json = JSON.stringify(["", "", "", ""]);
      const nameTrim = nameFa.trim();
      const titleTrim = listingTitle.trim() || nameTrim;
      const descTrim = description.trim();
      const emailTrim = listingContactEmail.trim().toLowerCase();
      const payload = {
        slug: slugNorm,
        name_fa: nameTrim,
        description: descTrim,
        category: EXCHANGE_CATEGORY,
        city: city.trim(),
        phone: phone.trim(),
        address: address.trim(),
        postcode: postcode.trim(),
        status,
        hours_json,
        gallery_json,
        accept_listing_terms: true,
        listing_terms_version: LISTING_TERMS_VERSION,
        listing_contact_email: emailTrim,
        listing_title: titleTrim,
        google_review_url: googleReviewUrl.trim(),
      };
      await apiPost("/api/businesses", payload);
      navigate(`/admin-edit?slug=${encodeURIComponent(payload.slug)}`);
    } catch (err) {
      setMsg(`خطا: ${err.message || "نامشخص"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Seo title="افزودن آگهی صرافی — دپارتمان صرافی" noindex description="ایجاد آگهی جدید با دسته صرافی." />
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin/exchanges">← دپارتمان صرافی</Link>
        {" · "}
        <Link to="/admin-businesses">همه آگهی‌ها</Link>
      </p>

      <section className="dashboard-panel admin-add-exchange">
        <h2 className="admin-add-exchange__title">افزودن آگهی صرافی</h2>
        <p className="field-hint admin-add-exchange__intro">
          این فرم فقط برای <strong>صرافی</strong> است؛ دسته به‌صورت خودکار «{EXCHANGE_CATEGORY}» ثبت می‌شود. پس از ایجاد،
          از صفحهٔ ویرایش می‌توانید نرخ ارز، روش پرداخت و سایر جزئیات صرافی را تکمیل کنید.
        </p>

        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="field field--block">
              <label htmlFor="add-ex-slug">نامک (انگلیسی، اجباری)</label>
              <input
                id="add-ex-slug"
                value={slug}
                onChange={(e) => setSlug(normalizeBusinessSlugInput(e.target.value))}
                lang="en"
                dir="ltr"
                required
                placeholder="my-exchange"
                autoComplete="off"
              />
              <p className="field-hint" style={{ marginTop: "0.35rem" }}>
                فقط a تا z، 0–۹ و خط تیره؛ هنگام تایپ نرمال می‌شود.
              </p>
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-name">نام صرافی (فارسی)</label>
              <input id="add-ex-name" value={nameFa} onChange={(e) => setNameFa(e.target.value)} required />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-listing-title">عنوان آگهی در لیست</label>
              <input
                id="add-ex-listing-title"
                value={listingTitle}
                onChange={(e) => setListingTitle(e.target.value)}
                placeholder="اگر خالی بماند، همان نام صرافی استفاده می‌شود"
              />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-contact-email">ایمیل تماس برای اطلاع‌رسانی</label>
              <input
                id="add-ex-contact-email"
                type="email"
                value={listingContactEmail}
                onChange={(e) => setListingContactEmail(e.target.value)}
                dir="ltr"
                autoComplete="email"
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-desc">توضیحات</label>
              <textarea
                id="add-ex-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: "100%" }}
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-gmaps">لینک صفحهٔ Google (نظر / نقشه) *</label>
              <input
                id="add-ex-gmaps"
                type="url"
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                dir="ltr"
                placeholder="https://www.google.com/maps/..."
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-cat">دسته</label>
              <input id="add-ex-cat" value={EXCHANGE_CATEGORY} readOnly tabIndex={-1} aria-readonly="true" />
              <p className="field-hint" style={{ marginTop: "0.35rem" }}>
                برای آگهی‌های صرافی ثابت است و در «افزودن آگهی» عمومی قابل تغییر است.
              </p>
            </div>
            <div className="field">
              <label htmlFor="add-ex-city">شهر</label>
              <input id="add-ex-city" list="add-ex-cities-list" value={city} onChange={(e) => setCity(e.target.value)} lang="en" dir="ltr" required />
              <datalist id="add-ex-cities-list">
                {UK_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="add-ex-phone">تلفن</label>
              <input id="add-ex-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" required />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-address">آدرس</label>
              <textarea id="add-ex-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="add-ex-postcode">Postcode</label>
              <input
                id="add-ex-postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                dir="ltr"
                placeholder="SW1A 1AA"
                style={{ textTransform: "uppercase" }}
              />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-status">وضعیت</label>
              <select id="add-ex-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">فعال</option>
                <option value="inactive">غیرفعال</option>
              </select>
            </div>
          </div>
          <h3 style={{ marginTop: "1.25rem", marginBottom: "0.5rem", fontSize: "1.05rem" }}>شرایط و قوانین</h3>
          <p className="field-hint" style={{ marginTop: 0 }}>
            به‌عنوان سوپرادمین، با تأیید زیر اعلام می‌کنید که قوانین ثبت آگهی را مطالعه کرده‌اید و مسئولیت صحت اطلاعات
            این آگهی را می‌پذیرید.
          </p>
          <ListingTermsScrollBox id="admin-add-exchange-listing-terms" />
          <ListingTermsCheckbox
            id="admin-add-exchange-terms-cb"
            checked={termsAccepted}
            onChange={setTermsAccepted}
            disabled={saving}
          />
          <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "در حال ایجاد…" : "ایجاد آگهی صرافی"}
            </button>
            <Link className="btn btn--ghost" to="/admin-edit">
              رفتن به ویرایش با نامک
            </Link>
          </div>
          {msg && <p className="field-hint">{msg}</p>}
        </form>
      </section>
    </>
  );
}
