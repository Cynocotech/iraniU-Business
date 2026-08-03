import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const PLANS = [
  {
    id: "silver",
    label: "نقره‌ای",
    icon: "🥈",
    days: 7,
    tokens: 100,
    color: "#374151",
    border: "#d1d5db",
    bg: "#f9fafb",
    accent: "#6b7280",
    features: [
      "۷ روز در بالای نتایج جستجو",
      "نشان «نقره‌ای» روی آگهی",
      "اولویت بیشتر نسبت به آگهی‌های عادی",
      "بهبود دیده‌شدن در فهرست کسب‌وکارها",
    ],
    notIncluded: ["جایگاه ویژه در صفحهٔ اصلی", "پالس و هایلایت رنگی", "صدرنشینی پیوسته"],
  },
  {
    id: "gold",
    label: "طلایی",
    icon: "🥇",
    days: 14,
    tokens: 200,
    color: "#b45309",
    border: "#fcd34d",
    bg: "#fffbeb",
    accent: "#d97706",
    features: [
      "۱۴ روز در بالای نتایج جستجو",
      "نشان «طلایی» برجسته روی آگهی",
      "اولویت بالاتر از نقره‌ای",
      "کادر طلایی دور آگهی",
      "دیده‌شدن بیشتر از نقره‌ای",
    ],
    notIncluded: ["جایگاه ویژه در صفحهٔ اصلی", "پالس انیمیشن رنگی", "صدرنشینی تضمینی"],
  },
  {
    id: "platinum",
    label: "پلاتینیوم",
    icon: "💎",
    days: 30,
    tokens: 450,
    color: "#5b21b6",
    border: "#a78bfa",
    bg: "#f5f3ff",
    accent: "#7c3aed",
    popular: true,
    features: [
      "۳۰ روز در بخش «آگهی‌های ویژه»",
      "نمایش در صفحهٔ اصلی سایت",
      "نمایش در صدر فهرست آگهی‌ها",
      "کادر بنفش با انیمیشن پالس",
      "نشان «پلاتینیوم» روی آگهی",
      "چرخش روزانهٔ عادلانه با سایر پلاتینیوم‌ها",
    ],
    notIncluded: ["تضمین صدر مطلق (الماسی)"],
  },
  {
    id: "diamond",
    label: "الماسی",
    icon: "💠",
    days: 60,
    tokens: 800,
    color: "#0891b2",
    border: "#67e8f9",
    bg: "#ecfeff",
    accent: "#0891b2",
    premium: true,
    features: [
      "۶۰ روز — بیشترین مدت در میان همهٔ پلن‌ها",
      "بالاترین اولویت — بالاتر از پلاتینیوم",
      "نمایش تضمینی در صدر بخش ویژه",
      "نمایش در صفحهٔ اصلی — ردیف اول",
      "کادر آبی‌فیروزه با انیمیشن پالس",
      "نشان «الماسی» روی آگهی",
      "چرخش روزانهٔ عادلانه با سایر الماسی‌ها",
    ],
    notIncluded: [],
  },
];

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="#d1fae5" />
      <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="#fee2e2" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function BoostPlansPage() {
  return (
    <>
      <Seo
        title="پلن‌های تبلیغاتی ایرانیو"
        description="با خرید پلن تبلیغاتی، کسب‌وکارتان را در صدر فهرست ایرانیو قرار دهید. چهار پلن نقره‌ای، طلایی، پلاتینیوم و الماسی — با توکن."
      />

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg,#1a0a2e 0%,#3a0a5e 100%)",
        padding: "4rem 1.5rem 3rem",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <p style={{ color: "rgba(200,160,255,0.75)", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.08em", margin: "0 0 0.75rem" }}>
            سیستم تبلیغات ایرانیو
          </p>
          <h1 style={{ color: "#fff", fontSize: "clamp(1.8rem,5vw,2.8rem)", fontWeight: 800, margin: "0 0 1rem" }}>
            پلن‌های تبلیغاتی
          </h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "1rem", maxWidth: 560, margin: "0 auto 2rem" }}>
            کسب‌وکارتان را با توکن برجسته کنید — در صدر فهرست، در صفحهٔ اصلی، با هایلایت رنگی.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/dashboard/wallet" className="demo-btn demo-btn--accent">
              خرید پلن از داشبورد
            </Link>
            <Link to="/listings" className="demo-btn demo-btn--outline">
              مشاهدهٔ فهرست آگهی‌ها
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>

        {/* Plan cards grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "1.5rem",
          marginBottom: "4rem",
        }}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: plan.bg,
                border: `2px solid ${plan.border}`,
                borderRadius: "1rem",
                padding: "1.75rem 1.5rem",
                position: "relative",
                boxShadow: plan.popular ? `0 4px 24px rgba(109,40,217,0.18)` : plan.premium ? `0 4px 24px rgba(8,145,178,0.18)` : "0 1px 6px rgba(0,0,0,0.06)",
              }}
            >
              {plan.popular && (
                <div style={{
                  position: "absolute", top: "-13px", right: "1.25rem",
                  background: "linear-gradient(135deg,#7c3aed,#5b21b6)",
                  color: "#fff", fontSize: "0.72rem", fontWeight: 700,
                  padding: "0.2rem 0.75rem", borderRadius: "99px",
                }}>
                  محبوب‌ترین
                </div>
              )}
              {plan.premium && (
                <div style={{
                  position: "absolute", top: "-13px", right: "1.25rem",
                  background: "linear-gradient(135deg,#0891b2,#0e7490)",
                  color: "#fff", fontSize: "0.72rem", fontWeight: 700,
                  padding: "0.2rem 0.75rem", borderRadius: "99px",
                }}>
                  بالاترین رده
                </div>
              )}

              <div style={{ fontSize: "2.2rem", marginBottom: "0.6rem" }}>{plan.icon}</div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: plan.color, margin: "0 0 0.2rem" }}>
                {plan.label}
              </h2>
              <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "0 0 1.25rem" }}>
                {plan.days} روز فعال
              </p>

              <div style={{
                display: "flex", alignItems: "baseline", gap: "0.35rem",
                marginBottom: "1.5rem",
              }}>
                <span style={{ fontSize: "2rem", fontWeight: 800, color: plan.accent }}>{plan.tokens.toLocaleString("fa-IR")}</span>
                <span style={{ fontSize: "0.88rem", color: "#9ca3af" }}>توکن</span>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.25rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.86rem", color: "#374151" }}>
                    <CheckIcon />
                    {f}
                  </li>
                ))}
                {plan.notIncluded.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.83rem", color: "#9ca3af" }}>
                    <XIcon />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/dashboard/wallet"
                style={{
                  display: "block", textAlign: "center",
                  padding: "0.55rem 1rem",
                  background: plan.popular ? `linear-gradient(135deg,${plan.accent},${plan.color})` : plan.premium ? `linear-gradient(135deg,#0891b2,#0e7490)` : "transparent",
                  color: (plan.popular || plan.premium) ? "#fff" : plan.accent,
                  border: `1.5px solid ${plan.border}`,
                  borderRadius: "8px", fontWeight: 700,
                  fontSize: "0.88rem", textDecoration: "none",
                  transition: "opacity 0.15s",
                }}
              >
                انتخاب {plan.label}
              </Link>
            </div>
          ))}
        </div>

        {/* How it works */}
        <section style={{ marginBottom: "3.5rem" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "1.5rem" }}>
            چطور کار می‌کند؟
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: "1rem" }}>
            {[
              { step: "۱", title: "توکن بگیرید", desc: "با تکمیل پروفایل، آپلود عکس، افزودن ساعت کاری و ویرایش هفتگی توکن رایگان کسب کنید." },
              { step: "۲", title: "پلن انتخاب کنید", desc: "از داشبورد → کیف پول، یکی از چهار پلن را انتخاب و توکن خرج کنید." },
              { step: "۳", title: "برجسته شوید", desc: "آگهی‌تان با هایلایت رنگی و پالس انیمیشن در بخش ویژه و صفحهٔ اصلی نمایش داده می‌شود." },
              { step: "۴", title: "چرخش عادلانه", desc: "اگر چند کسب‌وکار پلن یکسانی داشته باشند، همه نمایش داده می‌شوند — ترتیب هر روز به‌صورت خودکار تغییر می‌کند." },
            ].map((item) => (
              <div key={item.step} style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: "0.75rem", padding: "1.25rem",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg,#5b21b6,#7c3aed)",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "1rem", marginBottom: "0.75rem",
                }}>
                  {item.step}
                </div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.4rem" }}>{item.title}</h3>
                <p style={{ fontSize: "0.86rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Priority ladder explanation */}
        <section style={{
          background: "linear-gradient(135deg,#f5f3ff,#ecfeff)",
          border: "1px solid #c4b5fd",
          borderRadius: "1rem",
          padding: "2rem",
          marginBottom: "3.5rem",
        }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#3b0764", margin: "0 0 1rem" }}>
            نردبان اولویت (Priority Ladder)
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#4b5563", margin: "0 0 1.5rem", lineHeight: 1.7 }}>
            اگر چند کسب‌وکار به‌طور همزمان بوست فعال داشته باشند، ترتیب نمایش آن‌ها بر اساس رده‌بندی زیر است:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {[
              { rank: 1, icon: "💠", label: "الماسی", desc: "بالاترین اولویت — همیشه بالاتر از پلاتینیوم نمایش داده می‌شود.", color: "#0891b2" },
              { rank: 2, icon: "💎", label: "پلاتینیوم", desc: "زیر الماسی — همهٔ پلاتینیوم‌ها با چرخش روزانه نمایش داده می‌شوند.", color: "#7c3aed" },
              { rank: 3, icon: "🥇", label: "طلایی", desc: "در صدر فهرست اصلی آگهی‌ها — بدون بخش ویژه.", color: "#d97706" },
              { rank: 4, icon: "🥈", label: "نقره‌ای", desc: "بالاتر از آگهی‌های بدون بوست در فهرست اصلی.", color: "#6b7280" },
            ].map((item) => (
              <div key={item.rank} style={{
                display: "flex", alignItems: "center", gap: "1rem",
                background: "#fff", borderRadius: "0.6rem",
                padding: "0.85rem 1rem",
                border: "1px solid rgba(0,0,0,0.06)",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "linear-gradient(135deg,#e2e8f0,#cbd5e1)",
                  color: "#374151", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "0.8rem", flexShrink: 0,
                }}>
                  {item.rank}
                </div>
                <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <strong style={{ color: item.color, fontSize: "0.95rem" }}>{item.label}</strong>
                  <p style={{ margin: 0, fontSize: "0.83rem", color: "#6b7280" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Token earning section */}
        <section style={{ marginBottom: "3.5rem" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", margin: "0 0 1rem" }}>
            چطور توکن کسب کنیم؟
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: "0.75rem" }}>
            {[
              { icon: "📋", title: "تکمیل پروفایل",   tokens: "+۵۰ توکن", once: true },
              { icon: "🖼",  title: "افزودن کاور",       tokens: "+۳۰ توکن", once: true },
              { icon: "🖼",  title: "هر عکس گالری",      tokens: "+۱۰ توکن", once: true, sub: "تا ۴ عکس" },
              { icon: "🕐",  title: "ساعات کاری",         tokens: "+۱۵ توکن", once: true },
              { icon: "📍",  title: "لینک Google Maps",  tokens: "+۱۰ توکن", once: true },
              { icon: "✅",  title: "تأیید مالکیت",       tokens: "+۵۰ توکن", once: true },
              { icon: "✏️",  title: "ویرایش هفتگی",      tokens: "+۱۵ توکن", sub: "حداکثر ۲ بار در هفته" },
            ].map((item) => (
              <div key={item.title + item.tokens} style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: "0.65rem", padding: "1rem",
                display: "flex", flexDirection: "column", gap: "0.35rem",
              }}>
                <span style={{ fontSize: "1.4rem" }}>{item.icon}</span>
                <strong style={{ fontSize: "0.88rem", color: "#0f172a" }}>{item.title}</strong>
                {item.sub && <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{item.sub}</span>}
                <span style={{ fontSize: "0.88rem", color: "#059669", fontWeight: 700 }}>{item.tokens}</span>
                {item.once && <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>یک‌بار</span>}
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ marginBottom: "3.5rem" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", margin: "0 0 1.25rem" }}>سوالات متداول</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {[
              {
                q: "اگر ۱۰ کسب‌وکار پلاتینیوم داشته باشند چه اتفاقی می‌افتد؟",
                a: "همهٔ ۱۰ کسب‌وکار در بخش «آگهی‌های ویژه» نمایش داده می‌شوند. ترتیب نمایش هر روز به‌صورت خودکار تغییر می‌کند تا برای همه عادلانه باشد. هیچ‌کس حذف نمی‌شود.",
              },
              {
                q: "تفاوت پلاتینیوم و الماسی چیست؟",
                a: "هر دو در بخش ویژه نمایش داده می‌شوند، اما الماسی همیشه بالاتر از پلاتینیوم قرار می‌گیرد. اگر می‌خواهید تضمین کنید که بالاتر از تمام پلاتینیوم‌ها باشید، الماسی انتخاب کنید.",
              },
              {
                q: "آیا می‌توانم در یک ماه بیشتر از یک بار بوست بگیرم؟",
                a: "در هر ماه میلادی حداکثر ۳ بار می‌توانید از سیستم بوست استفاده کنید. این محدودیت برای جلوگیری از سوءاستفاده است.",
              },
              {
                q: "توکن‌ها منقضی می‌شوند؟",
                a: "خیر. توکن‌هایی که کسب کرده‌اید منقضی نمی‌شوند و می‌توانید هر زمان که بخواهید از آن‌ها استفاده کنید.",
              },
              {
                q: "از کجا می‌توانم پلن بخرم؟",
                a: "از داشبورد کسب‌وکارتان → بخش «کیف پول و تبلیغات» می‌توانید موجودی توکن را ببینید و پلن خریداری کنید.",
              },
            ].map((item) => (
              <details key={item.q} style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: "0.75rem", padding: "1rem 1.25rem",
              }}>
                <summary style={{
                  cursor: "pointer", fontWeight: 700,
                  fontSize: "0.92rem", color: "#0f172a", listStyle: "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  {item.q}
                  <span style={{ color: "#7c3aed", fontSize: "1.1rem", marginRight: "auto", marginLeft: "0.5rem" }}>+</span>
                </summary>
                <p style={{ margin: "0.75rem 0 0", fontSize: "0.88rem", color: "#4b5563", lineHeight: 1.7 }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div style={{
          background: "linear-gradient(135deg,#1a0a2e,#3a0a5e)",
          borderRadius: "1rem", padding: "2.5rem",
          textAlign: "center", color: "#fff",
        }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 0.75rem" }}>آمادهٔ برجسته‌شدن هستید؟</h2>
          <p style={{ color: "rgba(255,255,255,0.65)", margin: "0 0 1.5rem", fontSize: "0.95rem" }}>
            وارد داشبورد شوید، توکن کسب کنید و پلن موردنظرتان را فعال کنید.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/dashboard/wallet" className="demo-btn demo-btn--accent">
              رفتن به کیف پول
            </Link>
            <Link to="/login" className="demo-btn demo-btn--outline">
              ورود به داشبورد
            </Link>
          </div>
        </div>

      </div>
    </>
  );
}
