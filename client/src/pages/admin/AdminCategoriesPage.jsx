import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPatchJson } from "../../api.js";

export default function AdminCategoriesPage() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingIcon, setEditingIcon] = useState({});

  const load = () => {
    apiGet("/api/admin/categories")
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await apiPost("/api/admin/categories", { name: name.trim(), icon: icon.trim() || null });
      setName("");
      setIcon("");
      setMsg("دسته جدید اضافه شد.");
      load();
    } catch (err) {
      setMsg(err.message || "خطا در افزودن دسته");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row) => {
    try {
      const next = await apiPatchJson(`/api/admin/categories/${row.id}`, { is_active: !row.is_active });
      setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    } catch (e) {
      setMsg(e.message || "خطا در تغییر وضعیت");
    }
  };

  const saveIcon = async (row) => {
    const newIcon = (editingIcon[row.id] ?? row.icon ?? "").trim() || null;
    try {
      const next = await apiPatchJson(`/api/admin/categories/${row.id}`, { icon: newIcon });
      setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      setEditingIcon((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
      setMsg("آیکون ذخیره شد.");
    } catch (e) {
      setMsg(e.message || "خطا در ذخیره آیکون");
    }
  };

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
      </p>
      <section className="dashboard-panel">
        <h2>دسته‌بندی‌ها</h2>
        <p className="field-hint">دسته‌های فعال در فرم مدیر کسب‌وکار به صورت Dropdown نمایش داده می‌شوند.</p>
        <form onSubmit={add} className="form-grid" style={{ maxWidth: "32rem" }}>
          <div className="field field--block">
            <label htmlFor="cat-name">نام دسته</label>
            <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field field--block">
            <label htmlFor="cat-icon">آیکون (کلاس Font Awesome یا emoji)</label>
            <input
              id="cat-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="مثال: fa-solid fa-store  یا  🏪"
              dir="ltr"
            />
          </div>
          <div className="dashboard-actions dashboard-actions--inline">
            <button className="btn btn--primary" disabled={busy}>
              {busy ? "در حال افزودن…" : "افزودن دسته"}
            </button>
          </div>
        </form>
        {!!msg && <p className="field-hint">{msg}</p>}
        <div className="table-wrap" style={{ marginTop: "1rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>نام</th>
                <th>آیکون</th>
                <th>وضعیت</th>
                <th>اقدام</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const iconVal = editingIcon[r.id] !== undefined ? editingIcon[r.id] : (r.icon || "");
                const isDirty = editingIcon[r.id] !== undefined && editingIcon[r.id] !== (r.icon || "");
                return (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {r.icon && (
                          r.icon.startsWith("fa-") || r.icon.startsWith("fas ") || r.icon.startsWith("fa ") || r.icon.includes("fa-solid") || r.icon.includes("fa-regular")
                            ? <i className={r.icon} style={{ fontSize: "1.1rem", opacity: 0.75 }} />
                            : <span style={{ fontSize: "1.2rem" }}>{r.icon}</span>
                        )}
                        <input
                          value={iconVal}
                          onChange={(e) => setEditingIcon((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="آیکون…"
                          dir="ltr"
                          style={{ width: "13rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
                        />
                        {isDirty && (
                          <button type="button" className="btn btn--primary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }} onClick={() => saveIcon(r)}>
                            ذخیره
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{r.is_active ? "فعال" : "غیرفعال"}</td>
                    <td>
                      <button type="button" className="btn btn--ghost" onClick={() => toggle(r)}>
                        {r.is_active ? "غیرفعال کردن" : "فعال کردن"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
