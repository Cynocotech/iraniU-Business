import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";

/**
 * Draws the cropped area from an image onto a canvas and returns a Blob.
 * @param {string} imageSrc  — object URL of the source image
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {"cover"|"square"} shape
 * @returns {Promise<Blob>}
 */
async function getCroppedBlob(imageSrc, pixelCrop, shape) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas empty"))), "image/jpeg", 0.92)
  );
}

/**
 * @param {{
 *   open: boolean,
 *   src: string,          — object URL of selected file
 *   aspect: number,       — e.g. 16/9 for cover, 1 for logo
 *   shape?: "cover"|"square",
 *   title: string,
 *   onCancel: () => void,
 *   onSave: (blob: Blob) => void,
 * }} props
 */
export default function ImageCropModal({ open, src, aspect, shape = "cover", title, onCancel, onSave }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(src, croppedAreaPixels, shape);
      onSave(blob);
    } catch (e) {
      console.error("Crop failed", e);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      padding: "0.5rem",
    }}>
      <div style={{
        background: "#fff", borderRadius: "12px 12px 8px 8px",
        width: "100%", maxWidth: "520px",
        maxHeight: "92vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: "1rem" }}>{title}</span>
          <button type="button" onClick={onCancel} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b", lineHeight: 1 }}>✕</button>
        </div>

        {/* Crop area */}
        <div style={{ position: "relative", width: "100%", flex: "1 1 auto", minHeight: 220, background: "#111" }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div style={{ padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>بزرگ‌نمایی</span>
          <input
            type="range"
            min={1} max={3} step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: "#6366f1", minHeight: 44 }}
          />
        </div>

        {/* Actions */}
        <div style={{ padding: "0.6rem 1rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem", borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>انصراف</button>
          <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? "در حال پردازش…" : "ذخیره تصویر"}
          </button>
        </div>
      </div>
    </div>
  );
}
