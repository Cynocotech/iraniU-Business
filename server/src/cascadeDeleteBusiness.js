import { db } from "./db.js";

/** جداولی که به business_slug وابسته‌اند (هم‌تراز با db.js migrate slug) */
const SLUG_TABLES = [
  "business_reports",
  "call_logs",
  "qr_scans",
  "phone_clicks",
  "claim_requests",
  "billing_records",
  "reservations",
];

/**
 * حذف یک آگهی و ردیف‌های وابسته. برگشت: { deleted: boolean, reason?: string }
 */
export function cascadeDeleteBusinessBySlug(rawSlug) {
  const slug = String(rawSlug || "").trim();
  if (!slug) return { deleted: false, reason: "empty" };
  const exists = db.prepare(`SELECT 1 FROM businesses WHERE slug = ?`).get(slug);
  if (!exists) return { deleted: false, reason: "not_found" };

  const tx = db.transaction(() => {
    for (const t of SLUG_TABLES) {
      db.prepare(`DELETE FROM ${t} WHERE business_slug = ?`).run(slug);
    }
    db.prepare(`DELETE FROM businesses WHERE slug = ?`).run(slug);
  });
  tx();
  return { deleted: true };
}
