import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api.js";

export default function AdminSystemLogsPage({ embedded = false }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [level, setLevel] = useState("");
  const [actorType, setActorType] = useState("");

  const load = () => {
    setErr("");
    const qp = new URLSearchParams();
    qp.set("limit", "300");
    if (level) qp.set("level", level);
    if (actorType) qp.set("actor_type", actorType);
    apiGet(`/api/admin/system-logs?${qp.toString()}`)
      .then(setRows)
      .catch(() => setErr("بارگذاری لاگ سیستم ناموفق بود."));
  };

  useEffect(() => {
    load();
  }, [level, actorType]);

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
        <div className="dashboard-actions" style={{ marginBottom: "0.75rem" }}>
          <label className="field-label" htmlFor="syslog-level">
            سطح
          </label>
          <select id="syslog-level" className="field-input" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">همه</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
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
            <option value="system">system</option>
          </select>
        </div>
        {err && <p className="field-hint">{err}</p>}
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
                  <td colSpan={6}>لاگی ثبت نشده است.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
