import { Router } from "express";
import { dbAll, dbGet, dbRun } from "../../db.js";

const router = Router();

function requireUser(req, res, next) {
  if (!req.apiUser) return res.status(401).json({ error: "unauthorized", hint: "Bearer token required." });
  next();
}

const VALID_TYPES = ["listing", "banner", "spotlight"];
const VALID_PLACEMENTS = ["listings", "home", "sidebar"];

async function makeAdSlug(title) {
  const base = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "ad";
  let slug = base;
  let i = 2;
  while (await dbGet(`SELECT 1 FROM ads WHERE slug = $1`, [slug])) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

/**
 * @openapi
 * /ads:
 *   get:
 *     summary: List active ads
 *     tags: [Ads]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [listing, banner, spotlight] }
 *       - in: query
 *         name: placement
 *         schema: { type: string, enum: [listings, home, sidebar] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated list of active ads
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedAds'
 */
router.get("/", async (req, res, next) => {
  try {
    const type = String(req.query.type || "").trim();
    const placement = String(req.query.placement || "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const conds = [`a.status = 'active'`];
    const params = [];
    if (type && VALID_TYPES.includes(type)) { params.push(type); conds.push(`a.ad_type = $${params.length}`); }
    if (placement && VALID_PLACEMENTS.includes(placement)) { params.push(placement); conds.push(`a.placement = $${params.length}`); }
    const where = `WHERE ${conds.join(" AND ")}`;

    const countParams = [...params];
    params.push(limit);
    params.push(offset);

    const rows = await dbAll(
      `SELECT a.id, a.slug, a.title, a.description, a.image_url, a.target_url,
              a.ad_type, a.placement, a.business_slug,
              a.contact_name, a.budget_gbp, a.start_date, a.end_date,
              a.impression_count, a.click_count, a.created_at
       FROM ads a
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const { count } = await dbGet(
      `SELECT COUNT(*)::int AS count FROM ads a ${where}`,
      countParams
    );
    res.json({ data: rows, total: count, page, limit, pages: Math.ceil((count || 0) / limit) });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /ads/my:
 *   get:
 *     summary: List current user's ads
 *     tags: [Ads]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's ads (all statuses)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ad'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/my", requireUser, async (req, res, next) => {
  try {
    const rows = await dbAll(
      `SELECT * FROM ads WHERE api_user_id = $1 ORDER BY created_at DESC`,
      [req.apiUser.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /ads:
 *   post:
 *     summary: Create a new ad
 *     tags: [Ads]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdInput'
 *     responses:
 *       201:
 *         description: Ad created (pending review)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ad'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", requireUser, async (req, res, next) => {
  try {
    const {
      title, description, image_url, target_url,
      ad_type, placement, business_slug,
      contact_name, contact_email, contact_phone,
      budget_gbp, start_date, end_date, notes,
    } = req.body;

    if (!title || String(title).trim().length < 2)
      return res.status(400).json({ error: "validation_error", hint: "Title is required (min 2 chars)." });
    const email = String(contact_email || req.apiUser.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: "validation_error", hint: "Valid contact email is required." });

    const adType = VALID_TYPES.includes(ad_type) ? ad_type : "listing";
    const adPlacement = VALID_PLACEMENTS.includes(placement) ? placement : "listings";
    const slug = await makeAdSlug(String(title).trim());

    const row = await dbGet(
      `INSERT INTO ads (slug, title, description, image_url, target_url, ad_type, placement,
        business_slug, contact_name, contact_email, contact_phone, budget_gbp,
        start_date, end_date, notes, api_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        slug,
        String(title).trim(),
        description ? String(description).trim() : null,
        image_url || null,
        target_url || null,
        adType,
        adPlacement,
        business_slug || null,
        contact_name ? String(contact_name).trim() : req.apiUser.name,
        email,
        contact_phone || null,
        budget_gbp != null ? Number(budget_gbp) : null,
        start_date || null,
        end_date || null,
        notes || null,
        req.apiUser.id,
      ]
    );
    res.status(201).json(row);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /ads/{id}:
 *   get:
 *     summary: Get a single ad
 *     tags: [Ads]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Ad details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ad'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });
    const row = await dbGet(`SELECT * FROM ads WHERE id = $1`, [id]);
    if (!row) return res.status(404).json({ error: "not_found" });
    if (row.status !== "active" && (!req.apiUser || req.apiUser.id !== row.api_user_id))
      return res.status(404).json({ error: "not_found" });
    res.json(row);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /ads/{id}:
 *   patch:
 *     summary: Update your own ad
 *     tags: [Ads]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdInput'
 *     responses:
 *       200:
 *         description: Updated ad
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ad'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/:id", requireUser, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });
    const row = await dbGet(`SELECT * FROM ads WHERE id = $1`, [id]);
    if (!row) return res.status(404).json({ error: "not_found" });
    if (row.api_user_id !== req.apiUser.id)
      return res.status(403).json({ error: "forbidden", hint: "You do not own this ad." });

    const PATCHABLE = ["title","description","image_url","target_url","contact_name",
                       "contact_phone","budget_gbp","start_date","end_date","notes"];
    const sets = [];
    const vals = [];
    for (const key of PATCHABLE) {
      if (key in req.body) {
        vals.push(req.body[key]);
        sets.push(`${key} = $${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: "no_fields", hint: "No updatable fields provided." });
    vals.push(id);
    const updated = await dbGet(
      `UPDATE ads SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    res.json(updated);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /ads/{id}:
 *   delete:
 *     summary: Delete your own ad
 *     tags: [Ads]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete("/:id", requireUser, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });
    const row = await dbGet(`SELECT * FROM ads WHERE id = $1`, [id]);
    if (!row) return res.status(404).json({ error: "not_found" });
    if (row.api_user_id !== req.apiUser.id)
      return res.status(403).json({ error: "forbidden" });
    await dbRun(`DELETE FROM ads WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
