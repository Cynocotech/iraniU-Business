/**
 * enrichFromWebsite.js
 *
 * For each business that has a website URL + at least one image:
 *   1. Fetch their website and extract real content
 *   2. Rewrite the description in Persian HTML using GPT-4o-mini
 *   3. Set status='active', listing_approval='approved'
 *   4. Set description_rewritten=1
 *
 * Run:    node scripts/enrichFromWebsite.js
 * Resume: safe to re-run — state tracked in enrich_from_website_state.json
 * Force:  node scripts/enrichFromWebsite.js --force  (re-process done IDs)
 * Single: node scripts/enrichFromWebsite.js --id=42
 */

import "../src/env.js";
import { pool } from "../src/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "enrich_from_website_state.json");

const FORCE     = process.argv.includes("--force");
const DRY_RUN   = process.argv.includes("--dry-run");
const SINGLE_ID = process.argv.find(a => a.startsWith("--id="))?.split("=")[1];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error("OPENAI_API_KEY not set"); process.exit(1); }

const BATCH_SIZE  = 3;   // small — each iteration does a web fetch + AI call
const DELAY_MS    = 2000;
const FETCH_TIMEOUT_MS = 10000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── State ──────────────────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { done: [], failed: [] };
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return { done: [], failed: [] }; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Extract website URL from biolink_json ──────────────────────────────────────

function extractWebsiteUrl(biolinkJson) {
  if (!biolinkJson) return null;
  try {
    const b = typeof biolinkJson === "string" ? JSON.parse(biolinkJson) : biolinkJson;
    const links = b.links || [];
    // old format: icon="globe"
    const old = links.find(l => l.icon === "globe" && l.url);
    if (old) return old.url;
    // new format: preset="website" or iconClass contains "globe"
    const novo = links.find(l => (l.preset === "website" || (l.iconClass && l.iconClass.includes("globe"))) && l.url && l.enabled !== false);
    if (novo) return novo.url;
  } catch {}
  return null;
}

// ── Fetch website content ──────────────────────────────────────────────────────

async function fetchWebsiteText(url) {
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IraniuBot/1.0)" }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    // Strip tags, scripts, styles — keep readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{3,}/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim()
      .slice(0, 4000); // cap to stay within token budget
    return text || null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Rewrite description via GPT-4o-mini ───────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional Persian (Farsi) copywriter specialising in UK local business directory listings.

Given raw website content in English, write a business description in Persian (Farsi) following these rules:

1. Extract real facts only: services, location, target audience, unique selling points, opening hours, specialisations.
2. Fully rebuild the narrative — do NOT copy sentences from the source.
3. Professional, warm, inviting tone suitable for a local business directory.
4. DO NOT use AI buzzwords (nestled, beacon, tapestry, testament, game-changer, look no further).
5. Maintain 100% factual accuracy — do not invent services not mentioned on the website.
6. Output ONLY clean HTML using: <p> for paragraphs, <ul><li> for lists, <h3> for section headings.
7. Write entirely in Persian/Farsi. Only proper nouns or brand names stay in English.
8. Length: 150–350 words in the output HTML.
9. Do NOT wrap output in markdown code fences (no \`\`\`html or \`\`\`). Return raw HTML only.`;

async function rewriteFromWebContent(websiteText, nameFA, nameEN, city, category) {
  const context = [
    nameFA ? `نام کسب‌وکار (فارسی): ${nameFA}` : null,
    nameEN ? `نام کسب‌وکار (انگلیسی): ${nameEN}` : null,
    city   ? `شهر: ${city}` : null,
    category ? `دسته‌بندی: ${category}` : null,
  ].filter(Boolean).join("\n");

  const userMsg = `${context}\n\nمحتوای وبسایت:\n${websiteText}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMsg },
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

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const state = loadState();
  const doneSet = new Set(state.done);
  const client = await pool.connect();
  let done = 0, failed = 0, noSite = 0;

  try {
    // Query: businesses with website in biolink AND at least one image
    const whereExtra = SINGLE_ID
      ? `AND id = ${parseInt(SINGLE_ID)}`
      : FORCE ? "" : `AND id NOT IN (${state.done.length ? state.done.join(",") : 0})`;

    const { rows } = await client.query(`
      SELECT id, name_fa, name_en, city, category, biolink_json,
             logo_url, cover_image_url, gallery_json,
             description, description_original
      FROM businesses
      WHERE (
        biolink_json LIKE '%"icon":"globe"%'
        OR biolink_json LIKE '%"preset":"website"%'
        OR biolink_json LIKE '%fa-globe%'
      )
      AND (
        (logo_url IS NOT NULL AND logo_url != '')
        OR (cover_image_url IS NOT NULL AND cover_image_url != '')
        OR (gallery_json IS NOT NULL AND gallery_json != '' AND gallery_json != '[]')
      )
      ${whereExtra}
      ORDER BY id
    `);

    console.log(`[enrich] ${rows.length} businesses to process.`);
    if (DRY_RUN) console.log("[enrich] DRY RUN — no DB writes.");

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      console.log(`\n[enrich] Batch ${batchNum}/${totalBatches} (rows ${i+1}–${Math.min(i+BATCH_SIZE, rows.length)})…`);

      // Process batch sequentially to avoid hammering sites
      for (const row of batch) {
        const url = extractWebsiteUrl(row.biolink_json);
        if (!url) {
          console.log(`  [skip] id=${row.id} "${row.name_fa}" — no website URL found`);
          noSite++;
          continue;
        }

        try {
          console.log(`  [fetch] id=${row.id} "${row.name_fa}" → ${url}`);
          const siteText = await fetchWebsiteText(url);

          if (!siteText || siteText.length < 100) {
            console.warn(`  [skip] id=${row.id} — website returned no usable content`);
            noSite++;
            state.failed.push(row.id);
            saveState(state);
            continue;
          }

          const newDesc = await rewriteFromWebContent(siteText, row.name_fa, row.name_en, row.city, row.category);

          if (!newDesc) {
            console.warn(`  [skip] id=${row.id} — AI returned empty response`);
            failed++;
            state.failed.push(row.id);
            saveState(state);
            continue;
          }

          if (!DRY_RUN) {
            await client.query(`
              UPDATE businesses SET
                description           = $1,
                description_original  = COALESCE(NULLIF(description_original,''), $2),
                description_rewritten = 1,
                status                = 'active',
                listing_approval      = 'approved'
              WHERE id = $3
            `, [newDesc, row.description, row.id]);
          }

          console.log(`  [ok] id=${row.id} "${row.name_fa}" — published (${newDesc.length} chars)`);
          done++;
          state.done.push(row.id);
          saveState(state);

        } catch (e) {
          console.warn(`  [err] id=${row.id} "${row.name_fa}": ${e.message}`);
          failed++;
          state.failed.push(row.id);
          saveState(state);
        }

        await sleep(1000);
      }

      if (i + BATCH_SIZE < rows.length) await sleep(DELAY_MS);
    }

  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n[enrich] Done — published: ${done}, failed: ${failed}, no-site: ${noSite}`);
  console.log("[enrich] Run 'npm run embed:businesses' to refresh AI search embeddings.");
}

main().catch(e => { console.error("[enrich] Fatal:", e.message); process.exit(1); });
