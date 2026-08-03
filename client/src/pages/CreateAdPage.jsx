import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { usePublicAuth } from "../context/PublicAuthContext.jsx";
import { v1Post } from "../api-v1.js";

const AD_TYPES = [
  { value: "listing", label: "آگهی دایرکتوری", icon: "📋", desc: "کسب‌وکار شما با برچسب Sponsored در فهرست نمایش داده می‌شود." },
  { value: "banner", label: "بنر تصویری", icon: "🖼️", desc: "بنر تصویری در صفحه فهرست کسب‌وکارها نمایش داده می‌شود." },
  { value: "spotlight", label: "ویژه صفحه اصلی", icon: "⭐", desc: "کسب‌وکار شما بطور ویژه در صفحه اصلی سایت معرفی می‌شود." },
];

const PLACEMENTS = [
  { value: "listings", label: "صفحه فهرست (Listings)" },
  { value: "home", label: "صفحه اصلی (Home)" },
  { value: "sidebar", label: "نوار کناری (Sidebar)" },
];

function AuthRequired() {
  const { login, register } = usePublicAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isReg = mode === "register";

  async function handle(e) {
    e.preventDefault();
    setError("");
    if (isReg && !name.trim()) { setError("نام کامل را وارد کنید."); return; }
    if (!email.trim()) { setError("ایمیل را وارد کنید."); return; }
    if (!password) { setError("رمز عبور را وارد کنید."); return; }
    if (isReg && password.length < 8) { setError("رمز عبور باید حداقل ۸ کاراکتر باشد."); return; }
    setBusy(true);
    try {
      if (isReg) await register(name.trim(), email.trim().toLowerCase(), password);
      else await login(email.trim().toLowerCase(), password);
    } catch (ex) {
      setError(ex.message || "خطا در ارتباط با سرور.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="create-ad-auth">
      <div className="create-ad-auth__icon">🔐</div>
      <h2>برای ثبت آگهی وارد شوید</h2>
      <p>با ساخت حساب رایگان می‌توانید آگهی خود را ثبت و مدیریت کنید.</p>
      <div className="create-ad-auth__tabs">
        <button type="button" className={`create-ad-auth__tab${!isReg ? " is-active" : ""}`} onClick={() => setMode("login")}>ورود</button>
        <button type="button" className={`create-ad-auth__tab${isReg ? " is-active" : ""}`} onClick={() => setMode("register")}>ثبت‌نام</button>
      </div>
      <form onSubmit={handle} noValidate>
        {error && <div className="create-ad-auth__error">{error}</div>}
        {isReg && (
          <div className="ca-field">
            <label>نام کامل</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="نام و نام‌خانوادگی" required autoComplete="name" />
          </div>
        )}
        <div className="ca-field">
          <label>ایمیل</label>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" required autoComplete="email" />
        </div>
        <div className="ca-field">
          <label>رمز عبور</label>
          <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isReg ? "حداقل ۸ کاراکتر، حرف بزرگ و عدد" : "رمز عبور"} required autoComplete={isReg ? "new-password" : "current-password"} />
        </div>
        <button type="submit" className="ca-submit" disabled={busy}>
          {busy ? "…" : isReg ? "ثبت‌نام و ادامه" : "ورود و ادامه"}
        </button>
      </form>
    </div>
  );
}

export default function CreateAdPage() {
  const navigate = useNavigate();
  const { user, loading } = usePublicAuth();

  const [step, setStep] = useState(0);
  const [adType, setAdType] = useState("listing");
  const [placement, setPlacement] = useState("listings");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [budgetGbp, setBudgetGbp] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("عنوان آگهی الزامی است."); return; }
    const email = (contactEmail || user?.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("ایمیل تماس معتبر وارد کنید."); return; }
    setBusy(true);
    try {
      await v1Post("/api/v1/ads", {
        title: title.trim(),
        description: description.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        target_url: targetUrl.trim() || undefined,
        ad_type: adType,
        placement,
        business_slug: businessSlug.trim() || undefined,
        contact_name: (contactName.trim() || user?.name) || undefined,
        contact_email: email,
        contact_phone: contactPhone.trim() || undefined,
        budget_gbp: budgetGbp ? Number(budgetGbp) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        notes: notes.trim() || undefined,
      });
      navigate("/my-ads", { state: { created: true } });
    } catch (ex) {
      setError(ex.message || "خطا در ثبت آگهی. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div dir="rtl" style={{ textAlign: "center", padding: "4rem", color: "#888" }}>در حال بارگذاری…</div>;

  return (
    <div dir="rtl" className="create-ad-page">
      <Seo title="ثبت آگهی جدید — ایرانیو" />

      <div className="create-ad-page__inner">
        <div className="create-ad-page__header">
          <Link to="/listings" className="create-ad-page__back">← بازگشت</Link>
          <h1 className="create-ad-page__title">ثبت آگهی در ایرانیو</h1>
          <p className="create-ad-page__subtitle">کسب‌وکار یا خدمات خود را به جامعه ایرانی انگلستان معرفی کنید</p>
        </div>

        <div className="create-ad-page__body">
          {!user ? (
            <AuthRequired />
          ) : (
            <>
              {/* Step tabs */}
              <div className="create-ad-steps">
                {["نوع آگهی", "جزئیات آگهی", "اطلاعات تماس"].map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`create-ad-steps__step${step === i ? " is-active" : ""}${step > i ? " is-done" : ""}`}
                    onClick={() => step > i && setStep(i)}
                  >
                    <span className="create-ad-steps__num">{step > i ? "✓" : i + 1}</span>
                    <span className="create-ad-steps__label">{s}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={submit} noValidate>
                {error && <div className="ca-error">{error}</div>}

                {step === 0 && (
                  <div className="ca-step">
                    <h2 className="ca-step__title">نوع آگهی را انتخاب کنید</h2>
                    <div className="ca-type-grid">
                      {AD_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          className={`ca-type-card${adType === t.value ? " is-selected" : ""}`}
                          onClick={() => setAdType(t.value)}
                        >
                          <span className="ca-type-card__icon">{t.icon}</span>
                          <span className="ca-type-card__label">{t.label}</span>
                          <span className="ca-type-card__desc">{t.desc}</span>
                        </button>
                      ))}
                    </div>

                    <div className="ca-field" style={{ marginTop: "1.5rem" }}>
                      <label>جایگاه نمایش</label>
                      <select value={placement} onChange={(e) => setPlacement(e.target.value)}>
                        {PLACEMENTS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    <button type="button" className="ca-next" onClick={() => setStep(1)}>ادامه ←</button>
                  </div>
                )}

                {step === 1 && (
                  <div className="ca-step">
                    <h2 className="ca-step__title">جزئیات آگهی</h2>

                    <div className="ca-field">
                      <label>عنوان آگهی <span className="ca-req">*</span></label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="مثلاً: رستوران ایرانی در لندن — بهترین کباب"
                        required
                        maxLength={200}
                      />
                    </div>

                    <div className="ca-field">
                      <label>توضیحات</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        maxLength={2000}
                        placeholder="توضیح کوتاه درباره کسب‌وکار یا خدمات شما…"
                      />
                    </div>

                    <div className="ca-field-row">
                      <div className="ca-field">
                        <label>لینک مقصد</label>
                        <input
                          type="url"
                          dir="ltr"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="ca-field">
                        <label>لینک تصویر بنر</label>
                        <input
                          type="url"
                          dir="ltr"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://example.com/banner.jpg"
                        />
                      </div>
                    </div>

                    <div className="ca-field">
                      <label>Slug کسب‌وکار (اختیاری)</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={businessSlug}
                        onChange={(e) => setBusinessSlug(e.target.value)}
                        placeholder="restaurant-example"
                      />
                      <small className="ca-hint">اگر کسب‌وکار شما قبلاً در دایرکتوری ایرانیو ثبت شده، slug آن را وارد کنید.</small>
                    </div>

                    <div className="ca-field-row">
                      <div className="ca-field">
                        <label>تاریخ شروع</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={today} />
                      </div>
                      <div className="ca-field">
                        <label>تاریخ پایان</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || today} />
                      </div>
                    </div>

                    <div className="ca-step-nav">
                      <button type="button" className="ca-back" onClick={() => setStep(0)}>← قبلی</button>
                      <button type="button" className="ca-next" onClick={() => { if (!title.trim()) { setError("عنوان آگهی الزامی است."); return; } setError(""); setStep(2); }}>ادامه ←</button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="ca-step">
                    <h2 className="ca-step__title">اطلاعات تماس و بودجه</h2>

                    <div className="ca-field-row">
                      <div className="ca-field">
                        <label>نام تماس</label>
                        <input
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder={user.name}
                        />
                      </div>
                      <div className="ca-field">
                        <label>ایمیل تماس <span className="ca-req">*</span></label>
                        <input
                          type="email"
                          dir="ltr"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder={user.email}
                        />
                      </div>
                    </div>

                    <div className="ca-field-row">
                      <div className="ca-field">
                        <label>تلفن تماس</label>
                        <input
                          type="tel"
                          dir="ltr"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+44 7900 000000"
                        />
                      </div>
                      <div className="ca-field">
                        <label>بودجه ماهانه (£)</label>
                        <input
                          type="number"
                          dir="ltr"
                          value={budgetGbp}
                          onChange={(e) => setBudgetGbp(e.target.value)}
                          placeholder="100"
                          min={0}
                          step={1}
                        />
                      </div>
                    </div>

                    <div className="ca-field">
                      <label>توضیحات اضافه / درخواست ویژه</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        placeholder="هر توضیح یا درخواست خاصی که دارید…"
                      />
                    </div>

                    <div className="ca-review-box">
                      <h3>خلاصه آگهی</h3>
                      <ul>
                        <li><strong>نوع:</strong> {AD_TYPES.find(t => t.value === adType)?.label}</li>
                        <li><strong>جایگاه:</strong> {PLACEMENTS.find(p => p.value === placement)?.label}</li>
                        <li><strong>عنوان:</strong> {title || "—"}</li>
                        {budgetGbp && <li><strong>بودجه:</strong> £{budgetGbp}/ماه</li>}
                        {startDate && <li><strong>شروع:</strong> {startDate}</li>}
                        {endDate && <li><strong>پایان:</strong> {endDate}</li>}
                      </ul>
                      <p className="ca-review-note">
                        پس از ثبت، تیم ایرانیو آگهی شما را بررسی و در صورت تأیید منتشر می‌کند.
                      </p>
                    </div>

                    <div className="ca-step-nav">
                      <button type="button" className="ca-back" onClick={() => setStep(1)}>← قبلی</button>
                      <button type="submit" className="ca-submit" disabled={busy}>
                        {busy ? "در حال ثبت…" : "ثبت آگهی"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>

      <style>{`
        .create-ad-page {
          min-height: 100vh;
          background: #f8f9fc;
          padding: 2rem 1rem;
          font-family: inherit;
        }
        .create-ad-page__inner {
          max-width: 680px;
          margin: 0 auto;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 2px 24px rgba(0,0,0,.08);
          overflow: hidden;
        }
        .create-ad-page__header {
          padding: 2rem 2rem 1.5rem;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #fff;
        }
        .create-ad-page__back { color: rgba(255,255,255,.7); text-decoration: none; font-size: .85rem; }
        .create-ad-page__back:hover { color: #fff; }
        .create-ad-page__title { margin: .75rem 0 .25rem; font-size: 1.5rem; font-weight: 700; }
        .create-ad-page__subtitle { margin: 0; font-size: .9rem; opacity: .8; }
        .create-ad-page__body { padding: 2rem; }

        /* Steps */
        .create-ad-steps { display: flex; gap: .5rem; margin-bottom: 2rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 1.5rem; }
        .create-ad-steps__step {
          display: flex; align-items: center; gap: .5rem;
          background: none; border: none; padding: .5rem .75rem; border-radius: 8px;
          cursor: pointer; font-family: inherit; font-size: .85rem; color: #9ca3af;
          transition: all .2s;
        }
        .create-ad-steps__step.is-active { background: #eef0ff; color: #4f67ff; font-weight: 600; }
        .create-ad-steps__step.is-done { color: #10b981; cursor: pointer; }
        .create-ad-steps__num {
          width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: .75rem; font-weight: 700;
          background: currentColor; color: inherit;
          background: #e5e7eb; color: #9ca3af;
        }
        .create-ad-steps__step.is-active .create-ad-steps__num { background: #4f67ff; color: #fff; }
        .create-ad-steps__step.is-done .create-ad-steps__num { background: #10b981; color: #fff; }

        .ca-step__title { font-size: 1.15rem; font-weight: 700; margin: 0 0 1.5rem; color: #111827; }

        /* Type cards */
        .ca-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        @media (max-width: 500px) { .ca-type-grid { grid-template-columns: 1fr; } }
        .ca-type-card {
          border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.25rem 1rem;
          background: #fff; cursor: pointer; text-align: center;
          display: flex; flex-direction: column; gap: .5rem;
          font-family: inherit; transition: all .2s;
        }
        .ca-type-card:hover { border-color: #c7d0ff; background: #f8f9ff; }
        .ca-type-card.is-selected { border-color: #4f67ff; background: #eef0ff; }
        .ca-type-card__icon { font-size: 2rem; }
        .ca-type-card__label { font-size: .95rem; font-weight: 700; color: #111827; }
        .ca-type-card__desc { font-size: .8rem; color: #6b7280; line-height: 1.5; }

        /* Fields */
        .ca-field { display: flex; flex-direction: column; gap: .35rem; margin-bottom: 1rem; }
        .ca-field label { font-size: .875rem; font-weight: 600; color: #374151; }
        .ca-req { color: #ef4444; }
        .ca-hint { font-size: .78rem; color: #9ca3af; }
        .ca-field input, .ca-field select, .ca-field textarea {
          border: 1.5px solid #e5e7eb; border-radius: 8px; padding: .65rem .875rem;
          font-size: .95rem; outline: none; transition: border-color .2s;
          font-family: inherit; width: 100%; box-sizing: border-box;
        }
        .ca-field input:focus, .ca-field select:focus, .ca-field textarea:focus { border-color: #4f67ff; }
        .ca-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 500px) { .ca-field-row { grid-template-columns: 1fr; } }

        /* Review box */
        .ca-review-box {
          background: #f8f9fc; border: 1px solid #e5e7eb; border-radius: 10px;
          padding: 1.25rem; margin: 1.5rem 0;
        }
        .ca-review-box h3 { margin: 0 0 .75rem; font-size: 1rem; font-weight: 700; }
        .ca-review-box ul { margin: 0 0 .75rem; padding: 0; list-style: none; display: flex; flex-direction: column; gap: .4rem; }
        .ca-review-box li { font-size: .875rem; color: #374151; }
        .ca-review-note { font-size: .8rem; color: #6b7280; margin: 0; line-height: 1.6; }

        /* Navigation */
        .ca-step-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; }
        .ca-next, .ca-submit {
          background: #4f67ff; color: #fff; border: none; border-radius: 10px;
          padding: .7rem 1.75rem; font-size: 1rem; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: background .2s;
        }
        .ca-next:hover:not(:disabled), .ca-submit:hover:not(:disabled) { background: #3a52e8; }
        .ca-submit:disabled { opacity: .6; cursor: not-allowed; }
        .ca-back {
          background: none; border: 1.5px solid #e5e7eb; color: #6b7280;
          border-radius: 10px; padding: .65rem 1.25rem; font-size: .9rem;
          cursor: pointer; font-family: inherit; transition: all .2s;
        }
        .ca-back:hover { border-color: #9ca3af; color: #374151; }
        .ca-error {
          background: #fff0f0; border: 1px solid #ffbaba; border-radius: 8px;
          padding: .75rem 1rem; color: #c0392b; font-size: .875rem; margin-bottom: 1rem;
        }

        /* Auth required */
        .create-ad-auth { text-align: center; max-width: 380px; margin: 0 auto; }
        .create-ad-auth__icon { font-size: 3rem; margin-bottom: 1rem; }
        .create-ad-auth h2 { font-size: 1.3rem; margin: 0 0 .5rem; }
        .create-ad-auth p { color: #6b7280; font-size: .9rem; margin-bottom: 1.5rem; }
        .create-ad-auth__tabs { display: flex; border: 1.5px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 1.5rem; }
        .create-ad-auth__tab {
          flex: 1; padding: .65rem; border: none; background: #fff; cursor: pointer;
          font-family: inherit; font-size: .9rem; font-weight: 600; color: #9ca3af; transition: all .2s;
        }
        .create-ad-auth__tab.is-active { background: #4f67ff; color: #fff; }
        .create-ad-auth__error {
          background: #fff0f0; border: 1px solid #ffbaba; border-radius: 8px;
          padding: .65rem; color: #c0392b; font-size: .85rem; margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
