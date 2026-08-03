import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiDelete, apiGet, apiPatchJson, apiPostMultipart } from "../../api.js";
import { toInputDateTime } from "../../lib/bannerSchedule.js";

export default function AdminExchangeBannerEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const bannerId = Number.parseInt(String(id || ""), 10);

  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [savingImage, setSavingImage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    apiGet("/api/admin/exchange-banners")
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const row = list.find((r) => Number(r.id) === bannerId);
        if (!row) {
          setNotFound(true);
          return;
        }
        setDraft({
          ...row,
          start_at: toInputDateTime(row.start_at),
          end_at: toInputDateTime(row.end_at),
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bannerId]);

  const saveImage = async () => {
    if (!imageFile) {
      setMsg("ابتدا تصویر جدید را انتخاب کنید.");
      return;
    }
    setMsg("");
    setSavingImage(true);
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      const out = await apiPostMultipart(`/api/admin/exchange-banners/${bannerId}/image`, fd);
      setDraft((d) => ({ ...d, image_url: out.image_url }));
      setImageFile(null);
      setMsg("تصویر بنر ذخیره شد.");
    } catch (e) {
      setMsg(e.message || "ذخیره تصویر ناموفق بود.");
    } finally {
      setSavingImage(false);
    }
  };

  const saveChanges = async () => {
    setMsg("");
    setSaving(true);
    try {
      const updated = await apiPatchJson(`/api/admin/exchange-banners/${bannerId}`, {
        title: draft.title || "",
        image_url: draft.image_url || "",
        adsense_code: draft.adsense_code || "",
        link_url: draft.link_url || "",
        page_scope: draft.page_scope || "exchange",
        placement: draft.placement || "between",
        daily_user_cap: Number(draft.daily_user_cap) > 0 ? Number(draft.daily_user_cap) : 2,
        start_at: draft.start_at || "",
        end_at: draft.end_at || "",
        sort_order: draft.sort_order ?? 0,
        is_active: !!draft.is_active,
      });
      setDraft({ ...updated, start_at: toInputDateTime(updated.start_at), end_at: toInputDateTime(updated.end_at) });
      setMsg("به‌روزرسانی ذخیره شد.");
    } catch (e) {
      setMsg(e.message || "ذخیره نشد.");
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async () => {
    if (!window.confirm("این بنر حذف شود؟")) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/admin/exchange-banners/${bannerId}`);
      navigate("/admin/exchanges/banners");
    } catch (e) {
      setMsg(e.message || "حذف نشد.");
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="field-hint">در حال بارگذاری…</p>;
  }

  if (notFound || !draft) {
    return (
      <section className="admin-exchange-hub__panel dashboard-panel">
        <p className="field-hint">بنری با این شناسه پیدا نشد.</p>
        <Link className="btn btn--ghost" to="/admin/exchanges/banners">
          ← بازگشت به فهرست بنرها
        </Link>
      </section>
    );
  }

  return (
    <section className="admin-exchange-hub__panel dashboard-panel" aria-labelledby="banner-edit-page-h">
      <p className="field-hint">
        <Link to="/admin/exchanges/banners">← بازگشت به فهرست بنرها</Link>
      </p>
      <h2 id="banner-edit-page-h">ویرایش بنر تبلیغاتی #{bannerId}</h2>

      {draft.image_url ? (
        <img
          src={draft.image_url}
          alt={draft.title || "بنر تبلیغاتی"}
          style={{ width: "100%", maxWidth: "480px", borderRadius: "12px", border: "1px solid rgba(58,11,71,0.14)" }}
        />
      ) : (
        <div style={{ width: "100%", maxWidth: "480px", minHeight: "90px", borderRadius: "12px", border: "1px dashed rgba(58,11,71,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(58,11,71,0.4)", fontSize: "0.85rem" }}>
          بدون تصویر — AdSense یا تصویر آپلود کنید
        </div>
      )}

      <div className="field field--block" style={{ marginTop: "0.7rem" }}>
        <label>تصویر جدید</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
        />
        <div style={{ marginTop: "0.5rem" }}>
          <button type="button" className="btn btn--ghost" disabled={savingImage} onClick={saveImage}>
            {savingImage ? "در حال ذخیره تصویر…" : "ذخیره تصویر"}
          </button>
        </div>
      </div>

      <div className="field field--block" style={{ marginTop: "0.7rem" }}>
        <label>لینک منبع تصویر</label>
        <input
          dir="ltr"
          value={draft.image_url || ""}
          onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
          placeholder="https://... یا /uploads/..."
        />
        <span className="field-hint">با «ذخیره تغییرات» اعمال می‌شود.</span>
      </div>

      <div className="field field--block" style={{ marginTop: "0.7rem" }}>
        <label>کد Google AdSense <span style={{ fontWeight: 400, opacity: 0.65 }}>(اختیاری — اگر تصویر ندارید)</span></label>
        <textarea
          dir="ltr"
          rows={5}
          value={draft.adsense_code || ""}
          onChange={(e) => setDraft((d) => ({ ...d, adsense_code: e.target.value }))}
          placeholder={'<ins class="adsbygoogle"\n  data-ad-client="ca-pub-XXXX"\n  data-ad-slot="XXXX"\n  data-ad-format="auto"></ins>'}
          style={{ fontFamily: "monospace", fontSize: "0.82rem", resize: "vertical" }}
        />
        <span className="field-hint">اگر تصویر بنر آپلود شده باشد، تصویر اولویت دارد. در غیر این صورت آگهی AdSense نمایش داده می‌شود.</span>
      </div>

      <div className="admin-detail-modal__fields" style={{ display: "grid", gap: "0.7rem", marginTop: "0.7rem" }}>
        <div className="field field--block">
          <label>عنوان</label>
          <input value={draft.title || ""} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        </div>
        <div className="field field--block">
          <label>لینک</label>
          <input dir="ltr" value={draft.link_url || ""} onChange={(e) => setDraft((d) => ({ ...d, link_url: e.target.value }))} />
        </div>
        <div className="form-grid admin-ex-banner-two-col-grid" style={{ display: "grid", gap: "0.7rem" }}>
          <div className="field field--block">
            <label>صفحه</label>
            <div className="admin-banner-radio-group">
              <label className={`admin-banner-radio${(draft.page_scope || "exchange") === "exchange" ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name="banner-edit-scope"
                  checked={(draft.page_scope || "exchange") === "exchange"}
                  onChange={() => setDraft((d) => ({ ...d, page_scope: "exchange" }))}
                />
                <span>صرافی‌ها</span>
              </label>
              <label className={`admin-banner-radio${(draft.page_scope || "exchange") === "directory" ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name="banner-edit-scope"
                  checked={(draft.page_scope || "exchange") === "directory"}
                  onChange={() => setDraft((d) => ({ ...d, page_scope: "directory" }))}
                />
                <span>دایرکتوری</span>
              </label>
            </div>
          </div>
          <div className="field field--block">
            <label>محل نمایش</label>
            <div className="admin-banner-radio-group">
              <label className={`admin-banner-radio${(draft.placement || "between") === "top" ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name="banner-edit-placement"
                  checked={(draft.placement || "between") === "top"}
                  onChange={() => setDraft((d) => ({ ...d, placement: "top" }))}
                />
                <span>ابتدای لیست</span>
              </label>
              <label className={`admin-banner-radio${(draft.placement || "between") === "between" ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name="banner-edit-placement"
                  checked={(draft.placement || "between") === "between"}
                  onChange={() => setDraft((d) => ({ ...d, placement: "between" }))}
                />
                <span>بین کارت‌ها</span>
              </label>
              <label className={`admin-banner-radio${(draft.placement || "between") === "fullscreen" ? " is-active" : ""}`}>
                <input
                  type="radio"
                  name="banner-edit-placement"
                  checked={(draft.placement || "between") === "fullscreen"}
                  onChange={() => setDraft((d) => ({ ...d, placement: "fullscreen" }))}
                />
                <span>تمام‌صفحه</span>
              </label>
            </div>
          </div>
          <div className="field field--block">
            <label>شروع نمایش</label>
            <input
              type="datetime-local"
              value={draft.start_at || ""}
              onChange={(e) => setDraft((d) => ({ ...d, start_at: e.target.value }))}
            />
          </div>
          <div className="field field--block">
            <label>پایان نمایش</label>
            <input
              type="datetime-local"
              value={draft.end_at || ""}
              onChange={(e) => setDraft((d) => ({ ...d, end_at: e.target.value }))}
            />
          </div>
          <div className="field field--block">
            <label>نمایش/روز برای هر کاربر</label>
            <input
              type="number"
              min={1}
              max={50}
              value={Number(draft.daily_user_cap) > 0 ? Number(draft.daily_user_cap) : 2}
              onChange={(e) => setDraft((d) => ({ ...d, daily_user_cap: Number.parseInt(e.target.value || "2", 10) || 2 }))}
            />
          </div>
          <div className="field field--block">
            <label>ترتیب</label>
            <input
              type="number"
              value={draft.sort_order ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number.parseInt(e.target.value || "0", 10) || 0 }))}
            />
          </div>
          <div className="field field--block" style={{ alignSelf: "end" }}>
            <label style={{ display: "flex", gap: "0.35rem", alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={!!draft.is_active} onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))} />
              فعال
            </label>
          </div>
        </div>
      </div>

      {msg ? <p className="field-hint">{msg}</p> : null}

      <div className="admin-detail-modal__primary-actions" style={{ marginTop: "0.8rem" }}>
        <button type="button" className="btn btn--primary" disabled={saving} onClick={saveChanges}>
          {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
        </button>
      </div>

      <span className="admin-detail-modal__tools-label">ابزارها</span>
      <div className="admin-detail-modal__tools-row">
        <button type="button" className="btn btn--ghost" disabled={deleting} onClick={removeBanner}>
          {deleting ? "در حال حذف…" : "حذف بنر"}
        </button>
      </div>
    </section>
  );
}
