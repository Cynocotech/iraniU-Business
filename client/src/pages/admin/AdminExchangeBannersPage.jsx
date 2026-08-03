import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPostMultipart } from "../../api.js";
import { toInputDateTime, scheduleLabel, formatEndDate } from "../../lib/bannerSchedule.js";

const defaultForm = {
  title: "",
  image_url: "",
  link_url: "",
  page_scope: "exchange",
  placement: "between",
  category_filter: "",
  daily_user_cap: 2,
  start_at: "",
  end_at: "",
  sort_order: 0,
  is_active: true,
};

function sortBannerRows(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const sa = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 0;
    const sb = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 0;
    if (sa !== sb) return sa - sb;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });
}

export default function AdminExchangeBannersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/api/admin/exchange-banners");
      const list = Array.isArray(data) ? data : [];
      setRows(
        sortBannerRows(
          list.map((r) => ({
            ...r,
            start_at: toInputDateTime(r.start_at),
            end_at: toInputDateTime(r.end_at),
          }))
        )
      );
    } catch (e) {
      setMsg(e.message || "بارگذاری بنرها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onUpload = async (e) => {
    e.preventDefault();
    setMsg("");
    const imageSource = String(form.image_url || "").trim();
    if (!file && !imageSource) {
      setMsg("تصویر بنر را آپلود کنید یا لینک تصویر وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append("image", file);
      fd.append("image_url", imageSource);
      fd.append("title", form.title.trim());
      fd.append("link_url", form.link_url.trim());
      fd.append("page_scope", form.page_scope);
      fd.append("placement", form.placement);
      fd.append("category_filter", (form.category_filter || "").trim());
      fd.append("daily_user_cap", String(Number(form.daily_user_cap) || 2));
      fd.append("start_at", form.start_at || "");
      fd.append("end_at", form.end_at || "");
      fd.append("sort_order", String(Number(form.sort_order) || 0));
      fd.append("is_active", form.is_active ? "1" : "0");
      await apiPostMultipart("/api/admin/exchange-banners", fd);
      setForm(defaultForm);
      setFile(null);
      setMsg("بنر ذخیره شد.");
      await load();
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const reorderRows = (list, fromId, toId) => {
    const fromIdx = list.findIndex((r) => r.id === fromId);
    const toIdx = list.findIndex((r) => r.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return list;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    return next.map((r, idx) => ({ ...r, sort_order: idx + 1 }));
  };

  const persistReorder = async (nextRows) => {
    try {
      const payload = nextRows.map((r, idx) => ({ id: r.id, sort_order: idx + 1 }));
      const out = await apiPost("/api/admin/exchange-banners/reorder", { items: payload });
      const serverRows = Array.isArray(out?.items) ? out.items : [];
      setRows(
        sortBannerRows(
          serverRows.map((r) => ({
            ...r,
            start_at: toInputDateTime(r.start_at),
            end_at: toInputDateTime(r.end_at),
          }))
        )
      );
      setMsg("ترتیب بنرها ذخیره شد.");
    } catch (e) {
      setMsg(e.message || "ذخیره ترتیب ناموفق بود.");
      await load();
    }
  };

  const locationLabel = (row) => {
    const scope = (row?.page_scope || "exchange") === "directory" ? "دایرکتوری" : "صرافی‌ها";
    const placement = row?.placement || "between";
    const place =
      placement === "top" ? "ابتدای لیست"
      : placement === "fullscreen" ? "تمام‌صفحه"
      : placement === "below-categories" ? "زیر دسته‌بندی‌ها (اپ)"
      : placement === "in-post" ? "داخل آگهی (اپ)"
      : "بین کارت‌ها";
    const cat = row?.category_filter ? ` · ${row.category_filter}` : "";
    return `${scope} · ${place}${cat}`;
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (scopeFilter && (r.page_scope || "exchange") !== scopeFilter) return false;
      if (statusFilter === "active" && !r.is_active) return false;
      if (statusFilter === "inactive" && r.is_active) return false;
      if (!q) return true;
      const haystack = `${r.title || ""} ${r.link_url || ""} ${r.id}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, scopeFilter, statusFilter]);

  return (
    <section className="admin-exchange-hub__panel dashboard-panel" aria-labelledby="admin-exchange-banners-h">
      <header className="admin-ex-banner-head">
        <p className="admin-ex-banner-head__eyebrow">Ads Manager</p>
        <h2 id="admin-exchange-banners-h" className="admin-ex-banner-head__title">
          بنرهای تبلیغاتی
        </h2>
        <p className="admin-ex-banner-head__lead field-hint">
          بنرها در پنج حالت نمایش داده می‌شوند: <b>top</b> (ابتدای لیست)، <b>between</b> (بین کارت‌ها)، <b>fullscreen</b> (تمام‌صفحه)، <b>below-categories</b> (زیر دسته‌بندی‌ها در اپ) و <b>in-post</b> (داخل آگهی در اپ). با تعیین «دسته هدف» بنر فقط در آن دسته نمایش می‌یابد.
        </p>
        <div style={{ marginTop: "0.55rem" }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
          >
            {collapsed ? "نمایش بنرها (Maximize)" : "کمینه‌سازی بنرها (Minimize)"}
          </button>
        </div>
      </header>

      <div className="admin-ex-banner-expanded-area">
      <section className="admin-ex-banner-section-card">
      <form onSubmit={onUpload} className="form-grid admin-ex-banner-create-form" style={{ display: "grid", gap: "0.8rem", marginBottom: "0" }}>
        <div className="admin-ex-banner-create-form__title-wrap">
          <h3 className="admin-ex-banner-create-form__title">افزودن بنر جدید</h3>
          <p className="field-hint admin-ex-banner-create-form__subtitle">اطلاعات اصلی را وارد کنید و سپس ذخیره بنر را بزنید.</p>
        </div>
        <div className="field field--block">
          <label htmlFor="ex-banner-image">تصویر بنر</label>
          <input
            id="ex-banner-image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <span className="field-hint">اگر آپلود نشد، از فیلد لینک تصویر استفاده کنید.</span>
        </div>
        <div className="field field--block">
          <label htmlFor="ex-banner-image-url">لینک منبع تصویر (اختیاری)</label>
          <input
            id="ex-banner-image-url"
            dir="ltr"
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            placeholder="https://... یا /uploads/..."
          />
        </div>
        <div className="field field--block">
          <label htmlFor="ex-banner-title">عنوان (اختیاری)</label>
          <input
            className="admin-ex-banner-title-input"
            id="ex-banner-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="مثلاً: جشنواره نرخ ویژه آخر هفته"
          />
        </div>
        <div className="field field--block">
          <label htmlFor="ex-banner-link">لینک (اختیاری)</label>
          <input
            id="ex-banner-link"
            value={form.link_url}
            onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
            placeholder="https://... یا /business?slug=..."
            dir="ltr"
          />
        </div>
        <div className="form-grid admin-ex-banner-two-col-grid" style={{ display: "grid", gap: "0.75rem" }}>
          <div className="field field--block">
            <label>صفحه</label>
            <div className="admin-banner-radio-group">
            <label className={`admin-banner-radio${form.page_scope === "exchange" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="ex-banner-page-scope"
                checked={form.page_scope === "exchange"}
                onChange={() => setForm((f) => ({ ...f, page_scope: "exchange" }))}
              />
              <span>صرافی‌ها</span>
            </label>
            <label className={`admin-banner-radio${form.page_scope === "directory" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="ex-banner-page-scope"
                checked={form.page_scope === "directory"}
                onChange={() => setForm((f) => ({ ...f, page_scope: "directory" }))}
              />
              <span>دایرکتوری عمومی</span>
            </label>
            </div>
          </div>
          <div className="field field--block">
            <label>محل نمایش</label>
            <div className="admin-banner-radio-group">
            <label className={`admin-banner-radio${form.placement === "top" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="ex-banner-placement"
                checked={form.placement === "top"}
                onChange={() => setForm((f) => ({ ...f, placement: "top" }))}
              />
              <span>ابتدای لیست</span>
            </label>
            <label className={`admin-banner-radio${form.placement === "between" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="ex-banner-placement"
                checked={form.placement === "between"}
                onChange={() => setForm((f) => ({ ...f, placement: "between" }))}
              />
              <span>بین کارت‌ها</span>
            </label>
            <label className={`admin-banner-radio${form.placement === "fullscreen" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="ex-banner-placement"
                checked={form.placement === "fullscreen"}
                onChange={() => setForm((f) => ({ ...f, placement: "fullscreen" }))}
              />
              <span>تمام‌صفحه</span>
            </label>
            <label className={`admin-banner-radio${form.placement === "below-categories" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="ex-banner-placement"
                checked={form.placement === "below-categories"}
                onChange={() => setForm((f) => ({ ...f, placement: "below-categories" }))}
              />
              <span>زیر دسته‌بندی‌ها (اپ)</span>
            </label>
            <label className={`admin-banner-radio${form.placement === "in-post" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="ex-banner-placement"
                checked={form.placement === "in-post"}
                onChange={() => setForm((f) => ({ ...f, placement: "in-post" }))}
              />
              <span>داخل آگهی (اپ)</span>
            </label>
            </div>
          </div>
          <div className="field field--block">
            <label htmlFor="ex-banner-category-filter">دسته‌بندی هدف (اختیاری)</label>
            <input
              id="ex-banner-category-filter"
              value={form.category_filter}
              onChange={(e) => setForm((f) => ({ ...f, category_filter: e.target.value }))}
              placeholder="مثلاً: رستوران — فقط در آگهی‌های آن دسته نمایش می‌یابد"
            />
            <span className="field-hint">خالی = نمایش برای همه دسته‌ها</span>
          </div>
          <div className="field field--block">
            <label htmlFor="ex-banner-start">شروع نمایش</label>
            <input
              id="ex-banner-start"
              type="datetime-local"
              value={form.start_at}
              onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
            />
          </div>
          <div className="field field--block">
            <label htmlFor="ex-banner-end">پایان نمایش</label>
            <input
              id="ex-banner-end"
              type="datetime-local"
              value={form.end_at}
              onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
            />
          </div>
          <div className="field field--block">
            <label htmlFor="ex-banner-daily-cap">نمایش/روز برای هر کاربر</label>
            <input
              id="ex-banner-daily-cap"
              type="number"
              min={1}
              max={50}
              value={form.daily_user_cap}
              onChange={(e) => setForm((f) => ({ ...f, daily_user_cap: Number.parseInt(e.target.value || "2", 10) || 2 }))}
            />
          </div>
          <div className="field field--block">
            <label htmlFor="ex-banner-sort">ترتیب</label>
            <input
              id="ex-banner-sort"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number.parseInt(e.target.value || "0", 10) || 0 }))}
            />
          </div>
          <div className="field field--block" style={{ alignSelf: "end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              فعال
            </label>
          </div>
        </div>
        <div className="admin-ex-banner-create-form__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "در حال ذخیره…" : "ذخیره بنر"}
          </button>
        </div>
      </form>
      </section>

      {msg ? <p className="field-hint">{msg}</p> : null}

      {collapsed ? (
        <p className="field-hint" style={{ marginTop: "0.45rem" }}>
          لیست بنرها کمینه شده است. برای مشاهده روی «نمایش بنرها» بزنید.
        </p>
      ) : null}

      {!collapsed ? (
        <section className="admin-ex-banner-section-card">
        <div className="dashboard-actions" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <div className="field field--block" style={{ minWidth: "16rem" }}>
            <label htmlFor="ex-banner-search">جستجوی بنر</label>
            <input
              id="ex-banner-search"
              dir="rtl"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="عنوان، لینک یا شناسهٔ بنر…"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="ex-banner-filter-scope">صفحه</label>
            <select id="ex-banner-filter-scope" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
              <option value="">همه</option>
              <option value="exchange">صرافی‌ها</option>
              <option value="directory">دایرکتوری</option>
            </select>
          </div>
          <div className="field field--block">
            <label htmlFor="ex-banner-filter-status">وضعیت</label>
            <select id="ex-banner-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">همه</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          </div>
        </div>
        {loading ? <p className="field-hint">در حال بارگذاری…</p> : null}
        {!loading && rows.length === 0 ? <p className="field-hint">هنوز بنری ثبت نشده است.</p> : null}
        {!loading && rows.length > 0 && filteredRows.length === 0 ? (
          <p className="field-hint">با این جستجو/فیلتر بنری پیدا نشد.</p>
        ) : null}
        {!loading && filteredRows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "2.2rem" }}><span className="visually-hidden">جابجایی</span></th>
                  <th>پیش‌نمایش</th>
                  <th>عنوان</th>
                  <th>محل نمایش</th>
                  <th>دسته هدف</th>
                  <th>زمان‌بندی</th>
                  <th>نمایش/روز</th>
                  <th>کلیک</th>
                  <th>فعال</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(r.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(r.id));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData("text/plain");
                      const fromId = Number.parseInt(raw, 10);
                      const toId = r.id;
                      if (!Number.isFinite(fromId) || fromId === toId) {
                        setDraggingId(null);
                        return;
                      }
                      const nextRows = reorderRows(rows, fromId, toId);
                      setRows(nextRows);
                      setDraggingId(null);
                      persistReorder(nextRows);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={draggingId === r.id ? "admin-banner-row--dragging" : undefined}
                  >
                    <td title="جابجایی با Drag & Drop">
                      <span className="admin-banner-drag-handle" aria-hidden="true">⋮⋮</span>
                    </td>
                    <td>
                      <img
                        src={r.image_url}
                        alt={r.title || "بنر تبلیغاتی"}
                        style={{ width: "140px", maxWidth: "100%", borderRadius: "8px", border: "1px solid rgba(58,11,71,0.14)" }}
                      />
                    </td>
                    <td>
                      {r.title || "—"}
                    </td>
                    <td>
                      {locationLabel(r)}
                    </td>
                    <td>
                      {r.category_filter || <span className="field-hint">همه</span>}
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: "0.2rem" }}>
                        <span className="field-hint">{scheduleLabel(r)}</span>
                        <small className="field-hint">پایان: {formatEndDate(r.end_at)}</small>
                      </div>
                    </td>
                    <td>
                      {Number.isFinite(Number(r.daily_user_cap)) ? Number(r.daily_user_cap).toLocaleString("fa-IR") : "۲"}
                    </td>
                    <td>
                      {Number.isFinite(Number(r.clicks_count)) ? Number(r.clicks_count).toLocaleString("fa-IR") : "۰"}
                    </td>
                    <td>
                      {r.is_active ? "فعال" : "غیرفعال"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <Link className="btn btn--primary" to={`/admin/exchanges/banners/${r.id}`}>
                          ویرایش
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        </section>
      ) : null}
      </div>
    </section>
  );
}
