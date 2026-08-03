import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch, apiPatchUrl, apiPostMultipart } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { DashboardContext } from "../context/DashboardContext.jsx";
import DashboardPanelHead, { dashboardIcons } from "./DashboardPanelHead.jsx";
import { DEFAULT_HOURS_ROWS, parseHoursJson, parseGalleryJson } from "../lib/businessProfile.js";
import { ensureHttpsUrl } from "../lib/siteUrl.js";
import {
  EXCHANGE_DEFAULT_PAYMENT_METHOD_IDS,
  EXCHANGE_DEFAULT_FEATURE_IDS,
  EXCHANGE_FEATURES,
  EXCHANGE_PAYMENT_METHODS,
  EXCHANGE_DEFAULT_RATES,
  isExchangeCategory,
  parseExchangeFeaturesJson,
  parseExchangePaymentMethodsJson,
  parseExchangeRatesJson,
  sanitizeExchangeRatesRows,
} from "../lib/exchangeRates.js";
import ExchangeRatesEditor from "./ExchangeRatesEditor.jsx";
import RichEditor from "./RichEditor.jsx";
import { UK_CITIES } from "../data/ukCities.js";
import ExchangePaymentMethodIcon from "./ExchangePaymentMethodIcon.jsx";

const STORAGE_SLUG = "iraniu_dashboard_business_slug";

