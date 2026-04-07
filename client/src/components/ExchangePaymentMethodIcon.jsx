/**
 * آیکن‌های تزئینی برای نشان‌های «پرداخت با» — بدون وابستگی به فایل خارجی.
 */
export default function ExchangePaymentMethodIcon({ methodId, className = "" }) {
  const base = `exchange-pay-badge__icon ${className}`.trim();
  const svgProps = {
    className: base,
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
    focusable: "false",
  };

  switch (methodId) {
    case "visa":
      return (
        <svg {...svgProps}>
          <rect x="1" y="5" width="22" height="14" rx="2.5" fill="#1434CB" />
          <rect x="3" y="9" width="18" height="2.2" rx="0.5" fill="#fff" opacity="0.95" />
          <rect x="3" y="12.5" width="11" height="1.3" rx="0.3" fill="#fff" opacity="0.45" />
        </svg>
      );
    case "mastercard":
      return (
        <svg {...svgProps}>
          <circle cx="9" cy="12" r="7.5" fill="#EB001B" />
          <circle cx="15" cy="12" r="7.5" fill="#F79E1B" fillOpacity="0.88" />
        </svg>
      );
    case "bank_transfer":
      return (
        <svg {...svgProps} fill="none">
          <path
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            d="M12 4l7.5 4.5V20H4.5V8.5L12 4z"
          />
          <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M8.5 20v-6.5h7V20" />
        </svg>
      );
    case "card_to_card":
      return (
        <svg {...svgProps} fill="none">
          <rect x="2" y="6" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="10" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 8h5M13 14h2"
          />
        </svg>
      );
    case "cash":
      return (
        <svg {...svgProps} fill="none">
          <rect x="3" y="7" width="18" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" d="M5 10h2M17 14h2" />
        </svg>
      );
    case "crypto":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="10" fill="#F7931A" />
          <text
            x="12"
            y="12"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize="11"
            fontWeight="700"
            fontFamily="system-ui, 'Segoe UI', sans-serif"
          >
            ₿
          </text>
        </svg>
      );
    default:
      return (
        <svg {...svgProps} fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      );
  }
}
