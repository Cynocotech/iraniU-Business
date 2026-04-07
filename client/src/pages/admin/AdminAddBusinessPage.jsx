import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../api.js";
import { DEFAULT_HOURS_ROWS } from "../../lib/businessProfile.js";
import { LISTING_TERMS_VERSION } from "../../lib/listingTerms.js";
import { ListingTermsScrollBox, ListingTermsCheckbox } from "../../components/ListingTermsAgreement.jsx";
import { normalizeBusinessSlugInput } from "../../lib/businessSlugInput.js";

export default function AdminAddBusinessPage() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState("");
  const [nameFa, setNameFa] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [listingContactEmail, setListingContactEmail] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("https://www.google.com/maps");
  const [cta, setCta] = useState("تماس با ما");
  const [priceRange, setPriceRange] = useState("—");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("active");
  const [categories, setCategories] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    apiGet("/api/categories")
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]));
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
        category,
        city: city.trim(),
        phone: phone.trim(),
        address: address.trim(),
        status,
        hours_json,
        gallery_json,
        accept_listing_terms: true,
        listing_terms_version: LISTING_TERMS_VERSION,
        listing_contact_email: emailTrim,
        listing_title: titleTrim,
        google_review_url: googleReviewUrl.trim(),
        cta: cta.trim(),
        price_range: priceRange.trim(),
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
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
        {" · "}
        <Link to="/admin-businesses">همه آگهی‌ها</Link>
      </p>

      <section className="dashboard-panel">
        <h2>افزودن آگهی</h2>
        <p className="field-hint">
          آگهی جدید با <strong>claimed = 0</strong> ذخیره می‌شود تا مالک بتواند از صفحهٔ عمومی ادعا کند (در صورت تأیید در
          «درخواست‌های ادعا»).
        </p>

        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="field field--block">
              <label htmlFor="add-slug">نامک (انگلیسی، اجباری)</label>
              <input
                id="add-slug"
                value={slug}
                onChange={(e) => setSlug(normalizeBusinessSlugInput(e.target.value))}
                lang="en"
                dir="ltr"
                required
                placeholder="my-restaurant"
                autoComplete="off"
              />
              <p className="field-hint" style={{ marginTop: "0.35rem" }}>
                فقط a تا z، 0–۹ و خط تیره.
              </p>
            </div>
            <div className="field field--block">
              <label htmlFor="add-name">نام کسب‌وکار (فارسی)</label>
              <input
                id="add-name"
                value={nameFa}
                onChange={(e) => setNameFa(e.target.value)}
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="add-listing-title">عنوان آگهی در لیست</label>
              <input
                id="add-listing-title"
                value={listingTitle}
                onChange={(e) => setListingTitle(e.target.value)}
                placeholder="اگر خالی بماند، همان نام کسب‌وکار استفاده می‌شود"
              />
            </div>
            <div className="field field--block">
              <label htmlFor="add-contact-email">ایمیل تماس برای اطلاع‌رسانی</label>
              <input
                id="add-contact-email"
                type="email"
                value={listingContactEmail}
                onChange={(e) => setListingContactEmail(e.target.value)}
                dir="ltr"
                autoComplete="email"
                required
              />
            </div>
            <div className="field field--block">
              <label htmlFor="add-desc">توضیحات</label>
              <textarea
                id="add-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: "100%" }}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="add-cat">دسته</label>
              <select id="add-cat" value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">— انتخاب دسته —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--block">
              <label htmlFor="add-gmaps">لینک صفحهٔ Google (نظر / نقشه)</label>
              <input
                id="add-gmaps"
                type="url"
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                dir="ltr"
                placeholder="https://www.google.com/maps/..."
              />
            </div>
            <div className="field">
              <label htmlFor="add-cta">دکمهٔ فراخوان (CTA)</label>
              <input id="add-cta" value={cta} onChange={(e) => setCta(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="add-price">محدودهٔ قیمت (نمایشی)</label>
              <input id="add-price" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} dir="ltr" />
            </div>
            <div className="field">
              <label htmlFor="add-city">شهر</label>
              <input id="add-city" value={city} onChange={(e) => setCity(e.target.value)} lang="en" dir="ltr" required />
            </div>
            <div className="field">
              <label htmlFor="add-phone">تلفن</label>
              <input id="add-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" required />
            </div>
            <div className="field field--block">
              <label htmlFor="add-address">آدرس</label>
              <textarea id="add-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
            <div className="field field--block">
              <label htmlFor="add-status">وضعیت</label>
              <select id="add-status" value={status} onChange={(e) => setStatus(e.target.value)}>
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
          <ListingTermsScrollBox id="admin-add-listing-terms" />
          <ListingTermsCheckbox
            id="admin-add-terms-cb"
            checked={termsAccepted}
            onChange={setTermsAccepted}
            disabled={saving}
          />
          <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "در حال ایجاد…" : "ایجاد آگهی"}
            </button>
            <Link className="btn btn--ghost" to="/admin-edit">
              رفتن به ویرایش
            </Link>
          </div>
          {msg && <p className="field-hint">{msg}</p>}
        </form>
      </section>
    </>
  );
}
