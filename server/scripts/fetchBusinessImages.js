/**
 * fetchBusinessImages.js
 *
 * For businesses with no logo/cover/gallery but a website URL:
 *   1. Fetch the website HTML
 *   2. Extract best image candidates (og:image, logo, hero, favicon)
 *   3. Download each image and upload to S3
 *   4. Set logo_url (first/best image) and cover_image_url (second if found)
 *
 * Run:    node scripts/fetchBusinessImages.js
 * Resume: safe to re-run — state in fetch_images_state.json
 * Single: node scripts/fetchBusinessImages.js --id=42
 * Dry:    node scripts/fetchBusinessImages.js --dry-run
 */

import "../src/env.js";
import { pool } from "../src/db.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "fetch_images_state.json");

const FORCE     = process.argv.includes("--force");
const DRY_RUN   = process.argv.includes("--dry-run");
const SINGLE_ID = process.argv.find(a => a.startsWith("--id="))?.split("=")[1];

const FETCH_TIMEOUT_MS = 12000;
const DELAY_MS = 1500;
const MIN_IMAGE_BYTES = 2000; // skip tiny icons/spacers

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── S3 ─────────────────────────────────────────────────────────────────────────

let s3Client, s3Cfg;

async function getS3(client) {
  if (s3Client) return { s3Client, s3Cfg };
  const { rows } = await client.query(
    "SELECT key, value FROM app_meta WHERE key LIKE 'aws_s3_%'"
  );
  s3Cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  s3Client = new S3Client({
    region: s3Cfg.aws_s3_region,
    credentials: {
      accessKeyId: s3Cfg.aws_s3_access_key_id,
      secretAccessKey: s3Cfg.aws_s3_secret_access_key,
    },
  });
  return { s3Client, s3Cfg };
}

async function uploadToS3(buffer, contentType, dbClient) {
  const { s3Client: client, s3Cfg: cfg } = await getS3(dbClient);
  const ext = contentType.includes("png") ? "png"
    : contentType.includes("webp") ? "webp"
    : contentType.includes("gif") ? "gif"
    : "jpg";
  const key = `business-images/business-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await client.send(new PutObjectCommand({
    Bucket: cfg.aws_s3_bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `https://${cfg.aws_s3_bucket}.s3.${cfg.aws_s3_region}.amazonaws.com/${key}`;
}

// ── State ───────────────────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { done: [], failed: [] };
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return { done: [], failed: [] }; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Extract website URL ─────────────────────────────────────────────────────────

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

// ── Fetch with timeout ──────────────────────────────────────────────────────────

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IraniuBot/1.0)",
        ...opts.headers,
      },
    });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Extract image candidates from HTML ─────────────────────────────────────────

function resolveUrl(src, base) {
  if (!src || src.startsWith("data:")) return null;
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

function extractImageCandidates(html, baseUrl) {
  const candidates = [];

  // 1. og:image (best quality, usually a branded banner)
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch) candidates.push({ url: resolveUrl(ogMatch[1], baseUrl), priority: 1, type: "og:image" });

  // 2. twitter:image
  const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  if (twMatch) candidates.push({ url: resolveUrl(twMatch[1], baseUrl), priority: 2, type: "twitter:image" });

  // 3. Logo images (src contains "logo")
  const logoMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
  for (const m of logoMatches) {
    const src = resolveUrl(m[1], baseUrl);
    if (!src) continue;
    const full = m[0].toLowerCase();
    if (full.includes("logo") || full.includes("brand")) {
      candidates.push({ url: src, priority: 3, type: "logo-img" });
    }
  }

  // 4. Largest images by guessing from src (hero, banner, cover, featured)
  for (const m of logoMatches) {
    const src = resolveUrl(m[1], baseUrl);
    if (!src) continue;
    const lower = src.toLowerCase();
    if (lower.match(/hero|banner|cover|featured|header|background|bg[-_]/)) {
      candidates.push({ url: src, priority: 4, type: "hero-img" });
    }
  }

  // 5. Favicon as last resort
  const iconMatch = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i);
  if (iconMatch) candidates.push({ url: resolveUrl(iconMatch[1], baseUrl), priority: 9, type: "favicon" });

  // Deduplicate by URL
  const seen = new Set();
  return candidates
    .filter(c => c.url && !seen.has(c.url) && seen.add(c.url))
    .sort((a, b) => a.priority - b.priority);
}

