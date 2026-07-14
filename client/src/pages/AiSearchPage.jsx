import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import ListingCard from "../components/ListingCard.jsx";
import { apiPost } from "../api.js";

const TURNSTILE_SITE_KEY = "0x4AAAAAADmEnAaO3lpBKumP";

const STYLES = `
  .ai-page {
    min-height: calc(100vh - 68px);
    background: linear-gradient(160deg, #0d0418 0%, #1a0530 55%, #0d0418 100%);
    font-family: 'Yekan Bakh', Vazirmatn, Tahoma, Arial, sans-serif;
  }

  /* ── Hero ── */
  .ai-page__hero {
    padding: 3.5rem 1.5rem 3rem;
    text-align: center;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .ai-page__beta {
    display: inline-flex; align-items: center; gap: 0.4rem;
    color: rgba(200,160,255,0.9); font-size: 0.78rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    background: rgba(100,0,140,0.22); border: 1px solid rgba(160,80,255,0.35);
    border-radius: 50px; padding: 0.25rem 0.8rem; margin-bottom: 1.1rem;
  }
  .ai-page__title {
    color: #fff; font-size: clamp(1.7rem,4vw,2.6rem); font-weight: 800;
    margin: 0 0 0.75rem; line-height: 1.2;
  }
  .ai-page__intro {
    color: rgba(255,255,255,0.55); font-size: 0.97rem; line-height: 1.7;
    max-width: 560px; margin: 0 auto 1.75rem;
  }

  /* ── Search box ── */
  .ai-page__search-wrap {
    max-width: 720px; margin: 0 auto;
    background: rgba(255,255,255,0.04);
    border: 1.5px solid rgba(160,80,255,0.22);
    border-radius: 16px; padding: 1.4rem 1.5rem;
  }
  .ai-page__row {
    display: flex; gap: 0.6rem; flex-wrap: wrap;
  }
  .ai-page__input {
    flex: 1; min-width: 0;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(160,80,255,0.25);
    border-radius: 10px; color: #fff;
    font-family: inherit; font-size: 1rem;
    padding: 0.7rem 1rem; outline: none;
    transition: border-color 0.15s;
  }
  .ai-page__input:focus { border-color: rgba(160,80,255,0.6); }
  .ai-page__input::placeholder { color: rgba(255,255,255,0.3); }
  .ai-page__input:disabled { opacity: 0.55; }
  .ai-page__btn {
    background: #39004d; color: #fff; border: none;
    border-radius: 10px; padding: 0.7rem 1.4rem;
    font-family: inherit; font-size: 0.95rem; font-weight: 700;
    cursor: pointer; transition: background 0.15s; white-space: nowrap;
  }
  .ai-page__btn:hover:not(:disabled) { background: #5a0078; }
  .ai-page__btn:disabled { opacity: 0.5; cursor: default; }
  .ai-page__captcha { margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .ai-page__captcha-hint { color: rgba(255,255,255,0.35); font-size: 0.8rem; }

  /* ── Body ── */
  .ai-page__body { max-width: 1100px; margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }

  /* Answer block */
  .ai-page__answer {
    background: rgba(57,0,77,0.22);
    border-right: 3px solid #39004d;
    border-radius: 10px; padding: 1rem 1.2rem;
    color: rgba(255,255,255,0.9); font-size: 0.97rem;
    line-height: 1.7; margin-bottom: 1.5rem;
    direction: rtl;
  }

  /* Results header */
  .ai-page__results-head {
    color: rgba(200,160,255,0.75); font-size: 0.82rem; font-weight: 700;
    letter-spacing: 0.04em; margin-bottom: 1rem;
    display: flex; align-items: center; gap: 0.5rem;
  }
  .ai-page__badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    background: rgba(100,0,140,0.22); border: 1px solid rgba(160,80,255,0.3);
    border-radius: 50px; padding: 0.18rem 0.65rem;
    color: rgba(200,160,255,0.9); font-size: 0.78rem; font-weight: 700;
  }
  .ai-page__reason {
    font-size: 0.8rem; color: rgba(200,160,255,0.65);
    font-style: italic; margin-top: 0.35rem; direction: rtl;
    padding: 0 0.25rem;
  }

  /* Skeleton */
  .ai-page__skeleton-grid { display: grid; gap: 1rem; }
  @media(min-width:600px){ .ai-page__skeleton-grid { grid-template-columns: repeat(2,1fr); } }
  @media(min-width:900px){ .ai-page__skeleton-grid { grid-template-columns: repeat(3,1fr); } }
  .ai-page__skeleton-card {
    background: rgba(255,255,255,0.04); border-radius: 12px;
    overflow: hidden; animation: ai-shimmer 1.4s ease-in-out infinite;
  }
  .ai-page__skeleton-media { height: 160px; background: rgba(255,255,255,0.07); }
  .ai-page__skeleton-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.55rem; }
  .ai-page__skeleton-line { background: rgba(255,255,255,0.07); border-radius: 4px; height: 14px; }
  .ai-page__skeleton-line--title { height: 18px; width: 70%; }
  .ai-page__skeleton-line--short { width: 45%; }
  @keyframes ai-shimmer {
    0%,100% { opacity: 1; } 50% { opacity: 0.5; }
  }

  /* Empty / error */
  .ai-page__empty, .ai-page__error {
    text-align: center; padding: 3rem 1rem;
    color: rgba(255,255,255,0.45); font-size: 0.97rem;
    direction: rtl;
  }
  .ai-page__error { color: #f87171; }

  /* Back nav */
  .ai-page__nav {
    display: flex; gap: 1rem; justify-content: center;
    flex-wrap: wrap; margin-top: 1rem;
  }
  .ai-page__nav a {
    color: rgba(255,255,255,0.45); font-size: 0.85rem;
    text-decoration: none; padding: 0.35rem 0.8rem;
    border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
    transition: color 0.15s, border-color 0.15s;
  }
  .ai-page__nav a:hover { color: #fff; border-color: rgba(255,255,255,0.28); }

  @media(max-width:600px){
    .ai-page__search-wrap { padding: 1rem; }
    .ai-page__row { flex-direction: column; }
    .ai-page__btn { width: 100%; }
  }
`;

