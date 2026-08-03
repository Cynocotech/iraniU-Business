import "./src/env.js";
import { dbAll } from "./src/db.js";

async function checkManagerBusinesses() {
  console.log("Checking manager businesses and QR scans...\n");

  const businesses = await dbAll(`
    SELECT b.slug, b.name_fa, b.manager_id, b.exchange_manager_id,
           (SELECT COUNT(*) FROM qr_scans WHERE business_slug = 'qr_' || b.slug) as scan_count
    FROM businesses b
    WHERE b.manager_id IS NOT NULL OR b.exchange_manager_id IS NOT NULL
    ORDER BY b.slug
  `);

  console.log("Businesses with Managers:");
  businesses.forEach((b) => {
    console.log(`\n${b.name_fa || b.slug}`);
    console.log(`  Slug: ${b.slug}`);
    console.log(`  Manager ID: ${b.manager_id || 'none'}`);
    console.log(`  Exchange Manager ID: ${b.exchange_manager_id || 'none'}`);
    console.log(`  QR Scans: ${b.scan_count}`);
    
    if (b.scan_count > 0) {
      console.log(`  ✅ This business HAS scans!`);
    }
  });
}

checkManagerBusinesses().catch(console.error);
