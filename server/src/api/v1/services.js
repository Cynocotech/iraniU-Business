import { Router } from "express";
import { dbGet, dbAll, dbRun } from "../../db.js";

const router = Router();

const PUBLIC_COLS = `
  id, slug, name, description, service_type, provider_name,
  phone, mobile, email, whatsapp, website, instagram,
  city, area_coverage, postcode,
  pricing_info, pricing_from, pricing_currency,
  languages, availability,
  cover_image_url,
  status, api_user_id,
  created_at
`.trim();

const PATCHABLE = new Set([
  "name","description","service_type","provider_name",
  "phone","mobile","email","whatsapp","website","instagram",
  "city","area_coverage","postcode",
  "pricing_info","pricing_from","pricing_currency",
  "languages","availability","cover_image_url",
]);

async function makeServiceSlug(name) {
  const base = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "service";

  let slug = base;
  let i = 2;
  while (await dbGet(`SELECT 1 FROM services WHERE slug = $1`, [slug])) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

/**
 * @openapi
 * /services:
 *   get:
 *     summary: List and search services
 *     tags: [Services]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Free-text search (name, description, provider, service type)
 *       - in: query
 *         name: service_type
 *         schema: { type: string }
 *         description: Filter by service type/category
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *         description: Filter by city
 *       - in: query
 *         name: language
 *         schema: { type: string }
 *         description: Filter by language offered (e.g. Persian, English)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of services
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedServices'
 */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [`status = 'approved'`];
    const params = [];

    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      const n = params.length;
      conditions.push(
        `(name ILIKE $${n} OR description ILIKE $${n} OR provider_name ILIKE $${n} OR service_type ILIKE $${n})`
      );
    }
    if (req.query.service_type) {
      params.push(req.query.service_type);
      conditions.push(`service_type = $${params.length}`);
    }
    if (req.query.city) {
      params.push(`%${req.query.city}%`);
      conditions.push(`(city ILIKE $${params.length} OR area_coverage ILIKE $${params.length})`);
    }
    if (req.query.language) {
      params.push(`%${req.query.language}%`);
      conditions.push(`languages ILIKE $${params.length}`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const countRow = await dbGet(`SELECT COUNT(*) AS n FROM services ${where}`, params);
    const total = parseInt(countRow?.n || 0);

    params.push(limit, offset);
    const rows = await dbAll(
      `SELECT ${PUBLIC_COLS} FROM services ${where} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /services/types:
 *   get:
 *     summary: List distinct service types/categories
 *     tags: [Services]
 *     responses:
 *       200:
 *         description: Flat array of service type strings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
router.get("/types", async (_req, res, next) => {
  try {
    const rows = await dbAll(
      `SELECT DISTINCT service_type FROM services WHERE service_type IS NOT NULL AND status = 'approved' ORDER BY service_type`,
      []
    );
    return res.json(rows.map((r) => r.service_type));
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /services/my:
 *   get:
 *     summary: List services owned by the authenticated user
 *     tags: [Services]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of services you own (all statuses)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       401:
 *         description: Unauthorized
 */
router.get("/my", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const rows = await dbAll(
      `SELECT ${PUBLIC_COLS} FROM services WHERE api_user_id = $1 ORDER BY id DESC`,
      [user.id]
    );
    return res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /services:
 *   post:
 *     summary: Create a new service listing
 *     description: Requires authentication. Service starts in 'pending' state awaiting admin approval.
 *     tags: [Services]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceInput'
 *     responses:
 *       201:
 *         description: Service created (pending review)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.post("/", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized", hint: "Login required to add a service." });

    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (name.length < 2) {
      return res.status(422).json({ error: "validation_error", hint: "Service name is required (min 2 chars)." });
    }
    if (!body.service_type) {
      return res.status(422).json({ error: "validation_error", hint: "service_type is required." });
    }

    const slug = await makeServiceSlug(name);
    const fields = ["slug", "name", "api_user_id", "status"];
    const vals = [slug, name, user.id, "pending"];

    const optionals = [
      "description","service_type","provider_name",
      "phone","mobile","email","whatsapp","website","instagram",
      "city","area_coverage","postcode",
      "pricing_info","pricing_from","pricing_currency",
      "languages","availability","cover_image_url",
    ];

    for (const f of optionals) {
      if (body[f] !== undefined && body[f] !== null && String(body[f]).trim() !== "") {
        fields.push(f);
        vals.push(String(body[f]).trim());
      }
    }

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
    const row = await dbGet(
      `INSERT INTO services (${fields.join(", ")}) VALUES (${placeholders}) RETURNING ${PUBLIC_COLS}`,
      vals
    );

    return res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /services/{slug}:
 *   get:
 *     summary: Get a single service by slug
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Service details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Not found
 */
router.get("/:slug", async (req, res, next) => {
  try {
    const row = await dbGet(
      `SELECT ${PUBLIC_COLS} FROM services WHERE slug = $1 AND status = 'approved'`,
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
 * /services/{slug}:
 *   patch:
 *     summary: Update your own service listing
 *     tags: [Services]
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
 *             $ref: '#/components/schemas/ServiceInput'
 *     responses:
 *       200:
 *         description: Updated service
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: You don't own this service
 *       404:
 *         description: Not found
 */
router.patch("/:slug", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const existing = await dbGet(`SELECT id, api_user_id FROM services WHERE slug = $1`, [req.params.slug]);
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.api_user_id !== user.id) {
      return res.status(403).json({ error: "forbidden", hint: "You can only edit your own services." });
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
      const row = await dbGet(`SELECT ${PUBLIC_COLS} FROM services WHERE slug = $1`, [req.params.slug]);
      return res.json(row);
    }

    const updated = await dbGet(
      `UPDATE services SET ${sets.join(", ")} WHERE id = $1 RETURNING ${PUBLIC_COLS}`,
      [existing.id, ...vals]
    );
    return res.json(updated);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /services/{slug}:
 *   delete:
 *     summary: Delete your own service listing
 *     tags: [Services]
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
 *         description: You don't own this service
 *       404:
 *         description: Not found
 */
router.delete("/:slug", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const existing = await dbGet(`SELECT id, api_user_id FROM services WHERE slug = $1`, [req.params.slug]);
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.api_user_id !== user.id) {
      return res.status(403).json({ error: "forbidden", hint: "You can only delete your own services." });
    }

    await dbRun(`DELETE FROM services WHERE id = $1`, [existing.id]);
    return res.json({ ok: true, deleted: req.params.slug });
  } catch (e) {
    next(e);
  }
});

export default router;
