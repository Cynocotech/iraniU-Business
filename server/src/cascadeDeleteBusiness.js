import { dbGet, dbTransaction } from "./db.js";

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
export async function cascadeDeleteBusinessBySlug(rawSlug) {
  const slug = String(rawSlug || "").trim();
  if (!slug) return { deleted: false, reason: "empty" };
  const exists = await dbGet(`SELECT 1 FROM businesses WHERE slug = $1`, [slug]);
  if (!exists) return { deleted: false, reason: "not_found" };

  await dbTransaction(async (client) => {
    for (const t of SLUG_TABLES) {
      await client.query(`DELETE FROM ${t} WHERE business_slug = $1`, [slug]);
    }
    await client.query(`DELETE FROM businesses WHERE slug = $1`, [slug]);
  });
  return { deleted: true };
}
