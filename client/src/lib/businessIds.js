/** نمایش شناسهٔ آگهی: پیشوند IU- + ۸ رقم (پیش‌فرض صفر از چپ). */
export function formatAdId(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n < 0) return "";
  const s = String(Math.floor(n));
  const digits = s.length <= 8 ? s.padStart(8, "0") : s.slice(-8);
  return `IU-${digits}`;
}
