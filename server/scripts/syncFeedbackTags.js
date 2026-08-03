/**
 * syncFeedbackTags.js — Feedback-loop enrichment for AI search.
 *
 * For each (query, clicked_slug) pair logged in the last 30 days with a
 * positive user signal (click-through, or explicit feedback = 1), this script:
 *   1. Fetches the clicked business from Postgres.
 *   2. Checks whether the query phrase already exists in ai_tags_json.
 *   3. If missing, appends it and sets embedding_hash = NULL.
 *
 * Two effects of appending the phrase + nulling the hash:
 *   • Immediate  — the phrase is now in ai_tags_json, so the pg_trgm text leg
 *                  of RRF will match it for similar queries until the next embed run.
 *   • Next night — embedBusinesses.js detects the null hash, re-embeds the row
 *                  (GPT regenerates service tags from description; those overwrite
 *                  this phrase in ai_tags_json, but the fresh embedding captures
 *                  the current business content at least).
 *
 * If you want feedback phrases to survive re-embedding, modify embedBusinesses.js
 * to merge existing tags with GPT-generated ones before building the blob.
 *
 * Run: node server/scripts/syncFeedbackTags.js
 * Add to cron: 0 3 * * * node /path/to/server/scripts/syncFeedbackTags.js
 */

import "../src/env.js";
import { pool } from "../src/db.js";

const LOOKBACK_DAYS = 30;
const MAX_PHRASE_LENGTH = 80;

async function main() {
  const client = await pool.connect();
  try {
    // ── Step 1: Collect positive-signal log entries ───────────────────────────
    // A positive signal is: user clicked a specific business result (clicked_slug
    // is set) and did NOT explicitly rate it negative (feedback != -1).
    // Rows where feedback = 1 but clicked_slug IS NULL are skipped — without a
    // slug we cannot identify which business to enrich.
    const { rows: signals } = await client.query(
      `SELECT DISTINCT ON (clicked_slug, lower(trim(query)))
              trim(query)   AS query,
              clicked_slug
         FROM public.ai_search_logs
        WHERE created_at  >= NOW() - INTERVAL '${LOOKBACK_DAYS} days'
          AND clicked_slug IS NOT NULL
          AND (feedback IS NULL OR feedback >= 0)
        ORDER BY clicked_slug, lower(trim(query)), created_at DESC`
    );

    if (signals.length === 0) {
      console.log(
        `[sync-feedback-tags] No positive-signal clicks in the last ${LOOKBACK_DAYS} days.`
      );
      return;
    }

    console.log(
      `[sync-feedback-tags] Evaluating ${signals.length} unique (slug, query) pair(s)…`
    );

    let alreadyTagged = 0;
    let updated      = 0;
    let notFound     = 0;
    let errors       = 0;

    // ── Step 2–4: Per pair — fetch, check, append ─────────────────────────────
    for (const { query, clicked_slug } of signals) {
      const phrase = query.slice(0, MAX_PHRASE_LENGTH);
      if (!phrase) continue;

      // Fetch the business (approved only — no point tagging hidden listings).
      let business;
      try {
        const { rows } = await client.query(
          `SELECT id, ai_tags_json
             FROM public.businesses
            WHERE slug = $1
              AND listing_approval = 'approved'`,
          [clicked_slug]
        );
        business = rows[0];
      } catch (e) {
        console.warn(
          `[sync-feedback-tags] DB fetch error for slug="${clicked_slug}":`,
          e.message
        );
        errors++;
        continue;
      }

      if (!business) {
        notFound++;
        continue;
      }

      // ── Step 3: Check existing tags ────────────────────────────────────────
      let tags = [];
      try {
        const parsed = JSON.parse(business.ai_tags_json || "[]");
        tags = Array.isArray(parsed) ? parsed : [];
      } catch {
        tags = [];
      }

      const phraseLower = phrase.toLowerCase();
      const alreadyPresent = tags.some(
        (t) => String(t).trim().toLowerCase() === phraseLower
      );

      if (alreadyPresent) {
        alreadyTagged++;
        continue;
      }

      // ── Step 4: Append phrase and clear embedding_hash ────────────────────
      tags.push(phrase);
      try {
        await client.query(
          `UPDATE public.businesses
              SET ai_tags_json    = $1,
                  embedding_hash  = NULL
            WHERE id = $2`,
          [JSON.stringify(tags), business.id]
        );
        console.log(
          `[sync-feedback-tags] Updated id=${business.id} slug="${clicked_slug}" ← "${phrase}"`
        );
        updated++;
      } catch (e) {
        console.warn(
          `[sync-feedback-tags] Update failed for id=${business.id} slug="${clicked_slug}":`,
          e.message
        );
        errors++;
      }
    }

    // ── Step 5: Summary ───────────────────────────────────────────────────────
    console.log(
      `\n[sync-feedback-tags] Done — pairs evaluated: ${signals.length}, ` +
      `appended: ${updated}, already present: ${alreadyTagged}, ` +
      `not found / unapproved: ${notFound}, errors: ${errors}`
    );

    if (updated > 0) {
      console.log(
        `[sync-feedback-tags] ${updated} business(es) flagged for re-embedding — ` +
        `run embedBusinesses.js (or wait for its nightly cron) to update vectors.`
      );
    } else {
      console.log(`[sync-feedback-tags] No new phrases added.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[sync-feedback-tags] Fatal:", e.message);
    process.exit(1);
  });
