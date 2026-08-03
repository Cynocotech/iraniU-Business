import { useEffect, useState } from "react";
import RichEditor from "../../components/RichEditor.jsx";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPatchJson, apiDelete } from "../../api.js";

const CATEGORIES = ["عمومی", "کسب‌وکار", "مالی", "حقوقی", "زندگی", "مهاجرت"];

const EMPTY_DRAFT = {
  title_fa: "",
  slug: "",
  category: "عمومی",
  excerpt_fa: "",
  cover_image_url: "",
  author: "",
  body_fa: "",
  published_at: "",
  is_published: false,
};

function toDatetimeLocal(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function generateSlug(titleFa) {
  return `post-${Date.now()}`;
}

export default function AdminBlogEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [form, setForm] = useState(EMPTY_DRAFT);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, setToast] = useState(null);
  const [slugTouched, setSlugTouched] = useState(false);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    if (isNew) {
      setForm(EMPTY_DRAFT);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);

    apiGet("/api/admin/blog")
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.items ?? [];
        const found = list.find(
          (p) => String(p.id) === String(id) || p.slug === id
        );
        if (!found) {
          setErr("مطلب مورد نظر پیدا نشد.");
          return;
        }
        setForm({
          title_fa: found.title_fa || "",
          slug: found.slug || "",
          category: found.category || "عمومی",
          excerpt_fa: found.excerpt_fa || "",
          cover_image_url: found.cover_image_url || "",
          author: found.author || "",
          body_fa: found.body_fa || "",
          published_at: toDatetimeLocal(found.published_at),
          is_published: Boolean(found.is_published),
        });
        setSlugTouched(true);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || "خطا در بارگذاری");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, isNew]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;

    if (name === "slug") setSlugTouched(true);

    if (name === "title_fa" && isNew && !slugTouched) {
      setForm((prev) => ({ ...prev, title_fa: val }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: val }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const payload = {
      ...form,
      slug: form.slug.trim() || generateSlug(form.title_fa),
      published_at: form.published_at
        ? new Date(form.published_at).toISOString()
        : null,
    };

    try {
      if (isNew) {
        await apiPost("/api/admin/blog", payload);
        showToast("مطلب با موفقیت ایجاد شد.", "ok");
        setTimeout(() => navigate("/admin-blog"), 800);
      } else {
        await apiPatchJson(
          `/api/admin/blog/${encodeURIComponent(id)}`,
          payload
        );
        showToast("مطلب با موفقیت ذخیره شد.", "ok");
      }
    } catch (e) {
      setErr(e.message || "خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`آیا از حذف "${form.title_fa || id}" مطمئن هستید؟`)) return;
    setSaving(true);
    try {
      await apiDelete(`/api/admin/blog/${encodeURIComponent(id)}`);
      navigate("/admin-blog");
    } catch (e) {
      setErr(e.message || "خطا در حذف");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="panel-page-title">
        <p style={{ color: "#64748b" }}>در حال بارگذاری…</p>
      </div>
    );
  }

  return (
    <>
      <div className="panel-page-title">
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            {isNew ? "نوشته جدید" : "ویرایش مطلب"}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.2rem 0 0" }}>
            <a href="/admin-blog" onClick={(e) => { e.preventDefault(); navigate("/admin-blog"); }}>
              ← مدیریت وبلاگ
            </a>
          </p>
        </div>
        {!isNew && (
          <button
            type="button"
            className="pbtn pbtn--ghost"
            style={{ marginRight: "auto", color: "#b91c1c", borderColor: "#fecaca" }}
            disabled={saving}
            onClick={handleDelete}
          >
            حذف مطلب
          </button>
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

      {err && (
        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: 10,
            marginBottom: "1rem",
            background: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            fontWeight: 600,
          }}
          role="alert"
        >
          {err}
        </div>
      )}

      <form onSubmit={handleSave} noValidate>
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">اطلاعات مطلب</h3>
          </div>
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

            {/* Title */}
            <div className="field field--block">
              <label htmlFor="bf-title">عنوان</label>
              <input
                id="bf-title"
                name="title_fa"
                type="text"
                value={form.title_fa}
                onChange={handleChange}
                placeholder="عنوان مطلب را بنویسید…"
                required
                style={{ width: "100%" }}
              />
            </div>

            {/* Slug */}
            <div className="field field--block">
              <label htmlFor="bf-slug">نامک (slug)</label>
              <input
                id="bf-slug"
                name="slug"
                type="text"
                dir="ltr"
                value={form.slug}
                onChange={handleChange}
                placeholder="my-post-slug"
                style={{ width: "100%" }}
              />
              <p className="field-hint">اگر خالی بماند، هنگام ذخیره به‌صورت خودکار تولید می‌شود.</p>
            </div>

            {/* Category + Author in a row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="field field--block">
                <label htmlFor="bf-cat">دسته‌بندی</label>
                <select
                  id="bf-cat"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  style={{ width: "100%" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field field--block">
                <label htmlFor="bf-author">نویسنده</label>
                <input
                  id="bf-author"
                  name="author"
                  type="text"
                  value={form.author}
                  onChange={handleChange}
                  placeholder="نام نویسنده"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Excerpt */}
            <div className="field field--block">
              <label htmlFor="bf-excerpt">خلاصه</label>
              <textarea
                id="bf-excerpt"
                name="excerpt_fa"
                rows={3}
                value={form.excerpt_fa}
                onChange={handleChange}
                placeholder="خلاصه کوتاه مطلب برای نمایش در کارت وبلاگ…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>

            {/* Cover image */}
            <div className="field field--block">
              <label htmlFor="bf-cover">تصویر شاخص (URL)</label>
              <input
                id="bf-cover"
                name="cover_image_url"
                type="url"
                dir="ltr"
                value={form.cover_image_url}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
                style={{ width: "100%" }}
              />
              {form.cover_image_url && (
                <img
                  src={form.cover_image_url}
                  alt="پیش‌نمایش تصویر"
                  style={{
                    marginTop: "0.75rem",
                    maxWidth: "100%",
                    maxHeight: 200,
                    borderRadius: 10,
                    objectFit: "cover",
                  }}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              )}
            </div>

            {/* Body */}
            <div className="field field--block">
              <label>متن کامل</label>
              <RichEditor
                value={form.body_fa}
                onChange={(html) => setForm((f) => ({ ...f, body_fa: html }))}
                placeholder="متن مطلب را اینجا بنویسید…"
                minHeight={400}
              />
            </div>

            {/* Published_at + is_published in a row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "end" }}>
              <div className="field field--block">
                <label htmlFor="bf-pub-at">تاریخ انتشار</label>
                <input
                  id="bf-pub-at"
                  name="published_at"
                  type="datetime-local"
                  dir="ltr"
                  value={form.published_at}
                  onChange={handleChange}
                  style={{ width: "100%" }}
                />
              </div>

              <div className="field" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingBottom: "0.15rem" }}>
                <label htmlFor="bf-published" style={{ whiteSpace: "nowrap" }}>وضعیت انتشار</label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    cursor: "pointer",
                    fontWeight: 700,
                    color: form.is_published ? "#166534" : "#64748b",
                    userSelect: "none",
                  }}
                >
                  <input
                    id="bf-published"
                    name="is_published"
                    type="checkbox"
                    checked={form.is_published}
                    onChange={handleChange}
                    style={{ width: 18, height: 18, accentColor: "#73208a", cursor: "pointer" }}
                  />
                  {form.is_published ? "منتشرشده" : "پیش‌نویس"}
                </label>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="pbtn pbtn--ghost"
            onClick={() => navigate("/admin-blog")}
            disabled={saving}
          >
            انصراف
          </button>
          <button
            type="submit"
            className="pbtn pbtn--primary"
            disabled={saving}
            style={{ minWidth: 130 }}
          >
            {saving ? "در حال ذخیره…" : isNew ? "ایجاد مطلب" : "ذخیره تغییرات"}
          </button>
        </div>
      </form>
    </>
  );
}
