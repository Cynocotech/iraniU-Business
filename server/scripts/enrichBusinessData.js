/**
 * enrichBusinessData.js
 *
 * For businesses with a website URL, visits the site and uses GPT-4o-mini
 * to extract and update:
 *   - address (full street address)
 *   - postcode
 *   - phone / mobile
 *   - email
 *   - social links (Instagram, Facebook, etc.) → added to biolink_json
 *   - description (rewritten in Persian if current one is weak or missing)
 *
 * Only overwrites a field if the website provides a better value.
 * Safe to re-run — state tracked in enrich_business_data_state.json.
 *
 * Run:    node scripts/enrichBusinessData.js
 * Resume: re-run any time — skips already-done IDs
 * Force:  node scripts/enrichBusinessData.js --force
 * Single: node scripts/enrichBusinessData.js --id=42
 * Dry:    node scripts/enrichBusinessData.js --dry-run
 */

import "../src/env.js";
import { pool } from "../src/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "enrich_business_data_state.json");

const FORCE     = process.argv.includes("--force");
const DRY_RUN   = process.argv.includes("--dry-run");
const SINGLE_ID = process.argv.find(a => a.startsWith("--id="))?.split("=")[1];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error("OPENAI_API_KEY not set"); process.exit(1); }

const FETCH_TIMEOUT_MS = 12000;
const DELAY_MS = 2000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── State ───────────────────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { done: [], failed: [] };
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return { done: [], failed: [] }; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

// ── Extract website URL from biolink_json ───────────────────────────────────────

function extractWebsiteUrl(biolinkJson) {
  if (!biolinkJson) return null;
  try {
    const b = typeof biolinkJson === "string" ? JSON.parse(biolinkJson) : biolinkJson;
    const links = b.links || [];
    const old = links.find(l => l.icon === "globe" && l.url);
    if (old) return old.url;
    const novo = links.find(l =>
      (l.preset === "website" || (l.iconClass && l.iconClass.includes("globe"))) &&
      l.url && l.enabled !== false
    );
    if (novo) return novo.url;
  } catch {}
  return null;
}

// ── Fetch website text ──────────────────────────────────────────────────────────

async function fetchWebsiteText(rawUrl) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // Try homepage first
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IraniuBot/1.0)" }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{3,}/g, "\n")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .trim();

    // Also try /contact page for address info
    let contactText = "";
    try {
      const base = new URL(res.url || url);
      const contactUrl = `${base.origin}/contact`;
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 8000);
      const res2 = await fetch(contactUrl, {
        signal: controller2.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; IraniuBot/1.0)" }
      });
      clearTimeout(timer2);
      if (res2.ok) {
        const html2 = await res2.text();
        contactText = html2
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s{3,}/g, "\n")
          .trim()
          .slice(0, 2000);
      }
    } catch {}

    const combined = [text.slice(0, 3000), contactText].filter(Boolean).join("\n\n--- Contact Page ---\n\n");
    return combined.length > 50 ? combined : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── GPT extraction ──────────────────────────────────────────────────────────────

const EXTRACT_PROMPT = `You are a data extraction assistant. Given website content for a UK business, extract structured data.

Return ONLY valid JSON with these exact keys (use null for any field not found):
{
  "address": "full street address with number and street name (NOT just city/area)",
  "postcode": "UK postcode e.g. W1A 1AA",
  "phone": "UK landline with area code",
  "mobile": "UK mobile number starting 07",
  "email": "contact email address",
  "instagram": "full Instagram URL or null",
  "facebook": "full Facebook URL or null",
  "twitter": "full Twitter/X URL or null",
  "linkedin": "full LinkedIn URL or null",
  "tiktok": "full TikTok URL or null",
  "youtube": "full YouTube URL or null",
  "telegram": "full Telegram URL or null",
  "whatsapp": "WhatsApp link wa.me/... or null",
  "description_en": "1-2 sentence summary of what the business does in English (from website content)",
  "address_quality": "good if full street address found, bad if only area/city found"
}

Rules:
- address must include street number and name, not just "West London" or area names
- postcode must be a valid UK format (letters+numbers)
- phone/mobile: UK format only, no foreign numbers
- Return ONLY the JSON object, no other text`;

