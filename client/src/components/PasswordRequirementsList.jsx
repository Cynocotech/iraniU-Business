const RULES = [
  { test: (p) => p.length >= 12, label: "حداقل ۱۲ کاراکتر" },
  { test: (p) => /[a-z]/.test(p), label: "یک حرف کوچک انگلیسی (a-z)" },
  { test: (p) => /[A-Z]/.test(p), label: "یک حرف بزرگ انگلیسی (A-Z)" },
  { test: (p) => /[0-9]/.test(p), label: "یک رقم (0-9)" },
  { test: (p) => /[^a-zA-Z0-9_]/.test(p), label: "یک نماد (مثلاً ! @ # $ %)" },
];

/** نمایش زندهٔ الزامات رمز عبور هنگام تایپ — هم‌خوان با validatePasswordComplexity */
export default function PasswordRequirementsList({ password }) {
  const p = String(password || "");
  return (
    <ul style={{ margin: "0.4rem 0 0", paddingInlineStart: "1.1rem", fontSize: "0.85rem" }}>
      {RULES.map((rule) => {
        const ok = rule.test(p);
        return (
          <li key={rule.label} style={{ color: ok ? "#2e7d32" : "#6b6b6b" }}>
            {ok ? "✓" : "○"} {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
