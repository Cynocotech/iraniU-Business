#!/usr/bin/env node

/**
 * Migrate existing local uploads to S3
 * Usage: node scripts/migrate-to-s3.js [--dry-run]
 */

import "../src/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { uploadToS3, isS3Enabled } from "../src/s3Upload.js";
import { dbAll, dbRun } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");
const exchangeBannerDir = path.join(uploadsDir, "exchange-banners");

const isDryRun = process.argv.includes("--dry-run");

async function migrateExchangeBanners() {
  console.log("\n=== Migrating Exchange Banners ===\n");

  if (!isS3Enabled()) {
    console.error("❌ S3 not configured. Set AWS credentials in .env file.");
    return;
  }

  const banners = await dbAll(`SELECT id, image_url FROM exchange_banners`);

  console.log(`Found ${banners.length} exchange banners\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const banner of banners) {
    const imageUrl = String(banner.image_url || "");

    // Skip if already on S3
    if (imageUrl.startsWith("https://")) {
      console.log(`⏭️  Banner #${banner.id}: Already on S3`);
      skipped++;
      continue;
    }

    // Skip if not a local upload
    if (!imageUrl.startsWith("/uploads/exchange-banners/")) {
      console.log(`⏭️  Banner #${banner.id}: Not a local upload (${imageUrl})`);
      skipped++;
      continue;
    }

    const filename = path.basename(imageUrl);
    const localPath = path.join(exchangeBannerDir, filename);

    if (!fs.existsSync(localPath)) {
      console.log(`⚠️  Banner #${banner.id}: File not found at ${localPath}`);
      errors++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
      };
      const contentType = mimeTypes[ext] || "image/jpeg";

      const s3Key = `exchange-banners/${filename}`;

      if (isDryRun) {
        console.log(`🔍 [DRY RUN] Would upload Banner #${banner.id}: ${filename} → ${s3Key}`);
        migrated++;
      } else {
        const result = await uploadToS3(buffer, s3Key, contentType);
        await dbRun(`UPDATE exchange_banners SET image_url = $1 WHERE id = $2`, [result.url, banner.id]);

        console.log(`✅ Banner #${banner.id}: ${filename} → ${result.url}`);
        migrated++;

        // Optionally delete local file after successful upload
        // fs.unlinkSync(localPath);
      }
    } catch (error) {
      console.error(`❌ Banner #${banner.id}: Upload failed - ${error.message}`);
      errors++;
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (isDryRun) {
    console.log("\n⚠️  This was a dry run. Run without --dry-run to actually migrate.");
  }
}

async function main() {
  console.log("Iraniu S3 Migration Tool");
  console.log("========================\n");

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  await migrateExchangeBanners();

  console.log("\n✨ Done!\n");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
