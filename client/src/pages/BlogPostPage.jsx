import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiGet } from "../api.js";
import { getSiteUrl } from "../lib/siteUrl.js";

const S = `
.bpp-hero {
  position: relative;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  background: linear-gradient(135deg, #0f0520 0%, #2a0845 50%, #1a0a2e 100%);
}
.bpp-hero__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.22;
  filter: blur(2px);
  transform: scale(1.04);
}
.bpp-hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(10,3,28,0.97) 0%,
    rgba(15,5,32,0.75) 45%,
    rgba(20,8,40,0.35) 100%
  );
}
.bpp-hero__inner {
  position: relative;
  z-index: 2;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
  padding: 5rem 2rem 2.5rem;
}
.bpp-hero__back {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 1.75rem;
  transition: color 0.18s;
  letter-spacing: 0.01em;
}
.bpp-hero__back:hover { color: #d8b4fe; }
.bpp-hero__back i { font-size: 0.75rem; }
.bpp-hero__badges {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.1rem;
  flex-wrap: wrap;
}
.bpp-hero__cat {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.9rem;
  border-radius: 20px;
  background: rgba(167,139,250,0.18);
  border: 1px solid rgba(167,139,250,0.35);
  color: #d8b4fe;
  font-size: 0.78rem;
  font-weight: 700;
  backdrop-filter: blur(6px);
}
.bpp-hero__cat i { font-size: 0.7rem; }
.bpp-hero__title {
  font-size: clamp(1.55rem, 4vw, 2.4rem);
  font-weight: 900;
  color: #fff;
  line-height: 1.45;
  margin: 0 0 1rem;
  text-shadow: 0 2px 20px rgba(0,0,0,0.4);
}
.bpp-hero__excerpt {
  font-size: 1rem;
  color: rgba(255,255,255,0.65);
  line-height: 1.75;
  margin: 0 0 1.75rem;
  max-width: 680px;
}
.bpp-hero__meta {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
  border-top: 1px solid rgba(255,255,255,0.1);
  padding-top: 1.25rem;
}
.bpp-hero__meta-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.55);
  padding-left: 1.25rem;
  margin-left: 1.25rem;
  border-left: 1px solid rgba(255,255,255,0.12);
}
.bpp-hero__meta-item:last-child {
  border-left: none;
  margin-left: 0;
  padding-left: 0;
}
.bpp-hero__meta-item i { color: #a78bfa; font-size: 0.75rem; }

/* Content */
.bpp-content {
  max-width: 860px;
  margin: 0 auto;
  padding: 0 2rem;
}
.bpp-body-wrap {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.08);
  padding: 2.5rem;
  margin-top: -2.5rem;
  position: relative;
  z-index: 3;
}
.bpp-body {
  font-size: 1rem;
  line-height: 2.05;
  color: #1e293b;
}
/* Visible text preview */
.bpp-body-visible {
  font-size: 1rem;
  line-height: 2;
  color: #1e293b;
  margin-bottom: 1rem;
}
/* Blur stack */
.bpp-blur-stack {
  position: relative;
}
.bpp-body-blur-wrap {
  position: relative;
  max-height: 120px;
  overflow: hidden;
}
.bpp-body-blur {
  font-size: 0.95rem;
  line-height: 1.9;
  color: #1e293b;
  filter: blur(5px);
  user-select: none;
  pointer-events: none;
}
.bpp-blur-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to bottom, transparent, #fff);
  pointer-events: none;
}
/* CTA overlay */
.bpp-cta-head {
  background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
  border: 1.5px solid #d8b4fe;
  border-radius: 16px;
  padding: 1.75rem 1.5rem;
  text-align: center;
  margin-bottom: 0.75rem;
}
.bpp-cta-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #4c1d95;
  margin: 0 0 0.4rem;
}
.bpp-cta-sub {
  font-size: 0.85rem;
  color: #6d28d9;
  margin: 0 0 1.25rem;
}
.bpp-store-btns {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.bpp-store-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  font-family: inherit;
  text-decoration: none;
  transition: opacity 0.15s;
}
.bpp-store-btn:hover { opacity: 0.85; }
.bpp-store-btn--apple { background: #000; color: #fff; }
.bpp-store-btn--google { background: #4285f4; color: #fff; }
.bpp-store-btn--chat { background: #73208a; color: #fff; }
.bpp-qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.bpp-qr-wrap img {
  border-radius: 10px;
  border: 1.5px solid #d8b4fe;
}
.bpp-qr-wrap p {
  font-size: 0.78rem;
  color: #6d28d9;
  margin: 0;
}
@media (max-width: 520px) {
  .bpp-store-btns { flex-direction: column; align-items: stretch; }
  .bpp-store-btn { justify-content: center; }
}
.bpp-body h2 {
  font-size: 1.3rem;
  font-weight: 800;
  color: #1a0a2e;
  margin: 2.25rem 0 0.8rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #f3e8ff;
}
.bpp-body h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #3a0a5e;
  margin: 1.75rem 0 0.5rem;
}
.bpp-body p { margin: 0 0 1.1rem; }
.bpp-body ul, .bpp-body ol {
  padding-right: 1.75rem;
  margin: 0 0 1.25rem;
}
.bpp-body li { margin-bottom: 0.5rem; }
.bpp-body strong { color: #4c1d95; }
.bpp-body a { color: #7c3aed; text-decoration: underline; }

/* Tags */
.bpp-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 2.25rem;
  padding-top: 1.75rem;
  border-top: 1.5px solid #f3e8ff;
}
.bpp-tags__label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #94a3b8;
  white-space: nowrap;
}
.bpp-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.8rem;
  border-radius: 20px;
  background: #faf5ff;
  border: 1.5px solid #e9d5ff;
  color: #7c3aed;
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}
.bpp-tag:hover {
  background: #f3e8ff;
  border-color: #c4b5fd;
}
.bpp-tag i { font-size: 0.65rem; color: #a78bfa; }

/* Share strip */
.bpp-share {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 2rem;
  padding: 1.25rem 1.5rem;
  background: #faf5ff;
  border-radius: 14px;
  border: 1.5px solid #e9d5ff;
  flex-wrap: wrap;
}
.bpp-share__label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #64748b;
  margin-left: auto;
}
.bpp-share__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  border-radius: 10px;
  border: 1.5px solid #e9d5ff;
  background: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  color: #475569;
  transition: all 0.15s;
  text-decoration: none;
}
.bpp-share__btn:hover { border-color: #a78bfa; color: #7c3aed; background: #f5f3ff; }
.bpp-share__btn i { font-size: 0.85rem; }

/* Related */
.bpp-related {
  max-width: 860px;
  margin: 2.5rem auto 0;
  padding: 0 2rem 3rem;
}
.bpp-related__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.bpp-related__head h3 {
  font-size: 1.1rem;
  font-weight: 800;
  color: #1a0a2e;
  margin: 0;
}
.bpp-related__line {
  flex: 1;
  height: 2px;
  background: linear-gradient(to left, transparent, #e9d5ff);
  border-radius: 999px;
}
.bpp-related__icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 0.75rem;
  flex-shrink: 0;
}
.bpp-related__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}
@media (max-width: 700px) {
  .bpp-related__grid { grid-template-columns: 1fr 1fr; }
  .bpp-hero__inner { padding: 4rem 1.25rem 2rem; }
  .bpp-body-wrap { padding: 1.5rem 1.25rem; margin-top: -1.5rem; }
  .bpp-content { padding: 0 1rem; }
  .bpp-related { padding: 0 1rem 2.5rem; }
  .bpp-hero__meta-item { font-size: 0.73rem; padding-left: 0.9rem; margin-left: 0.9rem; }
}
@media (max-width: 460px) {
  .bpp-related__grid { grid-template-columns: 1fr; }
}
`;

function persianDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function parseTags(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setPost(null);

    Promise.all([
      apiGet(`/api/blog/${encodeURIComponent(slug)}`),
      apiGet("/api/blog"),
    ])
      .then(([postData, allData]) => {
        if (!cancelled) {
          setPost(postData);
          setAllPosts(Array.isArray(allData) ? allData : allData?.posts ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || "خطا در بارگذاری مطلب");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);

  const related = post
    ? allPosts
        .filter((p) => p.slug !== post.slug && p.category === post.category && p.is_published !== false)
        .slice(0, 3)
    : [];

  const tags = parseTags(post?.tags);
  const site = getSiteUrl();

  // ── SEO helpers ──────────────────────────────────────────────
  const keywords = post
    ? [post.category, ...tags].filter(Boolean).join(", ")
    : undefined;

  const canonicalUrl = post && site ? `${site}/blog/${post.slug}` : undefined;

  const jsonLd = post
    ? [
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title_fa,
          description: post.excerpt_fa || undefined,
          ...(post.cover_image_url ? { image: [post.cover_image_url] } : {}),
          ...(canonicalUrl ? { url: canonicalUrl, mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl } } : {}),
          datePublished: post.published_at ? new Date(post.published_at).toISOString() : undefined,
          dateModified: post.updated_at
            ? new Date(post.updated_at).toISOString()
            : post.published_at
            ? new Date(post.published_at).toISOString()
            : undefined,
          author: {
            "@type": "Organization",
            name: post.author || "تیم ایرانیو",
            ...(site ? { url: site } : {}),
          },
          publisher: {
            "@type": "Organization",
            name: "ایرانیو",
            ...(site ? { url: site } : {}),
            logo: {
              "@type": "ImageObject",
              url: site ? `${site}/images/iraniu-logo-header.png` : "/images/iraniu-logo-header.png",
            },
          },
          ...(post.category ? { articleSection: post.category } : {}),
          ...(tags.length ? { keywords: tags.join(", ") } : {}),
          inLanguage: "fa",
          isPartOf: {
            "@type": "Blog",
            name: "وبلاگ ایرانیو",
            ...(site ? { url: `${site}/blog` } : {}),
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "خانه", ...(site ? { item: site } : {}) },
            { "@type": "ListItem", position: 2, name: "وبلاگ", ...(site ? { item: `${site}/blog` } : {}) },
            { "@type": "ListItem", position: 3, name: post.title_fa, ...(canonicalUrl ? { item: canonicalUrl } : {}) },
          ],
        },
      ]
    : undefined;

  const articleMeta = post
    ? {
        publishedTime: post.published_at ? new Date(post.published_at).toISOString() : undefined,
        modifiedTime: post.updated_at
          ? new Date(post.updated_at).toISOString()
          : post.published_at
          ? new Date(post.published_at).toISOString()
          : undefined,
        author: post.author || "تیم ایرانیو",
        section: post.category || undefined,
        tags,
      }
    : undefined;

  function handleCopy() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <>
        <style>{S}</style>
        <div style={{ padding: "5rem 2rem", textAlign: "center", color: "#94a3b8", fontFamily: "inherit" }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: "1.5rem", marginBottom: "0.75rem", display: "block" }} />
          در حال بارگذاری…
        </div>
      </>
    );
  }

  if (err) {
    return (
      <>
        <style>{S}</style>
        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <Link to="/blog" className="bpp-hero__back">
            <i className="fa-solid fa-arrow-right" /> بازگشت به وبلاگ
          </Link>
          <p style={{ color: "#b91c1c", marginTop: "2rem" }}>{err}</p>
        </div>
      </>
    );
  }

  if (!post) return null;

  return (
    <>
      <style>{S}</style>
      <Seo
        title={post.title_fa || "مطلب وبلاگ"}
        description={post.excerpt_fa || undefined}
        image={post.cover_image_url || undefined}
        ogType="article"
        keywords={keywords}
        jsonLd={jsonLd}
        articleMeta={articleMeta}
      />

      {/* ── Hero ── */}
      <div className="bpp-hero">
        {post.cover_image_url && (
          <img src={post.cover_image_url} alt="" className="bpp-hero__bg" aria-hidden="true" />
        )}
        <div className="bpp-hero__overlay" aria-hidden="true" />

        <div className="bpp-hero__inner">
          <Link to="/blog" className="bpp-hero__back">
            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            بازگشت به وبلاگ
          </Link>

          <div className="bpp-hero__badges">
            {post.category && (
              <span className="bpp-hero__cat">
                <i className="fa-solid fa-folder-open" aria-hidden="true" />
                {post.category}
              </span>
            )}
          </div>

          <h1 className="bpp-hero__title">{post.title_fa}</h1>

          {post.excerpt_fa && (
            <p className="bpp-hero__excerpt">{post.excerpt_fa}</p>
          )}

          <div className="bpp-hero__meta">
            {post.author && (
              <span className="bpp-hero__meta-item">
                <i className="fa-solid fa-user" aria-hidden="true" />
                {post.author}
              </span>
            )}
            {post.published_at && (
              <span className="bpp-hero__meta-item">
                <i className="fa-solid fa-calendar-days" aria-hidden="true" />
                {persianDate(post.published_at)}
              </span>
            )}
            {post.view_count != null && (
              <span className="bpp-hero__meta-item">
                <i className="fa-solid fa-eye" aria-hidden="true" />
                {Number(post.view_count).toLocaleString("fa-IR")} بازدید
              </span>
            )}
            {tags.length > 0 && (
              <span className="bpp-hero__meta-item">
                <i className="fa-solid fa-tags" aria-hidden="true" />
                {tags.length} تگ
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body card ── */}
      <div className="bpp-content">
        <div className="bpp-body-wrap">
          {post.body_fa ? (() => {
            const plain = post.body_fa.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            const visibleEnd = Math.floor(plain.length * 0.5);
            const visible = plain.slice(0, visibleEnd);
            const blurred = plain.slice(visibleEnd);
            return (
              <>
                <div className="bpp-body-visible">{visible}</div>
                <div className="bpp-blur-stack">
                  <div className="bpp-cta-head">
                    <p className="bpp-cta-title">برای خواندن ادامهٔ این مطلب، اپلیکیشن ایرانیو را دانلود کنید</p>
                    <p className="bpp-cta-sub">متن کامل خبر فقط در اپلیکیشن در دسترس است.</p>
                    <div className="bpp-store-btns">
                      <a href="https://apps.apple.com/us/app/iraniu/id6760209069" target="_blank" rel="noopener noreferrer" className="bpp-store-btn bpp-store-btn--apple">
                        <i className="fab fa-apple fa-lg" /> App Store
                      </a>
                      <a href="#" rel="noopener noreferrer" className="bpp-store-btn bpp-store-btn--google">
                        <i className="fab fa-google-play fa-lg" /> Google Play
                      </a>
                      <a href="https://chatbot.iraniu.uk" target="_blank" rel="noopener noreferrer" className="bpp-store-btn bpp-store-btn--chat">
                        <i className="fas fa-robot fa-lg" aria-hidden="true" /> سوال حقوقی دارید؟ از چت‌بات بپرسید
                      </a>
                    </div>
                    <div className="bpp-qr-wrap">
                      <img
                        src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https%3A%2F%2Firaniu.uk%2Fapp-link.php"
                        alt="QR کد برای دانلود اپلیکیشن ایرانیو"
                        width={120}
                        height={120}
                      />
                      <p>برای نصب اپلیکیشن، QR را با موبایل اسکن کنید</p>
                    </div>
                  </div>
                  <div className="bpp-body-blur-wrap">
                    <div className="bpp-body-blur">{blurred}</div>
                    <div className="bpp-blur-fade" aria-hidden="true" />
                  </div>
                </div>
              </>
            );
          })() : null}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="bpp-tags">
              <span className="bpp-tags__label">
                <i className="fa-solid fa-tags" style={{ marginLeft: "0.3rem" }} />
                تگ‌ها:
              </span>
              {tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/blog?q=${encodeURIComponent(tag)}`}
                  className="bpp-tag"
                >
                  <i className="fa-solid fa-hashtag" aria-hidden="true" />
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {/* Share */}
          <div className="bpp-share">
            <span className="bpp-share__label">اشتراک‌گذاری:</span>
            <button type="button" className="bpp-share__btn" onClick={handleCopy}>
              <i className={`fa-solid ${copied ? "fa-check" : "fa-link"}`} />
              {copied ? "کپی شد!" : "کپی لینک"}
            </button>
            <a
              className="bpp-share__btn"
              href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}&text=${encodeURIComponent(post.title_fa || "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-brands fa-telegram" />
              تلگرام
            </a>
            <a
              className="bpp-share__btn"
              href={`https://wa.me/?text=${encodeURIComponent((post.title_fa || "") + " " + (typeof window !== "undefined" ? window.location.href : ""))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-brands fa-whatsapp" />
              واتساپ
            </a>
          </div>
        </div>
      </div>

      {/* ── Related posts ── */}
      {related.length > 0 && (
        <div className="bpp-related">
          <div className="bpp-related__head">
            <div className="bpp-related__icon" aria-hidden="true">
              <i className="fa-solid fa-newspaper" />
            </div>
            <h3>مطالب مرتبط</h3>
            <div className="bpp-related__line" aria-hidden="true" />
          </div>
          <div className="bpp-related__grid">
            {related.map((rp) => (
              <Link
                key={rp.slug || rp.id}
                to={`/blog/${rp.slug}`}
                className="blog-card"
                aria-label={rp.title_fa}
              >
                {rp.cover_image_url ? (
                  <img src={rp.cover_image_url} alt={rp.title_fa || ""} className="blog-card__img" loading="lazy" />
                ) : (
                  <div className="blog-card__img-placeholder" aria-hidden="true">
                    <i className="fa-solid fa-newspaper" />
                  </div>
                )}
                <div className="blog-card__body">
                  {rp.category && <span className="blog-card__cat">{rp.category}</span>}
                  <h2 className="blog-card__title">{rp.title_fa}</h2>
                  <div className="blog-card__meta">
                    {rp.published_at && (
                      <span>
                        <i className="fa-solid fa-calendar" aria-hidden="true" />
                        {persianDate(rp.published_at)}
                      </span>
                    )}
                    {rp.view_count != null && (
                      <span>
                        <i className="fa-solid fa-eye" aria-hidden="true" />
                        {Number(rp.view_count).toLocaleString("fa-IR")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
