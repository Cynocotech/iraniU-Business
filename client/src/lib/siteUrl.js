/**
 * Absolute site origin for canonical URLs and Open Graph.
 * Set `VITE_PUBLIC_SITE_URL` in production (e.g. https://job.iraniu.uk).
 */
export function getSiteUrl() {
  const v = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (v && String(v).trim()) return String(v).trim().replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}
