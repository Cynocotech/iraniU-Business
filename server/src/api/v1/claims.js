import { Router } from "express";
import { dbGet, dbAll, dbRun } from "../../db.js";

const router = Router();

/**
 * @openapi
 * /claims/my:
 *   get:
 *     summary: List your submitted claim requests
 *     tags: [Claims]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of claim requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: integer }
 *                   business_slug: { type: string }
 *                   status: { type: string, enum: [pending, approved, rejected] }
 *                   created_at: { type: string, format: date-time }
 *                   decided_at: { type: string, nullable: true }
 *       401:
 *         description: Unauthorized
 */
router.get("/my", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const rows = await dbAll(
      `SELECT id, business_slug, status, created_at, decided_at
       FROM claim_requests WHERE email = $1 ORDER BY id DESC`,
      [user.email]
    );
    return res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /claims/{slug}:
 *   post:
 *     summary: Submit a claim request for an unclaimed business
 *     description: Authenticated users can claim ownership of an unclaimed listing. Admins review and approve.
 *     tags: [Claims]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: Slug of the business to claim
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClaimInput'
 *     responses:
 *       201:
 *         description: Claim submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 id: { type: integer }
 *                 message: { type: string }
 *       400:
 *         description: Business already claimed or claim already pending
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 *       422:
 *         description: Validation error
 */
router.post("/:slug", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized", hint: "Login required to submit a claim." });

    const { slug } = req.params;
    const business = await dbGet(`SELECT id, name_fa, claimed FROM businesses WHERE slug = $1`, [slug]);
    if (!business) return res.status(404).json({ error: "not_found", hint: "Business not found." });
    if (business.claimed) {
      return res.status(400).json({ error: "already_claimed", hint: "This business has already been claimed." });
    }

    const pending = await dbGet(
      `SELECT id FROM claim_requests WHERE business_slug = $1 AND status = 'pending'`,
      [slug]
    );
    if (pending) {
      return res.status(400).json({ error: "claim_pending", hint: "A claim is already pending for this business." });
    }

    const { applicant_name, email, phone, message } = req.body || {};
    const name = String(applicant_name || user.name || "").trim();
    const emailStr = String(email || user.email || "").trim();

    if (!name) return res.status(422).json({ error: "validation_error", hint: "applicant_name is required." });
    if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.status(422).json({ error: "validation_error", hint: "A valid email is required." });
    }

    const row = await dbGet(
      `INSERT INTO claim_requests (business_slug, applicant_name, email, phone, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [slug, name, emailStr, phone ? String(phone).trim() : null, message ? String(message).trim() : null]
    );

    return res.status(201).json({
      ok: true,
      id: row.id,
      message: "Your claim has been submitted and will be reviewed by our team.",
    });
  } catch (e) {
    next(e);
  }
});

export default router;
