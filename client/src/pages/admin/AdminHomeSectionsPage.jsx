import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatchJson, apiDelete } from "../../api.js";

const SECTION_TYPES = [
  { value: "category-grid", label: "🗂 گرید دسته‌بندی‌ها" },
  { value: "featured-listings", label: "⭐ کسب‌وکارهای برجسته" },
  { value: "services-grid", label: "🛠 گرید خدمات حرفه‌ای" },
  { value: "city-grid", label: "🏙 گرید شهرها" },
];

const BG_OPTIONS = [
  { value: "white", label: "سفید" },
  { value: "gray", label: "خاکستری روشن" },
  { value: "dark", label: "تیره" },
];

const EMPTY_FORM = {
  title: "", subtitle: "", eyebrow: "", section_type: "category-grid",
  category_filter: "", icon: "", background: "gray", max_items: 8,
};

function SectionForm({ initial = EMPTY_FORM, onSave, onCancel, busy }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...f, max_items: Number(f.max_items) || 8 });
  }

  return (
    <form onSubmit={handleSubmit} className="hs-form">
      <div className="hs-form__grid">
        <div className="hs-field hs-field--wide">
          <label>عنوان بخش <span style={{ color: "#ef4444" }}>*</span></label>
          <input value={f.title} onChange={set("title")} placeholder="مثلاً: دسته‌بندی‌های محبوب" required />
        </div>
        <div className="hs-field">
          <label>نوع بخش</label>
          <select value={f.section_type} onChange={set("section_type")}>
            {SECTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="hs-field">
          <label>پیش‌عنوان (eyebrow)</label>
          <input value={f.eyebrow} onChange={set("eyebrow")} placeholder="مثلاً: مرور بر اساس دسته" />
        </div>
        <div className="hs-field hs-field--wide">
          <label>زیرعنوان</label>
          <input value={f.subtitle} onChange={set("subtitle")} placeholder="توضیح کوتاه برای این بخش" />
        </div>
        <div className="hs-field">
          <label>فیلتر دسته (اختیاری)</label>
          <input value={f.category_filter} onChange={set("category_filter")} placeholder="مثلاً: رستوران, صرافی" />
          <small>فقط برای نوع گرید دسته‌بندی — کاما جدا کنید</small>
        </div>
        <div className="hs-field">
          <label>آیکون</label>
          <input value={f.icon} onChange={set("icon")} placeholder="🍽 یا متن" maxLength={10} />
        </div>
        <div className="hs-field">
          <label>پس‌زمینه</label>
          <select value={f.background} onChange={set("background")}>
            {BG_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        <div className="hs-field">
          <label>تعداد آیتم</label>
          <input type="number" min={1} max={50} value={f.max_items} onChange={set("max_items")} />
        </div>
      </div>
      <div className="hs-form__actions">
        <button type="submit" className="hs-btn hs-btn--primary" disabled={busy}>
          {busy ? "در حال ذخیره…" : "ذخیره"}
        </button>
        {onCancel && (
          <button type="button" className="hs-btn hs-btn--ghost" onClick={onCancel}>انصراف</button>
        )}
      </div>
    </form>
  );
}

function SectionRow({ row, onToggle, onDelete, onEdit, onMove, isFirst, isLast }) {
  const typeLabel = SECTION_TYPES.find((t) => t.value === row.section_type)?.label || row.section_type;
  return (
    <div className={`hs-row${!row.is_active ? " hs-row--inactive" : ""}`}>
      <div className="hs-row__order">
        <button type="button" onClick={() => onMove(row.id, -1)} disabled={isFirst} title="بالا">▲</button>
        <span>{row.sort_order}</span>
        <button type="button" onClick={() => onMove(row.id, 1)} disabled={isLast} title="پایین">▼</button>
      </div>
      <div className="hs-row__body">
        <div className="hs-row__header">
          {row.icon && <span className="hs-row__icon">{row.icon}</span>}
          <strong className="hs-row__title">{row.title}</strong>
          <span className="hs-row__type">{typeLabel}</span>
          {row.category_filter && (
            <span className="hs-row__filter">📂 {row.category_filter}</span>
          )}
        </div>
        {row.subtitle && <p className="hs-row__subtitle">{row.subtitle}</p>}
        <div className="hs-row__meta">
          <span>پس‌زمینه: {BG_OPTIONS.find((b) => b.value === row.background)?.label || row.background}</span>
          <span>تعداد: {row.max_items}</span>
        </div>
      </div>
      <div className="hs-row__actions">
        <button
          type="button"
          className={`hs-toggle${row.is_active ? " hs-toggle--on" : ""}`}
          onClick={() => onToggle(row)}
          title={row.is_active ? "غیرفعال کن" : "فعال کن"}
        >
          {row.is_active ? "✅ فعال" : "⏸ غیرفعال"}
        </button>
        <button type="button" className="hs-btn hs-btn--sm" onClick={() => onEdit(row)}>ویرایش</button>
        <button type="button" className="hs-btn hs-btn--sm hs-btn--danger" onClick={() => onDelete(row.id)}>حذف</button>
      </div>
    </div>
  );
}

export default function AdminHomeSectionsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    setLoading(true);
    apiGet("/api/admin/home-sections")
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleAdd(data) {
    setBusy(true); setMsg("");
    try {
      await apiPost("/api/admin/home-sections", data);
      setMsg("بخش جدید اضافه شد.");
      setShowAdd(false);
      load();
    } catch (e) { setMsg(e.message || "خطا در افزودن بخش"); }
    finally { setBusy(false); }
  }

  async function handleEdit(data) {
    setBusy(true); setMsg("");
    try {
      await apiPatchJson(`/api/admin/home-sections/${editingId}`, data);
      setMsg("بخش بروزرسانی شد.");
      setEditingId(null);
      load();
    } catch (e) { setMsg(e.message || "خطا در بروزرسانی"); }
    finally { setBusy(false); }
  }

  async function handleToggle(row) {
    try {
      const updated = await apiPatchJson(`/api/admin/home-sections/${row.id}`, { is_active: !row.is_active });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) { setMsg(e.message || "خطا در تغییر وضعیت"); }
  }

  async function handleDelete(id) {
    if (!window.confirm("آیا مطمئن هستید؟")) return;
    try {
      await apiDelete(`/api/admin/home-sections/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setMsg("بخش حذف شد.");
    } catch (e) { setMsg(e.message || "خطا در حذف"); }
  }

  async function handleMove(id, dir) {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= rows.length) return;
    const a = rows[idx];
    const b = rows[swapIdx];
    try {
      await Promise.all([
        apiPatchJson(`/api/admin/home-sections/${a.id}`, { sort_order: b.sort_order }),
        apiPatchJson(`/api/admin/home-sections/${b.id}`, { sort_order: a.sort_order }),
      ]);
      load();
    } catch (e) { setMsg(e.message || "خطا در جابجایی"); }
  }

  const editingRow = editingId ? rows.find((r) => r.id === editingId) : null;

  return (
    <div dir="rtl" className="hs-page">
      <style>{`
        .hs-page { padding: 2rem; font-family: inherit; max-width: 900px; }
        .hs-page__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
        .hs-page__title { font-size: 1.4rem; font-weight: 700; margin: 0; }
        .hs-page__sub { color: #6b7280; font-size: .875rem; margin: .25rem 0 0; }
        .hs-msg { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: .65rem 1rem; color: #065f46; font-size: .875rem; margin-bottom: 1rem; }

        .hs-add-box { background: #f8f9fc; border: 1.5px dashed #c7d0ff; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
        .hs-add-box__title { font-size: 1rem; font-weight: 700; margin: 0 0 1rem; }

        .hs-form__grid { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; }
        .hs-field--wide { grid-column: 1 / -1; }
        .hs-field { display: flex; flex-direction: column; gap: .3rem; }
        .hs-field label { font-size: .82rem; font-weight: 600; color: #374151; }
        .hs-field small { font-size: .75rem; color: #9ca3af; }
        .hs-field input, .hs-field select {
          border: 1.5px solid #e5e7eb; border-radius: 8px; padding: .55rem .75rem;
          font-size: .875rem; outline: none; font-family: inherit; transition: border-color .2s;
        }
        .hs-field input:focus, .hs-field select:focus { border-color: #4f67ff; }
        .hs-form__actions { display: flex; gap: .75rem; margin-top: 1rem; }

        .hs-btn { border: none; border-radius: 8px; padding: .5rem 1.25rem; font-size: .875rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .2s; }
        .hs-btn--primary { background: #4f67ff; color: #fff; }
        .hs-btn--primary:hover:not(:disabled) { background: #3a52e8; }
        .hs-btn--primary:disabled { opacity: .6; cursor: not-allowed; }
        .hs-btn--ghost { background: none; border: 1.5px solid #e5e7eb; color: #6b7280; }
        .hs-btn--ghost:hover { border-color: #9ca3af; color: #374151; }
        .hs-btn--sm { padding: .3rem .75rem; font-size: .78rem; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
        .hs-btn--sm:hover { background: #e5e7eb; }
        .hs-btn--danger { background: #fff1f2; color: #ef4444; border: 1px solid #fecdd3; }
        .hs-btn--danger:hover { background: #ffe4e6; }

        .hs-list { display: flex; flex-direction: column; gap: .75rem; }
        .hs-row {
          display: flex; gap: 1rem; align-items: flex-start;
          border: 1.5px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.25rem;
          background: #fff; transition: border-color .2s;
        }
        .hs-row:hover { border-color: #c7d0ff; }
        .hs-row--inactive { opacity: .55; }
        .hs-row__order { display: flex; flex-direction: column; align-items: center; gap: .25rem; min-width: 36px; }
        .hs-row__order button {
          background: none; border: 1px solid #e5e7eb; border-radius: 6px;
          width: 26px; height: 26px; cursor: pointer; font-size: .7rem; color: #6b7280;
          display: flex; align-items: center; justify-content: center;
        }
        .hs-row__order button:disabled { opacity: .3; cursor: not-allowed; }
        .hs-row__order span { font-size: .75rem; color: #9ca3af; }
        .hs-row__body { flex: 1; min-width: 0; }
        .hs-row__header { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; margin-bottom: .35rem; }
        .hs-row__icon { font-size: 1.25rem; }
        .hs-row__title { font-size: .95rem; font-weight: 700; color: #111827; }
        .hs-row__type { font-size: .75rem; background: #eef0ff; color: #4f67ff; border-radius: 6px; padding: .2rem .5rem; }
        .hs-row__filter { font-size: .75rem; background: #fef9c3; color: #854d0e; border-radius: 6px; padding: .2rem .5rem; }
        .hs-row__subtitle { font-size: .82rem; color: #6b7280; margin: 0 0 .4rem; }
        .hs-row__meta { display: flex; gap: 1rem; font-size: .75rem; color: #9ca3af; }
        .hs-row__actions { display: flex; flex-direction: column; gap: .4rem; align-items: flex-end; min-width: 110px; }
        .hs-toggle {
          font-size: .75rem; border: 1px solid #e5e7eb; background: #f9fafb;
          color: #6b7280; border-radius: 6px; padding: .25rem .6rem; cursor: pointer; font-family: inherit;
          white-space: nowrap;
        }
        .hs-toggle--on { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }

        .hs-empty { text-align: center; padding: 3rem 1rem; color: #9ca3af; }
        .hs-edit-box { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
        .hs-edit-box__title { font-size: 1rem; font-weight: 700; margin: 0 0 1rem; color: #92400e; }

        .hs-note { background: #f0f4ff; border: 1px solid #c7d0ff; border-radius: 10px; padding: 1rem 1.25rem; margin-top: 2rem; font-size: .85rem; color: #374151; }
        .hs-note strong { color: #4f67ff; }
      `}</style>

      <div className="hs-page__header">
        <div>
          <h1 className="hs-page__title">🏠 بخش‌های صفحه اصلی</h1>
          <p className="hs-page__sub">ترتیب و محتوای بخش‌های صفحه اصلی سایت را کنترل کنید</p>
        </div>
        <button type="button" className="hs-btn hs-btn--primary" onClick={() => { setShowAdd((v) => !v); setEditingId(null); }}>
          {showAdd ? "انصراف" : "+ بخش جدید"}
        </button>
      </div>

      {msg && <div className="hs-msg">{msg}</div>}

      {showAdd && (
        <div className="hs-add-box">
          <p className="hs-add-box__title">+ افزودن بخش جدید</p>
          <SectionForm onSave={handleAdd} onCancel={() => setShowAdd(false)} busy={busy} />
        </div>
      )}

      {editingRow && (
        <div className="hs-edit-box">
          <p className="hs-edit-box__title">✏️ ویرایش: {editingRow.title}</p>
          <SectionForm
            initial={{
              title: editingRow.title,
              subtitle: editingRow.subtitle || "",
              eyebrow: editingRow.eyebrow || "",
              section_type: editingRow.section_type,
              category_filter: editingRow.category_filter || "",
              icon: editingRow.icon || "",
              background: editingRow.background,
              max_items: editingRow.max_items,
            }}
            onSave={handleEdit}
            onCancel={() => setEditingId(null)}
            busy={busy}
          />
        </div>
      )}

      {loading ? (
        <div className="hs-empty">در حال بارگذاری…</div>
      ) : rows.length === 0 ? (
        <div className="hs-empty">
          <div style={{ fontSize: "3rem", marginBottom: ".75rem" }}>📭</div>
          <p>هنوز بخشی تعریف نشده. بخش اول را اضافه کنید.</p>
        </div>
      ) : (
        <div className="hs-list">
          {rows.map((row, idx) => (
            <SectionRow
              key={row.id}
              row={row}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={(r) => { setEditingId(r.id); setShowAdd(false); window.scrollTo(0, 0); }}
              onMove={handleMove}
              isFirst={idx === 0}
              isLast={idx === rows.length - 1}
            />
          ))}
        </div>
      )}

      <div className="hs-note">
        <strong>راهنما:</strong> بخش‌های فعال به ترتیب sort_order در صفحه اصلی نمایش داده می‌شوند.
        نوع <strong>گرید دسته‌بندی</strong> — با فیلتر دسته مشخص می‌کنید کدام دسته‌ها نمایش داده شوند (خالی = همه).
        نوع <strong>کسب‌وکارهای برجسته</strong> — لیست کسب‌وکارهای promoted را نشان می‌دهد.
      </div>
    </div>
  );
}
