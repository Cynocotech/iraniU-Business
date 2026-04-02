import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPostMultipart } from "../../api.js";

export default function AdminBulkImportPage() {
  const [preset, setPreset] = useState("iraniu");
  const [contactEmail, setContactEmail] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [result, setResult] = useState(null);
  const [sqliteFile, setSqliteFile] = useState(null);
  const [sqliteBusy, setSqliteBusy] = useState(false);

  const downloadTemplate = async (p) => {
    setMsg(null);
    try {
      const t = sessionStorage.getItem("iraniu_jwt");
      const r = await fetch(`/api/admin/businesses/csv-template?preset=${encodeURIComponent(p)}`, {
        credentials: "include",
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = p === "london" ? "london-businesses-template.csv" : "iraniu-businesses-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(String(e.message || e));
    }
  };

  const downloadFullExport = async () => {
    setMsg(null);
    try {
      const t = sessionStorage.getItem("iraniu_jwt");
      const r = await fetch("/api/admin/businesses/export-csv?preset=iraniu", {
        credentials: "include",
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const day = new Date().toISOString().slice(0, 10);
      a.download = `businesses-export-iraniu-${day}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(String(e.message || e));
    }
  };

  const downloadSqliteDb = async () => {
    setMsg(null);
    try {
      const t = sessionStorage.getItem("iraniu_jwt");
      const r = await fetch("/api/admin/database/sqlite", {
        credentials: "include",
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iraniu-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(String(e.message || e));
    }
  };

  const submitSqlite = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!sqliteFile) {
      setMsg("فایل iraniu.db را انتخاب کنید.");
      return;
    }
    setSqliteBusy(true);
    try {
      const fd = new FormData();
      fd.append("db", sqliteFile);
      const data = await apiPostMultipart("/api/admin/database/sqlite", fd);
      setMsg(data.hint || "آپلود ذخیره شد؛ سرویس را ری‌استارت کنید.");
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setSqliteBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setResult(null);
    if (!file) {
      setMsg("فایل CSV را انتخاب کنید.");
      return;
    }
    const em = contactEmail.trim().toLowerCase();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setMsg("ایمیل تماس معتبر وارد کنید (برای فیلد listing_contact_email).");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("csv", file);
      fd.append("preset", preset);
      fd.append("default_contact_email", em);
      const data = await apiPostMultipart("/api/admin/businesses/import-csv", fd);
      setResult(data);
      setMsg(`ثبت شد: ${data.inserted_count} ردیف؛ رد شده (نامک تکراری): ${data.skipped?.length || 0}.`);
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
        {" · "}
        <Link to="/admin-businesses">همه آگهی‌ها</Link>
      </p>
      <section className="dashboard-panel">
        <h2>پشتیبان و بازیابی SQLite</h2>
        <p className="field-hint">
          <strong>خروجی و ورود اصلی:</strong> فایل کامل دیتابیس <code dir="ltr">iraniu.db</code> (همهٔ جداول: آگهی‌ها، مدیران،
          سوپرادمین، …). برای ورود، فایل باید SQLite معتبر با جدول <code dir="ltr">businesses</code> باشد.
        </p>
        <p className="field-hint">
          بعد از <strong>آپلود</strong>، فایل در سرور ذخیره می‌شود و با <strong>اولین ری‌استارت</strong> سرویس (Docker / Dokploy)
          جایگزین دیتابیس فعلی می‌شود؛ نسخهٔ قبلی به‌صورت <code dir="ltr">iraniu.db.bak.&lt;زمان&gt;</code> بک‌آپ می‌شود.
        </p>
        <div className="dashboard-actions" style={{ marginBottom: "var(--space-md)", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="btn btn--accent" onClick={downloadSqliteDb}>
            دانلود iraniu.db
          </button>
        </div>
        <form onSubmit={submitSqlite} className="form-grid" style={{ marginTop: "var(--space-md)" }}>
          <div className="field field--block">
            <label htmlFor="sqlite-import-file">ورود فایل SQLite (.db)</label>
            <input
              id="sqlite-import-file"
              type="file"
              accept=".db,application/octet-stream"
              onChange={(e) => setSqliteFile(e.target.files?.[0] || null)}
            />
            <span className="field-hint">سپس یک بار سرویس را ری‌استارت کنید.</span>
          </div>
          <div className="dashboard-actions">
            <button type="submit" className="btn btn--primary" disabled={sqliteBusy}>
              {sqliteBusy ? "در حال آپلود…" : "آپلود و ذخیره برای ری‌استارت"}
            </button>
          </div>
        </form>
      </section>

      <section className="dashboard-panel">
        <h2>خروجی CSV (فقط آگهی‌ها)</h2>
        <p className="field-hint">
          بک‌آپ سبک فقط ردیف‌های آگهی؛ برای انتقال کامل سایت از بخش SQLite بالا استفاده کنید.
        </p>
        <div className="dashboard-actions" style={{ marginBottom: "var(--space-md)", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="btn btn--ghost" onClick={downloadFullExport}>
            دانلود CSV (iraniu)
          </button>
        </div>
      </section>

      <section className="dashboard-panel">
        <h2>ورود دسته‌ای آگهی (CSV)</h2>
        <p className="field-hint">
          برای افزودن یا به‌روزرسانی آگهی‌ها از فایل <strong>CSV</strong> استفاده کنید (خروجی از Excel، Google Sheets، یا
          صادرات جدول).
        </p>
        <p className="field-hint">
          دو فرمت: <strong>london</strong> — ستون‌های نزدیک خروجی London (CSV). <strong>iraniu</strong> — ستون‌های جدول{" "}
          <code dir="ltr">businesses</code> در همین پروژه.
        </p>
        <p className="field-hint">
          نامک تکراری <strong>رد می‌شود</strong>. آگهی‌های واردشده با وضعیت <strong>تأیید شده</strong> ثبت می‌شوند.
        </p>

        <div className="dashboard-actions" style={{ marginBottom: "var(--space-md)", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="btn btn--ghost" onClick={() => downloadTemplate("london")}>
            دانلود الگوی london
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => downloadTemplate("iraniu")}>
            دانلود الگوی iraniu
          </button>
        </div>

        <form onSubmit={submit} className="form-grid">
          <div className="field field--block">
            <label htmlFor="bulk-preset">فرمت فایل</label>
            <select id="bulk-preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
              <option value="london">london (CSV)</option>
              <option value="iraniu">iraniu (CSV)</option>
            </select>
          </div>
          <div className="field field--block">
            <label htmlFor="bulk-email">ایمیل تماس پیش‌فرض (listing_contact_email)</label>
            <input
              id="bulk-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="imports@yourdomain.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
            />
            <span className="field-hint">برای هر ردیف در دیتابیس ذخیره می‌شود؛ می‌توانید بعداً در ویرایش آگهی عوض کنید.</span>
          </div>
          <div className="field field--block">
            <label htmlFor="bulk-file">فایل CSV</label>
            <input id="bulk-file" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="dashboard-actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "در حال ورود…" : "شروع ورود"}
            </button>
          </div>
        </form>

        {msg && <p className="field-hint">{msg}</p>}

        {result && (
          <div style={{ marginTop: "var(--space-md)" }}>
            <h3 className="onboarding-panel-title" style={{ fontSize: "1.1rem" }}>
              جزئیات
            </h3>
            {result.parse_errors?.length > 0 && (
              <div className="field-hint" style={{ color: "#5d4037" }}>
                <strong>خطاهای پارس ردیف:</strong> {result.parse_errors.length} مورد
                <ul style={{ margin: "0.5rem 0", paddingInlineStart: "1.25rem" }}>
                  {result.parse_errors.slice(0, 15).map((x, i) => (
                    <li key={i}>
                      ردیف {x.row}: {x.error}
                    </li>
                  ))}
                  {result.parse_errors.length > 15 ? <li>…</li> : null}
                </ul>
              </div>
            )}
            {result.failed?.length > 0 && (
              <p className="field-hint" style={{ color: "#b71c1c" }}>
                خطای درج: {result.failed.length} — نمونه: {result.failed[0]?.slug} ({result.failed[0]?.error})
              </p>
            )}
            {result.inserted_slugs?.length > 0 && (
              <p className="field-hint" style={{ maxHeight: "8rem", overflow: "auto" }} dir="ltr">
                نامک‌ها: {result.inserted_slugs.join(", ")}
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
