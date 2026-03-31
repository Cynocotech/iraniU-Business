import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch } from "../api.js";
import DashboardPanelHead, { dashboardIcons } from "./DashboardPanelHead.jsx";
import { DEFAULT_HOURS_ROWS, parseHoursJson, parseGalleryJson } from "../lib/businessProfile.js";

const STORAGE_SLUG = "iraniu_dashboard_business_slug";

export default function DashboardBusinessForm({
  slug,
  onSlugChange,
  onLoaded,
  sectionTitle,
  /** در پنل سوپرادمین وقتی نامک از منوی کشویی است */
  hideSlugPicker,
}) {
  const [slugInput, setSlugInput] = useState(slug);
  const [loadErr, setLoadErr] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const [nameFa, setNameFa] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [ratingStr, setRatingStr] = useState("");
  const [cta, setCta] = useState("");
  const [status, setStatus] = useState("active");
  const [subtitle, setSubtitle] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [reservationLink, setReservationLink] = useState("");
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [hoursRows, setHoursRows] = useState(() => [...DEFAULT_HOURS_ROWS]);
  const [galleryUrls, setGalleryUrls] = useState(["", "", "", ""]);
  const [categories, setCategories] = useState([]);

  const applyBusiness = useCallback(
    (b) => {
      if (!b) return;
      setNameFa(b.name_fa || "");
      setListingTitle(b.listing_title || "");
      setDescription(b.description || "");
      setCategory(b.category || "");
      setCity(b.city || "");
      setPriceRange(b.price_range || "");
      setRatingStr(b.rating != null && b.rating !== "" ? String(b.rating) : "");
      setCta(b.cta || "");
      setStatus(b.status || "active");
      setSubtitle(b.subtitle || "");
      setPhone(b.phone || "");
      setAddress(b.address || "");
      setGoogleReviewUrl(b.google_review_url || "");
      setReservationLink(b.reservation_link || "");
      setPromoTitle(b.promo_title || "");
      setPromoDescription(b.promo_description || "");
      setCoverImageUrl(b.cover_image_url || "");
      setHoursRows(parseHoursJson(b.hours_json));
      setGalleryUrls(parseGalleryJson(b.gallery_json));
      onLoaded?.(b);
    },
    [onLoaded]
  );

  const fetchBySlug = useCallback(
    async (key) => {
      const s = String(key || "").trim();
      if (!s) return;
      setLoadErr(null);
      setSaveMsg(null);
      try {
        const b = await apiGet(`/api/businesses/${encodeURIComponent(s)}`);
        applyBusiness(b);
      } catch {
        setLoadErr("این نامک در پایگاه داده نیست.");
        onLoaded?.(null);
      }
    },
    [applyBusiness, onLoaded]
  );

  useEffect(() => {
    setSlugInput(slug);
  }, [slug]);

  useEffect(() => {
    fetchBySlug(slug);
  }, [slug, fetchBySlug]);

  useEffect(() => {
    apiGet("/api/categories")
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]));
  }, []);

  const persistSlug = (next) => {
    const s = String(next || "").trim();
    try {
      localStorage.setItem(STORAGE_SLUG, s);
    } catch (_) {}
    onSlugChange?.(s);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const hours_json = JSON.stringify(
        hoursRows.map((r) => ({ day: r.day, hours: r.hours }))
      );
      const gallery_json = JSON.stringify(galleryUrls.map((u) => u.trim()));
      const ratingPayload =
        ratingStr.trim() === "" ? null : parseFloat(ratingStr.replace(",", "."));
      const updated = await apiPatch(`/api/businesses/${encodeURIComponent(slugInput.trim())}`, {
        name_fa: nameFa,
        listing_title: listingTitle,
        description,
        category,
        city,
        price_range: priceRange,
        rating: Number.isFinite(ratingPayload) ? ratingPayload : null,
        cta,
        status,
        subtitle,
        phone,
        address,
        google_review_url: googleReviewUrl,
        reservation_link: reservationLink,
        promo_title: promoTitle,
        promo_description: promoDescription,
        cover_image_url: coverImageUrl,
        hours_json,
        gallery_json,
      });
      applyBusiness(updated);
      setSaveMsg("ذخیره شد.");
    } catch (err) {
      setSaveMsg(`خطا: ${err.message || "نامشخص"}`);
    } finally {
      setSaving(false);
    }
  };

  const updateHour = (index, field, value) => {
    setHoursRows((rows) => {
      const next = [...rows];
      if (!next[index]) next[index] = { day: "", hours: "" };
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addHourRow = () => {
    setHoursRows((rows) => [...rows, { day: "", hours: "" }]);
  };

  const removeHourRow = (index) => {
    setHoursRows((rows) => rows.filter((_, i) => i !== index));
  };

  const previewHref = `/business?slug=${encodeURIComponent(slugInput.trim())}`;

  return (
    <section className="dashboard-panel" id="edit-ad" aria-labelledby="edit-heading">
      <DashboardPanelHead
        headingId="edit-heading"
        title={sectionTitle || "ویرایش آگهی (نمایش در صفحهٔ عمومی)"}
        icon={dashboardIcons.edit}
      />
      <p className="field-hint">
        {hideSlugPicker
          ? "فیلدها را ویرایش و ذخیره کنید. پیش‌نمایش:"
          : "نامک آگهی را انتخاب کنید، بارگذاری کنید، سپس فیلدها را ویرایش و ذخیره کنید. تغییرات در SQLite و همان لحظه روی"}{" "}
        <Link to={previewHref} target="_blank" rel="noreferrer">
          پیش‌نمایش
        </Link>
        {!hideSlugPicker && " دیده می‌شود."}
      </p>

      {!hideSlugPicker && (
        <div className="form-grid" style={{ marginBottom: "1rem" }}>
          <div className="field field--block">
            <label htmlFor="dash-slug-load">نامک (slug) برای بارگذاری</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                id="dash-slug-load"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                lang="en"
                autoComplete="off"
                style={{ flex: "1", minWidth: "12rem" }}
              />
              <button type="button" className="btn btn--ghost" onClick={() => persistSlug(slugInput)}>
                اعمال نامک
              </button>
              <button type="button" className="btn btn--primary" onClick={() => fetchBySlug(slugInput)}>
                بارگذاری از سرور
              </button>
            </div>
          </div>
        </div>
      )}

      {loadErr && <p className="field-hint">{loadErr}</p>}

      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field field--block">
            <label htmlFor="dash-name">نام کسب‌وکار</label>
            <input id="dash-name" value={nameFa} onChange={(e) => setNameFa(e.target.value)} required />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-listing-title">عنوان تبلیغاتی (مثل title در JSON)</label>
            <input
              id="dash-listing-title"
              value={listingTitle}
              onChange={(e) => setListingTitle(e.target.value)}
              placeholder="رستوران ایرانی اصیل در لندن"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-subtitle">زیرعنوان (یک خط زیر نام)</label>
            <input
              id="dash-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="مثال: غذای ایرانی و کباب — London"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-category">دسته</label>
            <select id="dash-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— انتخاب دسته —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              {category && !categories.some((c) => c.name === category) ? <option value={category}>{category}</option> : null}
            </select>
          </div>
          <div className="field field--block">
            <label htmlFor="dash-city">شهر (انگلیسی)</label>
            <input id="dash-city" value={city} onChange={(e) => setCity(e.target.value)} lang="en" dir="ltr" />
          </div>
          <div className="field">
            <label htmlFor="dash-price">محدوده قیمت</label>
            <input id="dash-price" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} lang="en" dir="ltr" placeholder="£20-30" />
          </div>
          <div className="field">
            <label htmlFor="dash-rating">امتیاز (۰–۵)</label>
            <input
              id="dash-rating"
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={ratingStr}
              onChange={(e) => setRatingStr(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-cta">دکمهٔ تماس (متن)</label>
            <input id="dash-cta" value={cta} onChange={(e) => setCta(e.target.value)} placeholder="رزرو کنید" />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-status">وضعیت آگهی</label>
            <select id="dash-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          </div>
          <div className="field field--block">
            <label htmlFor="dash-desc">توضیحات (درباره کسب‌وکار)</label>
            <textarea id="dash-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-phone">تلفن</label>
            <input id="dash-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="phone-ltr" />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-address">آدرس (نقشه و تماس)</label>
            <textarea id="dash-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-cover">تصویر هدر صفحهٔ عمومی (لینک سفارشی)</label>
            <input
              id="dash-cover"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://example.com/banner.jpg یا /uploads/cover.jpg"
              dir="ltr"
            />
            <p className="field-hint">
              آدرس کامل تصویر (https) یا مسیر روی همین سایت (مثلاً <span dir="ltr">/images/...</span>). اگر خالی
              باشد، از اولین تصویر گالری استفاده می‌شود؛ اگر گالری هم خالی باشد، تصویر پیش‌فرض دسته نمایش داده
              می‌شود.
            </p>
          </div>
          <div className="field field--block">
            <label htmlFor="dash-greview">لینک صفحهٔ نظر Google (برای QR و ریدایرکت)</label>
            <input
              id="dash-greview"
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/.../review"
              dir="ltr"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-res-link">لینک رزرو سفارشی (اختیاری)</label>
            <input
              id="dash-res-link"
              type="url"
              value={reservationLink}
              onChange={(e) => setReservationLink(e.target.value)}
              placeholder="https://example.com/book"
              dir="ltr"
            />
            <p className="field-hint">
              اگر پر شود، در صفحه عمومی دکمه «رزرو آنلاین» نمایش داده می‌شود و کاربر به این لینک منتقل می‌شود.
            </p>
          </div>
        </div>

        <h3 style={{ marginTop: "1.25rem", marginBottom: "0.25rem", fontSize: "1.05rem" }}>پیشنهاد و تبلیغ</h3>
        <div className="form-grid">
          <div className="field field--block">
            <label htmlFor="dash-promo-title">عنوان پیشنهاد</label>
            <input id="dash-promo-title" value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} />
          </div>
          <div className="field field--block">
            <label htmlFor="dash-promo-desc">شرح پیشنهاد</label>
            <textarea id="dash-promo-desc" rows={3} value={promoDescription} onChange={(e) => setPromoDescription(e.target.value)} />
          </div>
        </div>

        <h3 style={{ marginTop: "1.25rem", marginBottom: "0.25rem", fontSize: "1.05rem" }}>ساعات کاری</h3>
        <div>
          {hoursRows.map((row, i) => (
            <div key={i} className="form-grid" style={{ marginBottom: "0.5rem" }}>
              <div className="field">
                <label htmlFor={`dash-day-${i}`}>روز</label>
                <input id={`dash-day-${i}`} value={row.day} onChange={(e) => updateHour(i, "day", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`dash-hours-${i}`}>ساعت</label>
                <input id={`dash-hours-${i}`} value={row.hours} onChange={(e) => updateHour(i, "hours", e.target.value)} dir="ltr" />
              </div>
              <div className="field" style={{ alignSelf: "end" }}>
                <button type="button" className="btn btn--ghost" onClick={() => removeHourRow(i)}>
                  حذف
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn--ghost" onClick={addHourRow}>
            + ردیف ساعت
          </button>
        </div>

        <h3 style={{ marginTop: "1.25rem", marginBottom: "0.25rem", fontSize: "1.05rem" }}>گالری (تا ۴ تصویر — URL)</h3>
        <div className="form-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="field field--block">
              <label htmlFor={`dash-gal-${i}`}>تصویر {i + 1}</label>
              <input
                id={`dash-gal-${i}`}
                type="url"
                value={galleryUrls[i] || ""}
                onChange={(e) => {
                  const next = [...galleryUrls];
                  next[i] = e.target.value;
                  setGalleryUrls(next);
                }}
                dir="ltr"
                placeholder="https://..."
              />
            </div>
          ))}
        </div>

        <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "در حال ذخیره…" : "ذخیره در سرور"}
          </button>
          <Link className="btn btn--ghost" to={previewHref} target="_blank" rel="noreferrer">
            پیش‌نمایش صفحهٔ عمومی
          </Link>
        </div>
        {saveMsg && <p className="field-hint">{saveMsg}</p>}
      </form>
    </section>
  );
}
