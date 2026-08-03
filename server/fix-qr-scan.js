import "./src/env.js";
import { dbRun, dbGet } from "./src/db.js";

async function fixScan() {
  console.log("Fixing QR scan slug mismatch...\n");

  // Update the scan to use the correct slug
  await dbRun(`
    UPDATE qr_scans 
    SET business_slug = 'qr_abtin-yeganeh---solicitor'
    WHERE business_slug = 'qr_abtin-yeganeh-solicitor'
  `);

  console.log("✅ Updated scan slug from:");
  console.log("   qr_abtin-yeganeh-solicitor");
  console.log("   ↓");
  console.log("   qr_abtin-yeganeh---solicitor");

  // Verify
  const count = await dbGet(`
    SELECT COUNT(*) as c 
    FROM qr_scans 
    WHERE business_slug = 'qr_abtin-yeganeh---solicitor'
  `);

  console.log(`\n✅ Business "abtin-yeganeh---solicitor" now has ${count.c} scan(s)`);
}

fixScan().catch(console.error);
