/**
 * importLondonBusinesses.js — Import/enrich 862 London businesses from CSV export.
 *
 * Strategy:
 *   - Match CSV rows to DB by name_fa (normalised — strip non-breaking spaces)
 *   - For matched rows: UPDATE only fields that are currently NULL / empty string
 *   - For unmatched rows: INSERT as new approved businesses
 *
 * Fields imported:
 *   postcode, address, phone, category, google_review_url, city (borough),
 *   hours_json, biolink_json (website + instagram merged), reservation_link
 *
 * Fields intentionally skipped:
 *   description, updated_description (keep existing AI descriptions)
 *   imageUrl (only 1% filled in CSV)
 *   facebook, twitter, linkedin, telegram (< 4% each — not worth the noise)
 *
 * Run: node scripts/importLondonBusinesses.js [--dry-run]
 */

import "../src/env.js";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { pool } from "../src/db.js";
import { lookupPostcode } from "../src/postcodeIo.js";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE_HOURS = process.argv.includes("--fix-hours");

// ── Persian digit conversion ──────────────────────────────────────────────────

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toPersian = (s) => String(s).replace(/\d/g, (d) => PERSIAN_DIGITS[+d]);

/**
 * Convert "09:30 AM" → "۰۹:۳۰"  |  "05:00 PM" → "۱۷:۰۰"
 */
function convertTime(t) {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return toPersian(t.trim());
  let h = parseInt(m[1], 10);
  const min = m[2];
  const period = m[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return toPersian(String(h).padStart(2, "0") + ":" + min);
}

const HOUR_DAYS = [
  ["workingHours_Sat", "شنبه"],
  ["workingHours_Sun", "یکشنبه"],
  ["workingHours_Mon", "دوشنبه"],
  ["workingHours_Tue", "سه‌شنبه"],
  ["workingHours_Wed", "چهارشنبه"],
  ["workingHours_Thu", "پنج‌شنبه"],
  ["workingHours_Fri", "جمعه"],
];

/**
 * Parse the 7 workingHours_* columns into our hours_json format:
 *   [{"day":"شنبه","hours":"۱۰:۰۰–۱۸:۰۰"}, ...]
 * "تعطیل" entries are included with hours="تعطیل".
 */
function buildHoursJson(row) {
  const entries = [];
  for (const [col, dayName] of HOUR_DAYS) {
    const raw = (row[col] || "").trim();
    if (!raw) continue;

    // Detect closed: "شنبه تعطیل است" or just "تعطیل"
    if (/تعطیل/.test(raw)) {
      entries.push({ day: dayName, hours: "تعطیل" });
      continue;
    }

    // Format: "دوشنبه 09:30 AM - 05:30 PM"
    // Find where the time digits start — safer than a Unicode range strip
    // (handles ZWNJ inside day names like سه‌شنبه, پنج‌شنبه)
    const firstDigit = raw.search(/\d/);
    const timePart = firstDigit >= 0 ? raw.slice(firstDigit) : raw;
    const parts = timePart.split(/\s*-\s*/);
    if (parts.length === 2) {
      const open = convertTime(parts[0]);
      const close = convertTime(parts[1]);
      entries.push({ day: dayName, hours: `${open}–${close}` });
    } else {
      entries.push({ day: dayName, hours: toPersian(timePart) });
    }
  }
  return entries.length ? JSON.stringify(entries) : null;
}

/**
 * Merge website + instagram into existing (or empty) biolink_json.
 * Only adds links/socialLinks that aren't already present.
 */
const SOCIAL_PLATFORMS = [
  { key: "instagram", prefix: "https://instagram.com/", stripAt: true },
  { key: "facebook",  prefix: "https://facebook.com/",  stripAt: false },
  { key: "twitter",   prefix: "https://x.com/",         stripAt: true },
  { key: "linkedin",  prefix: "https://linkedin.com/in/", stripAt: false },
  { key: "telegram",  prefix: "https://t.me/",          stripAt: true },
];

function toSocialUrl(platform, raw) {
  const s = (raw || "").trim();
  if (!s) return null;
  if (s.startsWith("http")) return s;
  const handle = platform.stripAt ? s.replace(/^@/, "") : s;
  return platform.prefix + handle;
}

function buildBiolinkJson(existing, { website, instagram, facebook, twitter, linkedin, telegram } = {}) {
  const base = existing
    ? (() => { try { return JSON.parse(existing); } catch { return null; } })()
    : null;

  const bio = base || {
    headline: "",
    bio: "",
    avatarUrl: "",
    themeId: 1,
    backgroundImageUrl: "",
    backgroundOverlay: "dark",
    alert: { enabled: false, text: "" },
    links: [],
    socialLinks: [],
  };

  bio.links      = bio.links      || [];
  bio.socialLinks = bio.socialLinks || [];

  // Website → links array
  if (website) {
    const alreadyHas = bio.links.some((l) => l.url && l.url.toLowerCase() === website.toLowerCase());
    if (!alreadyHas) bio.links.push({ label: "وبسایت", url: website, icon: "globe" });
  }

  // Social links
  const csvSocials = { instagram, facebook, twitter, linkedin, telegram };
  for (const platform of SOCIAL_PLATFORMS) {
    const raw = csvSocials[platform.key];
    if (!raw || !raw.trim()) continue;
    const alreadyHas = bio.socialLinks.some((l) => l.platform === platform.key);
    if (alreadyHas) continue;
    const url = toSocialUrl(platform, raw);
    if (url) bio.socialLinks.push({ platform: platform.key, url });
  }

  return JSON.stringify(bio);
}

// ── Slug generation for new businesses ───────────────────────────────────────

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[؀-ۿ]/g, (c) => c) // keep Persian as-is for now
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

