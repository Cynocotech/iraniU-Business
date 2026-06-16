import { parse } from "csv-parse/sync";
import crypto from "crypto";
import { dbGet, dbRun } from "./db.js";

const DEFAULT_BIOLINK_JSON = JSON.stringify({
  headline: "",
  bio: "",
  avatarUrl: "",
  themeId: 1,
  backgroundImageUrl: "",
  backgroundOverlay: "dark",
  alert: { enabled: false, text: "" },
  links: [],
  socialLinks: [],
});

const DEFAULT_GALLERY = JSON.stringify(["", "", "", ""]);
const DEFAULT_HOURS_FALLBACK = JSON.stringify([
  { day: "شنبه", hours: "" },
  { day: "یکشنبه", hours: "" },
  { day: "دوشنبه", hours: "" },
  { day: "سه‌شنبه", hours: "" },
  { day: "چهارشنبه", hours: "" },
  { day: "پنج‌شنبه", hours: "" },
  { day: "جمعه", hours: "" },
]);

/** هم‌تراز با خروجی CSV London — شنبه … جمعه */
const LONDON_HOUR_KEYS = [
  "workingHours_Sat",
  "workingHours_Sun",
  "workingHours_Mon",
  "workingHours_Tue",
  "workingHours_Wed",
  "workingHours_Thu",
  "workingHours_Fri",
];
const PERSIAN_DAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];

function str(v) {
  if (v == null) return "";
  return String(v).trim();
}

function validSlug(s) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

function randomSlug() {
  return `import-${crypto.randomBytes(6).toString("hex")}`;
}

function londonSlugFromId(idRaw) {
  const id = str(idRaw).toLowerCase().replace(/[^a-f0-9]/g, "");
  if (id.length < 8) return randomSlug();
  return `l-${id.slice(0, 24)}`;
}

function hoursFromLondonRow(row) {
  const parts = PERSIAN_DAYS.map((day, i) => ({
    day,
    hours: str(row[LONDON_HOUR_KEYS[i]]),
  }));
  return JSON.stringify(parts);
}

function safeUrl(u) {
  const s = str(u);
  if (!s) return "";
  try {
    const x = new URL(s);
    if (x.protocol !== "http:" && x.protocol !== "https:") return "";
    return s;
  } catch {
    return "";
  }
}

/**
 * preset: "iraniu" — ستون‌ها مطابق جدول businesses (sqlite)
 * preset: "london" — ستون‌های خروجی London_Bussines_List (MySQL export)
 */
export function parseBusinessCsv({ csvText, preset, defaultContactEmail, listingTermsVersion }) {
  const email = str(defaultContactEmail).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("invalid_default_contact_email");
  }

  let records;
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
    });
  } catch (e) {
    throw new Error(`csv_parse_error: ${e.message || String(e)}`);
  }

  if (!records.length) {
    throw new Error("csv_empty");
  }

  const out = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // header + 1-based
    try {
      if (preset === "london") {
        out.push(mapLondonRow(row, email, listingTermsVersion));
      } else {
        out.push(mapIraniuRow(row, email, listingTermsVersion));
      }
    } catch (e) {
      errors.push({ row: rowNum, error: e.message || String(e) });
    }
  }

  return { rows: out, errors };
}