// ── Download image ──────────────────────────────────────────────────────────────

async function downloadImage(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < MIN_IMAGE_BYTES) return null;
    return { buffer, contentType: contentType.split(";")[0].trim() };
  } catch {
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  const state = loadState();
  const client = await pool.connect();
  let done = 0, failed = 0, noImages = 0;

  try {
    const whereExtra = SINGLE_ID
      ? `AND id = ${parseInt(SINGLE_ID)}`
      : FORCE ? "" : `AND id NOT IN (${state.done.length ? state.done.join(",") : 0})`;

    const { rows } = await client.query(`
      SELECT id, name_fa, name_en, biolink_json
      FROM businesses
      WHERE (logo_url IS NULL OR logo_url = '')
        AND (cover_image_url IS NULL OR cover_image_url = '')
        AND (gallery_json IS NULL OR gallery_json = '' OR gallery_json = '[]')
        AND (
          biolink_json LIKE '%"icon":"globe"%'
          OR biolink_json LIKE '%"preset":"website"%'
          OR biolink_json LIKE '%fa-globe%'
        )
        ${whereExtra}
      ORDER BY id
    `);

    console.log(`[images] ${rows.length} businesses to process.`);
    if (DRY_RUN) console.log("[images] DRY RUN — no DB/S3 writes.");

    for (const row of rows) {
      const websiteUrl = extractWebsiteUrl(row.biolink_json);
      if (!websiteUrl) {
        console.log(`  [skip] id=${row.id} "${row.name_fa}" — no URL`);
        state.failed.push(row.id);
        saveState(state);
        continue;
      }

      const url = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
      console.log(`[fetch] id=${row.id} "${row.name_fa}" → ${url}`);

      try {
        // Fetch homepage HTML
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const finalUrl = res.url || url;

        const candidates = extractImageCandidates(html, finalUrl);
        if (candidates.length === 0) {
          console.log(`  [skip] id=${row.id} — no image candidates found`);
          noImages++;
          state.failed.push(row.id);
          saveState(state);
          await sleep(500);
          continue;
        }

        // Try candidates in priority order, collect up to 2 usable images
        const uploaded = [];
        for (const c of candidates) {
          if (uploaded.length >= 2) break;
          const img = await downloadImage(c.url);
          if (!img) continue;
          if (DRY_RUN) {
            console.log(`  [dry] would upload ${c.type}: ${c.url} (${img.buffer.length} bytes)`);
            uploaded.push(`DRY:${c.url}`);
            continue;
          }
          const s3Url = await uploadToS3(img.buffer, img.contentType, client);
          console.log(`  [s3] ${c.type} → ${s3Url}`);
          uploaded.push(s3Url);
        }

        if (uploaded.length === 0) {
          console.log(`  [skip] id=${row.id} — all image downloads failed`);
          noImages++;
          state.failed.push(row.id);
          saveState(state);
          await sleep(500);
          continue;
        }

        if (!DRY_RUN) {
          await client.query(
            `UPDATE businesses SET
              logo_url        = COALESCE(NULLIF(logo_url,''), $1),
              cover_image_url = COALESCE(NULLIF(cover_image_url,''), $2)
            WHERE id = $3`,
            [uploaded[0], uploaded[1] || null, row.id]
          );
        }

        console.log(`  [ok] id=${row.id} "${row.name_fa}" — ${uploaded.length} image(s) saved`);
        done++;
        state.done.push(row.id);
        saveState(state);

      } catch (e) {
        console.warn(`  [err] id=${row.id} "${row.name_fa}": ${e.message}`);
        failed++;
        state.failed.push(row.id);
        saveState(state);
      }

      await sleep(DELAY_MS);
    }

  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n[images] Done — saved: ${done}, no-images: ${noImages}, errors: ${failed}`);
}

main().catch(e => { console.error("[images] Fatal:", e.message); process.exit(1); });
