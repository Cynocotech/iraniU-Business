import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api.js";
import DashboardMain from "../../components/DashboardMain.jsx";
import DashboardPanelHead, { dashboardIcons } from "../../components/DashboardPanelHead.jsx";

export default function DashboardCallsPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [moduleOff, setModuleOff] = useState(false);

  const load = () => {
    setErr("");
    setModuleOff(false);
    apiGet("/api/manager/call-logs?limit=200")
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => {
        const msg = String(e?.message || e || "");
        if (msg.includes("403") || msg.includes("twilio_module")) {
          setModuleOff(true);
          setRows([]);
        } else {
          setErr("بارگذاری لاگ تماس ناموفق بود.");
        }
      });
  };

  useEffect(() => {
    apiGet("/api/twilio-module-status")
      .then((d) => {
        if (d && d.enabled === false) setModuleOff(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardMain>
      <section className="dashboard-panel">
        <DashboardPanelHead headingId="calls-heading" title="لاگ تماس‌ها" icon={dashboardIcons.overview} />
        {moduleOff ? (
          <p className="field-hint">
            ماژول Twilio غیرفعال است. برای مشاهدهٔ لاگ تماس‌ها، از{" "}
            <Link to="/admin-security">امنیت و ۲FA</Link> ماژول را فعال کنید.
          </p>
        ) : (
          <p className="field-hint">تماس‌های ثبت‌شده از شماره ابری Twilio در این بخش نمایش داده می‌شود.</p>
        )}
        <div className="dashboard-actions">
          <button type="button" className="btn btn--ghost" onClick={load} disabled={moduleOff}>
            تازه سازی
          </button>
        </div>
        {err ? <p className="field-hint">{err}</p> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>کسب‌وکار</th>
                <th>از</th>
                <th>به</th>
                <th>وضعیت</th>
                <th>مدت (ثانیه)</th>
                <th>ضبط</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr">{r.created_at}</td>
                  <td>{r.business_name || r.business_slug || "—"}</td>
                  <td dir="ltr">{r.from_number || "—"}</td>
                  <td dir="ltr">{r.to_number || "—"}</td>
                  <td>{r.status || "—"}</td>
                  <td dir="ltr">{r.duration_seconds ?? "—"}</td>
                  <td>{r.recording_url ? <a href={r.recording_url} target="_blank" rel="noreferrer">پخش</a> : "—"}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7}>تماسی ثبت نشده است.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardMain>
  );
}