function mapLondonRow(row, listingContactEmail, listingTermsVersion) {
  const name_fa = str(row.name);
  if (!name_fa) throw new Error("missing_name");

  let slug = str(row.slug);
  if (!slug) slug = londonSlugFromId(row.id);
  if (!validSlug(slug)) slug = londonSlugFromId(row.id);

  const phone = str(row.phone) || str(row.mobile);
  if (!phone) throw new Error("missing_phone");

  const address = str(row.address);
  if (!address) throw new Error("missing_address");

  const category = str(row.category_1) || str(row.category_2) || "سایر";
  const description = str(row.updated_description) || str(row.description) || "";
  const listing_title = (str(row.category_2) || str(row.category_1) || name_fa).slice(0, 200);
  const city = str(row.borough) || "London";

  let google_review_url = safeUrl(row.googleMap);
  if (!google_review_url) {
    google_review_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  const imageUrl = str(row.imageUrl);
  const gallery_json = imageUrl ? JSON.stringify([imageUrl, "", "", ""]) : DEFAULT_GALLERY;

  const hours_json = hoursFromLondonRow(row);

  const website = str(row.website);
  const cta = website ? "وب‌سایت" : "تماس";

  return {
    slug,
    name_fa,
    description,
    category,
    phone,
    address,
    google_review_url,
    claimed: 0,
    package: "basic",
    subtitle: "",
    hours_json,
    promo_title: "",
    promo_description: "",
    cover_image_url: imageUrl,
    gallery_json,
    listing_title,
    city,
    price_range: "—",
    rating: null,
    cta,
    status: "active",
    manager_id: null,
    biolink_json: DEFAULT_BIOLINK_JSON,
    listing_approval: "approved",
    listing_terms_accepted_at: new Date().toISOString(),
    listing_terms_version: listingTermsVersion,
    listing_contact_email: listingContactEmail,
  };
}

function mapIraniuRow(row, listingContactEmail, listingTermsVersion) {
  const name_fa = str(row.name_fa);
  if (!name_fa) throw new Error("missing_name_fa");

  let slug = str(row.slug);
  if (!slug) slug = randomSlug();
  slug = slug.toLowerCase();
  if (!validSlug(slug)) throw new Error("invalid_slug");

  const phone = str(row.phone);
  if (!phone) throw new Error("missing_phone");

  const address = str(row.address);
  if (!address) throw new Error("missing_address");

  const category = str(row.category) || "سایر";
  const description = str(row.description);

  const listing_title = str(row.listing_title) || name_fa.slice(0, 120);

  const city = str(row.city);
  if (!city) throw new Error("missing_city");

  let google_review_url = safeUrl(row.google_review_url);
  if (!google_review_url) {
    google_review_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  const price_range = str(row.price_range) || "—";
  const cta = str(row.cta) || "تماس";

  let hours_json = str(row.hours_json);
  if (hours_json) {
    try {
      JSON.parse(hours_json);
    } catch {
      hours_json = DEFAULT_HOURS_FALLBACK;
    }
  } else {
    hours_json = DEFAULT_HOURS_FALLBACK;
  }

  let gallery_json = str(row.gallery_json);
  if (gallery_json) {
    try {
      JSON.parse(gallery_json);
    } catch {
      gallery_json = DEFAULT_GALLERY;
    }
  } else {
    gallery_json = DEFAULT_GALLERY;
  }

  let biolink_json = str(row.biolink_json);
  if (biolink_json) {
    try {
      JSON.parse(biolink_json);
    } catch {
      biolink_json = DEFAULT_BIOLINK_JSON;
    }
  } else {
    biolink_json = DEFAULT_BIOLINK_JSON;
  }

  let rating = null;
  if (row.rating != null && str(row.rating) !== "") {
    const n = parseFloat(str(row.rating));
    if (Number.isFinite(n)) rating = n;
  }

  return {
    slug,
    name_fa,
    description,
    category,
    phone,
    address,
    google_review_url,
    claimed: str(row.claimed) === "1" || str(row.claimed).toLowerCase() === "true" ? 1 : 0,
    package: str(row.package) || "basic",
    subtitle: str(row.subtitle),
    hours_json,
    promo_title: str(row.promo_title),
    promo_description: str(row.promo_description),
    cover_image_url: str(row.cover_image_url),
    gallery_json,
    listing_title,
    city,
    price_range,
    rating,
    cta,
    status: str(row.status) || "active",
    manager_id: null,
    biolink_json,
    listing_approval: str(row.listing_approval) || "approved",
    listing_terms_accepted_at: new Date().toISOString(),
    listing_terms_version: listingTermsVersion,
    listing_contact_email: listingContactEmail,
  };
}

const INSERT_SQL = `
  INSERT INTO businesses (
    slug, name_fa, description, category, phone, address, google_review_url, claimed, package,
    subtitle, hours_json, promo_title, promo_description, cover_image_url, gallery_json,
    listing_title, city, price_range, rating, cta, status, manager_id, biolink_json, listing_approval,
    listing_terms_accepted_at, listing_terms_version, listing_contact_email
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9,
    $10, $11, $12, $13, $14, $15,
    $16, $17, $18, $19, $20, $21, $22, $23, $24,
    $25, $26, $27
  )
`;

function insertParams(r) {
  return [
    r.slug, r.name_fa, r.description, r.category, r.phone, r.address, r.google_review_url, r.claimed, r.package,
    r.subtitle, r.hours_json, r.promo_title, r.promo_description, r.cover_image_url, r.gallery_json,
    r.listing_title, r.city, r.price_range, r.rating, r.cta, r.status, r.manager_id, r.biolink_json, r.listing_approval,
    r.listing_terms_accepted_at, r.listing_terms_version, r.listing_contact_email,
  ];
}

export async function runBulkInsert(rows, { onDuplicate = "skip" } = {}) {
  const inserted = [];
  const skipped = [];
  const failed = [];

  // Per-row (not a single transaction) so one bad row doesn't abort the whole batch,
  // matching the previous SQLite behaviour of resilience-per-row.
  for (const r of rows) {
    const exists = await dbGet(`SELECT slug FROM businesses WHERE slug = $1`, [r.slug]);
    if (exists) {
      if (onDuplicate === "skip") {
        skipped.push({ slug: r.slug, reason: "duplicate_slug" });
        continue;
      }
      failed.push({ slug: r.slug, error: "duplicate_slug" });
      continue;
    }
    try {
      await dbRun(INSERT_SQL, insertParams(r));
      inserted.push(r.slug);
    } catch (e) {
      failed.push({ slug: r.slug, error: String(e.message || e) });
    }
  }

  return { inserted, skipped, failed };
}
