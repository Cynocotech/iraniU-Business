import { useEffect, useRef, useState } from "react";
import { apiPost } from "../api.js";

const TURNSTILE_SITE_KEY = "0x4AAAAAADmEnAaO3lpBKumP";

const OVERLAY = {
  position: "fixed", inset: 0, zIndex: 9999,
  background: "rgba(10,2,20,0.82)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "flex-end", justifyContent: "center",
  padding: "0",
};

const MODAL = {
  width: "100%", maxWidth: "680px",
  maxHeight: "92dvh",
  background: "linear-gradient(160deg,#0d0418 0%,#1a0530 60%,#0d0418 100%)",
  borderTop: "1.5px solid rgba(160,80,255,0.3)",
  borderRadius: "18px 18px 0 0",
  display: "flex", flexDirection: "column",
  overflow: "hidden",
  fontFamily: "'Yekan Bakh',Vazirmatn,Tahoma,Arial,sans-serif",
};

const HEADER = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "1rem 1.2rem 0.75rem",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  flexShrink: 0,
};

const TITLE_WRAP = { display: "flex", alignItems: "center", gap: "0.5rem" };

const BADGE = {
  display: "inline-flex", alignItems: "center", gap: "0.3rem",
  color: "rgba(200,160,255,0.9)", fontSize: "0.75rem", fontWeight: 700,
  letterSpacing: "0.05em", textTransform: "uppercase",
  background: "rgba(100,0,140,0.22)", border: "1px solid rgba(160,80,255,0.35)",
  borderRadius: "50px", padding: "0.18rem 0.65rem",
};

const CLOSE_BTN = {
  background: "none", border: "none", cursor: "pointer",
  color: "rgba(255,255,255,0.45)", fontSize: "1.3rem", lineHeight: 1,
  padding: "0.2rem 0.4rem", borderRadius: "6px",
  transition: "color 0.15s",
};

const BODY = {
  flex: 1, overflowY: "auto", padding: "1rem 1.2rem",
  display: "flex", flexDirection: "column", gap: "0.9rem",
};

const ANSWER_BOX = {
  background: "rgba(57,0,77,0.25)",
  borderRight: "3px solid #5a0078",
  borderRadius: "10px", padding: "0.85rem 1rem",
  color: "rgba(255,255,255,0.9)", fontSize: "0.94rem", lineHeight: 1.75,
  direction: "rtl",
};

const RESULT_ITEM = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(160,80,255,0.15)",
  borderRadius: "12px", padding: "0.85rem 1rem",
  display: "flex", gap: "0.85rem", alignItems: "flex-start",
  textDecoration: "none", color: "inherit",
  transition: "border-color 0.15s, background 0.15s",
  cursor: "pointer",
};

const RESULT_IMG = {
  width: "60px", height: "60px", borderRadius: "8px",
  objectFit: "cover", flexShrink: 0,
  background: "rgba(255,255,255,0.08)",
};

const RESULT_PLACEHOLDER = {
  width: "60px", height: "60px", borderRadius: "8px",
  background: "rgba(90,0,120,0.4)", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "1.4rem", color: "rgba(255,255,255,0.7)",
};

const RESULT_INFO = { flex: 1, minWidth: 0, direction: "rtl" };

const RESULT_NAME = {
  color: "#fff", fontWeight: 700, fontSize: "0.97rem",
  margin: "0 0 0.25rem", whiteSpace: "nowrap",
  overflow: "hidden", textOverflow: "ellipsis",
};

const RESULT_META = {
  color: "rgba(200,160,255,0.65)", fontSize: "0.8rem",
  display: "flex", gap: "0.6rem", flexWrap: "wrap",
};

const RESULT_REASON = {
  color: "rgba(200,160,255,0.55)", fontSize: "0.77rem",
  fontStyle: "italic", marginTop: "0.3rem",
};

const FOOTER = {
  padding: "0.85rem 1.2rem 1rem",
  borderTop: "1px solid rgba(255,255,255,0.07)",
  flexShrink: 0,
};

const FORM_ROW = {
  display: "flex", gap: "0.5rem",
};

const INPUT = {
  flex: 1, background: "rgba(255,255,255,0.07)",
  border: "1.5px solid rgba(160,80,255,0.25)",
  borderRadius: "10px", color: "#fff",
  fontFamily: "inherit", fontSize: "0.97rem",
  padding: "0.65rem 1rem", outline: "none",
};

const SEND_BTN = {
  background: "#39004d", color: "#fff", border: "none",
  borderRadius: "10px", padding: "0.65rem 1.2rem",
  fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 700,
  cursor: "pointer", whiteSpace: "nowrap",
  transition: "background 0.15s",
};

const CAPTCHA_ROW = {
  display: "flex", alignItems: "center", gap: "0.6rem",
  marginTop: "0.65rem", flexWrap: "wrap",
};

const CAPTCHA_HINT = {
  color: "rgba(255,255,255,0.3)", fontSize: "0.75rem",
};

const EMPTY = {
  textAlign: "center", padding: "2rem 1rem",
  color: "rgba(255,255,255,0.4)", fontSize: "0.93rem", direction: "rtl",
};

const ERROR_MSG = {
  color: "#f87171", fontSize: "0.88rem", direction: "rtl", textAlign: "right",
};

const SKELETON_ITEM = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(160,80,255,0.1)",
  borderRadius: "12px", padding: "0.85rem 1rem",
  display: "flex", gap: "0.85rem", alignItems: "center",
};

const SKEL_IMG = {
  width: "60px", height: "60px", borderRadius: "8px",
  background: "rgba(255,255,255,0.08)", flexShrink: 0,
  animation: "ai-modal-shimmer 1.4s ease-in-out infinite",
};