async function ensureUniqueSlug(client, base) {
  let slug = base;
  let n = 2;
  while (true) {
    const { rows } = await client.query(
      "SELECT 1 FROM businesses WHERE slug = $1",
      [slug]
    );
    if (!rows.length) return slug;
    slug = `${base}-${n++}`;
  }
}

// ── Name normalisation for matching ──────────────────────────────────────────

const normName = (s) =>
  (s || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Load CSV
  const rows = await new Promise((resolve, reject) => {
    const acc = [];
    createReadStream("/root/London_Bussines_List_202607211920.csv")
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (r) => acc.push(r))
      .on("end", () => resolve(acc))
      .on("error", reject);
  });

  console.log(`[import] Loaded ${rows.length} CSV rows.`);
  if (DRY_RUN) console.log("[import] DRY RUN — no DB writes.");

  const client = await pool.connect();
  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  const newRows = [];

  try {
    // Load all existing businesses once
    const { rows: dbRows } = await client.query(
      `SELECT id, slug, name_fa, postcode, address, phone, mobile, category,
              google_review_url, city, hours_json, biolink_json,
              reservation_link, cover_image_url
         FROM businesses`
    );

    const byName = new Map(dbRows.map((r) => [normName(r.name_fa), r]));

    for (const csvRow of rows) {
      const name = normName(csvRow.name);
      const db = byName.get(name);

      if (!db) {
        newRows.push(csvRow);
        continue;
      }

      // Build field-level updates (only overwrite NULL/empty)
      const sets = [];
      const vals = [];
      let p = 1;

      const maybe = (dbVal, csvVal) => {
        if (!dbVal && csvVal && csvVal.trim()) {
          vals.push(csvVal.trim());
          return `$${p++}`;
        }
        return null;
      };

      const postcode = maybe(db.postcode, csvRow.postcode);
      if (postcode) sets.push(`postcode = ${postcode}`);

      const address = maybe(db.address, csvRow.address);
      if (address) sets.push(`address = ${address}`);

      const phone = maybe(db.phone, csvRow.phone);
      if (phone) sets.push(`phone = ${phone}`);

      const mobile = maybe(db.mobile, csvRow.mobile);
      if (mobile) sets.push(`mobile = ${mobile}`);

      const category = maybe(db.category, csvRow.category_1);
      if (category) sets.push(`category = ${category}`);

      const googleMap = maybe(db.google_review_url, csvRow.googleMap);
      if (googleMap) sets.push(`google_review_url = ${googleMap}`);

      const city = maybe(db.city, csvRow.borough);
      if (city) sets.push(`city = ${city}`);

      const calendarUrl = maybe(db.reservation_link, csvRow.calendarUrl);
      if (calendarUrl) sets.push(`reservation_link = ${calendarUrl}`);

      // hours_json: overwrite if DB is empty OR --fix-hours flag passed
      if (!db.hours_json || FORCE_HOURS) {
        const hj = buildHoursJson(csvRow);
        if (hj) {
          vals.push(hj);
          sets.push(`hours_json = $${p++}`);
        }
      }

      // biolink_json: merge all social links into existing
      const hasSocial = ["website","instagram","facebook","twitter","linkedin","telegram"]
        .some((k) => csvRow[k] && csvRow[k].trim());
      if (hasSocial) {
        const merged = buildBiolinkJson(db.biolink_json, {
          website:   csvRow.website?.trim(),
          instagram: csvRow.instagram?.trim(),
          facebook:  csvRow.facebook?.trim(),
          twitter:   csvRow.twitter?.trim(),
          linkedin:  csvRow.linkedin?.trim(),
          telegram:  csvRow.telegram?.trim(),
        });
        if (merged !== db.biolink_json) {
          vals.push(merged);
          sets.push(`biolink_json = $${p++}`);
        }
      }

      if (sets.length === 0) {
        skipped++;
        continue;
      }

      vals.push(db.id);
      const sql = `UPDATE businesses SET ${sets.join(", ")} WHERE id = $${p}`;

      if (!DRY_RUN) {
        await client.query(sql, vals);
      } else {
        console.log(`  [dry] UPDATE ${db.slug}: ${sets.map((s) => s.split(" = ")[0]).join(", ")}`);
      }
      updated++;
    }

    // INSERT new businesses
    for (const csvRow of newRows) {
      const name = normName(csvRow.name);
      const slug = await ensureUniqueSlug(client, slugify(name));
      const hoursJson = buildHoursJson(csvRow);
      const biolinkJson = buildBiolinkJson(null, {
        website:   csvRow.website?.trim(),
        instagram: csvRow.instagram?.trim(),
        facebook:  csvRow.facebook?.trim(),
        twitter:   csvRow.twitter?.trim(),
        linkedin:  csvRow.linkedin?.trim(),
        telegram:  csvRow.telegram?.trim(),
      });

      const insertSql = `
        INSERT INTO businesses
          (slug, name_fa, category, phone, mobile, address, postcode, google_review_url,
           city, hours_json, biolink_json, reservation_link,
           listing_approval, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'approved','active')
      `;
      const insertVals = [
        slug,
        name,
        csvRow.category_1 || null,
        csvRow.phone || null,
        csvRow.mobile || null,
        csvRow.address || null,
        csvRow.postcode || null,
        csvRow.googleMap || null,
        csvRow.borough || null,
        hoursJson,
        biolinkJson,
        csvRow.calendarUrl || null,
      ];

      if (!DRY_RUN) {
        await client.query(insertSql, insertVals);
        // Enrich postcode geo asynchronously
        if (csvRow.postcode) {
          lookupPostcode(csvRow.postcode)
            .then(async (geo) => {
              if (!geo) return;
              await pool.query(
                `UPDATE businesses SET
                   postcode_latitude=$1, postcode_longitude=$2,
                   postcode_primary_care_trust=$3, postcode_admin_ward=$4
                 WHERE slug=$5`,
                [geo.latitude, geo.longitude, geo.primary_care_trust, geo.admin_ward, slug]
              );
            })
            .catch(() => {});
        }
      } else {
        console.log(`  [dry] INSERT: "${name}" → slug="${slug}"`);
      }
      inserted++;
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n[import] Done.`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped : ${skipped} (already fully populated)`);
  if (!DRY_RUN && (updated > 0 || inserted > 0)) {
    console.log(
      "\n[import] Next: run `npm run embed:businesses` to refresh AI embeddings."
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[import] Fatal:", e.message, e.stack);
    process.exit(1);
  });
