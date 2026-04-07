/** تیک آبی — صرافی تأییدشده به‌عنوان کسب‌وکار ثبت‌شده (فقط توسط سوپرادمین). */
export default function ExchangeCompanyVerifiedBadge({ className = "" }) {
  return (
    <span
      className={`exchange-company-verified ${className}`.trim()}
      title="تأیید شده توسط مدیر سایت به‌عنوان کسب‌وکار ثبت‌شده"
      aria-label="تأیید شده به‌عنوان کسب‌وکار ثبت‌شده"
      role="img"
    >
      <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" aria-hidden focusable="false">
        <circle cx="12" cy="12" r="10" fill="#1d9bf0" />
        <path
          d="M8 12.5l2.5 2.5 5.5-6"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
