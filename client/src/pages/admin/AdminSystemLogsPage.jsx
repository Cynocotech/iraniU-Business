import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api.js";

export default function AdminSystemLogsPage({ embedded = false }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [level, setLevel] = useState("");
  const [actorType, setActorType] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [limit, setLimit] = useState("300");

  const load = () => {
    setErr("");
    const qp = new URLSearchParams();
    qp.set("limit", limit);
    if (level) qp.set("level", level);
    if (actorType) qp.set("actor_type", actorType);
    if (search.trim()) qp.set("search", search.trim());
    if (dateFrom) qp.set("from", dateFrom);
    if (dateTo) qp.set("to", dateTo);
    apiGet(`/api/admin/system-logs?${qp.toString()}`)
      .then(setRows)
      .catch((e) => setErr(e?.message || "بارگذاری لاگ سیستم ناموفق بود."));
  };

  useEffect(() => {
    load();
  }, [level, actorType, dateFrom, dateTo, limit]);

  const submitSearch = (e) => {
    e.preventDefault();
    load();
  };

  const clearFilters = () => {
    setLevel("");
    setActorType("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setLimit("300");
  };

  return (
    <>
      {!embedded ? (
        <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
          <Link to="/admin">← داشبورد</Link>
          <button type="button" className="btn btn--ghost" style={{ marginInlineStart: "0.5rem" }} onClick={load}>
            تازه سازی
          </button>
        </p>
      ) : (
        <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
          <button type="button" className="btn btn--ghost" onClick={load}>
            تازه سازی
          </button>
        </p>
      )}
      <section className="dashboard-panel">
        <h2>لاگ سیستم و تغییرات پروفایل</h2>
        <p className="field-hint">تاریخچه تغییرات مدیر/ادمین و خطاهای سرور با زمان ثبت می‌شود.</p>
        <form onSubmit={submitSearch} className="dashboard-actions" style={{ marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.6rem" }}>
          <div className="field field--block" style={{ minWidth: "14rem" }}>
            <label className="field-label" htmlFor="syslog-search">
              جستجو (پیام، عملیات، هدف)
            </label>
            <input
              id="syslog-search"
              className="field-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="مثلاً نام مدیر یا شناسهٔ آگهی…"
            />
          </div>
          <div className="field field--block">
            <label className="field-label" htmlFor="syslog-level">
              سطح
            </label>
            <select id="syslog-level" className="field-input" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">همه</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </div>
          <div className="field field--block">
            <label className="field-label" htmlFor="syslog-actor">
              نقش
            </label>
            <select
              id="syslog-actor"
              className="field-input"
              value={actorType}
              onChange={(e) => setActorType(e.target.value)}
            >
              <option value="">همه</option>
              <option value="superadmin">superadmin</option>
              <option value="manager">manager</option>
              <option value="exchange_manager">exchange_manager</option>
              <option value="system">system</option>
            </select>
          </div>
          <div className="field field--block">
            <label className="field-label" htmlFor="syslog-from">
              از تاریخ
            </label>
            <input id="syslog-from" type="date" className="field-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field field--block">
            <label className="field-label" htmlFor="syslog-to">
              تا تاریخ
            </label>
            <input id="syslog-to" type="date" className="field-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="field field--block">
            <label className="field-label" htmlFor="syslog-limit">
              تعداد
            </label>
            <select id="syslog-limit" className="field-input" value={limit} onChange={(e) => setLimit(e.target.value)}>
              <option value="100">۱۰۰</option>
              <option value="300">۳۰۰</option>
              <option value="500">۵۰۰</option>
              <option value="1000">۱۰۰۰</option>
            </select>
          </div>
          <div className="field field--block" style={{ alignSelf: "end" }}>
            <button type="submit" className="btn btn--primary">
              اعمال جستجو
            </button>
          </div>
          <div className="field field--block" style={{ alignSelf: "end" }}>
            <button type="button" className="btn btn--ghost" onClick={clearFilters}>
              پاک‌کردن فیلترها
            </button>
          </div>
        </form>
        {err && <p className="field-hint" style={{ color: "#b71c1c" }}>{err}</p>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>سطح</th>
                <th>عامل</th>
                <th>عملیات</th>
                <th>هدف</th>
                <th>پیام</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr" style={{ whiteSpace: "nowrap" }}>
                    {r.created_at}
                  </td>
                  <td>{r.level || "info"}</td>
                  <td dir="ltr">
                    {r.actor_type}
                    {r.actor_name
                      ? ` — ${r.actor_name}`
                      : r.actor_id
                        ? ` #${r.actor_id}`
                        : ""}
                  </td>
                  <td dir="ltr">{r.action}</td>
                  <td dir="ltr">
                    {[r.target_type, r.target_id].filter(Boolean).join(":") || "—"}
                  </td>
                  <td style={{ maxWidth: "26rem", wordBreak: "break-word" }}>{r.message || "—"}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6}>لاگی با این فیلترها پیدا نشد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
