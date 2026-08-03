import "./src/env.js";
import { dbAll } from "./src/db.js";

async function testQRScan() {
  console.log("Testing QR scan tracking...\n");

  // Show recent scans
  const scans = await dbAll(`
    SELECT business_slug, scanned_at 
    FROM qr_scans 
    ORDER BY scanned_at DESC 
    LIMIT 10
  `);

  console.log("Recent QR scans:");
  scans.forEach((s, i) => {
    console.log(`${i + 1}. ${s.business_slug} - ${s.scanned_at}`);
  });

  console.log("\n---\n");

  // Check stats for each unique business
  const businesses = await dbAll(`
    SELECT business_slug, COUNT(*) as count
    FROM qr_scans
    GROUP BY business_slug
    ORDER BY count DESC
  `);

  console.log("QR Scan Stats by Business:");
  businesses.forEach((b) => {
    console.log(`${b.business_slug}: ${b.count} scan(s)`);
    
    // Extract the actual business slug (remove qr_ prefix)
    const slug = b.business_slug.replace(/^qr_/, '');
    console.log(`  → Dashboard should show ${b.count} for business: ${slug}\n`);
  });
}

testQRScan().catch(console.error);
