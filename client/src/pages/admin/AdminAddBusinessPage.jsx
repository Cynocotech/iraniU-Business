import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../api.js";
import { DEFAULT_HOURS_ROWS } from "../../lib/businessProfile.js";
import { LISTING_TERMS_VERSION } from "../../lib/listingTerms.js";
import { ListingTermsScrollBox, ListingTermsCheckbox } from "../../components/ListingTermsAgreement.jsx";

export default function AdminAddBusinessPage() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState("");
  const [nameFa, setNameFa] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
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
      const hours_json = JSON.stringify(
        DEFAULT_HOURS_ROWS.map((r) => ({ day: r.day, hours: r.hours }))
      );
      const gallery_json = JSON.stringify(["", "", "", ""]);
      const payload = {
        slug: slug.trim().toLowerCase(),
        name_fa: nameFa.trim(),
        description,
        category,
        city,
        phone,
        address,
        status,
        hours_json,
        gallery_json,
        accept_listing_terms: true,
        listing_terms_version: LISTING_TERMS_VERSION,
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
                onChange={(e) => setSlug(e.target.value)}
                lang="en"
                dir="ltr"
                required
                placeholder="my-restaurant"
                autoComplete="off"
              />
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
              <label htmlFor="add-desc">توضیحات</label>
              <textarea
                id="add-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div className="field">
              <label htmlFor="add-cat">دسته</label>
              <select id="add-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">— انتخاب دسته —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="add-city">شهر</label>
              <input id="add-city" value={city} onChange={(e) => setCity(e.target.value)} lang="en" dir="ltr" />
            </div>
            <div className="field">
              <label htmlFor="add-phone">تلفن</label>
              <input id="add-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div className="field field--block">
              <label htmlFor="add-address">آدرس</label>
              <textarea id="add-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
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
