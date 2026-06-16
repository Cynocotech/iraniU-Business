import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiGet, apiPost } from "../api.js";
import { formatAdId } from "../lib/businessIds.js";

export default function ClaimPage() {
  const [searchParams] = useSearchParams();
  const slug = (searchParams.get("slug") || "").trim();
  const businessLabel = searchParams.get("business") || slug || "این آگهی";

  const [adId, setAdId] = useState(null);

  useEffect(() => {
    if (!slug) {
      setAdId(null);
      return;
    }
    apiGet(`/api/businesses/${encodeURIComponent(slug)}`)
      .then((row) => {
        setAdId(row?.id != null ? formatAdId(row.id) : null);
      })
      .catch(() => setAdId(null));
  }, [slug]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!slug) {
      setStatus({ ok: false, text: "نامک آگهی در آدرس نیست." });
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await apiPost("/api/claim-requests", {
        business_slug: slug,
        applicant_name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
      });
      setStatus({ ok: true, text: "درخواست شما ثبت شد. پس از بررسی با شما تماس گرفته می‌شود." });
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (err) {
      const t = err.message || "";
      let text = t;
      if (t.includes("already_claimed")) text = "این آگهی قبلاً مالک دارد.";
      else if (t.includes("duplicate_pending")) text = "برای این ایمیل و آگهی درخواست در انتظار دارید.";
      else if (t.includes("business_not_found")) text = "آگهی پیدا نشد.";
      else if (t.includes("listing_not_public") || t.includes("listing_not_approved")) {
        text = "این آگهی در سایت منتشر نشده یا غیرفعال است؛ فقط آگهی‌های فعال و منتشرشده قابل ادعا هستند.";
      }
      setStatus({ ok: false, text });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Seo
        title="ادعای مالکیت آگهی"
        description={`درخواست تأیید مالکیت برای «${businessLabel}» در فهرست ایرانیو.`}
      />
    <main className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem", maxWidth: "36rem" }}>
      <h1>ادعای مالکیت</h1>
      <p className="field-hint">
        آگهی: <strong>{businessLabel}</strong>
        {adId && (
          <>
            {" "}
            (<span lang="en" dir="ltr">{adId}</span>)
          </>
        )}
      </p>

      {!slug && (
        <p className="field-hint" role="alert">
          از صفحهٔ یک کسب‌وکار روی «ادعای مالکیت» کلیک کنید یا نامک را در آدرس بگذارید:{" "}
          <code dir="ltr">/claim?slug=your-slug</code>
        </p>
      )}

      {slug && (
        <form className="dashboard-panel" onSubmit={submit} style={{ marginTop: "1rem" }}>
          <div className="form-grid">
            <div className="field field--block">
              <label htmlFor="claim-name">نام و نام خانوادگی</label>
              <input id="claim-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field field--block">
              <label htmlFor="claim-email">ایمیل</label>
              <input
                id="claim-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                autoComplete="email"
              />
            </div>
            <div className="field field--block">
              <label htmlFor="claim-phone">تلفن</label>
              <input id="claim-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" required />
            </div>
            <div className="field field--block">
              <label htmlFor="claim-msg">توضیح</label>
              <textarea id="claim-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn--primary" disabled={sending}>
            {sending ? "در حال ارسال…" : "ارسال درخواست"}
          </button>
          {status && (
            <p className="field-hint" style={{ color: status.ok ? "inherit" : "#b71c1c" }}>
              {status.text}
            </p>
          )}
        </form>
      )}

      <p style={{ marginTop: "1.5rem" }}>
        <Link to="/listings">بازگشت به فهرست</Link>
      </p>
    </main>
    </>
  );
}
