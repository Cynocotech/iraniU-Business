import { useRef, useState } from "react";
import { apiPatch, apiPostMultipart } from "../api.js";
import { parseGalleryJson } from "../lib/businessProfile.js";
import ImageCropModal from "./ImageCropModal.jsx";

export default function MediaEditor({ slug, biz, setBiz }) {
  const uploadBlobAndPatch = async (blob, filename, field, setMsg, setUploading, fileRef) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", blob, filename);
      const data = await apiPostMultipart("/api/upload/business-image", formData);
      const url = data?.url || data?.imageUrl || "";
      if (!url) throw new Error("آدرس تصویر دریافت نشد");
      const updated = await apiPatch(`/api/businesses/${encodeURIComponent(slug)}`, { [field]: url });
      setBiz(updated);
      setMsg({ ok: true, text: "تصویر با موفقیت ذخیره شد." });
    } catch (err) {
      setMsg({ ok: false, text: err.message || "خطا در آپلود" });
    } finally {
      setUploading(false);
      if (fileRef?.current) fileRef.current.value = "";
    }
  };

  // ── Logo ──
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg] = useState(null);
  const [logoCropSrc, setLogoCropSrc] = useState(null);
  const logoRef = useRef(null);
  const logoUrl = biz?.logo_url || "";

  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoCropSrc(URL.createObjectURL(file));
  };

  const handleLogoRemove = async () => {
    setLogoMsg(null);
    try {
      const updated = await apiPatch(`/api/businesses/${encodeURIComponent(slug)}`, { logo_url: "" });
      setBiz(updated);
      setLogoMsg({ ok: true, text: "لوگو حذف شد." });
    } catch (err) {
      setLogoMsg({ ok: false, text: err.message || "خطا" });
    }
  };

  // ── Cover ──
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverMsg, setCoverMsg] = useState(null);
  const [coverCropSrc, setCoverCropSrc] = useState(null);
  const coverRef = useRef(null);
  const coverUrl = biz?.cover_image_url || "";

  const handleCoverFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverCropSrc(URL.createObjectURL(file));
  };

  const handleCoverRemove = async () => {
    setCoverMsg(null);
    try {
      const updated = await apiPatch(`/api/businesses/${encodeURIComponent(slug)}`, { cover_image_url: "" });
      setBiz(updated);
      setCoverMsg({ ok: true, text: "تصویر هدر حذف شد." });
    } catch (err) {
      setCoverMsg({ ok: false, text: err.message || "خطا" });
    }
  };

  // ── Gallery ──
  const galleryUrls = parseGalleryJson(biz?.gallery_json);
  const [galleryUploading, setGalleryUploading] = useState([false, false, false, false]);
  const [galleryMsg, setGalleryMsg] = useState(["", "", "", ""]);

  const saveGallery = async (urls) => {
    const gallery_json = JSON.stringify(urls.map((u) => u.trim()));
    const updated = await apiPatch(`/api/businesses/${encodeURIComponent(slug)}`, { gallery_json });
    setBiz(updated);
  };

  const handleGalleryUpload = async (i, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryUploading((prev) => { const n = [...prev]; n[i] = true; return n; });
    setGalleryMsg((prev) => { const n = [...prev]; n[i] = ""; return n; });
    try {
      const formData = new FormData();
      formData.append("image", file);
      const data = await apiPostMultipart("/api/upload/business-image", formData);
      const url = data?.url || "";
      if (!url) throw new Error("آدرس تصویر دریافت نشد");
      const next = [...galleryUrls];
      next[i] = url;
      await saveGallery(next);
      setGalleryMsg((prev) => { const n = [...prev]; n[i] = "✅ آپلود شد"; return n; });
      setTimeout(() => setGalleryMsg((prev) => { const n = [...prev]; n[i] = ""; return n; }), 3000);
    } catch (err) {
      setGalleryMsg((prev) => { const n = [...prev]; n[i] = `❌ ${err.message || "خطا"}`; return n; });
    } finally {
      setGalleryUploading((prev) => { const n = [...prev]; n[i] = false; return n; });
      e.target.value = "";
    }
  };

  const handleGalleryRemove = async (i) => {
    const next = [...galleryUrls];
    next[i] = "";
    await saveGallery(next);
  };

  return (
    <section className="dashboard-panel" id="media" aria-labelledby="media-heading" style={{ marginBottom: "var(--space-md)" }}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }} id="media-heading">تصاویر</h2>

      {/* Logo */}
      <div className="panel-card" style={{ marginBottom: "1.25rem" }}>
        <div className="panel-card__head"><h3 className="panel-card__title">لوگوی کسب‌وکار</h3></div>
        <div className="panel-card__body" style={{ padding: "1.25rem" }}>
          <p className="field-hint" style={{ marginTop: 0 }}>
            لوگو در کارت‌های آگهی و صفحهٔ کسب‌وکار نمایش داده می‌شود. فرمت توصیه‌شده: PNG یا WebP، ابعاد مربعی، حداکثر ۱ مگابایت.
          </p>
          {logoUrl && (
            <div style={{ marginBottom: "1rem" }}>
              <img src={logoUrl} alt="لوگوی فعلی" style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#f8fafc", padding: 8 }} />
            </div>
          )}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            <label htmlFor={`logo-file-${slug}`} className="btn btn--primary" style={{ cursor: logoUploading ? "not-allowed" : "pointer", opacity: logoUploading ? 0.6 : 1 }}>
              {logoUploading ? "در حال آپلود…" : logoUrl ? "تغییر لوگو" : "آپلود لوگو"}
            </label>
            <input id={`logo-file-${slug}`} ref={logoRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleLogoFileChange} disabled={logoUploading} style={{ display: "none" }} />
            {logoUrl && (
              <button type="button" className="btn btn--ghost" onClick={handleLogoRemove} disabled={logoUploading}>حذف لوگو</button>
            )}
          </div>
          {logoMsg && <p className="field-hint" role="status" style={{ marginTop: "0.6rem", color: logoMsg.ok ? "var(--color-success,#2e7d32)" : "#b71c1c" }}>{logoMsg.text}</p>}
          <ImageCropModal
            open={!!logoCropSrc}
            src={logoCropSrc || ""}
            aspect={1}
            shape="square"
            title="برش لوگو"
            onCancel={() => { setLogoCropSrc(null); if (logoRef.current) logoRef.current.value = ""; }}
            onSave={(blob) => { setLogoCropSrc(null); uploadBlobAndPatch(blob, "logo.jpg", "logo_url", setLogoMsg, setLogoUploading, logoRef); }}
          />
        </div>
      </div>

      {/* Cover */}
      <div className="panel-card" style={{ marginBottom: "1.25rem" }}>
        <div className="panel-card__head"><h3 className="panel-card__title">تصویر هدر صفحهٔ عمومی</h3></div>
        <div className="panel-card__body" style={{ padding: "1.25rem" }}>
          <div style={{ marginBottom: "0.6rem", padding: "0.6rem 0.85rem", borderRadius: "6px", border: "1px solid #b0c4de", background: "#f0f6ff", fontSize: "0.85rem", lineHeight: 1.7, color: "#1a3a5c" }}>
            ابعاد پیشنهادی: <strong>۱۲۰۰ × ۶۳۰ پیکسل</strong> — حجم حداکثر <strong>۲ مگابایت</strong> — فرمت <strong>WebP یا JPEG</strong>
          </div>
          {coverUrl && (
            <div style={{ marginBottom: "0.75rem" }}>
              <img src={coverUrl} alt="تصویر هدر فعلی" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 6, border: "1px solid #ddd", objectFit: "cover" }} />
            </div>
          )}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            <label htmlFor={`cover-file-${slug}`} className="btn btn--secondary" style={{ cursor: coverUploading ? "not-allowed" : "pointer", opacity: coverUploading ? 0.6 : 1 }}>
              {coverUploading ? "در حال آپلود…" : coverUrl ? "تغییر تصویر هدر" : "آپلود تصویر هدر"}
            </label>
            <input id={`cover-file-${slug}`} ref={coverRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" onChange={handleCoverFileChange} disabled={coverUploading} style={{ display: "none" }} />
            {coverUrl && (
              <button type="button" className="btn btn--ghost" onClick={handleCoverRemove} disabled={coverUploading}>حذف تصویر هدر</button>
            )}
          </div>
          {coverMsg && <p className="field-hint" role="status" style={{ marginTop: "0.6rem", color: coverMsg.ok ? "var(--color-success,#2e7d32)" : "#b71c1c" }}>{coverMsg.text}</p>}
          <p className="field-hint" style={{ marginTop: "0.5rem" }}>اگر تصویر هدر خالی باشد، از اولین تصویر گالری استفاده می‌شود.</p>
          <ImageCropModal
            open={!!coverCropSrc}
            src={coverCropSrc || ""}
            aspect={16 / 9}
            shape="cover"
            title="برش تصویر هدر"
            onCancel={() => { setCoverCropSrc(null); if (coverRef.current) coverRef.current.value = ""; }}
            onSave={(blob) => { setCoverCropSrc(null); uploadBlobAndPatch(blob, "cover.jpg", "cover_image_url", setCoverMsg, setCoverUploading, coverRef); }}
          />
        </div>
      </div>

      {/* Gallery */}
      <div className="panel-card">
        <div className="panel-card__head"><h3 className="panel-card__title">گالری (تا ۴ تصویر)</h3></div>
        <div className="panel-card__body" style={{ padding: "1.25rem" }}>
          <p className="field-hint" style={{ marginTop: 0 }}>
            اندازه پیشنهادی: <strong>۱۲۰۰ × ۹۰۰ پیکسل</strong> (نسبت ۴:۳) — فرمت WebP یا JPEG، حداکثر ۲ مگابایت.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(180px,100%), 1fr))", gap: "1rem" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label htmlFor={`gallery-file-${slug}-${i}`} style={{ fontWeight: 500, fontSize: "0.9rem" }}>تصویر {i + 1}</label>
                {galleryUrls[i] ? (
                  <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", border: "2px solid #ddd", borderRadius: "8px", overflow: "hidden" }}>
                    <img src={galleryUrls[i]} alt={`گالری ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      type="button"
                      onClick={() => handleGalleryRemove(i)}
                      style={{ position: "absolute", top: "0.25rem", right: "0.25rem", background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "4px", padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      ✕ حذف
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor={`gallery-file-${slug}-${i}`}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", aspectRatio: "4/3", border: "2px dashed #ccc", borderRadius: "8px", cursor: galleryUploading[i] ? "not-allowed" : "pointer", opacity: galleryUploading[i] ? 0.6 : 1, background: "#f9f9f9" }}
                  >
                    <span style={{ fontSize: "2rem" }}>📤</span>
                    <span style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>{galleryUploading[i] ? "در حال آپلود…" : "کلیک برای آپلود"}</span>
                  </label>
                )}
                <input
                  id={`gallery-file-${slug}-${i}`}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  onChange={(e) => handleGalleryUpload(i, e)}
                  disabled={galleryUploading[i]}
                  style={{ display: "none" }}
                />
                {galleryMsg[i] && (
                  <p style={{ color: galleryMsg[i].includes("✅") ? "var(--color-success,#2e7d32)" : "#b71c1c", margin: 0, fontSize: "0.8rem" }}>{galleryMsg[i]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
