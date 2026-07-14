import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiPost } from "../api.js";
import ListingCard from "./ListingCard.jsx";

const TURNSTILE_SITE_KEY = "0x4AAAAAADmEnAaO3lpBKumP";

function SkeletonCard() {
  return (
    <div className="listing-card listing-card--skeleton">
      <div className="listing-card__media listing-card__skeleton-shimmer" />
      <div className="listing-card__body">
        <div className="listing-card__skeleton-line listing-card__skeleton-line--title" />
        <div className="listing-card__skeleton-line" />
        <div className="listing-card__skeleton-line listing-card__skeleton-line--short" />
      </div>
    </div>
  );
}

export default function AiSearch() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [answerFa, setAnswerFa] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const inputRef = useRef(null);
  const widgetIdRef = useRef(null);
  const turnstileContainerId = "cf-turnstile-ai-search";

  // Load Turnstile script once
  useEffect(() => {
    if (document.querySelector('script[src*="turnstile"]')) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // Render Turnstile widget
  useEffect(() => {
    const render = () => {
      if (!window.turnstile || widgetIdRef.current) return;
      try {
        widgetIdRef.current = window.turnstile.render(`#${turnstileContainerId}`, {
          sitekey: TURNSTILE_SITE_KEY,
          size: "compact",
          callback: (token) => setCaptchaToken(token),
          "error-callback": () => setCaptchaToken(""),
          "expired-callback": () => setCaptchaToken(""),
        });
      } catch {}
    };
    const id = setInterval(() => {
      if (window.turnstile) {
        clearInterval(id);
        render();
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  // Auto-trigger when navigated from homepage with ?q=...&ai=1
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const isAi = searchParams.get("ai") === "1";
    if (!isAi || !q) return;
    setQuery(q);
    // Captcha may not be ready yet; attempt without token (server skips if unconfigured)
    runSearch(q, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(q, token) {
    setLoading(true);
    setError(null);
    setResults(null);
    setAnswerFa("");
    try {
      const data = await apiPost("/api/ai-search", { query: q, turnstileToken: token });
      setAnswerFa(typeof data.answer_fa === "string" ? data.answer_fa : "");
      setResults(Array.isArray(data.businesses) ? data.businesses : []);
    } catch (e) {
      const code = e.code || "";
      if (code === "captcha_failed") {
        setError("تأیید امنیتی ناموفق بود. لطفاً صبر کنید تا تأیید امنیتی بارگذاری شود.");
      } else if (code === "rate_limited") {
        setError("تعداد جستجوهای شما زیاد است. لطفاً یک دقیقه صبر کنید.");
      } else {
        setError("جستجوی هوشمند موقتاً در دسترس نیست. لطفاً دوباره امتحان کنید.");
      }
    } finally {
      setLoading(false);
      // Reset Turnstile so user can search again
      if (widgetIdRef.current != null && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {}
        setCaptchaToken("");
      }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    runSearch(q, captchaToken);
  }

  function handleClear() {
    setResults(null);
    setAnswerFa("");
    setError(null);
    setQuery("");
    if (inputRef.current) inputRef.current.focus();
  }

  return (
    <div className="ai-search" dir="rtl">
      <style>{`
        .ai-search { margin-bottom: 2rem; }
        .ai-search-bar { background: rgba(255,255,255,0.06); border: 1.5px solid rgba(200,160,255,0.25); border-radius: 14px; padding: 1.1rem 1.2rem; display: flex; gap: 0.9rem; align-items: flex-start; }
        .ai-search-bar__icon { font-size: 1.4rem; line-height: 1; padding-top: 0.15rem; flex-shrink: 0; }
        .ai-search-bar__inner { flex: 1; min-width: 0; }
        .ai-search-bar__label { display: block; font-size: 0.8rem; font-weight: 700; color: rgba(200,160,255,0.85); letter-spacing: 0.04em; margin-bottom: 0.5rem; }
        .ai-search-bar__row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
        .ai-search-bar__input { flex: 1; min-width: 0; background: rgba(255,255,255,0.08); border: 1px solid rgba(200,160,255,0.2); border-radius: 8px; color: #fff; font-family: inherit; font-size: 0.95rem; padding: 0.55rem 0.85rem; outline: none; transition: border-color 0.15s; }
        .ai-search-bar__input:focus { border-color: rgba(200,160,255,0.6); }
        .ai-search-bar__input::placeholder { color: rgba(255,255,255,0.35); }
        .ai-search-bar__input:disabled { opacity: 0.6; }
        .ai-search-bar__btn { background: #39004d; color: #fff; border: none; border-radius: 8px; padding: 0.55rem 1.1rem; font-family: inherit; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .ai-search-bar__btn:hover:not(:disabled) { background: #55006e; }
        .ai-search-bar__btn:disabled { opacity: 0.55; cursor: default; }
        .ai-search-bar__clear { background: transparent; color: rgba(200,160,255,0.7); border: 1px solid rgba(200,160,255,0.25); border-radius: 8px; padding: 0.5rem 0.8rem; font-family: inherit; font-size: 0.85rem; cursor: pointer; }
        .ai-search-bar__clear:hover { color: #fff; border-color: rgba(200,160,255,0.5); }
        .ai-search-bar__error { margin: 0.5rem 0 0; font-size: 0.85rem; color: #f87171; }
        .ai-search-bar__captcha { margin-top: 0.75rem; }
        .ai-search-answer { background: rgba(57,0,77,0.18); border-right: 3px solid #39004d; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; color: rgba(255,255,255,0.9); font-size: 0.95rem; line-height: 1.65; }
        .ai-search-results__head { font-size: 0.82rem; color: rgba(200,160,255,0.75); margin-bottom: 0.9rem; font-weight: 600; }
        .ai-search-reason { font-size: 0.8rem; color: rgba(200,160,255,0.7); margin-top: 0.3rem; font-style: italic; }
        .ai-search-empty { padding: 2rem 1rem; text-align: center; color: rgba(255,255,255,0.5); font-size: 0.95rem; }
        @media(max-width:600px){ .ai-search-bar { flex-direction: column; } .ai-search-bar__row { flex-direction: column; } .ai-search-bar__btn { width: 100%; } }
      `}</style>

      <form className="ai-search-bar" onSubmit={handleSubmit} role="search" aria-label="جستجوی هوشمند با هوش مصنوعی">
        <div className="ai-search-bar__icon" aria-hidden="true">✨</div>
        <div className="ai-search-bar__inner">
          <label htmlFor="ai-search-input" className="ai-search-bar__label">
            جستجوی هوشمند با هوش مصنوعی
          </label>
          <div className="ai-search-bar__row">
            <input
              ref={inputRef}
              id="ai-search-input"
              type="text"
              className="ai-search-bar__input"
              placeholder="هر چیزی بخواهید بنویسید — مثلاً «وکیل مهاجرت در لندن» یا «Iranian restaurant Manchester»"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              autoComplete="off"
              dir="auto"
            />
            <button
              type="submit"
              className="ai-search-bar__btn"
              disabled={loading || !query.trim()}
            >
              {loading ? "در حال جستجو…" : "جستجو"}
            </button>
            {results !== null && (
              <button type="button" className="ai-search-bar__clear" onClick={handleClear}>
                پاک کردن
              </button>
            )}
          </div>

          <div className="ai-search-bar__captcha">
            <div id={turnstileContainerId} />
          </div>

          {error && <p className="ai-search-bar__error" role="alert">{error}</p>}
        </div>
      </form>

      {results !== null && (
        <div className="ai-search-results">
          {loading ? (
            <div className="listing-cards listing-cards--skeleton" aria-busy="true">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <>
              {answerFa && (
                <div className="ai-search-answer" role="status">
                  {answerFa}
                </div>
              )}
              {results.length === 0 ? (
                <div className="ai-search-empty">
                  <p>کسب‌وکاری یافت نشد. عبارت دیگری امتحان کنید.</p>
                </div>
              ) : (
                <>
                  <p className="ai-search-results__head">
                    <span className="ai-search-badge">✨ هوش مصنوعی</span>{" "}
                    {results.length} نتیجه برای «{query}»
                  </p>
                  <div className="listing-cards">
                    {results.map((b) => (
                      <div key={b.slug} className="listings-page__stack-item">
                        <Link
                          to={`/business?slug=${encodeURIComponent(b.slug)}`}
                          style={{ display: "block", textDecoration: "none" }}
                          tabIndex={-1}
                        >
                          <ListingCard b={b} />
                        </Link>
                        {b.reason_fa && (
                          <p className="ai-search-reason">{b.reason_fa}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
