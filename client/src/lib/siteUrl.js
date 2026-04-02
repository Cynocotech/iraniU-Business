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

/**
 * If the string has no http(s) scheme, prepend `https://` (e.g. g.page/... → https://g.page/...).
 */
export function ensureHttpsUrl(s) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return `https://${t}`;
}

/** Full URL to a business listing page (uses site origin + path). */
export function buildBusinessListingUrl(slug) {
  const s = String(slug ?? "").trim();
  if (!s) return "";
  const base = getSiteUrl();
  const path = `/business?slug=${encodeURIComponent(s)}`;
  if (base) return `${base}${path}`;
  return path;
}
