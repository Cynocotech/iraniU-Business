import { useEffect, useState } from "react";
import RichEditor from "../../components/RichEditor.jsx";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../api.js";
import { DEFAULT_HOURS_ROWS } from "../../lib/businessProfile.js";
import { LISTING_TERMS_VERSION } from "../../lib/listingTerms.js";
import { ListingTermsScrollBox, ListingTermsCheckbox } from "../../components/ListingTermsAgreement.jsx";
import { normalizeBusinessSlugInput } from "../../lib/businessSlugInput.js";
import { UK_CITIES } from "../../data/ukCities.js";

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
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
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
      {/* Breadcrumb */}
      <nav className="panel-breadcrumb">
        <Link to="/admin">داشبورد</Link>
        <span className="panel-breadcrumb__sep">/</span>
        <Link to="/admin-businesses">همه آگهی‌ها</Link>
        <span className="panel-breadcrumb__sep">/</span>
        <span>افزودن آگهی</span>
      </nav>

      {/* Page title */}
      <div className="panel-page-title">
        <div>
          <h2>افزودن آگهی جدید</h2>
          <p>آگهی جدید با <strong>claimed = 0</strong> ذخیره می‌شود.</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="panel-form-grid">

          {/* ── Left: main fields ── */}
          <div>
            {/* Basic Info */}
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-store" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                  اطلاعات پایه
                </h3>
              </div>
              <div className="panel-card__body" style={{ display: "flex", flexDirection: "column" }}>
                <div className="pfield-row">
                  <div className="pfield">
                    <label htmlFor="add-slug">نامک (انگلیسی) *</label>
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
                    <p className="pfield__hint">فقط a–z، ۰–۹ و خط‌تیره</p>
                  </div>
                  <div className="pfield">
                    <label htmlFor="add-name">نام کسب‌وکار (فارسی) *</label>
                    <input
                      id="add-name"
                      value={nameFa}
                      onChange={(e) => setNameFa(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="panel-section-divider" />

                <div className="pfield">
                  <label htmlFor="add-listing-title">عنوان آگهی در لیست</label>
                  <input
                    id="add-listing-title"
                    value={listingTitle}
                    onChange={(e) => setListingTitle(e.target.value)}
                    placeholder="اگر خالی بماند، همان نام کسب‌وکار استفاده می‌شود"
                  />
                </div>

                <div className="pfield" style={{ marginTop: "1rem" }}>
                  <label>توضیحات *</label>
                  <RichEditor value={description} onChange={setDescription} placeholder="توضیحات کسب‌وکار…" minHeight={160} />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-location-dot" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                  موقعیت
                </h3>
              </div>
              <div className="panel-card__body" style={{ display: "flex", flexDirection: "column" }}>
                <div className="pfield-row">
                  <div className="pfield">
                    <label htmlFor="add-city">شهر *</label>
                    <input
                      id="add-city"
                      list="add-cities-list"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      lang="en"
                      dir="ltr"
                      required
                    />
                    <datalist id="add-cities-list">
                      {UK_CITIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div className="pfield">
                    <label htmlFor="add-postcode">Postcode</label>
                    <input
                      id="add-postcode"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      dir="ltr"
                      placeholder="SW1A 1AA"
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>
                </div>

                <div className="pfield" style={{ marginTop: "1rem" }}>
                  <label htmlFor="add-address">آدرس *</label>
                  <textarea
                    id="add-address"
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-address-card" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                  اطلاعات تماس
                </h3>
              </div>
              <div className="panel-card__body" style={{ display: "flex", flexDirection: "column" }}>
                <div className="pfield-row">
                  <div className="pfield">
                    <label htmlFor="add-phone">تلفن *</label>
                    <input
                      id="add-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="pfield">
                    <label htmlFor="add-contact-email">ایمیل اطلاع‌رسانی *</label>
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
                </div>

                <div className="pfield" style={{ marginTop: "1rem" }}>
                  <label htmlFor="add-gmaps">لینک صفحه Google Maps / نظرات *</label>
                  <input
                    id="add-gmaps"
                    type="url"
                    value={googleReviewUrl}
                    onChange={(e) => setGoogleReviewUrl(e.target.value)}
                    dir="ltr"
                    placeholder="https://www.google.com/maps/..."
                    required
                  />
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-file-contract" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                  شرایط و قوانین
                </h3>
              </div>
              <div className="panel-card__body">
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "#475569" }}>
                  به‌عنوان سوپرادمین، با تأیید زیر اعلام می‌کنید که قوانین ثبت آگهی را مطالعه کرده‌اید و مسئولیت صحت اطلاعات این آگهی را می‌پذیرید.
                </p>
                <ListingTermsScrollBox id="admin-add-listing-terms" />
                <ListingTermsCheckbox
                  id="admin-add-terms-cb"
                  checked={termsAccepted}
                  onChange={setTermsAccepted}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* ── Right: sidebar settings ── */}
          <div>
            {/* Publish settings */}
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-sliders" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                  تنظیمات انتشار
                </h3>
              </div>
              <div className="panel-card__body" style={{ display: "flex", flexDirection: "column" }}>
                <div className="pfield">
                  <label htmlFor="add-cat">دسته‌بندی *</label>
                  <select id="add-cat" value={category} onChange={(e) => setCategory(e.target.value)} required>
                    <option value="">— انتخاب دسته —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pfield" style={{ marginTop: "1rem" }}>
                  <label htmlFor="add-status">وضعیت</label>
                  <select id="add-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">فعال</option>
                    <option value="inactive">غیرفعال</option>
                  </select>
                </div>

                <div className="panel-form-actions">
                  <button type="submit" className="pbtn pbtn--primary" disabled={saving} style={{ flex: 1 }}>
                    {saving ? (
                      <><i className="fa-solid fa-spinner fa-spin" /> در حال ایجاد…</>
                    ) : (
                      <><i className="fa-solid fa-plus" /> ایجاد آگهی</>
                    )}
                  </button>
                </div>

                {msg && (
                  <p className={`panel-form-msg ${msg.startsWith("خطا") ? "panel-form-msg--error" : "panel-form-msg--ok"}`}>
                    {msg}
                  </p>
                )}
              </div>
            </div>

            {/* Info box */}
            <div className="panel-card">
              <div className="panel-card__body" style={{ fontSize: "0.83rem", color: "#64748b", lineHeight: 1.6 }}>
                <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#374151" }}>
                  <i className="fa-solid fa-circle-info" style={{ marginInlineEnd: "0.4rem", color: "#818cf8" }} />
                  نکات مهم
                </p>
                <ul style={{ margin: 0, paddingInlineStart: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <li>آگهی با <code style={{ background: "#f1f5f9", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>claimed = 0</code> ذخیره می‌شود.</li>
                  <li>مالک می‌تواند از صفحه عمومی ادعای مالکیت کند.</li>
                  <li>پس از ایجاد، به صفحه ویرایش هدایت می‌شوید.</li>
                </ul>
              </div>
            </div>

            <Link to="/admin-edit" className="pbtn pbtn--ghost" style={{ width: "100%", justifyContent: "center", marginBottom: "0.75rem" }}>
              <i className="fa-solid fa-pen" /> رفتن به ویرایش آگهی
            </Link>
          </div>

        </div>
      </form>
    </>
  );
}
