import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatchJson, apiPost, apiPostMultipart } from "../../api.js";

const defaultForm = {
  title: "",
  image_url: "",
  link_url: "",
  page_scope: "exchange",
  placement: "between",
  daily_user_cap: 2,
  start_at: "",
  end_at: "",
  sort_order: 0,
  is_active: true,
};

function toInputDateTime(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  const t = s.replace(" ", "T");
  const m = t.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return m ? m[1] : "";
}

function scheduleLabel(row) {
  const now = new Date();
  const start = row?.start_at ? new Date(String(row.start_at).replace(" ", "T")) : null;
  const end = row?.end_at ? new Date(String(row.end_at).replace(" ", "T")) : null;
  if (start instanceof Date && !Number.isNaN(start.valueOf()) && start > now) return "زمان‌بندی‌شده";
  if (end instanceof Date && !Number.isNaN(end.valueOf()) && end < now) return "پایان‌یافته";
  return "در حال نمایش";
}

function formatEndDate(value) {
  const s = String(value || "").trim();
  if (!s) return "—";
  const t = s.replace(" ", "T");
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return s;
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
}

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
  const [savingId, setSavingId] = useState(null);
  const [imageSavingId, setImageSavingId] = useState(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [updateOkOpen, setUpdateOkOpen] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const editOpen = !!editDraft;

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

  const patchBanner = async (id, patch) => {
    try {
      const updated = await apiPatchJson(`/api/admin/exchange-banners/${id}`, patch);
      const normalized = {
        ...updated,
        start_at: toInputDateTime(updated?.start_at),
        end_at: toInputDateTime(updated?.end_at),
      };
      setRows((prev) => sortBannerRows(prev.map((r) => (r.id === id ? normalized : r))));
      return normalized;
    } catch (e) {
      setMsg(e.message || "ذخیره نشد.");
      return null;
    }
  };

  const saveBannerRow = async (row) => {
    setMsg("");
    setSavingId(row.id);
    try {
      const out = await patchBanner(row.id, {
        title: row.title || "",
        image_url: row.image_url || "",
        link_url: row.link_url || "",
        page_scope: row.page_scope || "exchange",
        placement: row.placement || "between",
        daily_user_cap: Number(row.daily_user_cap) > 0 ? Number(row.daily_user_cap) : 2,
        start_at: row.start_at || "",
        end_at: row.end_at || "",
        sort_order: row.sort_order ?? 0,
        is_active: !!row.is_active,
      });
      if (out) {
        setMsg("");
        setUpdateOkOpen(true);
        return true;
      }
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const openEdit = (row) => {
    setEditDraft({
      ...row,
      start_at: toInputDateTime(row?.start_at),
      end_at: toInputDateTime(row?.end_at),
    });
    setEditImageFile(null);
  };

  const closeEdit = () => {
    if (savingId || imageSavingId) return;
    setEditDraft(null);
    setEditImageFile(null);
  };

  const saveBannerImage = async (id) => {
    if (!editImageFile) {
      setMsg("ابتدا تصویر جدید را انتخاب کنید.");
      return false;
    }
    setMsg("");
    setImageSavingId(id);
    try {
      const fd = new FormData();
      fd.append("image", editImageFile);
      const out = await apiPostMultipart(`/api/admin/exchange-banners/${id}/image`, fd);
      const normalized = {
        ...out,
        start_at: toInputDateTime(out?.start_at),
        end_at: toInputDateTime(out?.end_at),
      };
      setRows((prev) => sortBannerRows(prev.map((r) => (r.id === id ? normalized : r))));
      setEditDraft((d) => (d && d.id === id ? { ...d, image_url: normalized.image_url } : d));
      setEditImageFile(null);
      setMsg("تصویر بنر ذخیره شد.");
      return true;
    } catch (e) {
      setMsg(e.message || "ذخیره تصویر ناموفق بود.");
      return false;
    } finally {
      setImageSavingId(null);
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
    const place = placement === "top" ? "ابتدای لیست" : placement === "fullscreen" ? "تمام‌صفحه" : "بین کارت‌ها";
    return `${scope} · ${place}`;
  };

  const removeBanner = async (id) => {
    if (!window.confirm("این بنر حذف شود؟")) return;
    try {
      await apiDelete(`/api/admin/exchange-banners/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setMsg(e.message || "حذف نشد.");
    }
  };

  return (
    <section className="admin-exchange-hub__panel dashboard-panel" aria-labelledby="admin-exchange-banners-h">
      <header className="admin-ex-banner-head">
        <p className="admin-ex-banner-head__eyebrow">Ads Manager</p>
        <h2 id="admin-exchange-banners-h" className="admin-ex-banner-head__title">
          بنرهای تبلیغاتی
        </h2>
        <p className="admin-ex-banner-head__lead field-hint">
          بنرها در سه حالت `top` (ابتدای لیست)، `between` (بین کارت‌ها) و `fullscreen` (تمام‌صفحه) نمایش داده می‌شوند.
          با گزینهٔ «نمایش/روز برای هر کاربر» می‌توانید تعداد دفعات نمایش تمام‌صفحه را کنترل کنید.
        </p>
        <div style={{ marginTop: "0.55rem" }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setCollapsed((v) => {
                const next = !v;
                if (!next) return next;
                setEditDraft(null);
                setUpdateOkOpen(false);
                return next;
              });
            }}
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
            </div>
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
        {loading ? <p className="field-hint">در حال بارگذاری…</p> : null}
        {!loading && rows.length === 0 ? <p className="field-hint">هنوز بنری ثبت نشده است.</p> : null}
        {!loading && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "2.2rem" }}><span className="visually-hidden">جابجایی</span></th>
                  <th>پیش‌نمایش</th>
                  <th>عنوان</th>
                  <th>محل نمایش</th>
                  <th>زمان‌بندی</th>
                  <th>نمایش/روز</th>
                  <th>کلیک</th>
                  <th>فعال</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
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
                        <button type="button" className="btn btn--primary" onClick={() => openEdit(r)}>
                          ویرایش
                        </button>
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

      <div className="admin-detail-modal" hidden={!editOpen || collapsed}>
        <div className="admin-detail-modal__backdrop" onClick={closeEdit} />
        <div className="admin-detail-modal__panel" role="dialog" aria-modal="true" aria-labelledby="banner-edit-title">
          <button type="button" className="admin-detail-modal__close" onClick={closeEdit} aria-label="بستن">
            ×
          </button>
          <p className="admin-detail-modal__type">Banner</p>
          <h3 id="banner-edit-title" className="admin-detail-modal__title">
            ویرایش بنر تبلیغاتی
          </h3>

          {editDraft ? (
            <>
              <div className="admin-detail-modal__body">
                <img
                  src={editDraft.image_url}
                  alt={editDraft.title || "بنر تبلیغاتی"}
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(58,11,71,0.14)" }}
                />
                <div className="field field--block" style={{ marginTop: "0.7rem" }}>
                  <label>تصویر جدید</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                  />
                  <div style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={imageSavingId === editDraft.id || savingId === editDraft.id}
                      onClick={() => saveBannerImage(editDraft.id)}
                    >
                      {imageSavingId === editDraft.id ? "در حال ذخیره تصویر…" : "ذخیره تصویر"}
                    </button>
                  </div>
                </div>
                <div className="field field--block" style={{ marginTop: "0.7rem" }}>
                  <label>لینک منبع تصویر</label>
                  <input
                    dir="ltr"
                    value={editDraft.image_url || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, image_url: e.target.value }))}
                    placeholder="https://... یا /uploads/..."
                  />
                  <span className="field-hint">با «ذخیره تغییرات» اعمال می‌شود.</span>
                </div>
              </div>

              <div className="admin-detail-modal__fields" style={{ display: "grid", gap: "0.7rem" }}>
                <div className="field field--block">
                  <label>عنوان</label>
                  <input value={editDraft.title || ""} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} />
                </div>
                <div className="field field--block">
                  <label>لینک</label>
                  <input dir="ltr" value={editDraft.link_url || ""} onChange={(e) => setEditDraft((d) => ({ ...d, link_url: e.target.value }))} />
                </div>
                <div className="form-grid admin-ex-banner-two-col-grid" style={{ display: "grid", gap: "0.7rem" }}>
                  <div className="field field--block">
                    <label>صفحه</label>
                    <div className="admin-banner-radio-group">
                    <label className={`admin-banner-radio${(editDraft.page_scope || "exchange") === "exchange" ? " is-active" : ""}`}>
                      <input
                        type="radio"
                        name="banner-edit-scope"
                        checked={(editDraft.page_scope || "exchange") === "exchange"}
                        onChange={() => setEditDraft((d) => ({ ...d, page_scope: "exchange" }))}
                      />
                      <span>صرافی‌ها</span>
                    </label>
                    <label className={`admin-banner-radio${(editDraft.page_scope || "exchange") === "directory" ? " is-active" : ""}`}>
                      <input
                        type="radio"
                        name="banner-edit-scope"
                        checked={(editDraft.page_scope || "exchange") === "directory"}
                        onChange={() => setEditDraft((d) => ({ ...d, page_scope: "directory" }))}
                      />
                      <span>دایرکتوری</span>
                    </label>
                    </div>
                  </div>
                  <div className="field field--block">
                    <label>محل نمایش</label>
                    <div className="admin-banner-radio-group">
                    <label className={`admin-banner-radio${(editDraft.placement || "between") === "top" ? " is-active" : ""}`}>
                      <input
                        type="radio"
                        name="banner-edit-placement"
                        checked={(editDraft.placement || "between") === "top"}
                        onChange={() => setEditDraft((d) => ({ ...d, placement: "top" }))}
                      />
                      <span>ابتدای لیست</span>
                    </label>
                    <label className={`admin-banner-radio${(editDraft.placement || "between") === "between" ? " is-active" : ""}`}>
                      <input
                        type="radio"
                        name="banner-edit-placement"
                        checked={(editDraft.placement || "between") === "between"}
                        onChange={() => setEditDraft((d) => ({ ...d, placement: "between" }))}
                      />
                      <span>بین کارت‌ها</span>
                    </label>
                    <label className={`admin-banner-radio${(editDraft.placement || "between") === "fullscreen" ? " is-active" : ""}`}>
                      <input
                        type="radio"
                        name="banner-edit-placement"
                        checked={(editDraft.placement || "between") === "fullscreen"}
                        onChange={() => setEditDraft((d) => ({ ...d, placement: "fullscreen" }))}
                      />
                      <span>تمام‌صفحه</span>
                    </label>
                    </div>
                  </div>
                  <div className="field field--block">
                    <label>شروع نمایش</label>
                    <input
                      type="datetime-local"
                      value={editDraft.start_at || ""}
                      onChange={(e) => setEditDraft((d) => ({ ...d, start_at: e.target.value }))}
                    />
                  </div>
                  <div className="field field--block">
                    <label>پایان نمایش</label>
                    <input
                      type="datetime-local"
                      value={editDraft.end_at || ""}
                      onChange={(e) => setEditDraft((d) => ({ ...d, end_at: e.target.value }))}
                    />
                  </div>
                  <div className="field field--block">
                    <label>نمایش/روز برای هر کاربر</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={Number(editDraft.daily_user_cap) > 0 ? Number(editDraft.daily_user_cap) : 2}
                      onChange={(e) => setEditDraft((d) => ({ ...d, daily_user_cap: Number.parseInt(e.target.value || "2", 10) || 2 }))}
                    />
                  </div>
                  <div className="field field--block">
                    <label>ترتیب</label>
                    <input
                      type="number"
                      value={editDraft.sort_order ?? 0}
                      onChange={(e) => setEditDraft((d) => ({ ...d, sort_order: Number.parseInt(e.target.value || "0", 10) || 0 }))}
                    />
                  </div>
                  <div className="field field--block" style={{ alignSelf: "end" }}>
                    <label style={{ display: "flex", gap: "0.35rem", alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editDraft.is_active} onChange={(e) => setEditDraft((d) => ({ ...d, is_active: e.target.checked }))} />
                      فعال
                    </label>
                  </div>
                </div>
              </div>

              <div className="admin-detail-modal__primary-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={savingId === editDraft.id}
                  onClick={async () => {
                    const ok = await saveBannerRow(editDraft);
                    if (ok) closeEdit();
                  }}
                >
                  {savingId === editDraft.id ? "در حال ذخیره…" : "ذخیره تغییرات"}
                </button>
              </div>

              <span className="admin-detail-modal__tools-label">ابزارها</span>
              <div className="admin-detail-modal__tools-row">
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={savingId === editDraft.id}
                  onClick={async () => {
                    await removeBanner(editDraft.id);
                    closeEdit();
                  }}
                >
                  حذف بنر
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="admin-detail-modal" hidden={!updateOkOpen || collapsed}>
        <div className="admin-detail-modal__backdrop" onClick={() => setUpdateOkOpen(false)} />
        <div className="admin-detail-modal__panel" role="dialog" aria-modal="true" aria-labelledby="banner-update-ok-title">
          <button type="button" className="admin-detail-modal__close" onClick={() => setUpdateOkOpen(false)} aria-label="بستن">
            ×
          </button>
          <p className="admin-detail-modal__type">Success</p>
          <h3 id="banner-update-ok-title" className="admin-detail-modal__title">
            به‌روزرسانی ذخیره شد.
          </h3>
          <div className="admin-detail-modal__primary-actions">
            <button type="button" className="btn btn--primary" onClick={() => setUpdateOkOpen(false)}>
              متوجه شدم
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