async function extractFromWebsite(websiteText, businessName) {
  const userMsg = `Business name: ${businessName}\n\nWebsite content:\n${websiteText}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 600,
      messages: [
        { role: "system", content: EXTRACT_PROMPT },
        { role: "user", content: userMsg },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  try {
    const json = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ── Merge social links into biolink_json ────────────────────────────────────────

function mergeSocialLinks(existingBiolink, extracted) {
  let b;
  try { b = typeof existingBiolink === "string" ? JSON.parse(existingBiolink) : (existingBiolink || {}); }
  catch { b = {}; }

  const existingSocials = b.socialLinks || [];
  const existingPlatforms = new Set(existingSocials.map(s => s.platform));
  const existingLinks = b.links || [];

  const platformMap = {
    instagram: extracted.instagram,
    facebook:  extracted.facebook,
    twitter:   extracted.twitter,
    linkedin:  extracted.linkedin,
    tiktok:    extracted.tiktok,
    youtube:   extracted.youtube,
    telegram:  extracted.telegram,
    whatsapp:  extracted.whatsapp,
  };

  let changed = false;

  for (const [platform, url] of Object.entries(platformMap)) {
    if (!url) continue;
    if (existingPlatforms.has(platform)) continue;
    existingSocials.push({ platform, url });
    changed = true;
  }

  // Add WhatsApp to links array too if not already there
  if (extracted.whatsapp && !existingLinks.some(l => l.url?.includes("wa.me"))) {
    existingLinks.push({ label: "واتس‌اپ", url: extracted.whatsapp, icon: "message-circle" });
    changed = true;
  }

  if (!changed) return null;

  return JSON.stringify({ ...b, socialLinks: existingSocials, links: existingLinks });
}

// ── Is address weak? ────────────────────────────────────────────────────────────

function isWeakAddress(address) {
  if (!address || address.trim().length < 5) return true;
  const a = address.toLowerCase().trim();
  const weakPatterns = [
    /^(east|west|north|south|central)?\s*london,?\s*(uk)?$/i,
    /^(east|west|north|south|central)?\s*london$/i,
    /^\w+ london,?\s*(uk)?$/i,
    /^uk$/i,
    /^london$/i,
    /^england$/i,
  ];
  return weakPatterns.some(p => p.test(a));
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  const state = loadState();
  const client = await pool.connect();
  let updated = 0, noData = 0, failed = 0;

  try {
    const whereExtra = SINGLE_ID
      ? `AND id = ${parseInt(SINGLE_ID)}`
      : FORCE ? "" : `AND id NOT IN (${state.done.length ? state.done.join(",") : 0})`;

    const { rows } = await client.query(`
      SELECT id, name_fa, name_en, address, postcode, city,
             phone, mobile, listing_contact_email,
             biolink_json, description, description_rewritten, status
      FROM businesses
      WHERE (
        biolink_json LIKE '%"icon":"globe"%'
        OR biolink_json LIKE '%"preset":"website"%'
        OR biolink_json LIKE '%fa-globe%'
      )
      ${whereExtra}
      ORDER BY id
    `);

    console.log(`[enrich] ${rows.length} businesses to process.`);
    if (DRY_RUN) console.log("[enrich] DRY RUN — no DB writes.");

    for (const row of rows) {
      const websiteUrl = extractWebsiteUrl(row.biolink_json);
      if (!websiteUrl) {
        state.done.push(row.id);
        saveState(state);
        continue;
      }

      console.log(`\n[enrich] id=${row.id} "${row.name_fa}" → ${websiteUrl}`);

      try {
        const siteText = await fetchWebsiteText(websiteUrl);
        if (!siteText) {
          console.log(`  [skip] unreachable`);
          noData++;
          state.done.push(row.id);
          saveState(state);
          await sleep(500);
          continue;
        }

        const extracted = await extractFromWebsite(siteText, row.name_fa || row.name_en);
        if (!extracted) {
          console.log(`  [skip] GPT parse failed`);
          noData++;
          state.done.push(row.id);
          saveState(state);
          await sleep(500);
          continue;
        }

        // Build update fields — only overwrite if current value is weak/missing
        const updates = {};
        const log = [];
        const hadWeakAddress = isWeakAddress(row.address);

        // Address: update if current is weak AND extracted has a good one
        if (isWeakAddress(row.address) && extracted.address_quality === "good" && extracted.address) {
          updates.address = extracted.address;
          log.push(`address: "${row.address}" → "${extracted.address}"`);
        }

        // Auto-reactivate: if we fixed a vague address AND business is inactive, re-enable it
        if (hadWeakAddress && updates.address && row.status === "inactive") {
          updates.status = "active";
          log.push(`status: inactive → active (address fixed)`);
        }

        // Postcode: update if missing
        if ((!row.postcode || row.postcode.trim() === "") && extracted.postcode) {
          updates.postcode = extracted.postcode;
          log.push(`postcode: → "${extracted.postcode}"`);
        }

        // Phone: update if missing
        if ((!row.phone || row.phone.trim() === "") && extracted.phone) {
          updates.phone = extracted.phone;
          log.push(`phone: → "${extracted.phone}"`);
        }

        // Mobile: update if missing
        if ((!row.mobile || row.mobile.trim() === "") && extracted.mobile) {
          updates.mobile = extracted.mobile;
          log.push(`mobile: → "${extracted.mobile}"`);
        }

        // Email: update if missing
        if ((!row.listing_contact_email || row.listing_contact_email.trim() === "") && extracted.email) {
          updates.listing_contact_email = extracted.email;
          log.push(`email: → "${extracted.email}"`);
        }

        // Social links: merge new ones into biolink_json
        const newBiolink = mergeSocialLinks(row.biolink_json, extracted);
        if (newBiolink) {
          updates.biolink_json = newBiolink;
          log.push(`biolink: added social links`);
        }

        if (Object.keys(updates).length === 0) {
          console.log(`  [ok] nothing to update`);
          state.done.push(row.id);
          saveState(state);
          await sleep(DELAY_MS);
          continue;
        }

        log.forEach(l => console.log(`  • ${l}`));

        if (!DRY_RUN) {
          const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(", ");
          const values = [row.id, ...Object.values(updates)];
          await client.query(`UPDATE businesses SET ${setClauses} WHERE id = $1`, values);
        }

        console.log(`  [ok] updated ${Object.keys(updates).length} field(s)`);
        updated++;
        state.done.push(row.id);
        saveState(state);

      } catch (e) {
        console.warn(`  [err] ${e.message}`);
        failed++;
        state.done.push(row.id);
        saveState(state);
      }

      await sleep(DELAY_MS);
    }

  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n[enrich] Done — updated: ${updated}, no-data: ${noData}, errors: ${failed}`);
}

main().catch(e => { console.error("[enrich] Fatal:", e.message); process.exit(1); });
