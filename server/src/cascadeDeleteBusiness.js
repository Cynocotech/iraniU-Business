import { dbGet, dbTransaction } from "./db.js";
import { deleteFromS3, extractS3KeyFromUrl } from "./s3Upload.js";

const SLUG_TABLES = [
  "business_reports",
  "call_logs",
  "qr_scans",
  "phone_clicks",
  "claim_requests",
  "billing_records",
  "reservations",
];

async function deleteImageFromS3(url) {
  if (!url) return;
  const key = await extractS3KeyFromUrl(url);
  if (key) await deleteFromS3(key);
}

/**
 * حذف یک آگهی، ردیف‌های وابسته، و تصاویر S3 آن.
 * برگشت: { deleted: boolean, reason?: string }
 */
export async function cascadeDeleteBusinessBySlug(rawSlug) {
  const slug = String(rawSlug || "").trim();
  if (!slug) return { deleted: false, reason: "empty" };

  const row = await dbGet(
    `SELECT logo_url, cover_image_url, gallery_json FROM businesses WHERE slug = $1`,
    [slug]
  );
  if (!row) return { deleted: false, reason: "not_found" };

  // Collect all S3 image URLs before deleting from DB
  const imageUrls = [row.logo_url, row.cover_image_url];
  try {
    const gallery = typeof row.gallery_json === "string"
      ? JSON.parse(row.gallery_json)
      : row.gallery_json;
    if (Array.isArray(gallery)) imageUrls.push(...gallery);
  } catch {}

  await dbTransaction(async (client) => {
    for (const t of SLUG_TABLES) {
      await client.query(`DELETE FROM ${t} WHERE business_slug = $1`, [slug]);
    }
    await client.query(`DELETE FROM businesses WHERE slug = $1`, [slug]);
  });

  // Delete S3 images after DB is clean (failures are non-fatal)
  await Promise.allSettled(imageUrls.map(deleteImageFromS3));

  return { deleted: true };
}
