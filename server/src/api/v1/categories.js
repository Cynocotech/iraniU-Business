import { Router } from "express";
import { dbAll } from "../../db.js";

const router = Router();

/**
 * @openapi
 * /categories:
 *   get:
 *     summary: List all active business categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 */
router.get("/", async (_req, res, next) => {
  try {
    const rows = await dbAll(
      `SELECT id, name, icon, sort_order FROM business_categories WHERE is_active = 1 ORDER BY sort_order, name`,
      []
    );
    return res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /categories/values:
 *   get:
 *     summary: List distinct category values used by businesses
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Flat array of category strings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
router.get("/values", async (_req, res, next) => {
  try {
    const rows = await dbAll(
      `SELECT DISTINCT category FROM businesses WHERE category IS NOT NULL AND category != '' AND listing_approval = 'approved' ORDER BY category`,
      []
    );
    return res.json(rows.map((r) => r.category));
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /categories/cities:
 *   get:
 *     summary: List distinct cities from approved businesses
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Flat array of city strings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
router.get("/cities", async (_req, res, next) => {
  try {
    const rows = await dbAll(
      `SELECT DISTINCT city FROM businesses
       WHERE city IS NOT NULL AND city != '' AND listing_approval = 'approved'
       ORDER BY city ASC`,
      []
    );
    return res.json(rows.map((r) => r.city));
  } catch (e) {
    next(e);
  }
});

export default router;
