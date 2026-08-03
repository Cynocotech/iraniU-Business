import { Router } from "express";
import { dbAll, dbGet } from "../../db.js";

const router = Router();

/**
 * @openapi
 * /sections:
 *   get:
 *     summary: List active home page sections
 *     description: Returns all active sections in display order. Used to build the home page layout dynamically.
 *     tags: [Sections]
 *     responses:
 *       200:
 *         description: Ordered list of active sections
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HomeSection'
 */
router.get("/", async (_req, res, next) => {
  try {
    const rows = await dbAll(
      `SELECT id, title, subtitle, eyebrow, section_type, category_filter, icon, background, max_items, sort_order
       FROM home_sections
       WHERE is_active = 1
       ORDER BY sort_order, id`,
      []
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /sections/{id}:
 *   get:
 *     summary: Get a single section by ID
 *     tags: [Sections]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Section details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HomeSection'
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
    const row = await dbGet(
      `SELECT id, title, subtitle, eyebrow, section_type, category_filter, icon, background, max_items, sort_order
       FROM home_sections WHERE id = $1 AND is_active = 1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(row);
  } catch (e) { next(e); }
});

export default router;
