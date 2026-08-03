import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import DashboardBusinessForm from "../../components/DashboardBusinessForm.jsx";
import MediaEditor from "../../components/MediaEditor.jsx";
import BiolinkEditor from "../../components/BiolinkEditor.jsx";
import { apiGet, apiPost, apiPatchJson, apiDelete } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";

function GeoInfoPanel({ slug }) {
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState({
    postcode_latitude: "",
    postcode_longitude: "",
    postcode_admin_ward: "",
    postcode_primary_care_trust: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setMsg(null);
    apiGet(`/api/businesses/${encodeURIComponent(slug)}`).then((b) => {
      setFields({
        postcode_latitude:           b?.postcode_latitude           ?? "",
        postcode_longitude:          b?.postcode_longitude          ?? "",
        postcode_admin_ward:         b?.postcode_admin_ward         ?? "",
        postcode_primary_care_trust: b?.postcode_primary_care_trust ?? "",
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [slug]);

  const set = (key) => (e) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
    setMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await apiPatchJson(`/api/admin/businesses/${encodeURIComponent(slug)}/geo`, {
        postcode_latitude:           fields.postcode_latitude           === "" ? null : fields.postcode_latitude,
        postcode_longitude:          fields.postcode_longitude          === "" ? null : fields.postcode_longitude,
        postcode_admin_ward:         fields.postcode_admin_ward         || null,
        postcode_primary_care_trust: fields.postcode_primary_care_trust || null,
      });
      setMsg({ ok: true, text: "ذخیره شد." });
    } catch (e) {
      setMsg({ ok: false, text: e.message || "خطا در ذخیره‌سازی" });
    } finally {
      setSaving(false);
    }
  };

  if (!slug) return null;

  const lat = parseFloat(fields.postcode_latitude);
  const lng = parseFloat(fields.postcode_longitude);
  const mapsUrl = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://maps.google.com/?q=${lat},${lng}`
    : null;

  return (
    <section className="dashboard-panel" style={{ marginBottom: "var(--space-md)" }}>
      <h2 className="field-hint" style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 600 }}>
        موقعیت جغرافیایی (سوپرادمین)
      </h2>
      {loading ? (
        <p className="field-hint">در حال بارگذاری…</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))", gap: "0.6rem 1.25rem" }}>
            <div className="field field--block" style={{ margin: 0 }}>
              <label htmlFor="geo-lat">عرض جغرافیایی (Latitude)</label>
              <input id="geo-lat" type="number" step="any" dir="ltr" value={fields.postcode_latitude} onChange={set("postcode_latitude")} placeholder="e.g. 51.5074" />
            </div>
            <div className="field field--block" style={{ margin: 0 }}>
              <label htmlFor="geo-lng">طول جغرافیایی (Longitude)</label>
              <input id="geo-lng" type="number" step="any" dir="ltr" value={fields.postcode_longitude} onChange={set("postcode_longitude")} placeholder="e.g. -0.1278" />
            </div>
            <div className="field field--block" style={{ margin: 0 }}>
              <label htmlFor="geo-ward">ناحیه اداری (Admin Ward)</label>
              <input id="geo-ward" type="text" value={fields.postcode_admin_ward} onChange={set("postcode_admin_ward")} placeholder="e.g. West Hampstead" />
            </div>
            <div className="field field--block" style={{ margin: 0 }}>
              <label htmlFor="geo-pct">ناحیه بهداشت (Primary Care Trust)</label>
              <input id="geo-pct" type="text" value={fields.postcode_primary_care_trust} onChange={set("postcode_primary_care_trust")} placeholder="e.g. Camden" />
            </div>
          </div>
          <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
              {saving ? "در حال ذخیره…" : "ذخیره موقعیت"}
            </button>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ fontSize: "0.85rem" }}>
                📍 نمایش در Google Maps
              </a>
            )}
            {msg && (
              <span className="field-hint" style={{ color: msg.ok ? "var(--color-success,#2e7d32)" : "#b71c1c", margin: 0 }}>
                {msg.text}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

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
  const [biz, setBiz] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const deleteInputRef = useRef(null);

  useEffect(() => {
    apiGet("/api/businesses").then(setList).catch(() => setList([]));
  }, []);

  useEffect(() => {
    if (!slug) { setBiz(null); return; }
    apiGet(`/api/businesses/${encodeURIComponent(slug)}`).then(setBiz).catch(() => setBiz(null));
  }, [slug]);


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

  const openDeleteModal = () => {
    setDeleteInput("");
    setDeleteError(null);
    setDeleteModal(true);
    setTimeout(() => deleteInputRef.current?.focus(), 50);
  };

  const confirmDelete = async () => {
    if (deleteInput !== "DELETE") {
      setDeleteError("لطفاً دقیقاً DELETE را تایپ کنید.");
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiDelete(`/api/admin/businesses/${encodeURIComponent(slug)}`);
      setDeleteModal(false);
      navigate("/admin-businesses", { replace: true });
    } catch (e) {
      setDeleteError(e.message || "خطا در حذف کسب‌وکار");
    } finally {
      setDeleteBusy(false);
    }
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

      {slug && <GeoInfoPanel slug={slug} />}

      {slug ? (
        <>
          <DashboardBusinessForm
            slug={slug}
            onSlugChange={onSlugChange}
            sectionTitle="ویرایش آگهی (سوپرادمین)"
            hideSlugPicker
            allowEditName
            showTagsPanel
          />
          <MediaEditor slug={slug} biz={biz} setBiz={setBiz} />
          <BiolinkEditor slug={slug} biz={biz} setBiz={setBiz} />

          <section style={{
            marginTop: "var(--space-md)",
            border: "2px solid #b71c1c",
            borderRadius: "0.75rem",
            padding: "1.25rem 1.5rem",
          }}>
            <h2 style={{ margin: "0 0 0.4rem", color: "#b71c1c", fontSize: "1rem", fontWeight: 700 }}>
              منطقه خطر
            </h2>
            <p className="field-hint" style={{ margin: "0 0 1rem" }}>
              حذف کسب‌وکار برگشت‌ناپذیر است. تمام اطلاعات، تصاویر S3 و داده‌های وابسته برای همیشه پاک می‌شوند.
            </p>
            <button
              type="button"
              className="btn"
              style={{ background: "#b71c1c", color: "#fff", border: "none" }}
              onClick={openDeleteModal}
            >
              حذف کامل این کسب‌وکار
            </button>
          </section>
        </>
      ) : (
        <p className="field-hint">برای نمایش فرم ویرایش، ابتدا یک آگهی را از بالا انتخاب کنید.</p>
      )}

      {deleteModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteModal(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: "0.75rem", padding: "2rem",
            width: "min(420px, 92vw)", boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
            direction: "rtl",
          }}>
            <h2 style={{ margin: "0 0 0.5rem", color: "#b71c1c", fontSize: "1.1rem" }}>
              حذف کامل کسب‌وکار
            </h2>
            <p className="field-hint" style={{ margin: "0 0 1rem" }}>
              این عملیات <strong>برگشت‌ناپذیر</strong> است. تمام اطلاعات، تصاویر S3، و داده‌های وابسته این کسب‌وکار برای همیشه حذف می‌شوند.
            </p>
            <p className="field-hint" style={{ margin: "0 0 0.75rem" }}>
              برای تأیید، کلمه <strong style={{ direction: "ltr", display: "inline-block" }}>DELETE</strong> را تایپ کنید:
            </p>
            <input
              ref={deleteInputRef}
              type="text"
              dir="ltr"
              value={deleteInput}
              onChange={(e) => { setDeleteInput(e.target.value); setDeleteError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") confirmDelete(); if (e.key === "Escape") setDeleteModal(false); }}
              placeholder="DELETE"
              style={{ width: "100%", marginBottom: "0.75rem", fontFamily: "monospace", fontSize: "1rem" }}
            />
            {deleteError && (
              <p style={{ color: "#b71c1c", margin: "0 0 0.75rem", fontSize: "0.875rem" }}>{deleteError}</p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeleteModal(false)}
                disabled={deleteBusy}
              >
                انصراف
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: "#b71c1c", color: "#fff", border: "none" }}
                onClick={confirmDelete}
                disabled={deleteBusy || deleteInput !== "DELETE"}
              >
                {deleteBusy ? "در حال حذف…" : "حذف دائمی"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
