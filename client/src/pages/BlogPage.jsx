import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiGet } from "../api.js";
import { getSiteUrl } from "../lib/siteUrl.js";

const PAGE_SIZE = 9;

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

function buildPages(current, total) {
  if (total <= 1) return [];
  const pages = [];
  const delta = 2;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }
  return pages;
}

export default function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const qParam = searchParams.get("q") || "";
  const catParam = searchParams.get("cat") || "";
  const pageParam = Number(searchParams.get("page") || "1");

  const [search, setSearch] = useState(qParam);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    Promise.all([
      apiGet("/api/blog"),
      apiGet("/api/blog-categories"),
    ])
      .then(([postsData, catsData]) => {
        if (!cancelled) {
          setPosts(Array.isArray(postsData) ? postsData : postsData?.posts ?? []);
          setCategories(Array.isArray(catsData?.categories) ? catsData.categories : []);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || "خطا در بارگذاری مطالب");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = posts;
    if (catParam) {
      list = list.filter((p) => p.category === catParam);
    }
    if (qParam.trim()) {
      const q = qParam.trim().toLowerCase();
      list = list.filter(
        (p) =>
          String(p.title_fa || "").toLowerCase().includes(q) ||
          String(p.excerpt_fa || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [posts, catParam, qParam]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, pageParam), totalPages);
  const pagePosts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageButtons = buildPages(currentPage, totalPages);

  function setParam(key, value, resetPage = false) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      if (resetPage) next.delete("page");
      return next;
    });
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setParam("q", search.trim(), true);
  }

  function handleCat(cat) {
    setParam("cat", cat, true);
  }

  function handlePage(p) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p === 1) next.delete("page");
      else next.set("page", String(p));
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const site = getSiteUrl();

  const blogJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "وبلاگ ایرانیو",
      description: "راهنماها، مقالات و اخبار کسب‌وکارهای ایرانی در بریتانیا",
      inLanguage: "fa",
      ...(site ? { url: `${site}/blog`, publisher: { "@type": "Organization", name: "ایرانیو", url: site, logo: { "@type": "ImageObject", url: `${site}/images/iraniu-logo-header.png` } } } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "خانه", ...(site ? { item: site } : {}) },
        { "@type": "ListItem", position: 2, name: "وبلاگ", ...(site ? { item: `${site}/blog` } : {}) },
      ],
    },
  ];

  return (
    <>
      <Seo
        title="وبلاگ ایرانیو"
        description="راهنماها، مقالات و اخبار کسب‌وکار برای ایرانیان مقیم بریتانیا — ثبت شرکت، مالیات، مسکن، ویزا و بیشتر"
        keywords="وبلاگ ایرانیو, کسب‌وکار ایرانی بریتانیا, ثبت شرکت انگلستان, مالیات بریتانیا, ویزا کارآفرینی, ایرانیان لندن"
        jsonLd={blogJsonLd}
      />

      {/* ── Hero ── */}
      <div style={{
        background: "linear-gradient(135deg, #0f0520 0%, #2a0845 55%, #1a0a2e 100%)",
        padding: "4rem 1.5rem 3rem",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative blobs */}
        <div aria-hidden="true" style={{ position: "absolute", top: "-60px", right: "-60px", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(115,32,138,0.35) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: "-40px", left: "-40px", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", padding: "0.3rem 1rem", borderRadius: 20, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", color: "#d8b4fe", fontSize: "0.78rem", fontWeight: 700, marginBottom: "1.25rem" }}>
            <i className="fa-solid fa-newspaper" aria-hidden="true" />
            وبلاگ ایرانیو
          </span>
          <h1 style={{ fontSize: "clamp(1.8rem, 5vw, 2.8rem)", fontWeight: 900, color: "#fff", margin: "0 0 1rem", lineHeight: 1.35, textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
            راهنمای کسب‌وکار و زندگی<br />
            <span style={{ background: "linear-gradient(90deg, #c084fc, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ایرانیان در بریتانیا</span>
          </h1>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.6)", maxWidth: 520, margin: "0 auto 2rem", lineHeight: 1.75 }}>
            مقالات کاربردی درباره ثبت شرکت، مالیات، مسکن، ویزا و زندگی روزمره برای ایرانیان مقیم بریتانیا
          </p>

          {/* Stats row */}
          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { icon: "fa-file-lines", val: `${posts.length}+`, label: "مقاله" },
              { icon: "fa-layer-group", val: `${categories.length || ""}`, label: "دسته‌بندی" },
              { icon: "fa-users", val: "رایگان", label: "دسترسی" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <i className={`fa-solid ${s.icon}`} style={{ color: "#a78bfa", fontSize: "1.2rem", marginBottom: "0.35rem", display: "block" }} aria-hidden="true" />
                <strong style={{ color: "#fff", fontSize: "1.1rem", display: "block", lineHeight: 1.2 }}>{s.val}</strong>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="blog-page">
        <form className="blog-search" onSubmit={handleSearchSubmit} role="search" style={{ marginTop: "2rem" }}>
          <input
            type="search"
            className="blog-search__input"
            placeholder="جستجو در مطالب…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="جستجو در وبلاگ"
          />
          <button type="submit" className="pbtn pbtn--primary" style={{ padding: "0.6rem 1.2rem", borderRadius: 10, border: "none", background: "#73208a", color: "#fff", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}>
            جستجو
          </button>
        </form>

        <div className="blog-cats" role="list" aria-label="دسته‌بندی‌ها">
          <button
            type="button"
            role="listitem"
            className={`blog-cat-chip${!catParam ? " is-active" : ""}`}
            onClick={() => handleCat("")}
          >
            همه
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="listitem"
              className={`blog-cat-chip${catParam === cat ? " is-active" : ""}`}
              onClick={() => handleCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading && (
          <p style={{ textAlign: "center", color: "#64748b", padding: "3rem 0" }}>در حال بارگذاری…</p>
        )}
        {err && (
          <p style={{ textAlign: "center", color: "#b91c1c", padding: "3rem 0" }}>{err}</p>
        )}
        {!loading && !err && filtered.length === 0 && (
          <p style={{ textAlign: "center", color: "#64748b", padding: "3rem 0" }}>
            مطلبی پیدا نشد. عبارت دیگری جستجو کنید یا دسته‌بندی دیگری انتخاب کنید.
          </p>
        )}

        {!loading && !err && pagePosts.length > 0 && (
          <div className="blog-grid">
            {pagePosts.map((post) => (
              <Link
                key={post.slug || post.id}
                to={`/blog/${post.slug}`}
                className="blog-card"
                aria-label={post.title_fa}
              >
                {post.cover_image_url ? (
                  <img
                    src={post.cover_image_url}
                    alt={post.title_fa || ""}
                    className="blog-card__img"
                    loading="lazy"
                  />
                ) : (
                  <div className="blog-card__img-placeholder" aria-hidden="true">
                    <i className="fa-solid fa-newspaper" />
                  </div>
                )}
                <div className="blog-card__body">
                  {post.category && (
                    <span className="blog-card__cat">{post.category}</span>
                  )}
                  <h2 className="blog-card__title">{post.title_fa}</h2>
                  {post.excerpt_fa && (
                    <p className="blog-card__excerpt">{post.excerpt_fa}</p>
                  )}
                  <div className="blog-card__meta">
                    {post.author && (
                      <span>
                        <i className="fa-solid fa-user" aria-hidden="true" />
                        {post.author}
                      </span>
                    )}
                    {post.published_at && (
                      <span>
                        <i className="fa-solid fa-calendar" aria-hidden="true" />
                        {persianDate(post.published_at)}
                      </span>
                    )}
                    {post.view_count != null && (
                      <span>
                        <i className="fa-solid fa-eye" aria-hidden="true" />
                        {Number(post.view_count).toLocaleString("fa-IR")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="blog-pagination" role="navigation" aria-label="صفحه‌بندی">
            <button
              type="button"
              className="blog-page-btn"
              disabled={currentPage === 1}
              onClick={() => handlePage(currentPage - 1)}
              aria-label="صفحه قبل"
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true" />
            </button>
            {pageButtons.map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} className="blog-page-btn" style={{ cursor: "default", border: "none" }}>…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`blog-page-btn${p === currentPage ? " is-active" : ""}`}
                  onClick={() => handlePage(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                >
                  {Number(p).toLocaleString("fa-IR")}
                </button>
              )
            )}
            <button
              type="button"
              className="blog-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => handlePage(currentPage + 1)}
              aria-label="صفحه بعد"
            >
              <i className="fa-solid fa-chevron-left" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
