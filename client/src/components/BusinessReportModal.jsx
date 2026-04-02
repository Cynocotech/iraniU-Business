import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api.js";

export default function BusinessReportModal({ open, onClose, slug, businessName }) {
  const [reasons, setReasons] = useState([]);
  const [reasonKey, setReasonKey] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [done, setDone] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setSubmitErr(null);
    setLoadErr(null);
    setLoading(true);
    apiGet("/api/business-report-reasons")
      .then((data) => {
        const list = Array.isArray(data?.reasons) ? data.reasons : [];
        setReasons(list);
        setReasonKey(list[0]?.key || "");
      })
      .catch(() => setLoadErr("بارگذاری دلایل ناموفق بود."))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!reasonKey || !slug) return;
    setSubmitErr(null);
    setLoading(true);
    try {
      await apiPost(`/api/businesses/${encodeURIComponent(slug)}/report`, {
        reason_key: reasonKey,
        details: details.trim(),
        reporter_email: email.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setSubmitErr(err?.message || "ارسال ناموفق بود.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="admin-detail-modal"
      style={{ zIndex: 1200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="biz-report-title"
    >
      <div className="admin-detail-modal__backdrop" aria-hidden="true" onClick={onClose} />
      <div className="admin-detail-modal__panel" style={{ maxWidth: "26rem" }}>
        <h2 id="biz-report-title" className="admin-detail-modal__title">
          گزارش آگهی
        </h2>
        <p className="field-hint" style={{ marginTop: 0 }}>
          {businessName ? (
            <>
              <strong>{businessName}</strong>
              <span lang="en" dir="ltr" style={{ display: "block", marginTop: "0.25rem", fontSize: "0.9em" }}>
                {slug}
              </span>
            </>
          ) : (
            <span lang="en" dir="ltr">
              {slug}
            </span>
          )}
        </p>
        {loadErr && <p className="field-hint">{loadErr}</p>}
        {done ? (
          <>
            <p>گزارش شما ثبت شد. در صورت نیاز با شما تماس گرفته می‌شود.</p>
            <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="btn btn--primary" onClick={onClose}>
                بستن
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field field--block">
              <label htmlFor="biz-report-reason">دلیل</label>
              <select
                id="biz-report-reason"
                value={reasonKey}
                onChange={(e) => setReasonKey(e.target.value)}
                required
                disabled={loading || reasons.length === 0}
              >
                {reasons.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--block">
              <label htmlFor="biz-report-details">توضیح (اختیاری)</label>
              <textarea
                id="biz-report-details"
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                placeholder="جزئیات بیشتر در صورت نیاز…"
                disabled={loading}
              />
            </div>
            <div className="field field--block">
              <label htmlFor="biz-report-email">ایمیل تماس (اختیاری)</label>
              <input
                id="biz-report-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
            {submitErr && <p className="field-hint">{submitErr}</p>}
            <div className="dashboard-actions" style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="submit" className="btn btn--primary" disabled={loading || !reasonKey}>
                {loading ? "در حال ارسال…" : "ارسال گزارش"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
                انصراف
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
