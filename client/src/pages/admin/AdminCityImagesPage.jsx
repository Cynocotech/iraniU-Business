import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatchJson, apiPostMultipart } from "../../api.js";

const DEFAULT_CITIES = ["London", "Manchester", "Birmingham", "Glasgow", "Leeds", "Bristol", "Edinburgh", "Liverpool", "Nottingham", "Sheffield", "Cardiff", "Oxford"];

export default function AdminCityImagesPage() {
  const [images, setImages] = useState({});
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [urlInputs, setUrlInputs] = useState({});
  const fileRefs = useRef({});

  useEffect(() => {
    apiGet("/api/admin/city-images")
      .then((d) => setImages(typeof d === "object" && d ? d : {}))
      .catch(() => {});
  }, []);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: "", text: "" }), 3500);
  };

  const saveUrl = async (city) => {
    const url = (urlInputs[city] || "").trim();
    if (!url) return;
    setSaving((s) => ({ ...s, [city]: true }));
    try {
      const updated = await apiPatchJson("/api/admin/city-images", { [city]: url });
      setImages(updated);
      setUrlInputs((u) => { const n = { ...u }; delete n[city]; return n; });
      flash("ok", `تصویر ${city} ذخیره شد.`);
    } catch (e) {
      flash("err", e.message || "خطا در ذخیره");
    } finally {
      setSaving((s) => ({ ...s, [city]: false }));
    }
  };

  const uploadFile = async (city, file) => {
    if (!file) return;
    setSaving((s) => ({ ...s, [city]: true }));
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiPostMultipart(`/api/admin/city-images/${encodeURIComponent(city)}/upload`, fd);
      setImages(res.all || {});
      flash("ok", `تصویر ${city} آپلود شد.`);
    } catch (e) {
      flash("err", e.message || "خطا در آپلود");
    } finally {
      setSaving((s) => ({ ...s, [city]: false }));
    }
  };

  const removeImage = async (city) => {
    if (!window.confirm(`تصویر ${city} حذف شود؟`)) return;
    setSaving((s) => ({ ...s, [city]: true }));
    try {
      const updated = await apiPatchJson("/api/admin/city-images", { [city]: "" });
      setImages(updated);
      flash("ok", `تصویر ${city} حذف شد.`);
    } catch (e) {
      flash("err", e.message || "خطا");
    } finally {
      setSaving((s) => ({ ...s, [city]: false }));
    }
  };

  const allCities = Array.from(new Set([...DEFAULT_CITIES, ...Object.keys(images)])).sort();

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
      </p>

      <section className="dashboard-panel">
        <h2>تصاویر شهرها — صفحه اصلی</h2>
        <p className="field-hint">
          برای هر شهر می‌توانید یک تصویر آپلود کنید یا لینک مستقیم عکس را وارد کنید. این تصاویر در بخش «محبوب‌ترین شهرها» صفحه اصلی نمایش داده می‌شوند.
        </p>

        {msg.text && (
          <p className="field-hint" style={{ color: msg.type === "ok" ? "#2e7d32" : "#c62828", fontWeight: 700, marginBottom: "1rem" }}>
            {msg.text}
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem", marginTop: "1.25rem" }}>
          {allCities.map((city) => {
            const currentImg = images[city] || "";
            const isBusy = !!saving[city];
            return (
              <div key={city} className="dashboard-panel" style={{ margin: 0, padding: "1rem", border: "1px solid var(--color-border)" }}>
                {/* Preview */}
                <div style={{ height: 140, borderRadius: 10, overflow: "hidden", background: "linear-gradient(135deg,#1a0a2e,#5c1f6e)", marginBottom: "0.75rem", position: "relative" }}>
                  {currentImg ? (
                    <>
                      <img src={currentImg} alt={city} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <button
                        onClick={() => removeImage(city)}
                        disabled={isBusy}
                        style={{ position: "absolute", top: 6, left: 6, background: "rgba(198,40,40,0.85)", color: "#fff", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: "0.75rem", cursor: "pointer" }}
                      >
                        حذف
                      </button>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.3)", fontSize: "0.88rem" }}>
                      بدون تصویر
                    </div>
                  )}
                </div>

                <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.95rem" }} dir="ltr">{city}</h3>

                {/* URL input */}
                <div className="field field--block" style={{ marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.78rem" }}>لینک تصویر (URL)</label>
                  <input
                    type="url"
                    dir="ltr"
                    placeholder="https://images.unsplash.com/..."
                    value={urlInputs[city] ?? ""}
                    onChange={(e) => setUrlInputs((u) => ({ ...u, [city]: e.target.value }))}
                    style={{ fontSize: "0.82rem" }}
                  />
                </div>
                <button
                  className="btn btn--primary"
                  style={{ fontSize: "0.82rem", padding: "0.4rem 0.9rem", marginBottom: "0.75rem" }}
                  disabled={isBusy || !(urlInputs[city] || "").trim()}
                  onClick={() => saveUrl(city)}
                >
                  {isBusy ? "در حال ذخیره…" : "ذخیره URL"}
                </button>

                {/* File upload */}
                <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "0.65rem" }}>
                  <label style={{ fontSize: "0.78rem", color: "var(--color-muted)", display: "block", marginBottom: "0.35rem" }}>یا آپلود فایل</label>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    ref={(el) => { if (el) fileRefs.current[city] = el; }}
                    onChange={(e) => uploadFile(city, e.target.files?.[0])}
                  />
                  <button
                    className="btn btn--ghost"
                    style={{ fontSize: "0.82rem", padding: "0.4rem 0.9rem" }}
                    disabled={isBusy}
                    onClick={() => fileRefs.current[city]?.click()}
                  >
                    {isBusy ? "در حال آپلود…" : "انتخاب فایل"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