const SKEL_LINES = { flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" };
const SKEL_LINE = {
  background: "rgba(255,255,255,0.08)", borderRadius: "4px", height: "13px",
  animation: "ai-modal-shimmer 1.4s ease-in-out infinite",
};

function Skeletons() {
  return (
    <>
      <style>{`@keyframes ai-modal-shimmer{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      {[0, 1, 2].map((i) => (
        <div key={i} style={SKELETON_ITEM}>
          <div style={SKEL_IMG} />
          <div style={SKEL_LINES}>
            <div style={{ ...SKEL_LINE, width: "65%" }} />
            <div style={{ ...SKEL_LINE, width: "40%" }} />
          </div>
        </div>
      ))}
    </>
  );
}

export default function AiSearchModal({ onClose }) {
  const [inputValue, setInputValue] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const widgetIdRef = useRef(null);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  useEffect(() => {
    if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true; s.defer = true;
      document.body.appendChild(s);
    }
  }, []);

  useEffect(() => {
    const tryRender = () => {
      if (!window.turnstile || widgetIdRef.current != null) return false;
      try {
        widgetIdRef.current = window.turnstile.render("#cf-turnstile-modal", {
          sitekey: TURNSTILE_SITE_KEY,
          size: "compact", theme: "dark", language: "fa",
          callback: (t) => setCaptchaToken(t),
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
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setResults(null);

    try {
      const data = await apiPost("/api/ai-search", { query: q, turnstileToken: captchaToken });
      setAnswer(typeof data.answer_fa === "string" ? data.answer_fa : "");
      setResults(Array.isArray(data.businesses) ? data.businesses : []);
      setTimeout(() => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
    } catch (err) {
      const code = err.code || "";
      if (code === "captcha_failed") setError("تأیید امنیتی ناموفق بود. لطفاً صبر کنید و دوباره امتحان کنید.");
      else if (code === "rate_limited") setError("تعداد جستجوهای شما زیاد است. یک دقیقه صبر کنید.");
      else setError("جستجوی هوشمند موقتاً در دسترس نیست. لطفاً دوباره امتحان کنید.");
    } finally {
      setLoading(false);
      if (widgetIdRef.current != null && window.turnstile) {
        try { window.turnstile.reset(widgetIdRef.current); } catch {}
        setCaptchaToken("");
      }
    }
  }

  const hasResults = results !== null;

  return (
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="جستجوی هوشمند">
      <div style={MODAL} dir="rtl">

        {/* Header */}
        <div style={HEADER}>
          <div style={TITLE_WRAP}>
            <span style={BADGE}>✨ هوش مصنوعی</span>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>جستجوی هوشمند ایرانیو</span>
          </div>
          <button style={CLOSE_BTN} onClick={onClose} aria-label="بستن">✕</button>
        </div>

        {/* Results body */}
        <div ref={bodyRef} style={BODY}>
          {!hasResults && !loading && !error && (
            <div style={EMPTY}>
              <p style={{ marginBottom: "0.4rem", fontSize: "1.8rem" }}>✨</p>
              <p>هر چیزی بنویسید — مثلاً «وکیل مهاجرت در لندن» یا «رستوران ایرانی منچستر»</p>
            </div>
          )}

          {loading && <Skeletons />}

          {error && !loading && <p style={ERROR_MSG}>{error}</p>}

          {!loading && hasResults && (
            <>
              {answer && <div style={ANSWER_BOX}>{answer}</div>}
              {results.length === 0 ? (
                <div style={EMPTY}>کسب‌وکاری با این مشخصات پیدا نشد. عبارت دیگری امتحان کنید.</div>
              ) : (
                results.map((b) => {
                  const cover = String(b.cover_image_url || "").trim();
                  return (
                    <a
                      key={b.slug}
                      href={`/business?slug=${encodeURIComponent(b.slug)}`}
                      style={RESULT_ITEM}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(160,80,255,0.4)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(160,80,255,0.15)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      }}
                    >
                      {cover
                        ? <img src={cover} alt="" style={RESULT_IMG} loading="lazy" />
                        : <div style={RESULT_PLACEHOLDER}>{String(b.name_fa || "?").charAt(0)}</div>
                      }
                      <div style={RESULT_INFO}>
                        <p style={RESULT_NAME}>{b.name_fa}</p>
                        <div style={RESULT_META}>
                          {b.category && <span>{b.category}</span>}
                          {b.city && <span>📍 {b.city}</span>}
                          {b.rating > 0 && <span>⭐ {Number(b.rating).toFixed(1)}</span>}
                        </div>
                        {b.reason_fa && <p style={RESULT_REASON}>{b.reason_fa}</p>}
                      </div>
                    </a>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Footer with input */}
        <div style={FOOTER}>
          <form onSubmit={handleSubmit} role="search">
            <div style={FORM_ROW}>
              <input
                ref={inputRef}
                type="text"
                style={INPUT}
                placeholder="هر چیزی بخواهید بنویسید…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={loading}
                autoComplete="off"
                dir="auto"
                onFocus={(e) => { e.target.style.borderColor = "rgba(160,80,255,0.6)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(160,80,255,0.25)"; }}
              />
              <button
                type="submit"
                style={{ ...SEND_BTN, opacity: loading || !inputValue.trim() ? 0.5 : 1, cursor: loading || !inputValue.trim() ? "default" : "pointer" }}
                disabled={loading || !inputValue.trim()}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#5a0078"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#39004d"; }}
              >
                {loading ? "…" : "جستجو"}
              </button>
            </div>
            <div style={CAPTCHA_ROW}>
              <div id="cf-turnstile-modal" />
              <span style={CAPTCHA_HINT}>تأیید امنیتی لازم است</span>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
