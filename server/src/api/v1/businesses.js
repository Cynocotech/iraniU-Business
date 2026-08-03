import { Router } from "express";
import { dbGet, dbAll, dbRun } from "../../db.js";

const router = Router();

const PUBLIC_COLS = `
  id, slug, name_fa, description, category, phone, mobile, address, postcode, city,
  price_range, cover_image_url, gallery_json, google_review_url, reservation_link,
  claimed, package, rating, hours_json, subtitle, promo_title, promo_description,
  listing_title, listing_approval, created_at
`.trim();

const PATCHABLE = new Set([
  "name_fa","description","category","phone","mobile","address","postcode",
  "city","price_range","google_review_url","reservation_link","hours_json",
  "subtitle","promo_title","promo_description","listing_title","listing_contact_email",
]);

async function makeSlug(nameRaw) {
  const base = String(nameRaw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "business";

  let slug = base;
  let i = 2;
  while (await dbGet(`SELECT 1 FROM businesses WHERE slug = $1`, [slug])) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

/**
 * @openapi
 * /businesses:
 *   get:
 *     summary: List and search businesses
 *     tags: [Businesses]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Free-text search (name, description, category, address)
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: claimed
 *         schema: { type: integer, enum: [0, 1] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of businesses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedBusinesses'
 */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [`listing_approval = 'approved'`];
    const params = [];

    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      const n = params.length;
      conditions.push(
        `(name_fa ILIKE $${n} OR description ILIKE $${n} OR category ILIKE $${n} OR address ILIKE $${n})`
      );
    }
    if (req.query.category) {
      params.push(req.query.category);
      conditions.push(`category = $${params.length}`);
    }
    if (req.query.city) {
      params.push(req.query.city);
      conditions.push(`city ILIKE $${params.length}`);
    }
    if (req.query.claimed !== undefined) {
      params.push(parseInt(req.query.claimed) || 0);
      conditions.push(`claimed = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const countRow = await dbGet(`SELECT COUNT(*) AS n FROM businesses ${where}`, params);
    const total = parseInt(countRow?.n || 0);

    params.push(limit, offset);
    const rows = await dbAll(
      `SELECT ${PUBLIC_COLS} FROM businesses ${where} ORDER BY claimed DESC, id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /businesses/my:
 *   get:
 *     summary: List businesses owned by the authenticated user
 *     tags: [Businesses]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of businesses you own (all statuses)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Business'
 *       401:
 *         description: Unauthorized
 */
router.get("/my", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const rows = await dbAll(
      `SELECT ${PUBLIC_COLS} FROM businesses WHERE api_user_id = $1 ORDER BY id DESC`,
      [user.id]
    );
    return res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /businesses:
 *   post:
 *     summary: Create a new business listing
 *     description: Requires authentication. Listing starts in 'pending' state awaiting admin approval.
 *     tags: [Businesses]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessInput'
 *     responses:
 *       201:
 *         description: Business created (pending review)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Business'
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.post("/", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized", hint: "Login required to add a business." });

    const body = req.body || {};
    const name_fa = String(body.name_fa || "").trim();
    if (name_fa.length < 2) {
      return res.status(422).json({ error: "validation_error", hint: "Business name (name_fa) is required." });
    }

    const slug = await makeSlug(name_fa);
    const fields = ["slug", "name_fa", "api_user_id", "listing_approval", "claimed"];
    const vals = [slug, name_fa, user.id, "pending", 0];

    const patchable = [
      "description","category","phone","mobile","address","postcode","city",
      "price_range","google_review_url","reservation_link","hours_json",
      "subtitle","promo_title","promo_description","listing_title","listing_contact_email",
    ];

    for (const f of patchable) {
      if (body[f] !== undefined && body[f] !== null) {
        fields.push(f);
        vals.push(String(body[f]).trim());
      }
    }

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
    const row = await dbGet(
      `INSERT INTO businesses (${fields.join(", ")}) VALUES (${placeholders}) RETURNING ${PUBLIC_COLS}`,
      vals
    );

    return res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /businesses/{slug}:
 *   get:
 *     summary: Get a single business by slug
 *     tags: [Businesses]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Business details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Business'
 *       404:
 *         description: Not found
 */
router.get("/:slug", async (req, res, next) => {
  try {
    const row = await dbGet(
      `SELECT ${PUBLIC_COLS} FROM businesses WHERE slug = $1 AND listing_approval = 'approved'`,
      [req.params.slug]
    );
    if (!row) return res.status(404).json({ error: "not_found" });
    return res.json(row);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /businesses/{slug}:
 *   patch:
 *     summary: Update your own business listing
 *     tags: [Businesses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessInput'
 *     responses:
 *       200:
 *         description: Updated business
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Business'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: You don't own this business
 *       404:
 *         description: Business not found
 */
router.patch("/:slug", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const existing = await dbGet(`SELECT id, api_user_id FROM businesses WHERE slug = $1`, [req.params.slug]);
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.api_user_id !== user.id) {
      return res.status(403).json({ error: "forbidden", hint: "You can only edit your own businesses." });
    }

    const body = req.body || {};
    const sets = [];
    const vals = [];

    for (const [k, v] of Object.entries(body)) {
      if (!PATCHABLE.has(k)) continue;
      vals.push(v !== null && v !== undefined ? String(v).trim() : null);
      sets.push(`${k} = $${vals.length + 1}`);
    }

    if (sets.length === 0) {
      const row = await dbGet(`SELECT ${PUBLIC_COLS} FROM businesses WHERE slug = $1`, [req.params.slug]);
      return res.json(row);
    }

    const updated = await dbGet(
      `UPDATE businesses SET ${sets.join(", ")} WHERE id = $1 RETURNING ${PUBLIC_COLS}`,
      [existing.id, ...vals]
    );
    return res.json(updated);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /businesses/{slug}:
 *   delete:
 *     summary: Delete your own business listing
 *     tags: [Businesses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: You don't own this business
 *       404:
 *         description: Business not found
 */
router.delete("/:slug", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const existing = await dbGet(`SELECT id, api_user_id FROM businesses WHERE slug = $1`, [req.params.slug]);
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.api_user_id !== user.id) {
      return res.status(403).json({ error: "forbidden", hint: "You can only delete your own businesses." });
    }

    await dbRun(`DELETE FROM businesses WHERE id = $1`, [existing.id]);
    return res.json({ ok: true, deleted: req.params.slug });
  } catch (e) {
    next(e);
  }
});

export default router;