export default function DashboardBusinessForm({
  slug,
  onSlugChange,
  onLoaded,
  sectionTitle,
  /** در پنل سوپرادمین وقتی نامک از منوی کشویی است */
  hideSlugPicker,
  /** سوپرادمین می‌تواند نام را ویرایش کند */
  allowEditName = false,
  /** نمایش پنل برچسب‌های AI — فقط در پنل سوپرادمین */
  showTagsPanel = false,
}) {
  const { isSuperAdmin } = useAuth();
  const dashCtx = useContext(DashboardContext);
  const { impersonation = null, dashSlug: ctxDashSlug = "" } = dashCtx ?? {};
  const [slugInput, setSlugInput] = useState(slug);
  const [milestones, setMilestones] = useState(null); // { list, weeklyBonusUsed, boostsThisMonth, boostMonthlyLimit }
  const [loadErr, setLoadErr] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── AI Tags (admin only) ──
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [tagMsg, setTagMsg] = useState(null);
  const [tagSaving, setTagSaving] = useState(false);
  const tagInputRef = useRef(null);

  const [nameFa, setNameFa] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [ratingStr, setRatingStr] = useState("");
  const [status, setStatus] = useState("active");
  const [subtitle, setSubtitle] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [listingContactEmail, setListingContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [reservationLink, setReservationLink] = useState("");
  const [callTrackingEnabled, setCallTrackingEnabled] = useState(false);
  const [callTrackingNumber, setCallTrackingNumber] = useState("");
  const [callForwardNumber, setCallForwardNumber] = useState("");
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [hoursRows, setHoursRows] = useState(() => [...DEFAULT_HOURS_ROWS]);
  const [galleryUrls, setGalleryUrls] = useState(["", "", "", ""]);
  const [exchangeRatesRows, setExchangeRatesRows] = useState(() => [...EXCHANGE_DEFAULT_RATES]);
  const [paymentMethods, setPaymentMethods] = useState(() => [...EXCHANGE_DEFAULT_PAYMENT_METHOD_IDS]);
  const [exchangeFeatures, setExchangeFeatures] = useState(() => [...EXCHANGE_DEFAULT_FEATURE_IDS]);
  const [exchangeTodayRateEnabled, setExchangeTodayRateEnabled] = useState(true);
  const [exchangeCompanyVerified, setExchangeCompanyVerified] = useState(false);
  const [categories, setCategories] = useState([]);
  const [twilioModuleEnabled, setTwilioModuleEnabled] = useState(true);
  const [exchangeManagers, setExchangeManagers] = useState([]);
  const [exchangeManagerEmail, setExchangeManagerEmail] = useState("");
  const [exchangeManagerIdCurrent, setExchangeManagerIdCurrent] = useState(null);
  const [exchangeManagerMsg, setExchangeManagerMsg] = useState("");
  const [exchangeManagerSaving, setExchangeManagerSaving] = useState(false);
  const [cities, setCities] = useState([]);

  const [coverImageUploading, setCoverImageUploading] = useState(false);
  const [coverImageUploadMsg, setCoverImageUploadMsg] = useState("");
  const [coverImageMeta, setCoverImageMeta] = useState(null);
  const [galleryUploading, setGalleryUploading] = useState([false, false, false, false]);
  const [galleryUploadMsg, setGalleryUploadMsg] = useState(["", "", "", ""]);

  useEffect(() => {
    let cancelled = false;
    apiGet("/api/twilio-module-status")
      .then((d) => {
        if (!cancelled && d && typeof d.enabled === "boolean") setTwilioModuleEnabled(d.enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const applyBusiness = useCallback(
    (b) => {
      if (!b) return;
      setNameFa(b.name_fa || "");
      setListingTitle(b.listing_title || "");
      setDescription(b.description || "");
      setCategory(b.category || "");
      setCity(b.city || "");
      setRatingStr(b.rating != null && b.rating !== "" ? String(b.rating) : "");
      setStatus(b.status || "active");
      setSubtitle(b.subtitle || "");
      setPhone(b.phone || "");
      setMobile(b.mobile || "");
      setListingContactEmail(b.listing_contact_email || "");
      setAddress(b.address || "");
      setPostcode(b.postcode || "");
      setGoogleReviewUrl(b.google_review_url || "");
      setReservationLink(b.reservation_link || "");
      setCallTrackingEnabled(!!b.call_tracking_enabled);
      setCallTrackingNumber(b.call_tracking_number || "");
      setCallForwardNumber(b.call_forward_number || "");
      setPromoTitle(b.promo_title || "");
      setPromoDescription(b.promo_description || "");
      setCoverImageUrl(b.cover_image_url || "");
      setCoverImageMeta(null);
      setHoursRows(parseHoursJson(b.hours_json));
      setGalleryUrls(parseGalleryJson(b.gallery_json));
      setExchangeRatesRows(parseExchangeRatesJson(b.exchange_rates_json));
      setPaymentMethods(parseExchangePaymentMethodsJson(b.payment_methods_json));
      setExchangeFeatures(parseExchangeFeaturesJson(b.exchange_features_json));
      setExchangeTodayRateEnabled(Number(b.exchange_today_rate_enabled) !== 0);
      setExchangeCompanyVerified(Number(b.exchange_company_verified) === 1);
      try { setTags(JSON.parse(b.ai_tags_json || "[]")); } catch { setTags([]); }
      setExchangeManagerIdCurrent(
        Number.isFinite(Number(b.exchange_manager_id)) && Number(b.exchange_manager_id) > 0
          ? Number(b.exchange_manager_id)
          : null
      );
      setExchangeManagerMsg("");
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

  useEffect(() => {
    apiGet("/api/cities")
      .then((d) => setCities(Array.from(new Set([...UK_CITIES, ...(Array.isArray(d) ? d : [])])).sort()))
      .catch(() => setCities(UK_CITIES));
  }, []);

  // Load wallet/milestone data for token hints
  useEffect(() => {
    const effectiveSlug = slug || ctxDashSlug;
    if (!effectiveSlug) return;
    const url = isSuperAdmin ? `/api/wallet?slug=${encodeURIComponent(effectiveSlug)}` : "/api/wallet";
    apiGet(url)
      .then((d) => {
        if (d?.milestones) {
          setMilestones({
            list: d.milestones,
            weeklyBonusUsed: d.weeklyBonusUsed ?? 0,
          });
        }
      })
      .catch(() => {});
  }, [slug, ctxDashSlug, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSuperAdmin) return;
    apiGet("/api/exchange-managers")
      .then((d) => setExchangeManagers(Array.isArray(d) ? d : []))
      .catch(() => setExchangeManagers([]));
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (!exchangeManagerIdCurrent) {
      if (!exchangeManagerSaving) setExchangeManagerEmail("");
      return;
    }
    const m = exchangeManagers.find((x) => Number(x.id) === Number(exchangeManagerIdCurrent));
    if (m?.email && !exchangeManagerSaving) setExchangeManagerEmail(String(m.email).toLowerCase());
  }, [exchangeManagerIdCurrent, exchangeManagers, isSuperAdmin, exchangeManagerSaving]);

  const persistSlug = (next) => {
    const s = String(next || "").trim();
    try {
      localStorage.setItem(STORAGE_SLUG, s);
    } catch (_) {}
    onSlugChange?.(s);
  };

  const handleCoverImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverImageUploading(true);
    setCoverImageUploadMsg("");
    setCoverImageMeta(null);

    // Read dimensions before uploading
    const fileSizeKB = file.size / 1024;
    let dims = null;
    try {
      dims = await new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
        img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
        img.src = url;
      });
    } catch (_) {}

    try {
      const formData = new FormData();
      formData.append("image", file);

      const data = await apiPostMultipart("/api/upload/business-image", formData);
      setCoverImageUrl(data.url);
      setCoverImageMeta(dims ? { w: dims.w, h: dims.h, sizeKB: fileSizeKB } : { sizeKB: fileSizeKB });
      setCoverImageUploadMsg("✅ تصویر آپلود شد");
      setTimeout(() => setCoverImageUploadMsg(""), 3000);
    } catch (error) {
      setCoverImageUploadMsg(`❌ ${error.message}`);
    } finally {
      setCoverImageUploading(false);
      e.target.value = "";
    }
  };

  const handleGalleryImageUpload = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newUploading = [...galleryUploading];
    newUploading[index] = true;
    setGalleryUploading(newUploading);

    const newMsg = [...galleryUploadMsg];
    newMsg[index] = "";
    setGalleryUploadMsg(newMsg);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const data = await apiPostMultipart("/api/upload/business-image", formData);
      const newUrls = [...galleryUrls];
      newUrls[index] = data.url;
      setGalleryUrls(newUrls);

      newMsg[index] = "✅ آپلود شد";
      setGalleryUploadMsg(newMsg);
      setTimeout(() => {
        const clearMsg = [...galleryUploadMsg];
        clearMsg[index] = "";
        setGalleryUploadMsg(clearMsg);
      }, 3000);
    } catch (error) {
      newMsg[index] = `❌ ${error.message}`;
      setGalleryUploadMsg(newMsg);
    } finally {
      newUploading[index] = false;
      setGalleryUploading(newUploading);
      e.target.value = "";
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const hours_json = JSON.stringify(
        hoursRows.map((r) => ({ day: r.day, hours: r.hours }))
      );
      const exchange_rates_json = JSON.stringify(sanitizeExchangeRatesRows(exchangeRatesRows));
      const payment_methods_json = JSON.stringify(paymentMethods);
      const exchange_features_json = JSON.stringify(exchangeFeatures);
      const ratingPayload =
        ratingStr.trim() === "" ? null : parseFloat(ratingStr.replace(",", "."));
      const updated = await apiPatch(`/api/businesses/${encodeURIComponent(slugInput.trim())}`, {
        ...(allowEditName && nameFa.trim() ? { name_fa: nameFa.trim() } : {}),
        listing_title: listingTitle,
        description,
        category,
        city,
        rating: Number.isFinite(ratingPayload) ? ratingPayload : null,
        status,
        subtitle,
        phone,
        mobile,
        listing_contact_email: listingContactEmail.trim() || null,
        address,
        postcode: postcode.trim(),
        google_review_url: googleReviewUrl.trim() ? ensureHttpsUrl(googleReviewUrl.trim()) : "",
        reservation_link: reservationLink.trim() ? ensureHttpsUrl(reservationLink.trim()) : "",
        promo_title: promoTitle,
        promo_description: promoDescription,
        hours_json,
        exchange_rates_json,
        payment_methods_json,
        exchange_features_json,
        exchange_today_rate_enabled: exchangeTodayRateEnabled ? 1 : 0,
        ...(isSuperAdmin ? { exchange_company_verified: exchangeCompanyVerified ? 1 : 0 } : {}),
      });
      applyBusiness(updated);
      setSaveMsg("ذخیره شد.");
    } catch (err) {
      setSaveMsg(`خطا: ${err.message || "نامشخص"}`);
    } finally {
      setSaving(false);
    }
  };

  const saveTags = useCallback(async (nextTags) => {
    if (!slugInput.trim()) return;
    setTagSaving(true);
    setTagMsg(null);
    try {
      await apiPatch(`/api/businesses/${encodeURIComponent(slugInput.trim())}`, {
        ai_tags_json: JSON.stringify(nextTags),
      });
      setTags(nextTags);
      setTagMsg({ ok: true, text: "برچسب‌ها ذخیره شد." });
      setTimeout(() => setTagMsg(null), 2500);
    } catch (e) {
      setTagMsg({ ok: false, text: e.message || "خطا" });
    } finally {
      setTagSaving(false);
    }
  }, [slugInput]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    saveTags([...tags, t]);
    setTagInput("");
    tagInputRef.current?.focus();
  };

  const removeTag = (t) => saveTags(tags.filter((x) => x !== t));

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
  const showExchangeFields = isExchangeCategory(category);
  const connectExchangeManager = async (e) => {
    e?.preventDefault?.();
    if (!isSuperAdmin || !showExchangeFields) return;
    const s = String(slugInput || "").trim();
    if (!s) return;
    setExchangeManagerSaving(true);
    setExchangeManagerMsg("");
    try {
      const email = String(exchangeManagerEmail || "").trim().toLowerCase();
      const payload = email ? { manager_email: email } : { manager_id: null };
      const updated = await apiPatchUrl(`/api/admin/exchange-businesses/${encodeURIComponent(s)}/manager`, payload);
      const nextId =
        Number.isFinite(Number(updated?.exchange_manager_id)) && Number(updated.exchange_manager_id) > 0
          ? Number(updated.exchange_manager_id)
          : null;
      setExchangeManagerIdCurrent(nextId);
      if (updated?.manager?.email) {
        setExchangeManagerEmail(String(updated.manager.email).toLowerCase());
      } else if (!nextId) {
        setExchangeManagerEmail("");
      }
      setExchangeManagerMsg(nextId ? "مدیر صرافی متصل شد." : "اتصال مدیر صرافی حذف شد.");
      const latestManagers = await apiGet("/api/exchange-managers").catch(() => null);
      if (Array.isArray(latestManagers)) setExchangeManagers(latestManagers);
    } catch (err) {
      setExchangeManagerMsg(`خطا: ${err.message || "نامشخص"}`);
    } finally {
      setExchangeManagerSaving(false);
    }
  };
  const togglePaymentMethod = (methodId, enabled) => {
    setPaymentMethods((prev) => {
      const exists = prev.includes(methodId);
      if (enabled) return exists ? prev : [...prev, methodId];
      return prev.filter((id) => id !== methodId);
    });
  };
  const toggleExchangeFeature = (featureId, enabled) => {
    setExchangeFeatures((prev) => {
      const exists = prev.includes(featureId);
      if (enabled) return exists ? prev : [...prev, featureId];
      return prev.filter((id) => id !== featureId);
    });
  };

  // Token badge helper
  const TokenBadge = ({ type }) => {
    if (!milestones) return null;
    const m = milestones.list?.find((x) => x.type === type);
    if (!m) return null;
    if (m.on_cooldown) return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", background: "#dcfce7", color: "#166534", borderRadius: 6, padding: "0.1rem 0.45rem", fontSize: "0.7rem", fontWeight: 700, marginInlineStart: "0.5rem" }}>
        <i className="fa-solid fa-check" style={{ fontSize: "0.6rem" }} /> دریافت شد
      </span>
    );
    if (m.earned) return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", background: "#dbeafe", color: "#1e40af", borderRadius: 6, padding: "0.1rem 0.45rem", fontSize: "0.7rem", fontWeight: 700, marginInlineStart: "0.5rem" }}>
        <i className="fa-solid fa-rotate-right" style={{ fontSize: "0.6rem" }} /> +{m.amount} توکن
      </span>
    );
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", background: "#fef3c7", color: "#92400e", borderRadius: 6, padding: "0.1rem 0.45rem", fontSize: "0.7rem", fontWeight: 700, marginInlineStart: "0.5rem" }}>
        <i className="fa-solid fa-coins" style={{ fontSize: "0.6rem" }} /> +{m.amount} توکن
      </span>
    );
  };

  const WeeklyBonusBadge = () => {
    if (!milestones) return null;
    const used = milestones.weeklyBonusUsed ?? 0;
    const remaining = 2 - used;
    if (remaining <= 0) return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", background: "#f1f5f9", color: "#94a3b8", borderRadius: 6, padding: "0.1rem 0.45rem", fontSize: "0.7rem", fontWeight: 700, marginInlineStart: "0.5rem" }}>
        <i className="fa-solid fa-clock" style={{ fontSize: "0.6rem" }} /> پاداش هفتگی استفاده شد
      </span>
    );
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", background: "#ede9fe", color: "#5b21b6", borderRadius: 6, padding: "0.1rem 0.45rem", fontSize: "0.7rem", fontWeight: 700, marginInlineStart: "0.5rem" }}>
        <i className="fa-solid fa-coins" style={{ fontSize: "0.6rem" }} /> +15 توکن هفتگی ({remaining} بار باقی)
      </span>
    );
  };

  return (
    <section className="dashboard-panel" id="edit-ad" aria-labelledby="edit-heading">
      <DashboardPanelHead
        headingId="edit-heading"
        title={sectionTitle || "ویرایش آگهی"}
        icon={dashboardIcons.edit}
      />
      <p className="field-hint">
        {hideSlugPicker ? (
          isSuperAdmin ? (
            <>
              فیلدها را ویرایش و ذخیره کنید. پیش‌نمایش:{" "}
              <Link to={previewHref} target="_blank" rel="noreferrer">پیش‌نمایش</Link>
            </>
          ) : (
            "فیلدها را ویرایش و ذخیره کنید."
          )
        ) : isSuperAdmin ? (
          <>
            نامک آگهی را انتخاب کنید، فیلدها را ویرایش کنید و ذخیره کنید. پس از ذخیره روی{" "}
            <Link to={previewHref} target="_blank" rel="noreferrer">پیش‌نمایش</Link>{" "}
            دیده می‌شود.
          </>
        ) : (
          "نامک آگهی را انتخاب کنید، فیلدها را ویرایش و ذخیره کنید."
        )}
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
              <button type="button" className="btn btn--ghost" onClick={() => persistSlug(slugInput)}>اعمال نامک</button>
              <button type="button" className="btn btn--primary" onClick={() => fetchBySlug(slugInput)}>بارگذاری از سرور</button>
            </div>
          </div>
        </div>
      )}

      {loadErr && <p className="field-hint">{loadErr}</p>}

      <form id="dash-biz-form" onSubmit={onSubmit}>
        <div className="panel-form-grid">

          {/* ── Main column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* نمایش در صفحهٔ عمومی */}
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-eye" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                  نمایش در صفحهٔ عمومی
                  <TokenBadge type="earn_profile_complete" />
                  <WeeklyBonusBadge />
                </h3>
              </div>
              <div className="panel-card__body">
                <div className="form-grid">
                  <div className="field field--block">
                    <label htmlFor="dash-name">نام کسب‌وکار</label>
                    {allowEditName ? (
                      <input id="dash-name" value={nameFa} onChange={(e) => setNameFa(e.target.value)} placeholder="نام فارسی کسب‌وکار" maxLength={100} />
                    ) : (
                      <input id="dash-name" value={nameFa} readOnly style={{ background: "#f1f5f9", color: "#475569", cursor: "default" }} />
                    )}
                  </div>
                  <div className="field field--block">
                    <label htmlFor="dash-listing-title" style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>
                      عنوان تبلیغاتی
                      <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "#94a3b8", marginInlineStart: "0.5rem" }}>مثل title در JSON</span>
                    </label>
                    <input
                      id="dash-listing-title"
                      value={listingTitle}
                      onChange={(e) => setListingTitle(e.target.value)}
                      placeholder="رستوران ایرانی اصیل در لندن"
                      maxLength={160}
                    />
                  </div>
                  <div className="field field--block">
                    <label htmlFor="dash-subtitle" style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>زیرعنوان</label>
                    <input
                      id="dash-subtitle"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="مثال: غذای ایرانی و کباب — London"
                      maxLength={160}
                    />
                  </div>
                  <div className="field field--block">
                    <label htmlFor="dash-category" style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>دسته</label>
                    <select id="dash-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="">— انتخاب دسته —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      {category && !categories.some((c) => c.name === category) ? <option value={category}>{category}</option> : null}
                    </select>
                  </div>
                  <div className="field field--block" style={{ gridColumn: "1 / -1" }}>
                    <label>توضیحات (درباره کسب‌وکار)</label>
                    <RichEditor value={description} onChange={setDescription} placeholder="توضیحات کسب‌وکار…" minHeight={180} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── AI Tags (admin only) ── */}
            {showTagsPanel && (
              <div className="panel-card">
                <div className="panel-card__head">
                  <h3 className="panel-card__title">
                    <i className="fa-solid fa-tags" style={{ marginInlineEnd: "0.5rem", color: "#6366f1" }} />
                    برچسب‌های جستجو (AI Tags)
                  </h3>
                </div>
                <div className="panel-card__body" style={{ padding: "1.25rem" }}>
                  <p className="field-hint" style={{ marginTop: 0 }}>
                    فقط برای جستجوی هوش مصنوعی — برای کاربران نمایش داده نمی‌شود.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem", minHeight: "2rem" }}>
                    {tags.length === 0 && <span className="field-hint" style={{ margin: 0 }}>برچسبی ثبت نشده</span>}
                    {tags.map((t) => (
                      <span key={t} style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        background: "#ede9fe", color: "#4c1d95", borderRadius: "999px",
                        padding: "0.2rem 0.65rem", fontSize: "0.82rem", fontWeight: 500,
                        border: "1px solid #c4b5fd",
                      }}>
                        {t}
                        <button type="button" onClick={() => removeTag(t)} disabled={tagSaving}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", lineHeight: 1, padding: 0, fontSize: "0.9rem" }}
                          aria-label={`حذف ${t}`}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="برچسب جدید… مثلاً: DSS accepted"
                      disabled={tagSaving}
                      style={{ minWidth: "220px", flex: "1 1 220px" }}
                    />
                    <button type="button" className="btn btn--primary" onClick={addTag} disabled={tagSaving || !tagInput.trim()}>
                      {tagSaving ? "…" : "+ افزودن"}
                    </button>
                  </div>
                  {tagMsg && (
                    <p className="field-hint" role="status" style={{ marginTop: "0.5rem", color: tagMsg.ok ? "var(--color-success,#2e7d32)" : "#b71c1c" }}>
                      {tagMsg.text}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* موقعیت و اطلاعات تماس */}
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-location-dot" style={{ marginInlineEnd: "0.5rem", color: "#10b981" }} />
                  موقعیت و اطلاعات تماس
                </h3>
              </div>
              <div className="panel-card__body">
                <div className="form-grid">
                  <div className="field field--block">
                    <label htmlFor="dash-city">شهر (انگلیسی)</label>
                    <input
                      id="dash-city"
                      list="dash-cities-list"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      lang="en"
                      dir="ltr"
                      placeholder="London"
                      maxLength={100}
                    />
                    <datalist id="dash-cities-list">
                      {cities.map((c, i) => (<option key={i} value={c} />))}
                    </datalist>
                  </div>
                  <div className="field field--block">
                    <label htmlFor="dash-postcode">Postcode</label>
                    <input
                      id="dash-postcode"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      dir="ltr"
                      placeholder="SW1A 1AA"
                      style={{ textTransform: "uppercase" }}
                      maxLength={12}
                    />
                  </div>
                  <div className="field field--block" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="dash-address">آدرس (نقشه و تماس)</label>
                    <textarea id="dash-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
                  </div>
                  <div className="field field--block">
                    <label htmlFor="dash-phone">تلفن</label>
                    <input id="dash-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="phone-ltr" maxLength={30} />
                  </div>
                  <div className="field field--block">
                    <label htmlFor="dash-mobile">موبایل</label>
                    <input id="dash-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} dir="ltr" className="phone-ltr" maxLength={30} placeholder="شماره موبایل" />
                  </div>
                  <div className="field field--block">
                    <label htmlFor="dash-listing-email">ایمیل اطلاع تأیید/رد آگهی</label>
                    <input
                      id="dash-listing-email"
                      type="email"
                      value={listingContactEmail}
                      onChange={(e) => setListingContactEmail(e.target.value)}
                      dir="ltr"
                      placeholder="برای اطلاع‌رسانی هنگام تأیید یا رد توسط مدیر"
                      maxLength={200}
                    />
                    <span className="field-hint">اختیاری؛ همان ایمیل فرم ثبت کسب‌وکار.</span>
                  </div>
                  <div className="field field--block">
                    <label htmlFor="dash-greview">لینک صفحهٔ نظر Google (برای QR و ریدایرکت)<TokenBadge type="earn_google_maps" /></label>
                    <input
                      id="dash-greview"
                      type="url"
                      value={googleReviewUrl}
                      onChange={(e) => setGoogleReviewUrl(e.target.value)}
                      onBlur={() => setGoogleReviewUrl((prev) => (String(prev).trim() ? ensureHttpsUrl(String(prev).trim()) : ""))}
                      placeholder="https://g.page/.../review"
                      dir="ltr"
                      maxLength={500}
                    />
                  </div>
                  <div className="field field--block">
                    <label htmlFor="dash-res-link">لینک رزرو سفارشی (اختیاری)</label>
                    <input
                      id="dash-res-link"
                      type="url"
                      value={reservationLink}
                      onChange={(e) => setReservationLink(e.target.value)}
                      onBlur={() => setReservationLink((prev) => (String(prev).trim() ? ensureHttpsUrl(String(prev).trim()) : ""))}
                      placeholder="https://example.com/book"
                      dir="ltr"
                      maxLength={500}
                    />
                    <p className="field-hint">اگر پر شود، در صفحه عمومی دکمه «رزرو آنلاین» نمایش داده می‌شود و کاربر به این لینک منتقل می‌شود.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Promotion */}
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-tag" style={{ marginInlineEnd: "0.5rem", color: "#ec4899" }} />
                  Promotion
                </h3>
              </div>
              <div className="panel-card__body">
                <div className="form-grid">
                  <div className="field field--block">
                    <label htmlFor="dash-promo-title">عنوان Promotion</label>
                    <input id="dash-promo-title" value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} maxLength={100} />
                  </div>
                  <div className="field field--block">
                    <label>شرح Promotion</label>
                    <RichEditor value={promoDescription} onChange={setPromoDescription} placeholder="شرح پروموشن…" minHeight={140} />
                  </div>
                </div>
              </div>
            </div>

            {/* ساعات کاری */}
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-clock" style={{ marginInlineEnd: "0.5rem", color: "#10b981" }} />
                  ساعات کاری
                  <TokenBadge type="earn_hours_filled" />
                </h3>
              </div>
              <div className="panel-card__body" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {hoursRows.map((row, i) => {
                  const isClosed = row.hours === "بسته";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <span style={{ minWidth: "5.5rem", fontWeight: 700, fontSize: "0.92rem", color: "#334155" }}>{row.day}</span>
                      <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1.5px solid #e2e8f0", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => updateHour(i, "hours", isClosed ? "" : row.hours)}
                          style={{
                            padding: "0.3rem 0.85rem", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "0.85rem",
                            background: !isClosed ? "#dcfce7" : "#f8fafc", color: !isClosed ? "#166534" : "#94a3b8",
                            borderInlineEnd: "1.5px solid #e2e8f0",
                          }}
                        >باز</button>
                        <button
                          type="button"
                          onClick={() => updateHour(i, "hours", "بسته")}
                          style={{
                            padding: "0.3rem 0.85rem", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "0.85rem",
                            background: isClosed ? "#fee2e2" : "#f8fafc", color: isClosed ? "#991b1b" : "#94a3b8",
                          }}
                        >بسته</button>
                      </div>
                      {!isClosed && (
                        <input
                          value={row.hours}
                          onChange={(e) => updateHour(i, "hours", e.target.value)}
                          dir="ltr"
                          placeholder="۰۹:۰۰–۱۸:۰۰"
                          style={{ flex: 1, minWidth: "8rem", maxWidth: "14rem" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Exchange fields */}
            {showExchangeFields && (
              <>
                {isSuperAdmin ? (
                  <div className="panel-card">
                    <div className="panel-card__head">
                      <h3 className="panel-card__title">
                        <i className="fa-solid fa-user-tie" style={{ marginInlineEnd: "0.5rem", color: "#6366f1" }} />
                        اتصال مدیر صرافی به این آگهی
                      </h3>
                    </div>
                    <div className="panel-card__body">
                      <p className="field-hint" style={{ marginTop: 0 }}>
                        ایمیل مدیر صرافی را وارد کنید تا همین آگهی به حساب او متصل شود. برای حذف اتصال، فیلد را خالی ذخیره کنید.
                      </p>
                      <div className="form-grid">
                        <div className="field field--block">
                          <label htmlFor="dash-exchange-manager-email">ایمیل مدیر صرافی</label>
                          <input
                            id="dash-exchange-manager-email"
                            type="email"
                            dir="ltr"
                            value={exchangeManagerEmail}
                            onChange={(e) => setExchangeManagerEmail(e.target.value)}
                            list="dash-exchange-managers-list"
                            placeholder="manager@example.com"
                          />
                          <datalist id="dash-exchange-managers-list">
                            {exchangeManagers.map((m) => (<option key={m.id} value={String(m.email || "")} />))}
                          </datalist>
                          <span className="field-hint">
                            مدیر فعلی:{" "}
                            <strong dir="ltr">
                              {exchangeManagerIdCurrent != null
                                ? exchangeManagers.find((m) => Number(m.id) === Number(exchangeManagerIdCurrent))?.email || `#${exchangeManagerIdCurrent}`
                                : "—"}
                            </strong>
                          </span>
                        </div>
                        <div className="field" style={{ alignSelf: "end" }}>
                          <button type="button" className="btn btn--ghost" onClick={connectExchangeManager} disabled={exchangeManagerSaving}>
                            {exchangeManagerSaving ? "در حال اتصال…" : "ذخیره اتصال مدیر صرافی"}
                          </button>
                        </div>
                      </div>
                      {exchangeManagerMsg ? <p className="field-hint">{exchangeManagerMsg}</p> : null}
                    </div>
                  </div>
                ) : null}

                <div className="panel-card">
                  <div className="panel-card__head">
                    <h3 className="panel-card__title" id="dash-rates-section">
                      <i className="fa-solid fa-chart-line" style={{ marginInlineEnd: "0.5rem", color: "#f59e0b" }} />
                      نرخ ارز و رمز ارز (ویژهٔ صرافی)
                    </h3>
                  </div>
                  <div className="panel-card__body">
                    <p className="field-hint">
                      ارزها را از جستجو اضافه کنید؛ برای هر ارز می‌توانید خرید یا فروش را غیرفعال کنید. فیات و رمز ارز در سیستم پشتیبانی می‌شود.
                    </p>
                    <ExchangeRatesEditor rows={exchangeRatesRows} setRows={setExchangeRatesRows} />
                    <div className="field field--block" style={{ marginTop: "0.85rem" }}>
                      <label>روش‌های پرداخت قابل نمایش در صفحهٔ عمومی</label>
                      <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.45rem" }}>
                        {EXCHANGE_PAYMENT_METHODS.map((m) => (
                          <label key={m.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <input type="checkbox" checked={paymentMethods.includes(m.id)} onChange={(e) => togglePaymentMethod(m.id, e.target.checked)} />
                            <ExchangePaymentMethodIcon methodId={m.id} className="exchange-pay-badge__icon--dash" />
                            <span>{m.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="field-hint">هر گزینه‌ای که فعال باشد، در بخش «پرداخت با» در صفحهٔ عمومی نمایش داده می‌شود.</p>
                    </div>
                    <div className="field field--block" style={{ marginTop: "0.85rem" }}>
                      <label>ویژگی‌های صرافی برای نمایش روی کارت لیست</label>
                      <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.45rem" }}>
                        {EXCHANGE_FEATURES.map((f) => (
                          <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <input type="checkbox" checked={exchangeFeatures.includes(f.id)} onChange={(e) => toggleExchangeFeature(f.id, e.target.checked)} />
                            <span>{f.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="field-hint">هر گزینه‌ای که فعال باشد، به‌صورت چیپ روی کارت صرافی در صفحهٔ exchanges دیده می‌شود.</p>
                    </div>
                    <div className="field field--block" style={{ marginTop: "0.85rem" }}>
                      <label htmlFor="dash-exchange-today-rate-enabled">نمایش «نرخ ویژه امروز» در صفحه جزئیات صرافی</label>
                      <select
                        id="dash-exchange-today-rate-enabled"
                        value={exchangeTodayRateEnabled ? "1" : "0"}
                        onChange={(e) => setExchangeTodayRateEnabled(e.target.value === "1")}
                      >
                        <option value="1">فعال</option>
                        <option value="0">غیرفعال</option>
                      </select>
                    </div>
                    {isSuperAdmin ? (
                      <div className="field field--block dashboard-exchange-verified" style={{ marginTop: "0.85rem" }}>
                        <label htmlFor="dash-exchange-company-verified">وضعیت صرافی (فقط سوپرادمین)</label>
                        <select
                          id="dash-exchange-company-verified"
                          value={exchangeCompanyVerified ? "1" : "0"}
                          onChange={(e) => setExchangeCompanyVerified(e.target.value === "1")}
                        >
                          <option value="0">خصوصی / غیر شرکتی — هشدار نارنجی در صفحهٔ عمومی</option>
                          <option value="1">کسب‌وکار ثبت‌شده — تیک آبی در سایت</option>
                        </select>
                        <p className="field-hint">مدیر عادی آگهی نمی‌تواند این گزینه را تغییر دهد؛ فقط از این پنل با حساب سوپرادمین ذخیره می‌شود.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="panel-card">
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-solid fa-sliders" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                  تنظیمات آگهی
                </h3>
              </div>
              <div className="panel-card__body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="field field--block">
                  <label htmlFor="dash-status">وضعیت آگهی</label>
                  <select id="dash-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">فعال</option>
                    <option value="inactive">غیرفعال</option>
                  </select>
                </div>
                {isSuperAdmin ? (
                  <Link className="btn btn--ghost" to={previewHref} target="_blank" rel="noreferrer" style={{ textAlign: "center" }}>
                    پیش‌نمایش صفحهٔ عمومی
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

        </div>
      </form>

      <div className="dash-save-bar">
        {saveMsg && <span className="dash-save-bar__msg">{saveMsg}</span>}
        <button
          type="submit"
          form="dash-biz-form"
          className="btn btn--primary dash-save-bar__btn"
          disabled={saving}
        >
          {saving ? "در حال ذخیره…" : "ذخیره"}
        </button>
      </div>
    </section>
  );
}
