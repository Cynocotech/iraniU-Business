import { Router } from "express";
import jwt from "jsonwebtoken";
import { dbGet } from "../../db.js";
import authRouter from "./auth.js";
import businessesRouter from "./businesses.js";
import categoriesRouter from "./categories.js";
import claimsRouter from "./claims.js";
import servicesRouter from "./services.js";
import reservationsRouter from "./reservations.js";
import adsRouter from "./ads.js";
import sectionsRouter from "./sections.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "iraniu-dev-jwt-secret-change-me";

// Resolve Bearer token → req.apiUser (null if missing/invalid, no hard failure)
router.use(async (req, _res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return next();
  try {
    const payload = jwt.verify(h.slice(7).trim(), JWT_SECRET);
    if (payload?.typ === "usr") {
      const user = await dbGet(`SELECT * FROM identity.api_users WHERE id = $1`, [payload.sub]);
      req.apiUser = user || null;
    }
  } catch {
    // expired / invalid — leave req.apiUser undefined
  }
  next();
});

router.use("/auth", authRouter);
router.use("/businesses", businessesRouter);
router.use("/services", servicesRouter);
router.use("/reservations", reservationsRouter);
router.use("/categories", categoriesRouter);
router.use("/claims", claimsRouter);
router.use("/ads", adsRouter);
router.use("/sections", sectionsRouter);

/**
 * @openapi
 * /health:
 *   get:
 *     summary: API health check
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: API is up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 version: { type: string }
 *                 time: { type: string, format: date-time }
 */
router.get("/health", (_req, res) => {
  res.json({ ok: true, version: "1.0.0", time: new Date().toISOString() });
});

// 404 for unknown v1 routes
router.use((_req, res) => {
  res.status(404).json({ error: "not_found", hint: "Unknown API endpoint. See /api/docs for reference." });
});

export default router;
