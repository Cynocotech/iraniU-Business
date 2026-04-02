import { LISTING_TERMS_SECTIONS, LISTING_TERMS_VERSION } from "../lib/listingTerms.js";

export { LISTING_TERMS_VERSION };

export function ListingTermsScrollBox({ id }) {
  return (
    <div
      id={id}
      className="listing-terms-box"
      style={{
        maxHeight: "14rem",
        overflowY: "auto",
        padding: "0.85rem 1rem",
        marginBottom: "0.75rem",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        fontSize: "0.88rem",
        lineHeight: 1.65,
      }}
    >
      <p style={{ margin: "0 0 0.75rem", fontWeight: 700 }}>شرایط و قوانین ثبت آگهی (نسخهٔ {LISTING_TERMS_VERSION})</p>
      {LISTING_TERMS_SECTIONS.map((sec) => (
        <section key={sec.title} style={{ marginBottom: "0.85rem" }}>
          <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.92rem", fontWeight: 700 }}>{sec.title}</h3>
          <p style={{ margin: 0, color: "var(--color-text)" }}>{sec.body}</p>
        </section>
      ))}
    </div>
  );
}

export function ListingTermsCheckbox({ id, checked, onChange, disabled }) {
  return (
    <div className="field field--block" style={{ marginTop: "0.5rem" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          gap: "0.65rem",
          alignItems: "flex-start",
          cursor: disabled ? "default" : "pointer",
          fontWeight: 600,
        }}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          style={{ marginTop: "0.2rem", flexShrink: 0 }}
        />
        <span>
          شرایط و قوانین بالا را خوانده‌ام و با آن‌ها موافقم. می‌فهمم که مسئولیت صحت اطلاعات آگهی با من است و
          آگهی ممکن است پیش از انتشار توسط مدیر بررسی شود.
        </span>
      </label>
    </div>
  );
}
