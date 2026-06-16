/**
 * Chatbot API  — /chatbot/v1/*
 *
 * Secured with a static API key:  CHATBOT_API_KEY env var.
 * Pass it as:
 *   Authorization: Bearer <key>
 *   X-Api-Key: <key>
 *
 * Endpoints:
 *   GET /chatbot/v1/categories            — list all active categories + business count
 *   GET /chatbot/v1/businesses            — search businesses (category, city, q, limit, offset)
 *   GET /chatbot/v1/businesses/:slug      — full detail for one business
 */

import { Router } from "express";
import { dbGet, dbAll } from "./db.js";

const router = Router();

// ── Auth ──────────────────────────────────────────────────────────────────────

function requireApiKey(req, res, next) {
  const key = process.env.CHATBOT_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "chatbot_api_disabled", hint: "CHATBOT_API_KEY not configured on server." });
  }
  const authHeader = req.headers["authorization"] || "";
  const xApiKey = req.headers["x-api-key"] || "";
  const provided =
    authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : xApiKey.trim();

  if (!provided || provided !== key) {
    return res.status(401).json({ error: "unauthorized", hint: "Invalid or missing API key." });
  }
  next();
}

router.use(requireApiKey);

// ── Helpers ───────────────────────────────────────────────────────────────────

function siteUrl() {
  return (process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

function parseJson(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

/** Shape a raw DB row into chatbot-friendly output. */
function formatBusiness(row, full = false) {
  const base = siteUrl();
  const gallery = parseJson(row.gallery_json) || [];
  const hours = parseJson(row.hours_json) || [];
  const biolink = parseJson(row.biolink_json) || {};
  const socialLinks = (biolink.socialLinks || [])
    .filter((l) => l.enabled !== false && l.url)
    .map((l) => ({ platform: l.preset, url: l.url, icon: l.iconClass }));

  const out = {
    slug: row.slug,
    name: row.name_fa,
    category: row.category || null,
    city: row.city || null,
    address: row.address || null,
    phone: row.phone || null,
    description: row.description || null,
    listing_title: row.listing_title || null,
    cover_image: row.cover_image_url
      ? (row.cover_image_url.startsWith("http") ? row.cover_image_url : `${base}${row.cover_image_url}`)
      : null,
    google_maps_url: row.google_review_url || null,
    coordinates:
      row.map_lat != null && row.map_lng != null
        ? { lat: row.map_lat, lng: row.map_lng }
        : null,
    profile_url: `${base}/business?slug=${encodeURIComponent(row.slug)}`,
    social_links: socialLinks,
    opening_hours: hours,
  };

  if (full) {
    out.gallery = gallery
      .filter(Boolean)
      .map((u) => (u.startsWith("http") ? u : `${base}${u}`));
    out.subtitle = row.subtitle || null;
    out.price_range = row.price_range || null;
    out.rating = row.rating ?? null;
    out.reservation_link = row.reservation_link || null;
    out.promo = row.promo_title
      ? { title: row.promo_title, description: row.promo_description || null }
      : null;
  }

  return out;
}

/** Only publicly visible approved+active businesses. */
const PUBLIC_WHERE = `
  (listing_approval = 'approved' OR listing_approval IS NULL OR listing_approval = '')
  AND (status IS NULL OR status = '' OR status = 'active')
`;

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /chatbot/v1/categories
 *
 * Returns all active categories with how many approved businesses are in each.
 * Use this to build the category picker in your chatbot panel.
 */
router.get("/categories", async (req, res, next) => {
  try {
    const rows = await dbAll(`
      SELECT
        bc.id,
        bc.name,
        bc.sort_order,
        COUNT(b.id) AS business_count
      FROM business_categories bc
      LEFT JOIN businesses b
        ON b.category = bc.name
        AND ${PUBLIC_WHERE}
      WHERE bc.is_active = 1
      GROUP BY bc.id, bc.name, bc.sort_order
      ORDER BY bc.sort_order ASC, bc.name ASC
    `);
    res.json({ categories: rows.map((r) => ({ id: r.id, name: r.name, business_count: Number(r.business_count) })) });
  } catch (e) { next(e); }
});

/**
 * GET /chatbot/v1/businesses
 *
 * Query params:
 *   category  — exact category name (e.g. "رستوران")
 *   city      — city filter (e.g. "North London")
 *   q         — free-text search in name or description
 *   limit     — max results (default 10, max 50)
 *   offset    — pagination offset (default 0)
 *
 * Returns: { total, limit, offset, results: [...] }
 */
router.get("/businesses", async (req, res, next) => {
  try {
    const category = String(req.query.category || "").trim();
    const city = String(req.query.city || "").trim();
    const q = String(req.query.q || "").trim();
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const params = [];
    const conditions = [PUBLIC_WHERE];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (city) {
      params.push(`%${city}%`);
      conditions.push(`city ILIKE $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(name_fa ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const countRow = await dbGet(`SELECT COUNT(*) AS total FROM businesses ${where}`, params);
    const total = Number(countRow?.total || 0);

    params.push(limit);
    params.push(offset);
    const rows = await dbAll(
      `SELECT * FROM businesses ${where} ORDER BY name_fa LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      total,
      limit,
      offset,
      results: rows.map((r) => formatBusiness(r, false)),
    });
  } catch (e) { next(e); }
});

/**
 * GET /chatbot/v1/businesses/:slug
 *
 * Full detail for a single business — includes gallery, promo, all social links.
 */
router.get("/businesses/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params.slug || "").trim();
    const row = await dbGet(
      `SELECT * FROM businesses WHERE slug = $1 AND ${PUBLIC_WHERE}`,
      [slug]
    );
    if (!row) return res.status(404).json({ error: "not_found", slug });
    res.json(formatBusiness(row, true));
  } catch (e) { next(e); }
});

export { router as chatbotRouter };
