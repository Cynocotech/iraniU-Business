import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiDelete } from "../../api.js";

function persianDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

const SOURCE_LABELS = {
  local:    { label: "فقط مطالب محلی",       icon: "fa-database",   desc: "فقط مقالاتی که در این پنل نوشته‌اید نمایش داده می‌شوند." },
  external: { label: "فقط CyberCina",         icon: "fa-globe",      desc: "فقط مطالب سایت panel.cybercina.co.uk نمایش داده می‌شوند." },
  both:     { label: "ترکیب هر دو منبع",      icon: "fa-layer-group", desc: "مطالب محلی و CyberCina با هم ترکیب و بر اساس تاریخ مرتب می‌شوند." },
};

export default function AdminBlogPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState(null);

  // Blog source settings
  const [blogSource, setBlogSource] = useState("both");
  const [sourceSaving, setSourceSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [extPreview, setExtPreview] = useState([]);
  const [extLoading, setExtLoading] = useState(false);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    Promise.all([
      apiGet("/api/admin/blog"),
      apiGet("/api/admin/blog-settings"),
    ])
      .then(([postsData, settingsData]) => {
        if (!cancelled) {
          setPosts(Array.isArray(postsData) ? postsData : []);
          setBlogSource(settingsData?.blog_source || "both");
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || "خطا در بارگذاری");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function saveSource(val) {
    setSourceSaving(true);
    try {
      await apiPost("/api/admin/blog-settings", { blog_source: val });
      setBlogSource(val);
      showToast("تنظیمات منبع ذخیره شد.", "ok");
    } catch (e) {
      showToast(e.message || "خطا در ذخیره", "err");
    } finally {
      setSourceSaving(false);
    }
  }

  async function loadExtPreview() {
    setExtLoading(true);
    setExtPreview([]);
    try {
      const data = await apiGet("/api/admin/external-blog-preview?limit=5");
      setExtPreview(Array.isArray(data?.posts) ? data.posts : []);
    } catch (e) {
      showToast(e.message || "خطا در بارگذاری پیش‌نمایش", "err");
    } finally {
      setExtLoading(false);
    }
  }

  const filtered = posts.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(p.title_fa || "").toLowerCase().includes(q) ||
      String(p.category || "").toLowerCase().includes(q) ||
      String(p.author || "").toLowerCase().includes(q)
    );
  });

  const totalViews = posts.reduce((s, p) => s + (Number(p.view_count) || 0), 0);
  const published = posts.filter((p) => p.is_published).length;
  const drafts = posts.length - published;

  async function handleDelete(post) {
    if (!window.confirm(`آیا از حذف "${post.title_fa || post.slug}" مطمئن هستید؟`)) return;
    setDeleting(post.id ?? post.slug);
    try {
      await apiDelete(`/api/admin/blog/${encodeURIComponent(post.id ?? post.slug)}`);
      setPosts((prev) => prev.filter((p) => (p.id ?? p.slug) !== (post.id ?? post.slug)));
      showToast("مطلب با موفقیت حذف شد.", "ok");
    } catch (e) {
      showToast(e.message || "خطا در حذف مطلب", "err");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="panel-page-title">
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            مدیریت وبلاگ
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.2rem 0 0" }}>
            <Link to="/admin">← داشبورد</Link>
          </p>
        </div>
        <Link to="/admin-blog/new" className="pbtn pbtn--primary" style={{ marginRight: "auto" }}>
          + نوشته جدید
        </Link>
      </div>

      {/* ── Blog Source Settings ── */}
      <div className="panel-card" style={{ marginBottom: "1.5rem" }}>
        <button
          type="button"
          className="panel-card__head"
          onClick={() => { setSettingsOpen((v) => !v); if (!settingsOpen && extPreview.length === 0) loadExtPreview(); }}
          style={{ cursor: "pointer", width: "100%", textAlign: "right", background: "none", border: "none", display: "flex", alignItems: "center", gap: "0.6rem", padding: "1rem 1.25rem" }}
        >
          <i className="fa-solid fa-gear" style={{ color: "#73208a" }} />
          <h3 className="panel-card__title" style={{ margin: 0 }}>تنظیمات منبع مطالب وبلاگ</h3>
          <span style={{ marginRight: "auto", fontSize: "0.8rem", color: "#94a3b8" }}>
            {SOURCE_LABELS[blogSource]?.label}
          </span>
          <i className={`fa-solid fa-chevron-${settingsOpen ? "up" : "down"}`} style={{ color: "#94a3b8", fontSize: "0.8rem" }} />
        </button>

        {settingsOpen && (
          <div style={{ padding: "0 1.25rem 1.5rem" }}>
            <p style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 0, marginBottom: "1.25rem" }}>
              انتخاب کنید که مطالب وبلاگ عمومی از کجا بارگذاری شوند:
            </p>

            {/* Source radio cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
              {Object.entries(SOURCE_LABELS).map(([val, info]) => (
                <label key={val} style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.9rem 1rem", borderRadius: 12, border: `2px solid ${blogSource === val ? "#73208a" : "#e2e8f0"}`, background: blogSource === val ? "#faf5ff" : "#fff", cursor: "pointer", transition: "all 0.15s" }}>
                  <input type="radio" name="blog_source" value={val} checked={blogSource === val} onChange={() => setBlogSource(val)} style={{ display: "none" }} />
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.88rem", color: blogSource === val ? "#73208a" : "#1e293b" }}>
                    <i className={`fa-solid ${info.icon}`} style={{ color: blogSource === val ? "#73208a" : "#94a3b8" }} />
                    {info.label}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.5 }}>{info.desc}</span>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" className="pbtn pbtn--primary" disabled={sourceSaving} onClick={() => saveSource(blogSource)} style={{ fontSize: "0.85rem" }}>
                {sourceSaving ? <><i className="fa-solid fa-spinner fa-spin" /> در حال ذخیره…</> : <><i className="fa-solid fa-check" /> ذخیره تنظیمات</>}
              </button>
              <button type="button" className="pbtn pbtn--ghost" onClick={loadExtPreview} disabled={extLoading} style={{ fontSize: "0.85rem" }}>
                {extLoading ? <><i className="fa-solid fa-spinner fa-spin" /> بارگذاری…</> : <><i className="fa-solid fa-eye" /> پیش‌نمایش CyberCina</>}
              </button>
            </div>

            {/* External preview */}
            {extPreview.length > 0 && (
              <div style={{ marginTop: "1.25rem" }}>
                <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#73208a", marginBottom: "0.6rem" }}>
                  <i className="fa-solid fa-globe" style={{ marginLeft: "0.35rem" }} />
                  آخرین مطالب CyberCina (پیش‌نمایش):
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {extPreview.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.85rem", borderRadius: 10, background: "#f8f5ff", border: "1px solid #e9d5ff" }}>
                      {p.cover_image_url && (
                        <img src={p.cover_image_url} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title_fa}</p>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8" }}>{p.category} · {p.author}</p>
                      </div>
                      <span style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem", borderRadius: 20, background: "#e9d5ff", color: "#73208a", fontWeight: 700, flexShrink: 0 }}>خارجی</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: 10,
            marginBottom: "1rem",
            background: toast.type === "ok" ? "#f0fdf4" : "#fef2f2",
            color: toast.type === "ok" ? "#166534" : "#991b1b",
            border: `1px solid ${toast.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
            fontWeight: 600,
          }}
          role="status"
        >
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div className="panel-card" style={{ marginBottom: "1.25rem" }}>
        <div className="panel-card__head">
          <h3 className="panel-card__title">آمار</h3>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", padding: "1.25rem" }}>
          <div className="panel-stat">
            <div className="panel-stat__value">{posts.length.toLocaleString("fa-IR")}</div>
            <div className="panel-stat__label">کل مطالب</div>
          </div>
          <div className="panel-stat">
            <div className="panel-stat__value">{published.toLocaleString("fa-IR")}</div>
            <div className="panel-stat__label">منتشرشده</div>
          </div>
          <div className="panel-stat">
            <div className="panel-stat__value">{drafts.toLocaleString("fa-IR")}</div>
            <div className="panel-stat__label">پیش‌نویس</div>
          </div>
          <div className="panel-stat">
            <div className="panel-stat__value">{totalViews.toLocaleString("fa-IR")}</div>
            <div className="panel-stat__label">کل بازدید</div>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-card__head">
          <h3 className="panel-card__title">فهرست مطالب</h3>
        </div>

        <div style={{ padding: "1rem 1.25rem 0" }}>
          <input
            type="search"
            className="app-shell__search"
            placeholder="جستجو در عنوان، دسته‌بندی یا نویسنده…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", maxWidth: "28rem" }}
            aria-label="جستجو در مطالب"
          />
        </div>

        {loading && (
          <p style={{ color: "#64748b", padding: "2rem 1.25rem" }}>در حال بارگذاری…</p>
        )}
        {err && (
          <p style={{ color: "#b91c1c", padding: "2rem 1.25rem" }}>{err}</p>
        )}

        {!loading && !err && (
          <div className="panel-biz-list" style={{ padding: "0.75rem 0 0" }}>
            {filtered.length === 0 && (
              <p style={{ color: "#64748b", padding: "1.5rem 1.25rem" }}>
                {search.trim() ? "نتیجه‌ای پیدا نشد." : "هنوز مطلبی ثبت نشده."}
              </p>
            )}
            {filtered.map((post) => {
              const key = post.id ?? post.slug;
              return (
                <div className="panel-biz-item" key={key}>
                  <div
                    className="panel-biz-item__avatar"
                    style={{
                      background: post.is_published
                        ? "linear-gradient(135deg,#73208a,#a855f7)"
                        : "linear-gradient(135deg,#94a3b8,#cbd5e1)",
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    <i className="fa-solid fa-newspaper" style={{ color: "#fff", fontSize: "1rem" }} />
                  </div>

                  <div className="panel-biz-item__body">
                    <p className="panel-biz-item__name">
                      {post.title_fa || "بدون عنوان"}
                    </p>
                    <p className="panel-biz-item__meta">
                      {[post.category, post.author, persianDate(post.published_at)].filter(Boolean).join(" · ")}
                      {post.view_count != null && (
                        <> · <i className="fa-solid fa-eye" aria-hidden="true" style={{ color: "#73208a" }} /> {Number(post.view_count).toLocaleString("fa-IR")} بازدید</>
                      )}
                    </p>
                  </div>

                  <div className="panel-biz-item__badges">
                    <span className={`pbadge ${post.is_published ? "pbadge--green" : "pbadge--red"}`}>
                      {post.is_published ? "منتشر" : "پیش‌نویس"}
                    </span>
                  </div>

                  <div className="panel-biz-item__actions">
                    <Link
                      to={`/admin-blog/${encodeURIComponent(post.id ?? post.slug)}`}
                      className="pact-btn pact-btn--primary"
                    >
                      ویرایش
                    </Link>
                    <button
                      type="button"
                      className="pact-btn pact-btn--ghost"
                      disabled={deleting === key}
                      onClick={() => handleDelete(post)}
                    >
                      {deleting === key ? "…" : "حذف"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
