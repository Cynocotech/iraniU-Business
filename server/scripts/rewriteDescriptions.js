/**
 * rewriteDescriptions.js — Rewrite business descriptions with GPT using a strict protocol.
 *
 * - Backs up original text into description_original before first overwrite
 * - Marks each row with description_rewritten = 1 so normal re-runs skip them
 * - Use --force to re-process already-rewritten rows with the updated prompt
 *
 * Run:       node scripts/rewriteDescriptions.js
 * Dry-run:   node scripts/rewriteDescriptions.js --dry-run
 * Force all: node scripts/rewriteDescriptions.js --force
 * Resume:    safe to re-run — skips already-rewritten rows (unless --force)
 */

import "../src/env.js";
import { pool } from "../src/db.js";

const DRY_RUN    = process.argv.includes("--dry-run");
const FORCE      = process.argv.includes("--force");
const BATCH_SIZE = 10;
const DELAY_MS   = 1500;
const MODEL      = "gpt-4o-mini";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("[rewrite] OPENAI_API_KEY not set");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SYSTEM_PROMPT = `You are a professional copywriter specialising in local business directory listings for Persian-speaking businesses in the UK. Your task is to rewrite business descriptions in Persian (Farsi) following this strict protocol:

### REWRITING PROTOCOL

1. FACT EXTRACTION (Mental Step):
   - Extract the fundamental facts only: services offered, location/area served, target audience, unique selling points (USPs), opening hours, or specializations.
   - Ignore all original sentence structures, stylistic fluff, and marketing clichés.

2. NARRATIVE REBUILDING:
   - Completely reconstruct the narrative from the ground up using a fresh tone.
   - Use dynamic sentence structures (mix short, punchy sentences with compound ones).
   - Adopt a professional, warm, and inviting tone suitable for local business directories or websites.

3. LOCAL CONTEXT INTEGRATION:
   - Naturally weave in the business's local area (e.g., Ward, Borough, or City) if available in the text or metadata, making it feel locally rooted.

### CONSTRAINTS & RULES
- DO NOT use generic AI buzzwords: Avoid words like "nestled," "beacon," "tapestry," "testament," "realm," "game-changer," "look no further," or "one-stop shop" (and their Persian equivalents).
- DO NOT copy 3 or more consecutive words from the original source text.
- Maintain 100% factual accuracy — do not invent services or contact details not mentioned in the original.
- Output must be structured clearly using standard Markdown (paragraphs, short bullet points for services if appropriate).
- Write entirely in Persian (Farsi). Do not switch to English except for proper nouns or brand names that are inherently English.

### OUTPUT FORMAT
Provide ONLY the finalized, rewritten business description in Persian. Do not include introductory notes, explanations, or quotes around the response.`;

async function rewriteOne(description, businessName, city) {
  const context = [
    businessName ? `نام کسب‌وکار: ${businessName}` : null,
    city ? `شهر/منطقه: ${city}` : null,
  ].filter(Boolean).join("\n");

  const userMsg = context
    ? `${context}\n\nمتن توضیحات:\n${description}`
    : `متن توضیحات:\n${description}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.75,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function main() {
  const client = await pool.connect();
  let done = 0, failed = 0, skipped = 0;

  try {
    const whereClause = FORCE
      ? `WHERE description IS NOT NULL AND trim(description) NOT IN ('', '<p></p>', '<p><br></p>')`
      : `WHERE description IS NOT NULL AND trim(description) NOT IN ('', '<p></p>', '<p><br></p>') AND description_rewritten = 0`;

    const { rows } = await client.query(
      `SELECT id, slug, name_fa, city, description, description_original
         FROM businesses
         ${whereClause}
        ORDER BY id`
    );

    console.log(`[rewrite] ${rows.length} descriptions to rewrite${FORCE ? " (--force mode)" : ""}.`);
    if (DRY_RUN) console.log("[rewrite] DRY RUN — no DB writes.");

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      console.log(`\n[rewrite] Batch ${batchNum}/${totalBatches} (rows ${i + 1}–${Math.min(i + BATCH_SIZE, rows.length)})…`);

      await Promise.allSettled(
        batch.map(async (row) => {
          try {
            // Always rewrite from the original scraped text, not a previous AI version
            const sourceText = row.description_original || row.description;
            const rewritten = await rewriteOne(sourceText, row.name_fa, row.city);
            if (!rewritten) {
              console.warn(`  [skip] id=${row.id} — empty response`);
              skipped++;
              return;
            }

            if (!DRY_RUN) {
              await client.query(
                `UPDATE businesses
                    SET description           = $1,
                        description_original  = COALESCE(NULLIF(description_original, ''), $2),
                        description_rewritten = 1
                  WHERE id = $3`,
                [rewritten, row.description, row.id]
              );
            }
            console.log(`  [ok] id=${row.id} "${row.name_fa}" (${sourceText.length} → ${rewritten.length} chars)`);
            done++;
          } catch (e) {
            console.warn(`  [err] id=${row.id} "${row.name_fa}": ${e.message}`);
            failed++;
          }
        })
      );

      if (i + BATCH_SIZE < rows.length) await sleep(DELAY_MS);
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n[rewrite] Done — rewritten: ${done}, failed: ${failed}, skipped: ${skipped}`);
  if (!DRY_RUN && done > 0) {
    console.log("[rewrite] Tip: run `npm run embed:businesses` to refresh AI search embeddings.");
  }
}

main().catch((e) => {
  console.error("[rewrite] Fatal:", e.message);
  process.exit(1);
});
