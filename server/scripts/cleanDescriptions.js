/**
 * cleanDescriptions.js — Remove address mentions and strengthen uniqueness.
 *
 * Run:      node scripts/cleanDescriptions.js
 * Dry-run:  node scripts/cleanDescriptions.js --dry-run
 * Single:   node scripts/cleanDescriptions.js --id=26
 * Reset:    node scripts/cleanDescriptions.js --reset   (clears state file)
 *
 * Primary provider:  Gemini (GEMINI_API_KEY)
 * Fallback provider: Claude (ANTHROPIC_API_KEY, optional)
 *
 * State is tracked in scripts/clean_descriptions_state.json — safe to stop
 * and resume at any time.
 */

import "../src/env.js";
import { pool } from "../src/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "clean_descriptions_state.json");

const DRY_RUN   = process.argv.includes("--dry-run");
const RESET     = process.argv.includes("--reset");
const SINGLE_ID = process.argv.find(a => a.startsWith("--id="))?.split("=")[1];

const BATCH_SIZE = 5;
const DELAY_MS   = 1500;

const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
  console.error("[clean] No AI provider available. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in .env");
  process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── State file ────────────────────────────────────────────────────────────────

function loadState() {
  if (RESET && fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
    console.log("[clean] State reset.");
  }
  if (!fs.existsSync(STATE_FILE)) return { done: [], failed: [] };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { done: [], failed: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are editing Persian business descriptions for a UK business directory. You have two jobs:

JOB 1 — REMOVE ALL ADDRESS INFORMATION:
Strip every mention of:
- Street names, road names, lane names (e.g. "High Street", "خیابان Camden")
- Street numbers (e.g. "198", "31-32")
- UK postcodes (e.g. "NW1 8QR", "EC1N 6TD")
- Neighbourhood or ward names (e.g. "محله چرچ‌اند", "منطقه فینچلی")
- Phrases like "واقع در", "آدرس دقیق", "آدرس ما", "در خیابان", "در محله"
- Any sentence whose sole purpose is to state a physical location
- Keeping "London" or a general area like "شمال لندن" is acceptable ONLY if it flows naturally

JOB 2 — MAKE IT MORE DISTINCTIVE:
- Flip the opening sentence — start with the service or value, not the business name
- Use varied sentence lengths — one short punchy line, then a compound one
- Replace clichés or filler phrases
- Keep all factual details (services, specialisations, target customers)

RULES:
- Output clean HTML only: <p>, <ul><li>, <h3> tags — no Markdown, no plain text
- Write entirely in Persian (Farsi) — English only for proper nouns/brand names
- Do NOT invent new services or facts
- Do NOT include any introductory note — output the description only`;

// ── Providers ─────────────────────────────────────────────────────────────────

async function callGemini(description) {
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: description }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    const err = new Error(`Gemini ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function callClaude(description) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: description }],
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    const err = new Error(`Claude ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

async function processOne(description) {
  if (GEMINI_API_KEY) {
    try {
      return await callGemini(description);
    } catch (e) {
      if (e.status === 429 || e.status === 401 || e.status === 403) {
        // Quota or auth — stop entirely, don't waste on remaining items
        throw Object.assign(e, { fatal: true });
      }
      if (!ANTHROPIC_API_KEY) throw e;
      console.warn(`  [gemini-err] ${e.message.slice(0, 80)} — trying Claude fallback`);
    }
  }
  return await callClaude(description);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const state = loadState();
  const doneSet = new Set(state.done);

  const client = await pool.connect();
  let processed = 0, failed = 0, skipped = 0;

  try {
    const where = SINGLE_ID
      ? `WHERE id = ${parseInt(SINGLE_ID)}`
      : `WHERE description IS NOT NULL AND trim(description) NOT IN ('', '<p></p>', '<p><br></p>')`;

    const { rows: allRows } = await client.query(
      `SELECT id, slug, name_fa FROM businesses ${where} ORDER BY id`
    );

    const rows = SINGLE_ID ? allRows : allRows.filter(r => !doneSet.has(r.id));
    const alreadyDone = allRows.length - rows.length;

    console.log(`[clean] ${allRows.length} total with descriptions. ${alreadyDone} already done, ${rows.length} remaining.`);
    if (DRY_RUN) console.log("[clean] DRY RUN — no DB writes.");
    if (rows.length === 0) { console.log("[clean] Nothing to do."); return; }

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      console.log(`\n[clean] Batch ${batchNum}/${totalBatches} (${i + 1}–${Math.min(i + BATCH_SIZE, rows.length)} of ${rows.length} remaining)…`);

      const ids = batch.map(r => r.id);
      const { rows: descRows } = await client.query(
        `SELECT id, description FROM businesses WHERE id = ANY($1)`, [ids]
      );
      const descMap = Object.fromEntries(descRows.map(r => [r.id, r.description]));

      let fatalError = null;

      for (const row of batch) {
        const desc = descMap[row.id];
        if (!desc?.trim()) {
          console.log(`  [skip] id=${row.id} — empty`);
          skipped++;
          continue;
        }

        try {
          const cleaned = await processOne(desc);
          if (!cleaned) {
            console.warn(`  [skip] id=${row.id} — empty AI response`);
            skipped++;
            continue;
          }

          if (!DRY_RUN) {
            await client.query(
              `UPDATE businesses SET description = $1 WHERE id = $2`,
              [cleaned, row.id]
            );
            state.done.push(row.id);
            saveState(state);
          }

          console.log(`  [ok] id=${row.id} "${row.name_fa}" (${desc.length} → ${cleaned.length} chars)`);
          processed++;
        } catch (e) {
          if (e.fatal) {
            fatalError = e;
            break;
          }
          console.warn(`  [err] id=${row.id} "${row.name_fa}": ${e.message.slice(0, 120)}`);
          state.failed.push(row.id);
          saveState(state);
          failed++;
        }
      }

      if (fatalError) {
        console.error(`\n[clean] Fatal provider error — stopping early: ${fatalError.message.slice(0, 200)}`);
        console.error(`[clean] Progress saved. Re-run after fixing the issue to resume.`);
        break;
      }

      if (i + BATCH_SIZE < rows.length) await sleep(DELAY_MS);
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n[clean] Done — processed: ${processed}, failed: ${failed}, skipped: ${skipped}`);
  console.log(`[clean] State: ${state.done.length} total done, ${state.failed.length} total failed`);
  if (state.failed.length > 0) {
    console.log(`[clean] Failed IDs: ${state.failed.join(", ")}`);
  }
}

main().catch(e => { console.error("[clean] Fatal:", e.message); process.exit(1); });
