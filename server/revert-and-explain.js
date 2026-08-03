import "./src/env.js";
import { dbRun, dbGet, dbAll } from "./src/db.js";

async function fix() {
  // Revert back to sanitized slug
  await dbRun(`
    UPDATE qr_scans 
    SET business_slug = 'qr_abtin-yeganeh-solicitor'
    WHERE business_slug = 'qr_abtin-yeganeh---solicitor'
  `);

  console.log("✅ Reverted to correct sanitized slug\n");

  // Show all scans
  const scans = await dbAll(`
    SELECT business_slug, scanned_at 
    FROM qr_scans 
    ORDER BY scanned_at DESC
  `);

  console.log("All QR scans:");
  scans.forEach((s, i) => {
    console.log(`${i + 1}. ${s.business_slug} at ${s.scanned_at}`);
  });

  // Test API
  const count = await dbGet(`
    SELECT COUNT(*) as c 
    FROM qr_scans 
    WHERE business_slug = 'qr_abtin-yeganeh-solicitor'
  `);

  console.log(`\n✅ Count for abtin-yeganeh-solicitor: ${count.c}`);
}

fix().catch(console.error);
