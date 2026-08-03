import "./src/env.js";
import { dbAll } from "./src/db.js";

async function checkScans() {
  console.log("Checking QR scans in database...\n");

  const scans = await dbAll(`
    SELECT business_slug, scanned_at, COUNT(*) OVER (PARTITION BY business_slug) as total
    FROM qr_scans 
    ORDER BY scanned_at DESC 
    LIMIT 20
  `);

  if (scans.length === 0) {
    console.log("❌ No QR scans found in database!");
    console.log("\nPossible reasons:");
    console.log("1. QR code URL might be wrong");
    console.log("2. Scans not going through /go endpoint");
    console.log("3. Database insert failing silently");
    return;
  }

  console.log(`✅ Found ${scans.length} scan(s):\n`);
  
  scans.forEach((scan, i) => {
    console.log(`${i + 1}. Business: ${scan.business_slug}`);
    console.log(`   Scanned at: ${scan.scanned_at}`);
    console.log(`   Total for this business: ${scan.total}`);
    console.log();
  });
}

checkScans().catch(console.error);
