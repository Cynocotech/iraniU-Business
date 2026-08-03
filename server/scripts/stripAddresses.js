/**
 * stripAddresses.js — Rule-based address removal from business descriptions.
 * No AI required. Removes address content using pattern matching on HTML.
 *
 * Run:      node scripts/stripAddresses.js
 * Dry-run:  node scripts/stripAddresses.js --dry-run
 * Single:   node scripts/stripAddresses.js --id=26
 * Reset:    node scripts/stripAddresses.js --reset
 */

import "../src/env.js";
import { pool } from "../src/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "strip_addresses_state.json");

const DRY_RUN   = process.argv.includes("--dry-run");
const RESET     = process.argv.includes("--reset");
const SINGLE_ID = process.argv.find(a => a.startsWith("--id="))?.split("=")[1];
const VERBOSE   = process.argv.includes("--verbose");

// ── State ─────────────────────────────────────────────────────────────────────

function loadState() {
  if (RESET && fs.existsSync(STATE_FILE)) { fs.unlinkSync(STATE_FILE); console.log("[strip] State reset."); }
  if (!fs.existsSync(STATE_FILE)) return { done: [], skipped: [] };
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return { done: [], skipped: [] }; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Patterns ──────────────────────────────────────────────────────────────────

// Patterns that indicate a sentence/item is address-related
const ADDRESS_PATTERNS = [
  /[A-Z]{1,2}[0-9]{1,2} ?[0-9][A-Z]{2}/,           // UK postcode e.g. NW1 8QR
  /خیابان/,                                           // "street" in Persian
  /کوچه/,                                             // "alley/lane" in Persian
  /واقع در/,                                          // "located at"
  /آدرس ما/,                                          // "our address"
  /آدرس دقیق/,                                        // "exact address"
  /در محله/,                                          // "in the neighbourhood"
  /محله [^\s،,،.]/,                                   // "neighbourhood X"
  /منطقه [^\s،,،.]/,                                  // "area/district X"
  /کد پستی/,                                          // "postal code"
  /پستی:/,                                            // "postcode:"
  /ایستگاه مترو/,                                     // "metro station"
  /ایستگاه قطار/,                                     // "train station"
  /\b(?:High Street|Road,|Lane,|Street,|Avenue,|Close,|Drive,|Gardens,|Grove,|Place,|Square,|Terrace,|Way,)\b/i,
  /\b\d{1,4}[-\s]\d{1,4}\s+(?:[A-Z][a-z]+\s){1,3}(?:Road|Street|Lane|Avenue|Close|Drive|Gardens|Grove|Place|Square|Terrace|Way)\b/i,
];

// H3 headers that introduce address-only sections
const ADDRESS_HEADER_TEXTS = [
  /آدرس/,
  /موقعیت مکانی/,
  /موقعیت/,
  /دسترسی/,        // "access/how to get here"
  /نحوه دسترسی/,
  /امکانات و دسترسی/,
  /چگونه به ما برسید/,
];

function hasAddressContent(text) {
  return ADDRESS_PATTERNS.some(p => p.test(text));
}

function isAddressHeader(text) {
  return ADDRESS_HEADER_TEXTS.some(p => p.test(text));
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Core cleaner ──────────────────────────────────────────────────────────────

function cleanDescription(html) {
  if (!html) return html;

  // Split into top-level blocks. We process the HTML as segments separated by
  // block-level open tags. We handle <p>, <ul>...</ul>, <h3>, <h2>, <h4>.
  // Strategy: parse into a list of "chunks" and filter/transform them.

  let result = html;

  // 1. Remove entire <p> blocks that contain address content
  result = result.replace(/<p>([\s\S]*?)<\/p>/gi, (match, inner) => {
    const text = stripHtml(inner);
    if (hasAddressContent(text)) {
      if (VERBOSE) console.log(`    [rm-p] ${text.slice(0, 80)}`);
      return "";
    }
    return match;
  });

  // 2. Remove <li> items that contain address content
  result = result.replace(/<li>([\s\S]*?)<\/li>/gi, (match, inner) => {
    const text = stripHtml(inner);
    if (hasAddressContent(text)) {
      if (VERBOSE) console.log(`    [rm-li] ${text.slice(0, 80)}`);
      return "";
    }
    return match;
  });

  // 3. Remove <h3>/<h2>/<h4> headers about addresses AND everything until the
  //    next header or end — these are entire address sections
  result = result.replace(/<(h[2-4])>([\s\S]*?)<\/\1>([\s\S]*?)(?=<h[2-4]>|$)/gi, (match, tag, headerInner, body) => {
    const headerText = stripHtml(headerInner);
    if (isAddressHeader(headerText)) {
      if (VERBOSE) console.log(`    [rm-section] header: ${headerText.slice(0, 60)}`);
      return "";
    }
    return match;
  });

  // 4. Remove now-empty <ul></ul> blocks (after li removal)
  result = result.replace(/<ul>\s*<\/ul>/gi, "");
  result = result.replace(/<ol>\s*<\/ol>/gi, "");

  // 5. Collapse multiple blank lines
  result = result.replace(/(\s*\n){3,}/g, "\n\n").trim();

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const state = loadState();
  const doneSet = new Set(state.done);

  const client = await pool.connect();
  let changed = 0, unchanged = 0;

  try {
    const where = SINGLE_ID
      ? `WHERE id = ${parseInt(SINGLE_ID)}`
      : `WHERE description IS NOT NULL AND trim(description) NOT IN ('', '<p></p>', '<p><br></p>')
         AND (
           description ~ '[A-Z]{1,2}[0-9]{1,2} ?[0-9][A-Z]{2}'
           OR description ILIKE '%خیابان%'
           OR description ILIKE '%کوچه%'
           OR description ILIKE '%پستی%'
           OR description ILIKE '%واقع در%'
           OR description ILIKE '%آدرس ما%'
           OR description ILIKE '%آدرس دقیق%'
           OR description ILIKE '%در محله%'
           OR description ILIKE '%ایستگاه مترو%'
           OR description ILIKE '%ایستگاه قطار%'
           OR description ILIKE '%High Street%'
           OR description ILIKE '%دسترسی%'
           OR description ILIKE '%موقعیت%'
         )`;

    const { rows } = await client.query(
      `SELECT id, slug, name_fa, description FROM businesses ${where} ORDER BY id`
    );

    const toProcess = SINGLE_ID ? rows : rows.filter(r => !doneSet.has(r.id));
    const alreadyDone = rows.length - toProcess.length;

    console.log(`[strip] ${rows.length} descriptions with address content. ${alreadyDone} already done, ${toProcess.length} to process.`);
    if (DRY_RUN) console.log("[strip] DRY RUN — no DB writes.");

    for (const row of toProcess) {
      const cleaned = cleanDescription(row.description);

      if (cleaned === row.description) {
        if (VERBOSE) console.log(`  [unchanged] id=${row.id} "${row.name_fa}"`);
        state.skipped.push(row.id);
        unchanged++;
      } else {
        if (!DRY_RUN) {
          await client.query(`UPDATE businesses SET description = $1 WHERE id = $2`, [cleaned, row.id]);
          state.done.push(row.id);
          saveState(state);
        }
        console.log(`  [ok] id=${row.id} "${row.name_fa}" (${row.description.length} → ${cleaned.length} chars)`);
        changed++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n[strip] Done — changed: ${changed}, unchanged by rules: ${unchanged}`);
  console.log(`[strip] State: ${state.done.length} total done`);
}

main().catch(e => { console.error("[strip] Fatal:", e.message); process.exit(1); });
