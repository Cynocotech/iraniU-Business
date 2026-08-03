import { useState, useEffect, useRef } from "react";

const OCCASIONS = [
  { value: "", label: "— بدون مناسبت —" },
  { value: "birthday", label: "تولد" },
  { value: "anniversary", label: "سالگرد" },
  { value: "date", label: "قرار عاشقانه" },
  { value: "family", label: "دورهمی خانوادگی" },
  { value: "business", label: "کاری / تجاری" },
  { value: "celebration", label: "جشن" },
  { value: "other", label: "سایر" },
];

const SEATING = [
  { value: "no-preference", label: "فرقی ندارد" },
  { value: "indoor", label: "داخل سالن" },
  { value: "outdoor", label: "فضای باز / تراس" },
  { value: "booth", label: "کابین / بوث" },
  { value: "window", label: "کنار پنجره" },
  { value: "private", label: "اتاق خصوصی" },
];

function getMinDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function ReservationModal({ businessSlug, businessName, open, onClose }) {
  const firstRef = useRef(null);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    reservation_date: "",
    reservation_time: "19:30",
    party_size: "2",
    occasion: "",
    seating_preference: "no-preference",
    special_requests: "",
  });
  const [state, setState] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmCode, setConfirmCode] = useState("");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => firstRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setState("idle");
      setErrorMsg("");
      setConfirmCode("");
    }
  }, [open]);

  function set(k) {
    return (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/v1/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_slug: businessSlug,
          customer_name: form.customer_name.trim(),
          customer_email: form.customer_email.trim().toLowerCase(),
          customer_phone: form.customer_phone.trim() || null,
          reservation_date: form.reservation_date,
          reservation_time: form.reservation_time,
          party_size: parseInt(form.party_size) || 2,
          occasion: form.occasion || null,
          seating_preference: form.seating_preference || "no-preference",
          special_requests: form.special_requests.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState("error");
        setErrorMsg(json.hint || json.error || "خطایی رخ داد. لطفاً دوباره امتحان کنید.");
        return;
      }
      setConfirmCode(json.confirmation_code);
      setState("success");
    } catch {
      setState("error");
      setErrorMsg("اتصال به سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
    }
  }

  if (!open) return null;

  return (
    <div className="resv-modal is-open" role="dialog" aria-modal="true" aria-labelledby="resv-modal-title">
      <div className="resv-modal__backdrop" onClick={onClose} />
      <div className="resv-modal__panel">
        <div className="resv-modal__header">
          <h2 id="resv-modal-title" className="resv-modal__title">
            رزرو میز — {businessName}
          </h2>
          <button className="resv-modal__close" aria-label="بستن" onClick={onClose} type="button">✕</button>
        </div>

        {state === "success" ? (
          <div className="resv-notice resv-notice--success">
            <strong>رزرو شما با موفقیت ثبت شد!</strong>
            <br />کد تأیید رزرو شما:
            <br />
            <span className="resv-conf-code">{confirmCode}</span>
            <br />
            <small>
              این کد را نگه دارید. پس از تأیید توسط رستوران، ایمیل دریافت خواهید کرد.
              <br />برای لغو رزرو، این کد را نزد خود نگه دارید.
            </small>
            <br />
            <button className="btn btn--ghost" style={{ marginTop: "1rem" }} onClick={onClose} type="button">
              بستن
            </button>
          </div>
        ) : (
          <form className="resv-form" onSubmit={handleSubmit} noValidate>
            {state === "error" && (
              <div className="resv-notice resv-notice--error">{errorMsg}</div>
            )}

            <div className="resv-field">
              <label htmlFor="resv-name">نام کامل *</label>
              <input
                ref={firstRef}
                id="resv-name"
                type="text"
                required
                placeholder="مثلاً: علی احمدی"
                autoComplete="name"
                value={form.customer_name}
                onChange={set("customer_name")}
              />
            </div>

            <div className="resv-form__row">
              <div className="resv-field">
                <label htmlFor="resv-email">ایمیل *</label>
                <input
                  id="resv-email"
                  type="email"
                  required
                  placeholder="ali@example.com"
                  autoComplete="email"
                  dir="ltr"
                  value={form.customer_email}
                  onChange={set("customer_email")}
                />
              </div>
              <div className="resv-field">
                <label htmlFor="resv-phone">تلفن</label>
                <input
                  id="resv-phone"
                  type="tel"
                  placeholder="+44 7900 000000"
                  autoComplete="tel"
                  dir="ltr"
                  value={form.customer_phone}
                  onChange={set("customer_phone")}
                />
              </div>
            </div>

            <div className="resv-form__row">
              <div className="resv-field">
                <label htmlFor="resv-date">تاریخ *</label>
                <input
                  id="resv-date"
                  type="date"
                  required
                  min={getMinDate()}
                  value={form.reservation_date}
                  onChange={set("reservation_date")}
                />
              </div>
              <div className="resv-field">
                <label htmlFor="resv-time">ساعت *</label>
                <input
                  id="resv-time"
                  type="time"
                  required
                  value={form.reservation_time}
                  onChange={set("reservation_time")}
                />
              </div>
            </div>

            <div className="resv-form__row">
              <div className="resv-field">
                <label htmlFor="resv-party">تعداد نفر *</label>
                <select id="resv-party" required value={form.party_size} onChange={set("party_size")}>
                  {[1,2,3,4,5,6,7,8,9,10,12,15,20].map((n) => (
                    <option key={n} value={n}>{n} نفر</option>
                  ))}
                </select>
              </div>
              <div className="resv-field">
                <label htmlFor="resv-occasion">مناسبت</label>
                <select id="resv-occasion" value={form.occasion} onChange={set("occasion")}>
                  {OCCASIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="resv-field">
              <label htmlFor="resv-seating">محل نشستن</label>
              <select id="resv-seating" value={form.seating_preference} onChange={set("seating_preference")}>
                {SEATING.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="resv-field">
              <label htmlFor="resv-special">درخواست‌های ویژه</label>
              <textarea
                id="resv-special"
                placeholder="رژیم غذایی خاص، آلرژی، صندلی کودک، نیاز به ویلچر…"
                rows={3}
                value={form.special_requests}
                onChange={set("special_requests")}
              />
            </div>

            <button
              type="submit"
              className="resv-form__submit"
              disabled={state === "loading"}
            >
              {state === "loading" ? "در حال ارسال…" : "تأیید رزرو"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
