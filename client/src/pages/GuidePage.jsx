import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const SECTIONS = [
  { id: "intro",    label: "معرفی ایرانیو" },
  { id: "profile",  label: "ثبت و ویرایش آگهی" },
  { id: "tokens",   label: "سیستم توکن" },
  { id: "earn",     label: "روش‌های کسب توکن",   parent: true },
  { id: "weekly",   label: "پاداش هفتگی ویرایش", parent: true },
  { id: "boost",    label: "پلن‌های تبلیغاتی" },
  { id: "rules",    label: "قوانین فعال‌سازی",   parent: true },
  { id: "renew",    label: "تمدید (الماسی)",     parent: true },
  { id: "tools",    label: "ابزارهای پنل" },
  { id: "ai",       label: "جستجوی هوشمند" },
  { id: "security", label: "امنیت حساب" },
];

function scrollTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: y, behavior: "smooth" });
}

function Section({ id, title, icon, children }) {
  return (
    <section id={id} className="guide-section">
      <h2 className="guide-section__title">
        {icon && <span className="guide-section__icon">{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Note({ type = "info", children }) {
  const cfg = {
    info:    { bg: "#eff6ff", border: "#93c5fd", color: "#1e40af", icon: "ℹ️" },
    tip:     { bg: "#f0fdf4", border: "#86efac", color: "#166534", icon: "✅" },
    warn:    { bg: "#fffbeb", border: "#fcd34d", color: "#92400e", icon: "⚠️" },
    diamond: { bg: "#ecfeff", border: "#67e8f9", color: "#0e7490", icon: "💠" },
  };
  const s = cfg[type] || cfg.info;
  return (
    <div className="guide-note" style={{ background: s.bg, borderColor: s.border, color: s.color }}>
      <span className="guide-note__icon">{s.icon}</span>
      <span>{children}</span>
    </div>
  );
}

export default function GuidePage() {
  const [active, setActive] = useState("intro");
  const [tocOpen, setTocOpen] = useState(false);
  const observer = useRef(null);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.current.observe(el);
    });
    return () => observer.current?.disconnect();
  }, []);

  return (
    <>
      <Seo title="راهنمای کامل ایرانیو" description="راهنمای جامع ایرانیو: ثبت آگهی، کسب توکن، پلن‌های تبلیغاتی و ابزارهای پنل." />

      <style>{`
        .guide-wrap { max-width:1100px; margin:0 auto; padding:2rem 1.25rem 5rem; }
        .guide-hero { text-align:center; padding:3rem 1rem 2.5rem; }
        .guide-hero__badge { display:inline-flex; align-items:center; gap:0.4rem; background:#f3e8ff; color:#7c3aed; font-size:0.78rem; font-weight:700; padding:0.3rem 0.9rem; border-radius:99px; margin-bottom:1rem; }
        .guide-hero__title { font-size:clamp(1.7rem,4vw,2.4rem); font-weight:800; color:#0f172a; margin:0 0 0.75rem; line-height:1.3; }
        .guide-hero__sub { font-size:1rem; color:#64748b; max-width:520px; margin:0 auto 1.5rem; line-height:1.7; }
        .guide-hero__links { display:flex; flex-wrap:wrap; justify-content:center; gap:0.6rem; }
        .guide-hero__btn { display:inline-flex; align-items:center; gap:0.4rem; padding:0.55rem 1.2rem; border-radius:10px; font-size:0.88rem; font-weight:700; font-family:inherit; text-decoration:none; transition:transform 0.15s,background 0.15s; }
        .guide-hero__btn--primary { background:#73208a; color:#fff; }
        .guide-hero__btn--primary:hover { background:#5a1870; transform:translateY(-1px); }
        .guide-hero__btn--ghost { background:#f1f5f9; color:#334155; }
        .guide-hero__btn--ghost:hover { background:#e2e8f0; }

        /* Layout */
        .guide-layout { display:grid; grid-template-columns:220px 1fr; gap:2.5rem; align-items:start; }

        /* TOC */
        .guide-toc { position:sticky; top:80px; background:#fff; border:1.5px solid #e2e8f0; border-radius:14px; padding:1rem 0; }
        .guide-toc__title { font-size:0.72rem; font-weight:700; color:#94a3b8; letter-spacing:0.07em; text-transform:uppercase; padding:0 1rem 0.5rem; border-bottom:1px solid #f1f5f9; margin-bottom:0.4rem; }
        .guide-toc__item { display:flex; align-items:center; gap:0.4rem; width:100%; background:none; border:none; cursor:pointer; font-family:inherit; font-size:0.84rem; color:#475569; padding:0.4rem 1rem; text-align:right; transition:color 0.15s,background 0.15s; border-radius:0; line-height:1.4; }
        .guide-toc__item--child { padding-right:1.8rem; font-size:0.8rem; color:#64748b; }
        .guide-toc__item:hover { color:#73208a; background:#faf5ff; }
        .guide-toc__item--active { color:#73208a; font-weight:700; background:#faf5ff; border-right:3px solid #73208a; }
        .guide-toc__dot { width:5px; height:5px; border-radius:50%; background:#cbd5e1; flex-shrink:0; }
        .guide-toc__item--active .guide-toc__dot { background:#73208a; }

        /* Mobile TOC */
        .guide-toc-mobile { display:none; }
        .guide-toc-mobile__toggle { width:100%; display:flex; align-items:center; justify-content:space-between; background:#faf5ff; border:1.5px solid #e9d5ff; border-radius:10px; padding:0.7rem 1rem; font-family:inherit; font-size:0.88rem; font-weight:700; color:#73208a; cursor:pointer; margin-bottom:0.5rem; }
        .guide-toc-mobile__list { display:flex; flex-direction:column; gap:0.15rem; background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; overflow:hidden; }

        /* Sections */
        .guide-content { min-width:0; }
        .guide-section { margin-bottom:3rem; scroll-margin-top:90px; }
        .guide-section__title { font-size:1.45rem; font-weight:800; color:#0f172a; margin:0 0 1.25rem; display:flex; align-items:center; gap:0.6rem; padding-bottom:0.75rem; border-bottom:2px solid #f1f5f9; }
        .guide-section__icon { font-size:1.3rem; }
        .guide-section h3 { font-size:1.1rem; font-weight:700; color:#1e293b; margin:1.75rem 0 0.75rem; }
        .guide-section p { color:#374151; line-height:1.85; margin:0 0 1rem; font-size:0.95rem; }
        .guide-section ul, .guide-section ol { color:#374151; line-height:1.85; margin:0 0 1rem; padding-right:1.5rem; font-size:0.95rem; }
        .guide-section li { margin-bottom:0.4rem; }

        /* Note */
        .guide-note { display:flex; align-items:flex-start; gap:0.6rem; padding:0.85rem 1rem; border-radius:10px; border-right:3px solid; font-size:0.88rem; line-height:1.65; margin:1rem 0; }
        .guide-note__icon { font-size:1rem; flex-shrink:0; margin-top:0.05rem; }

        /* Table */
        .guide-table-wrap { overflow-x:auto; margin:1rem 0 1.5rem; border-radius:12px; border:1.5px solid #e2e8f0; }
        .guide-table { width:100%; border-collapse:collapse; font-size:0.88rem; }
        .guide-table th { background:#f8fafc; color:#64748b; font-weight:700; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em; padding:0.7rem 1rem; text-align:right; border-bottom:1.5px solid #e2e8f0; }
        .guide-table td { padding:0.75rem 1rem; border-bottom:1px solid #f1f5f9; color:#1e293b; vertical-align:middle; }
        .guide-table tr:last-child td { border-bottom:none; }
        .guide-table tr:hover td { background:#fafafa; }
        .guide-table .badge { display:inline-flex; align-items:center; padding:0.2rem 0.6rem; border-radius:6px; font-size:0.78rem; font-weight:700; white-space:nowrap; }
        .badge--silver   { background:#f3f4f6; color:#374151; }
        .badge--gold     { background:#fffbeb; color:#b45309; }
        .badge--platinum { background:#ede9fe; color:#5b21b6; }
        .badge--diamond  { background:#ecfeff; color:#0891b2; }
        .badge--green    { background:#dcfce7; color:#166534; }
        .badge--blue     { background:#dbeafe; color:#1e40af; }
        .badge--purple   { background:#f3e8ff; color:#7c3aed; }

        /* Plan cards grid */
        .guide-plans { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin:1rem 0 1.5rem; }
        .guide-plan { border-radius:14px; padding:1.25rem 1rem; text-align:center; border:2px solid; }
        .guide-plan__icon { font-size:2rem; margin-bottom:0.5rem; }
        .guide-plan__name { font-weight:800; font-size:1rem; margin:0 0 0.25rem; }
        .guide-plan__cost { font-size:1.5rem; font-weight:900; margin:0.4rem 0; }
        .guide-plan__meta { font-size:0.78rem; color:#64748b; margin:0; line-height:1.5; }
        .guide-plan__tag { font-size:0.72rem; font-weight:700; margin-top:0.5rem; padding:0.2rem 0.5rem; border-radius:99px; display:inline-block; }

        /* Steps */
        .guide-steps { display:flex; flex-direction:column; gap:0.75rem; margin:1rem 0; }
        .guide-step { display:flex; align-items:flex-start; gap:0.85rem; padding:0.85rem 1rem; background:#f8fafc; border-radius:10px; }
        .guide-step__num { min-width:28px; height:28px; border-radius:50%; background:#73208a; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem; flex-shrink:0; }
        .guide-step__body { flex:1; }
        .guide-step__title { font-weight:700; font-size:0.92rem; color:#0f172a; margin:0 0 0.2rem; }
        .guide-step__desc { font-size:0.85rem; color:#64748b; margin:0; line-height:1.55; }

        /* Back to top */
        .guide-back { display:inline-flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#94a3b8; text-decoration:none; margin-top:1.5rem; cursor:pointer; background:none; border:none; font-family:inherit; }
        .guide-back:hover { color:#73208a; }

        /* Responsive */
        @media(max-width:768px){
          .guide-layout { grid-template-columns:1fr; }
          .guide-toc { display:none; }
          .guide-toc-mobile { display:block; margin-bottom:1.5rem; }
          .guide-plans { grid-template-columns:1fr 1fr; }
        }
        @media(max-width:480px){
          .guide-plans { grid-template-columns:1fr; }
          .guide-hero { padding:2rem 0 1.5rem; }
        }
      `}</style>

      <div className="guide-wrap">
        {/* Hero */}
        <div className="guide-hero">
          <div className="guide-hero__badge">
            <i className="fa-solid fa-book-open" />
            راهنمای کامل
          </div>
          <h1 className="guide-hero__title">همه چیز درباره ایرانیو</h1>
          <p className="guide-hero__sub">
            از ثبت کسب‌وکار تا کسب توکن و راه‌اندازی تبلیغات — همه ابزارها را در یک نگاه بشناسید.
          </p>
          <div className="guide-hero__links">
            <Link to="/onboarding" className="guide-hero__btn guide-hero__btn--primary">
              <i className="fa-solid fa-store" /> ثبت کسب‌وکار
            </Link>
            <Link to="/dashboard/wallet" className="guide-hero__btn guide-hero__btn--ghost">
              <i className="fa-solid fa-coins" /> کیف توکن
            </Link>
            <Link to="/ai-search" className="guide-hero__btn guide-hero__btn--ghost">
              <i className="fa-solid fa-magnifying-glass-chart" /> جستجوی هوشمند
            </Link>
          </div>
        </div>

        {/* Mobile TOC */}
        <div className="guide-toc-mobile">
          <button className="guide-toc-mobile__toggle" onClick={() => setTocOpen((v) => !v)}>
            <span><i className="fa-solid fa-list" style={{ marginInlineEnd: "0.5rem" }} />فهرست مطالب</span>
            <i className={`fa-solid fa-chevron-${tocOpen ? "up" : "down"}`} />
          </button>
          {tocOpen && (
            <div className="guide-toc-mobile__list">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  className={`guide-toc__item${s.parent ? " guide-toc__item--child" : ""}${active === s.id ? " guide-toc__item--active" : ""}`}
                  onClick={() => { scrollTo(s.id); setTocOpen(false); }}
                >
                  <span className="guide-toc__dot" />
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="guide-layout">
          {/* Desktop TOC */}
          <nav className="guide-toc" aria-label="فهرست مطالب">
            <p className="guide-toc__title">فهرست مطالب</p>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`guide-toc__item${s.parent ? " guide-toc__item--child" : ""}${active === s.id ? " guide-toc__item--active" : ""}`}
                onClick={() => scrollTo(s.id)}
              >
                <span className="guide-toc__dot" />
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="guide-content">

            {/* ─── 1. intro ─── */}
            <Section id="intro" title="معرفی ایرانیو" icon="🏠">
              <p>
                <strong>ایرانیو</strong> فهرست جامع کسب‌وکارهای ایرانی در بریتانیاست. کسب‌وکارها می‌توانند آگهی رایگان ثبت کنند،
                پروفایل کامل با تصویر، ساعات کاری و لینک‌ها داشته باشند و با جمع‌آوری توکن، جایگاه خود را در نتایج جستجو ارتقاء دهند.
              </p>
              <p>
                کاربران ایرانی ساکن بریتانیا می‌توانند از طریق <strong>جستجوی هوشمند</strong> یا فهرست دسته‌بندی‌شده، کسب‌وکار موردنظرشان را
                به فارسی پیدا کنند — از رستوران و آرایشگاه تا وکیل، پزشک و صرافی.
              </p>
              <Note type="tip">
                ثبت و مدیریت آگهی کاملاً رایگان است. سیستم توکن تنها برای کسانی است که می‌خواهند در صدر نتایج نمایش داده شوند.
              </Note>
            </Section>

            {/* ─── 2. profile ─── */}
            <Section id="profile" title="ثبت و ویرایش آگهی" icon="📝">
              <h3>ثبت کسب‌وکار جدید</h3>
              <div className="guide-steps">
                {[
                  { t: "ثبت‌نام", d: "از صفحه ثبت‌نام یک حساب مدیریت برای کسب‌وکارتان بسازید." },
                  { t: "ورود به پنل", d: "با ایمیل و رمز عبور وارد داشبورد شوید." },
                  { t: "تکمیل پروفایل", d: "نام، دسته‌بندی، آدرس، تلفن و توضیحات را وارد کنید." },
                  { t: "افزودن تصاویر", d: "لوگو، عکس کاور و گالری (تا ۴ تصویر) اضافه کنید." },
                  { t: "تأیید مالکیت", d: "آگهی پس از بررسی ادمین تأیید می‌شود و کیف توکن فعال می‌گردد." },
                ].map((s, i) => (
                  <div className="guide-step" key={i}>
                    <div className="guide-step__num">{i + 1}</div>
                    <div className="guide-step__body">
                      <p className="guide-step__title">{s.t}</p>
                      <p className="guide-step__desc">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h3>فیلدهای مهم پروفایل</h3>
              <ul>
                <li><strong>نام فارسی و انگلیسی</strong> — در جستجو و نتایج نمایش داده می‌شود</li>
                <li><strong>دسته‌بندی</strong> — برای فیلتر کردن کاربران ضروری است</li>
                <li><strong>آدرس و شهر</strong> — به‌ویژه در جستجوی محله‌ای مهم است</li>
                <li><strong>ساعات کاری</strong> — روز‌به‌روز قابل تنظیم است</li>
                <li><strong>لینک Google Maps</strong> — مستقیم از صفحه کسب‌وکار Google بگیرید</li>
                <li><strong>لوگو و کاور</strong> — اولین چیزی است که کاربر می‌بیند</li>
              </ul>
              <Note type="info">
                هر بار که پروفایل را ذخیره کنید، سیستم شرایط کسب توکن را به‌صورت خودکار بررسی می‌کند. نیازی به اقدام جداگانه نیست.
              </Note>
            </Section>

            {/* ─── 3. tokens ─── */}
            <Section id="tokens" title="سیستم توکن" icon="🪙">
              <p>
                توکن واحد پاداش ایرانیو است. با تکمیل پروفایل و ویرایش منظم کسب‌وکارتان توکن جمع می‌کنید،
                سپس توکن‌ها را برای فعال‌سازی <strong>پلن‌های تبلیغاتی</strong> هزینه می‌کنید تا آگهی‌تان در صدر نتایج نمایش داده شود.
              </p>
              <Note type="info">
                موجودی توکن، تاریخچه تراکنش‌ها و وضعیت میلستون‌ها را در <Link to="/dashboard/wallet">کیف توکن</Link> ببینید.
              </Note>

              {/* ─── 3.1 earn ─── */}
              <h3 id="earn" style={{ scrollMarginTop: 90 }}>روش‌های کسب توکن</h3>
              <p>
                هر میلستون پس از کسب، یک دوره انتظار (cooldown) دارد. پس از گذشت این مدت، شرط همچنان باید برقرار باشد تا توکن دوباره
                اعطا شود — مثلاً اگر عکس گالری را پاک کرده باشید، توکن آن دوباره داده نمی‌شود.
              </p>
              <div className="guide-table-wrap">
                <table className="guide-table">
                  <thead>
                    <tr>
                      <th>میلستون</th>
                      <th>پاداش</th>
                      <th>دوره تکرار</th>
                      <th>شرط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "تکمیل پروفایل", reward: "۵۰", cd: "هر ۳۰ روز", cond: "نام، توضیحات، شهر، تلفن، آدرس و دسته همه پر باشند" },
                      { name: "تصویر کاور",     reward: "۳۰", cd: "هر ۳۰ روز", cond: "عکس کاور آپلود شده باشد" },
                      { name: "عکس گالری اول",  reward: "۱۰", cd: "هر ۱۴ روز", cond: "اولین اسلات گالری پر باشد" },
                      { name: "عکس گالری دوم",  reward: "۱۰", cd: "هر ۱۴ روز", cond: "دومین اسلات گالری پر باشد" },
                      { name: "عکس گالری سوم",  reward: "۱۰", cd: "هر ۱۴ روز", cond: "سومین اسلات گالری پر باشد" },
                      { name: "عکس گالری چهارم",reward: "۱۰", cd: "هر ۱۴ روز", cond: "چهارمین اسلات گالری پر باشد" },
                      { name: "ساعات کاری",     reward: "۱۵", cd: "هر ۱۴ روز", cond: "حداقل یک روز ساعت کاری وارد شده باشد" },
                      { name: "لینک Google Maps",reward: "۱۰", cd: "هر ۱۴ روز", cond: "آدرس maps.google.com واقعی کسب‌وکار وارد شده باشد" },
                      { name: "تأیید مالکیت",   reward: "۵۰", cd: "هر ۳۰ روز", cond: "کسب‌وکار توسط ادمین تأیید شده باشد" },
                    ].map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.name}</strong></td>
                        <td><span className="badge badge--purple">+{r.reward} توکن</span></td>
                        <td><span className="badge badge--blue">{r.cd}</span></td>
                        <td style={{ fontSize: "0.82rem", color: "#64748b" }}>{r.cond}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Note type="tip">
                یک کسب‌وکار تازه می‌تواند در اولین روز <strong>تا ۱۹۵ توکن</strong> به‌علاوه تا ۳۰ توکن از ویرایش‌های هفتگی جمع کند.
                محدودیت زمانی تنها برای دریافت مجدد اعمال می‌شود.
              </Note>

              {/* ─── 3.2 weekly ─── */}
              <h3 id="weekly" style={{ scrollMarginTop: 90 }}>پاداش هفتگی ویرایش پروفایل</h3>
              <p>
                هر بار که اطلاعات پروفایل را ذخیره کنید، سیستم یک پاداش <strong>۱۵ توکنی</strong> به‌عنوان تشویق برای به‌روزنگه‌داشتن
                اطلاعات می‌دهد.
              </p>
              <ul>
                <li>حداکثر <strong>۲ بار در هر ۷ روز</strong> قابل دریافت است (پنجره چرخشی، نه تقویمی)</li>
                <li>سیستم دو ذخیره آخر در ۷ روز گذشته را می‌بیند؛ اگر ۲ بار رسیده باشد، دریافت بعدی منوط است به آزادشدن قدیمی‌ترین رکورد</li>
                <li>این پاداش مستقل از سایر میلستون‌هاست و cooldown جداگانه دارد</li>
              </ul>
              <Note type="warn">
                ذخیره مکرر در یک روز فقط یک یا دو بار حساب می‌شود. ذخیره‌های اضافی توکن اضافی نمی‌دهند.
              </Note>
            </Section>

            {/* ─── 4. boost ─── */}
            <Section id="boost" title="پلن‌های تبلیغاتی" icon="🚀">
              <p>
                با خرج توکن، آگهی‌تان را در صدر نتایج جستجو و فهرست کسب‌وکارها قرار دهید.
                چهار پلن با سطوح مختلف دیده‌شدن و مدت تبلیغ وجود دارد.
              </p>

              {/* ─── 4.1 plans ─── */}
              <h3 id="plans" style={{ scrollMarginTop: 90 }}>انواع پلن</h3>
              <div className="guide-plans">
                {[
                  { id: "silver",   icon: "🥈", name: "نقره‌ای",   cost: "۱۰۰", dur: "۷ روز",  cd: "۱۴ روز", b: "#f3f4f6", br: "#d1d5db", c: "#374151", tc: "badge--silver",   gap: "7 روز بدون تبلیغ" },
                  { id: "gold",     icon: "🥇", name: "طلایی",     cost: "۲۰۰", dur: "۱۴ روز", cd: "۲۸ روز", b: "#fffbeb", br: "#fcd34d", c: "#b45309", tc: "badge--gold",     gap: "14 روز بدون تبلیغ" },
                  { id: "platinum", icon: "💎", name: "پلاتینیوم", cost: "۴۵۰", dur: "۳۰ روز", cd: "۴۲ روز", b: "#ede9fe", br: "#a78bfa", c: "#5b21b6", tc: "badge--platinum", gap: "12 روز بدون تبلیغ" },
                  { id: "diamond",  icon: "💠", name: "الماسی",    cost: "۸۰۰", dur: "۶۰ روز", cd: "۵۶ روز", b: "#ecfeff", br: "#67e8f9", c: "#0891b2", tc: "badge--diamond",  gap: "✓ تمدید پیوسته" },
                ].map((p) => (
                  <div key={p.id} className="guide-plan" style={{ background: p.b, borderColor: p.br }}>
                    <div className="guide-plan__icon">{p.icon}</div>
                    <p className="guide-plan__name" style={{ color: p.c }}>{p.name}</p>
                    <p className="guide-plan__cost" style={{ color: p.c }}>{p.cost}</p>
                    <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0 }}>توکن</p>
                    <p className="guide-plan__meta">{p.dur} تبلیغ</p>
                    <p className="guide-plan__meta">انتظار: {p.cd}</p>
                    <span className={`guide-plan__tag badge ${p.tc}`}>{p.gap}</span>
                  </div>
                ))}
              </div>

              <div className="guide-table-wrap">
                <table className="guide-table">
                  <thead>
                    <tr>
                      <th>پلن</th>
                      <th>هزینه توکن</th>
                      <th>مدت تبلیغ</th>
                      <th>انتظار تا فعال‌سازی مجدد</th>
                      <th>فاصله طبیعی</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="badge badge--silver">🥈 نقره‌ای</span></td>
                      <td>۱۰۰</td><td>۷ روز</td><td>۱۴ روز از فعال‌سازی</td>
                      <td style={{ color: "#64748b" }}>۷ روز بدون تبلیغ بین هر دوره</td>
                    </tr>
                    <tr>
                      <td><span className="badge badge--gold">🥇 طلایی</span></td>
                      <td>۲۰۰</td><td>۱۴ روز</td><td>۲۸ روز از فعال‌سازی</td>
                      <td style={{ color: "#64748b" }}>۱۴ روز بدون تبلیغ بین هر دوره</td>
                    </tr>
                    <tr>
                      <td><span className="badge badge--platinum">💎 پلاتینیوم</span></td>
                      <td>۴۵۰</td><td>۳۰ روز</td><td>۴۲ روز از فعال‌سازی</td>
                      <td style={{ color: "#64748b" }}>۱۲ روز بدون تبلیغ بین هر دوره</td>
                    </tr>
                    <tr>
                      <td><span className="badge badge--diamond">💠 الماسی</span></td>
                      <td>۸۰۰</td><td>۶۰ روز</td><td>۵۶ روز از فعال‌سازی</td>
                      <td style={{ color: "#0891b2", fontWeight: 700 }}>تمدید بدون وقفه ممکن است</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ─── 4.2 rules ─── */}
              <h3 id="rules" style={{ scrollMarginTop: 90 }}>قوانین فعال‌سازی</h3>
              <ul>
                <li><strong>فقط یک تبلیغ در هر لحظه:</strong> اگر پلنی فعال است، پلن دیگری را نمی‌توان فعال کرد مگر بعد از پایان آن.</li>
                <li><strong>دوره انتظار per-plan:</strong> هر پلن زمان انتظار مخصوص خود را دارد که از لحظه فعال‌سازی (نه پایان) حساب می‌شود.</li>
                <li><strong>موجودی کافی:</strong> قبل از فعال‌سازی، موجودی کیف توکن باید کافی باشد.</li>
              </ul>
              <Note type="warn">
                دوره انتظار از لحظه <strong>فعال‌سازی</strong> حساب می‌شود، نه از لحظه پایان تبلیغ. بنابراین اگر Silver را امروز فعال کنید، بعد از ۱۴ روز می‌توانید دوباره Silver بگیرید — حتی اگر Silver تا روز ۷ فعال بود.
              </Note>

              {/* ─── 4.3 renew ─── */}
              <h3 id="renew" style={{ scrollMarginTop: 90 }}>تمدید پیوسته — ویژه الماسی</h3>
              <Note type="diamond">
                پلن الماسی ۶۰ روز تبلیغ دارد اما دوره انتظارش تنها ۵۶ روز است. یعنی ۴ روز <em>قبل از پایان</em> می‌توانید تمدید کنید.
                تمدید اعمال‌شده، تاریخ انقضا را از همان انقضای قبلی ۶۰ روز جلو می‌برد — <strong>بدون هیچ روز خالی</strong>.
              </Note>
              <p>
                با این ویژگی، صاحبان کسب‌وکار الماسی می‌توانند تبلیغ پیوسته داشته باشند و هرگز از صدر نتایج خارج نشوند.
                برای سایر پلن‌ها این قانون هم اعمال می‌شود اما به دلیل اینکه دوره انتظار بیشتر از مدت تبلیغ است، همیشه فاصله‌ای بین دوره‌ها وجود دارد.
              </p>
            </Section>

            {/* ─── 5. tools ─── */}
            <Section id="tools" title="ابزارهای پنل" icon="🛠️">
              <p>
                داشبورد ایرانیو ابزارهای متعددی فراتر از ویرایش آگهی دارد که در منوی کناری در دسترس هستند.
              </p>

              <h3 id="biolink" style={{ scrollMarginTop: 90 }}>
                <i className="fa-solid fa-link" style={{ marginInlineEnd: "0.5rem", color: "#73208a" }} />
                لینک‌های من (Biolink)
              </h3>
              <p>
                یک صفحه شخصی با آدرس <code>/l/نامک‌شما</code> که می‌توانید لینک‌های مهم کسب‌وکارتان را در آن قرار دهید:
                سایت، اینستاگرام، واتساپ، تلگرام، ایمیل و لینک رزرو. این صفحه قابل اشتراک‌گذاری در شبکه‌های اجتماعی است.
              </p>

              <h3 id="qr" style={{ scrollMarginTop: 90 }}>
                <i className="fa-solid fa-qrcode" style={{ marginInlineEnd: "0.5rem", color: "#73208a" }} />
                QR کد نظر Google
              </h3>
              <p>
                یک QR کد آماده برای دریافت نظر مشتریان در Google. می‌توانید آن را پرینت گرفته و روی میز یا پیشخوان قرار دهید.
                با اسکن کردن، مشتری مستقیم به صفحه ثبت نظر Google کسب‌وکار شما می‌رود.
              </p>

              <h3 id="media" style={{ scrollMarginTop: 90 }}>
                <i className="fa-solid fa-images" style={{ marginInlineEnd: "0.5rem", color: "#73208a" }} />
                تصاویر و گالری
              </h3>
              <p>
                از بخش «تصاویر» می‌توانید لوگو، عکس کاور و تا ۴ عکس گالری آپلود کنید. هر عکس گالری یک میلستون توکن جداگانه دارد.
                فرمت‌های JPG، PNG و WebP پشتیبانی می‌شوند.
              </p>

              <h3>
                <i className="fa-solid fa-clock" style={{ marginInlineEnd: "0.5rem", color: "#73208a" }} />
                ساعات کاری
              </h3>
              <p>
                ساعت بازبودن کسب‌وکار را برای هر روز هفته به‌صورت جداگانه وارد کنید. این اطلاعات روی صفحه عمومی آگهی نمایش داده می‌شود
                و در کارت‌های نتایج جستجو هم باز/بسته بودن را نشان می‌دهد.
              </p>

              <h3>
                <i className="fa-solid fa-briefcase" style={{ marginInlineEnd: "0.5rem", color: "#73208a" }} />
                فرصت‌های شغلی
              </h3>
              <p>
                کسب‌وکارها می‌توانند آگهی‌های استخدامی اضافه کنند. این آگهی‌ها در جستجوی «دنبال کار» کاربران نمایش داده می‌شوند.
              </p>
            </Section>

            {/* ─── 6. ai ─── */}
            <Section id="ai" title="جستجوی هوشمند" icon="🤖">
              <p>
                جستجوی هوشمند ایرانیو از هوش مصنوعی برای درک جستجوی فارسی استفاده می‌کند. لازم نیست دقیقاً نام کسب‌وکار را بنویسید؛
                می‌توانید به فارسی توصیف کنید چه می‌خواهید.
              </p>
              <h3>نمونه جستجوها</h3>
              <ul>
                <li>«وکیل مهاجرت در لندن» — همه وکلای مهاجرت را پیدا می‌کند</li>
                <li>«صرافی با بهترین نرخ» — صرافی‌ها را اولویت‌بندی می‌کند</li>
                <li>«رستوران ایرانی در بارنت» — با نام فارسی محله کار می‌کند</li>
                <li>«دنبال کار در لندن هستم» — فرصت‌های شغلی را نشان می‌دهد</li>
                <li>«آرایشگاه در ایلینگ» — محله‌های لندن به فارسی درک می‌شوند</li>
              </ul>
              <Note type="tip">
                جستجو با نام مستقیم کسب‌وکار هم کار می‌کند — برای مثال «ایرانیو-۱» دقیقاً همان آگهی را پیدا می‌کند.
              </Note>
              <p>
                آگهی‌های دارای <strong>پلن تبلیغاتی فعال</strong> در بالای نتایج جستجو نشان داده می‌شوند.
              </p>
            </Section>

            {/* ─── 7. security ─── */}
            <Section id="security" title="امنیت حساب" icon="🔐">
              <h3>ورود دو مرحله‌ای (2FA)</h3>
              <p>
                برای محافظت از حساب مدیریت، می‌توانید ورود دو مرحله‌ای را با <strong>Google Authenticator</strong> فعال کنید.
                پس از فعال‌سازی، در هر ورود علاوه بر رمز عبور، یک کد ۶ رقمی هم خواسته می‌شود.
              </p>
              <div className="guide-steps">
                {[
                  { t: "دانلود Google Authenticator", d: "از App Store یا Google Play نصب کنید." },
                  { t: "رفتن به تنظیمات امنیتی", d: "در داشبورد، از منوی کاربری گزینه «تنظیمات امنیتی» را انتخاب کنید." },
                  { t: "اسکن QR یا وارد کردن کد", d: "QR نمایش‌داده‌شده را اسکن کنید یا کد متنی را در اپ وارد کنید." },
                  { t: "تأیید با کد ۶ رقمی", d: "کد فعلی اپ را وارد کنید تا 2FA فعال شود." },
                ].map((s, i) => (
                  <div className="guide-step" key={i}>
                    <div className="guide-step__num">{i + 1}</div>
                    <div className="guide-step__body">
                      <p className="guide-step__title">{s.t}</p>
                      <p className="guide-step__desc">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h3>نکات امنیتی</h3>
              <ul>
                <li>رمز عبور را با کسی به اشتراک نگذارید</li>
                <li>حتماً 2FA را فعال کنید — خصوصاً اگر اطلاعات تماس کسب‌وکار مهم است</li>
                <li>اگر رمز را فراموش کردید از صفحه «فراموشی رمز» استفاده کنید</li>
                <li>پس از هر بار ویرایش مهم، از ذخیره‌شدن صحیح اطمینان حاصل کنید</li>
              </ul>
              <Note type="warn">
                دسترسی ادمین سایت هرگز رمز عبور شما را از طریق ایمیل یا پیام نمی‌خواهد. درخواست‌های مشکوک را نادیده بگیرید.
              </Note>
            </Section>

            {/* Bottom links */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem", paddingTop: "1.5rem", borderTop: "2px solid #f1f5f9" }}>
              <Link to="/dashboard" className="guide-hero__btn guide-hero__btn--primary">
                <i className="fa-solid fa-gauge" /> رفتن به داشبورد
              </Link>
              <Link to="/dashboard/wallet" className="guide-hero__btn guide-hero__btn--ghost">
                <i className="fa-solid fa-coins" /> کیف توکن
              </Link>
              <Link to="/boost-plans" className="guide-hero__btn guide-hero__btn--ghost">
                <i className="fa-solid fa-rocket" /> پلن‌های تبلیغاتی
              </Link>
              <Link to="/ai-search" className="guide-hero__btn guide-hero__btn--ghost">
                <i className="fa-solid fa-magnifying-glass-chart" /> جستجوی هوشمند
              </Link>
            </div>

            <button className="guide-back" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <i className="fa-solid fa-arrow-up" /> بازگشت به بالا
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
