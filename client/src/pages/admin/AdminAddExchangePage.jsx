import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../../api.js";
import { DEFAULT_HOURS_ROWS } from "../../lib/businessProfile.js";
import { LISTING_TERMS_VERSION } from "../../lib/listingTerms.js";
import { ListingTermsScrollBox, ListingTermsCheckbox } from "../../components/ListingTermsAgreement.jsx";
import Seo from "../../components/Seo.jsx";

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
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
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
      const hours_json = JSON.stringify(
        DEFAULT_HOURS_ROWS.map((r) => ({ day: r.day, hours: r.hours }))
      );
      const gallery_json = JSON.stringify(["", "", "", ""]);
      const payload = {
        slug: slug.trim().toLowerCase(),
        name_fa: nameFa.trim(),
        description,
        category: EXCHANGE_CATEGORY,
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
                onChange={(e) => setSlug(e.target.value)}
                lang="en"
                dir="ltr"
                required
                placeholder="my-exchange"
                autoComplete="off"
              />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-name">نام صرافی (فارسی)</label>
              <input id="add-ex-name" value={nameFa} onChange={(e) => setNameFa(e.target.value)} required />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-desc">توضیحات</label>
              <textarea
                id="add-ex-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: "100%" }}
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
              <input id="add-ex-city" value={city} onChange={(e) => setCity(e.target.value)} lang="en" dir="ltr" />
            </div>
            <div className="field">
              <label htmlFor="add-ex-phone">تلفن</label>
              <input id="add-ex-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div className="field field--block">
              <label htmlFor="add-ex-address">آدرس</label>
              <textarea id="add-ex-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
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
