import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import DashboardBusinessForm from "../../components/DashboardBusinessForm.jsx";
import { apiGet, apiPatch, apiPost } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";

function rowIsActive(r) {
  const s = r.status;
  return s == null || s === "" || s === "active";
}

export default function AdminEditBusinessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const raw = searchParams.get("slug");
  const slug = (raw && String(raw).trim()) || "";

  const [list, setList] = useState([]);
  const [query, setQuery] = useState("");
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState(null);

  // ── Tags ──
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagMsg, setTagMsg] = useState(null);
  const [tagSaving, setTagSaving] = useState(false);
  const tagInputRef = useRef(null);

  useEffect(() => {
    apiGet("/api/businesses").then(setList).catch(() => setList([]));
  }, []);

  useEffect(() => {
    if (!slug) { setTags([]); return; }
    setTagsLoading(true);
    setTagMsg(null);
    apiGet(`/api/businesses/${encodeURIComponent(slug)}`)
      .then((b) => {
        try { setTags(JSON.parse(b.ai_tags_json || "[]")); } catch { setTags([]); }
      })
      .catch(() => setTags([]))
      .finally(() => setTagsLoading(false));
  }, [slug]);

  const saveTags = useCallback(async (nextTags) => {
    if (!slug) return;
    setTagSaving(true);
    setTagMsg(null);
    try {
      await apiPatch(`/api/businesses/${encodeURIComponent(slug)}`, {
        ai_tags_json: JSON.stringify(nextTags),
      });
      setTags(nextTags);
      setTagMsg({ ok: true, text: "برچسب‌ها ذخیره شد." });
      setTimeout(() => setTagMsg(null), 2500);
    } catch (e) {
      setTagMsg({ ok: false, text: e.message || "خطا" });
    } finally {
      setTagSaving(false);
    }
  }, [slug]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    const next = [...tags, t];
    setTagInput("");
    saveTags(next);
    tagInputRef.current?.focus();
  };

  const removeTag = (t) => saveTags(tags.filter((x) => x !== t));

  const onSlugChange = useCallback(
    (s) => {
      const next = String(s || "").trim();
      navigate(next ? `/admin-edit?slug=${encodeURIComponent(next)}` : "/admin-edit", { replace: true });
    },
    [navigate]
  );

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return list.filter((r) => String(r.name_fa || "").toLowerCase().includes(q));
  }, [list, query]);

  const RESULTS_CAP = 30;
  const visibleResults = filteredList.slice(0, RESULTS_CAP);

  const sendToTelegramChannel = async () => {
    setTelegramMsg(null);
    setTelegramBusy(true);
    try {
      await apiPost(`/api/admin/businesses/${encodeURIComponent(slug)}/send-to-telegram-channel`, {});
      setTelegramMsg({ ok: true, text: "آگهی در کانال دایرکتوری منتشر شد." });
    } catch (e) {
      setTelegramMsg({ ok: false, text: e.message || String(e) });
    } finally {
      setTelegramBusy(false);
    }
  };

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin-businesses">← همه آگهی‌ها</Link>
        {" · "}
        <Link to="/admin">داشبورد</Link>
      </p>

      <section className="dashboard-panel" style={{ marginBottom: "var(--space-md)" }}>
        <h2 className="field-hint" style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
          انتخاب آگهی
        </h2>
        <div className="field field--block" style={{ marginTop: "0.5rem" }}>
          <label htmlFor="admin-edit-business-search">جستجوی کسب‌وکار</label>
          <input
            id="admin-edit-business-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="نام کسب‌وکار…"
            autoComplete="off"
            style={{ width: "100%", maxWidth: "28rem" }}
          />
          {query.trim() ? (
            <span className="field-hint">
              {filteredList.length.toLocaleString("fa-IR")} نتیجه
              {filteredList.length > visibleResults.length
                ? ` — ${visibleResults.length.toLocaleString("fa-IR")} مورد نمایش داده شده؛ برای محدودکردن نتایج جستجو کنید.`
                : ""}
            </span>
          ) : null}
        </div>

        {query.trim() ? (
          <div className="table-wrap" style={{ marginTop: "0.5rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>نام</th>
                  <th>شناسه/نامک</th>
                  <th>دسته</th>
                  <th>شهر</th>
                  <th>وضعیت آگهی</th>
                  <th>مالکیت</th>
                  <th>اقدام</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <span className="field-hint">آگهی‌ای با این جستجو پیدا نشد.</span>
                    </td>
                  </tr>
                ) : (
                  visibleResults.map((r) => (
                    <tr key={r.slug} style={{ background: r.slug === slug ? "rgba(58,11,71,0.06)" : undefined }}>
                      <td>{r.name_fa}</td>
                      <td dir="ltr">{formatAdId(r.id) || r.slug}</td>
                      <td>{r.category || "—"}</td>
                      <td>{r.city || "—"}</td>
                      <td>{rowIsActive(r) ? "فعال" : "غیرفعال"}</td>
                      <td>{r.claimed ? "مالک‌دار" : "بدون مالک"}</td>
                      <td>
                        <button type="button" className="btn btn--primary" onClick={() => onSlugChange(r.slug)}>
                          {r.slug === slug ? "انتخاب‌شده" : "انتخاب"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
        <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn--accent"
            disabled={telegramBusy || !slug}
            onClick={sendToTelegramChannel}
          >
            {telegramBusy ? "در حال ارسال به کانال…" : "ارسال به کانال تلگرام (دایرکتوری)"}
          </button>
          {telegramMsg && (
            <span
              className="field-hint"
              style={{ color: telegramMsg.ok ? "var(--color-success, #2e7d32)" : "#b71c1c", margin: 0 }}
            >
              {telegramMsg.text}
            </span>
          )}
        </div>
      </section>

      {slug ? (
        <>
          <DashboardBusinessForm
            slug={slug}
            onSlugChange={onSlugChange}
            sectionTitle="ویرایش آگهی (سوپرادمین)"
            hideSlugPicker
            allowEditName
          />

          {/* ── AI Tags panel ── */}
          <div className="panel-card" style={{ marginTop: "1.25rem" }}>
            <div className="panel-card__head">
              <h3 className="panel-card__title">
                <i className="fa-solid fa-tags" style={{ marginInlineEnd: "0.5rem", color: "#6366f1" }} />
                برچسب‌های جستجو (AI Tags)
              </h3>
            </div>
            <div className="panel-card__body" style={{ padding: "1.25rem" }}>
              <p className="field-hint" style={{ marginTop: 0 }}>
                این برچسب‌ها فقط برای جستجوی هوش مصنوعی استفاده می‌شوند و برای کاربران نمایش داده نمی‌شوند.
                برچسب‌های تولیدشده توسط AI را می‌توانید حذف یا تکمیل کنید.
              </p>

              {tagsLoading ? (
                <p className="field-hint">در حال بارگذاری…</p>
              ) : (
                <>
                  {/* Tag chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem", minHeight: "2rem" }}>
                    {tags.length === 0 && (
                      <span className="field-hint" style={{ margin: 0 }}>برچسبی ثبت نشده</span>
                    )}
                    {tags.map((t) => (
                      <span key={t} style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        background: "#ede9fe", color: "#4c1d95", borderRadius: "999px",
                        padding: "0.2rem 0.65rem", fontSize: "0.82rem", fontWeight: 500,
                        border: "1px solid #c4b5fd",
                      }}>
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          disabled={tagSaving}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", lineHeight: 1, padding: 0, fontSize: "0.9rem" }}
                          aria-label={`حذف برچسب ${t}`}
                        >×</button>
                      </span>
                    ))}
                  </div>

                  {/* Add tag input */}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="برچسب جدید… مثلاً: DSS accepted"
                      disabled={tagSaving}
                      style={{ minWidth: "220px", flex: "1 1 220px" }}
                    />
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={addTag}
                      disabled={tagSaving || !tagInput.trim()}
                    >
                      {tagSaving ? "…" : "+ افزودن"}
                    </button>
                  </div>

                  {tagMsg && (
                    <p className="field-hint" role="status" style={{ marginTop: "0.5rem", color: tagMsg.ok ? "var(--color-success,#2e7d32)" : "#b71c1c" }}>
                      {tagMsg.text}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="field-hint">برای نمایش فرم ویرایش، ابتدا یک آگهی را از بالا انتخاب کنید.</p>
      )}
    </>
  );
}
