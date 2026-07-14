import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import DashboardBusinessForm from "../../components/DashboardBusinessForm.jsx";
import { apiGet, apiPost } from "../../api.js";
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


  useEffect(() => {
    apiGet("/api/businesses").then(setList).catch(() => setList([]));
  }, []);


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
        <DashboardBusinessForm
          slug={slug}
          onSlugChange={onSlugChange}
          sectionTitle="ویرایش آگهی (سوپرادمین)"
          hideSlugPicker
          allowEditName
          showTagsPanel
        />
      ) : (
        <p className="field-hint">برای نمایش فرم ویرایش، ابتدا یک آگهی را از بالا انتخاب کنید.</p>
      )}
    </>
  );
}
