/**
 * backfillPostcodes.js — One-time backfill of postcode geo data from postcodes.io.
 *
 * Fetches latitude, longitude, primary_care_trust, and admin_ward for every
 * approved business that has a postcode but no geo data yet.
 *
 * Uses the postcodes.io BATCH endpoint (up to 100 per request) to minimise
 * the number of HTTP calls. Adds a 1-second delay between batches.
 *
 * Run:  node server/scripts/backfillPostcodes.js
 * npm:  cd server && npm run backfill:postcodes
 *
 * Safe to re-run — only processes rows where postcode_latitude IS NULL.
 */

import "../src/env.js";
import { pool } from "../src/db.js";
import { lookupPostcodesBatch } from "../src/postcodeIo.js";

const BATCH_SIZE   = 100; // postcodes.io hard limit per POST
const BATCH_DELAY  = 1000; // ms between batches — polite default

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const client = await pool.connect();
  try {
    // Only process rows that still need enrichment.
    const { rows: pending } = await client.query(
      `SELECT id, slug, postcode
         FROM public.businesses
        WHERE postcode IS NOT NULL
          AND trim(postcode) <> ''
          AND postcode_latitude IS NULL
        ORDER BY id`
    );

    if (pending.length === 0) {
      console.log("[backfill-postcodes] Nothing to do — all rows already have geo data.");
      return;
    }

    console.log(`[backfill-postcodes] ${pending.length} business(es) need geo enrichment.`);

    let updated  = 0;
    let notFound = 0;
    let errors   = 0;
    const totalBatches = Math.ceil(pending.length / BATCH_SIZE);

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch      = pending.slice(i, i + BATCH_SIZE);
      const batchNum   = Math.floor(i / BATCH_SIZE) + 1;
      const postcodes  = batch.map((b) => b.postcode);

      console.log(
        `[backfill-postcodes] Batch ${batchNum}/${totalBatches}: ` +
        `looking up ${batch.length} postcode(s)…`
      );

      let geoMap;
      try {
        geoMap = await lookupPostcodesBatch(postcodes);
      } catch (e) {
        // lookupPostcodesBatch never throws, but guard just in case.
        console.warn(`[backfill-postcodes] Batch ${batchNum} lookup error:`, e.message);
        errors += batch.length;
        if (i + BATCH_SIZE < pending.length) await sleep(BATCH_DELAY);
        continue;
      }

      for (const biz of batch) {
        const key = biz.postcode.replace(/\s+/g, "").toUpperCase().trim();
        const geo = geoMap.get(key);

        if (!geo) {
          console.warn(
            `  [not found] id=${biz.id} slug="${biz.slug}" postcode="${biz.postcode}"`
          );
          notFound++;
          continue;
        }

        try {
          await client.query(
            `UPDATE public.businesses
                SET postcode_latitude           = $1,
                    postcode_longitude          = $2,
                    postcode_primary_care_trust = $3,
                    postcode_admin_ward         = $4
              WHERE id = $5`,
            [geo.latitude, geo.longitude, geo.primary_care_trust, geo.admin_ward, biz.id]
          );
          console.log(
            `  [ok] id=${biz.id} slug="${biz.slug}" postcode="${biz.postcode}"` +
            ` → lat=${geo.latitude} lng=${geo.longitude}` +
            ` ward="${geo.admin_ward ?? "-"}" pct="${geo.primary_care_trust ?? "-"}"`
          );
          updated++;
        } catch (e) {
          console.warn(
            `  [error] Update failed for id=${biz.id} slug="${biz.slug}":`,
            e.message
          );
          errors++;
        }
      }

      // Polite pause between batches — skip after the last one.
      if (i + BATCH_SIZE < pending.length) {
        await sleep(BATCH_DELAY);
      }
    }

    console.log(
      `\n[backfill-postcodes] Summary — ` +
      `total: ${pending.length}, ` +
      `updated: ${updated}, ` +
      `not found / invalid: ${notFound}, ` +
      `errors: ${errors}`
    );

    if (updated > 0) {
      console.log(
        "[backfill-postcodes] Re-run embedBusinesses.js so the new ward/PCT text is " +
        "included in the AI search embeddings."
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[backfill-postcodes] Fatal:", e.message);
    process.exit(1);
  });
