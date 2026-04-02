import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import DashboardBusinessForm from "../../components/DashboardBusinessForm.jsx";
import { apiGet, apiPost } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";

const DEFAULT_SLUG = "clinic-pars";

export default function AdminEditBusinessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const raw = searchParams.get("slug");
  const slug = (raw && String(raw).trim()) || DEFAULT_SLUG;

  const [list, setList] = useState([]);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState(null);

  useEffect(() => {
    apiGet("/api/businesses").then(setList).catch(() => setList([]));
  }, []);

  const onSlugChange = useCallback(
    (s) => {
      const next = String(s || "").trim() || DEFAULT_SLUG;
      navigate(`/admin-edit?slug=${encodeURIComponent(next)}`, { replace: true });
    },
    [navigate]
  );

  const onSelectBusiness = (e) => {
    const v = e.target.value;
    if (v) onSlugChange(v);
  };

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
          <label htmlFor="admin-edit-business-select">کسب‌وکار</label>
          <select
            id="admin-edit-business-select"
            value={slug}
            onChange={onSelectBusiness}
            style={{ width: "100%", maxWidth: "28rem" }}
          >
            <option value="">— انتخاب کنید —</option>
            {list.map((r) => (
              <option key={r.slug} value={r.slug} title={r.slug}>
                {r.name_fa} ({formatAdId(r.id) || r.slug})
              </option>
            ))}
            {slug && !list.some((r) => r.slug === slug) ? (
              <option value={slug}>{slug}</option>
            ) : null}
          </select>
        </div>
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

      <DashboardBusinessForm
        slug={slug}
        onSlugChange={onSlugChange}
        sectionTitle="ویرایش آگهی (سوپرادمین)"
        hideSlugPicker
      />
    </>
  );
}
