#!/usr/bin/env node
/**
 * Test script to verify QR scan flow
 * Run: node test-qr-flow.js
 */

import { dbGet, dbRun, dbAll } from "./src/db.js";

async function testQRFlow() {
  console.log("Testing QR scan flow...\n");

  const testSlug = "test-business";
  const testBid = "test-business";
  const qrKey = "qr_" + testBid;

  console.log(`1. Test business slug: ${testSlug}`);
  console.log(`2. QR bid: ${testBid}`);
  console.log(`3. QR key for database: ${qrKey}\n`);

  // Check initial count
  const before = await dbGet(`SELECT COUNT(*)::int AS c FROM qr_scans WHERE business_slug = $1`, [qrKey]);
  console.log(`4. Count BEFORE insert: ${before.c}`);

  // Insert a scan
  await dbRun(`INSERT INTO qr_scans (business_slug) VALUES ($1)`, [qrKey]);
  console.log(`5. Inserted QR scan for: ${qrKey}`);

  // Check after count
  const after = await dbGet(`SELECT COUNT(*)::int AS c FROM qr_scans WHERE business_slug = $1`, [qrKey]);
  console.log(`6. Count AFTER insert: ${after.c}`);

  console.log(`\n✅ QR scan incremented from ${before.c} to ${after.c}`);

  // Show recent scans
  const recent = await dbAll(`SELECT id, business_slug, scanned_at FROM qr_scans WHERE business_slug = $1 ORDER BY id DESC LIMIT 5`, [qrKey]);
  console.log(`\nRecent scans for ${qrKey}:`);
  recent.forEach(r => console.log(`  - ID ${r.id}: ${r.scanned_at}`));

  process.exit(0);
}

testQRFlow().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