function SkeletonGrid() {
  return (
    <div className="ai-page__skeleton-grid" aria-busy="true" aria-label="در حال بارگذاری">
      {[0, 1, 2].map((i) => (
        <div key={i} className="ai-page__skeleton-card">
          <div className="ai-page__skeleton-media" />
          <div className="ai-page__skeleton-body">
            <div className="ai-page__skeleton-line ai-page__skeleton-line--title" />
            <div className="ai-page__skeleton-line" />
            <div className="ai-page__skeleton-line ai-page__skeleton-line--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AiSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialQ = (searchParams.get("q") || "").trim();
  const [inputValue, setInputValue] = useState(initialQ);
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const widgetIdRef = useRef(null);
  const pendingAutoSearch = useRef(!!initialQ);

  // Load Turnstile script (idempotent)
  useEffect(() => {
    if (document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) return;
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }, []);

  // Render widget; auto-search once token arrives if we navigated here with ?q=
  useEffect(() => {
    const onToken = (token) => {
      setCaptchaToken(token);
      if (pendingAutoSearch.current) {
        pendingAutoSearch.current = false;
        runSearch(initialQ, token);
      }
    };

    const tryRender = () => {
      if (!window.turnstile || widgetIdRef.current != null) return false;
      try {
        widgetIdRef.current = window.turnstile.render("#cf-turnstile-ai", {
          sitekey: TURNSTILE_SITE_KEY,
          size: "compact",
          theme: "dark",
          language: "fa",
          callback: onToken,
          "error-callback": () => setCaptchaToken(""),
          "expired-callback": () => setCaptchaToken(""),
        });
      } catch {}
      return true;
    };

    if (!tryRender()) {
      const id = setInterval(() => { if (tryRender()) clearInterval(id); }, 150);
      const timeout = setTimeout(() => clearInterval(id), 8000);
      return () => { clearInterval(id); clearTimeout(timeout); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(q, token) {
    if (!q) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setResults(null);
    try {
      const data = await apiPost("/api/ai-search", { query: q, turnstileToken: token });
      setAnswer(typeof data.answer_fa === "string" ? data.answer_fa : "");
      setResults(Array.isArray(data.businesses) ? data.businesses : []);
    } catch (e) {
      const code = e.code || "";
      if (code === "captcha_failed") {
        setError("تأیید امنیتی ناموفق بود. لطفاً صبر کنید تا widget بارگذاری شود و دوباره امتحان کنید.");
      } else if (code === "rate_limited") {
        setError("تعداد جستجوهای شما زیاد است. یک دقیقه صبر کنید.");
      } else {
        setError("جستجوی هوشمند موقتاً در دسترس نیست. لطفاً دوباره امتحان کنید.");
      }
    } finally {
      setLoading(false);
      // Reset widget so user can search again
      if (widgetIdRef.current != null && window.turnstile) {
        try { window.turnstile.reset(widgetIdRef.current); } catch {}
        setCaptchaToken("");
      }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q || loading) return;
    // Push query to URL for shareability / back-button
    navigate(`/ai-search?q=${encodeURIComponent(q)}`, { replace: false });
    runSearch(q, captchaToken);
  }

  const hasResults = results !== null;

  return (
    <div className="ai-page demo-page" dir="rtl">
      <style>{STYLES}</style>

      <Seo
        title="جستجوی هوشمند"
        description="با هوش مصنوعی در میان کسب‌وکارهای ایرانی بریتانیا جستجو کنید — رستوران، وکیل، صرافی، پزشک و بیشتر."
      />

      {/* ── Hero ── */}
      <div className="ai-page__hero">
        <div className="ai-page__beta" aria-label="نسخه آزمایشی">
          ✨ نسخه آزمایشی
        </div>
        <h1 className="ai-page__title">جستجوی هوشمند ایرانیو</h1>
        <p className="ai-page__intro">
          به جای کلیدواژه، به زبان طبیعی بنویسید — مثلاً «وکیل مهاجرت در لندن» یا
          «Iranian restaurant near Manchester با پارکینگ». هوش مصنوعی بهترین گزینه‌ها
          را از میان کسب‌وکارهای ایرانی بریتانیا پیدا می‌کند.
        </p>

        <div className="ai-page__search-wrap">
          <form onSubmit={handleSubmit} role="search" aria-label="جستجوی هوشمند">
            <div className="ai-page__row">
              <input
                id="ai-search-input"
                type="text"
                className="ai-page__input"
                placeholder="هر چیزی بخواهید بنویسید…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={loading}
                autoComplete="off"
                dir="auto"
                aria-label="عبارت جستجو"
              />
              <button
                type="submit"
                className="ai-page__btn"
                disabled={loading || !inputValue.trim()}
              >
                {loading ? "در حال جستجو…" : "جستجو"}
              </button>
            </div>

            <div className="ai-page__captcha">
              <div id="cf-turnstile-ai" />
              <span className="ai-page__captcha-hint">تأیید امنیتی لازم است</span>
            </div>
          </form>
        </div>

        <nav className="ai-page__nav" aria-label="ناوبری">
          <Link to="/listings">فهرست کسب‌وکارها</Link>
          <Link to="/exchanges">صرافی‌ها</Link>
          <Link to="/">صفحه اصلی</Link>
        </nav>
      </div>

      {/* ── Results ── */}
      <div className="ai-page__body">
        {error && !loading && (
          <p className="ai-page__error" role="alert">{error}</p>
        )}

        {loading && <SkeletonGrid />}

        {!loading && hasResults && (
          <>
            {answer && (
              <div className="ai-page__answer" role="status">
                {answer}
              </div>
            )}

            {results.length === 0 ? (
              <div className="ai-page__empty">
                <p>کسب‌وکاری با این مشخصات پیدا نشد. عبارت دیگری امتحان کنید.</p>
              </div>
            ) : (
              <>
                <p className="ai-page__results-head">
                  <span className="ai-page__badge">✨ هوش مصنوعی</span>
                  {results.length} نتیجه
                </p>
                <div className="listing-cards">
                  {results.map((b) => (
                    <div key={b.slug} className="listings-page__stack-item">
                      <ListingCard b={b} />
                      {b.reason_fa && (
                        <p className="ai-page__reason">{b.reason_fa}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
