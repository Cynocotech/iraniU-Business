/**
 * cleanDescriptions.js — Remove address mentions and strengthen uniqueness via GPT.
 *
 * Run:      node scripts/cleanDescriptions.js
 * Dry-run:  node scripts/cleanDescriptions.js --dry-run
 * Single:   node scripts/cleanDescriptions.js --id=26
 */

import "../src/env.js";
import { pool } from "../src/db.js";

const DRY_RUN    = process.argv.includes("--dry-run");
const SINGLE_ID  = process.argv.find(a => a.startsWith("--id="))?.split("=")[1];
const BATCH_SIZE = 10;
const DELAY_MS   = 1200;
const MODEL      = "gpt-4o-mini";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error("OPENAI_API_KEY not set"); process.exit(1); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SYSTEM_PROMPT = `You are editing Persian business descriptions for a UK business directory. You have two jobs:

**JOB 1 — REMOVE ALL ADDRESS INFORMATION:**
Strip every mention of:
- Street names, road names, lane names (e.g. "High Street", "خیابان Camden")
- Street numbers (e.g. "198", "31-32")
- UK postcodes (e.g. "NW1 8QR", "EC1N 6TD")
- Neighbourhood or ward names (e.g. "محله چرچ‌اند", "منطقه فینچلی")
- Phrases like "واقع در", "آدرس دقیق", "آدرس ما", "در خیابان", "در محله"
- Any sentence whose sole purpose is to state a physical location
- Keeping "London" or a general area like "شمال لندن" is acceptable ONLY if it flows naturally — remove if it feels forced

**JOB 2 — MAKE IT MORE DISTINCTIVE:**
The current text is too close to the original. Rewrite it so it is clearly different:
- Flip the opening sentence — start with the service or value, not the business name
- Use varied sentence lengths — one short punchy line, then a compound one
- Replace any remaining clichés or filler phrases
- Keep all factual details (services, specialisations, target customers)

**RULES:**
- Output clean HTML only: <p>, <ul><li>, <h3> tags — no Markdown, no plain text
- Write entirely in Persian (Farsi) — English only for proper nouns/brand names
- Do NOT invent new services or facts
- Do NOT include any introductory note or explanation — output the description only`;

async function processOne(description) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.8,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function main() {
  const client = await pool.connect();
  let done = 0, failed = 0;

  try {
    const where = SINGLE_ID
      ? `WHERE id = ${parseInt(SINGLE_ID)}`
      : `WHERE description IS NOT NULL AND trim(description) NOT IN ('', '<p></p>', '<p><br></p>')`;

    const { rows } = await client.query(
      `SELECT id, slug, name_fa FROM businesses ${where} ORDER BY id`
    );

    console.log(`[clean] ${rows.length} descriptions to process.`);
    if (DRY_RUN) console.log("[clean] DRY RUN — no DB writes.");

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      console.log(`\n[clean] Batch ${batchNum}/${totalBatches} (rows ${i + 1}–${Math.min(i + BATCH_SIZE, rows.length)})…`);

      // Fetch full descriptions for this batch
      const ids = batch.map(r => r.id);
      const { rows: descRows } = await client.query(
        `SELECT id, description FROM businesses WHERE id = ANY($1)`, [ids]
      );
      const descMap = Object.fromEntries(descRows.map(r => [r.id, r.description]));

      await Promise.allSettled(
        batch.map(async (row) => {
          const desc = descMap[row.id];
          if (!desc || !desc.trim()) { console.log(`  [skip] id=${row.id} — empty`); return; }
          try {
            const cleaned = await processOne(desc);
            if (!cleaned) { console.warn(`  [skip] id=${row.id} — empty response`); return; }

            if (!DRY_RUN) {
              await client.query(
                `UPDATE businesses SET description = $1 WHERE id = $2`,
                [cleaned, row.id]
              );
            }
            console.log(`  [ok] id=${row.id} "${row.name_fa}" (${desc.length} → ${cleaned.length} chars)`);
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

  console.log(`\n[clean] Done — processed: ${done}, failed: ${failed}`);
}

main().catch(e => { console.error("[clean] Fatal:", e.message); process.exit(1); });
