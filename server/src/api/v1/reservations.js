import { Router } from "express";
import { dbGet, dbAll, dbRun } from "../../db.js";
import { parseAuthHeader } from "../../authUtil.js";

const router = Router();

const OCCASIONS = ["birthday", "anniversary", "date", "business", "family", "celebration", "other"];
const SEATING = ["indoor", "outdoor", "booth", "window", "bar", "private", "no-preference"];
const STATUSES = ["pending", "confirmed", "seated", "completed", "cancelled", "no-show"];

function makeConfirmationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function uniqueConfCode() {
  let code, exists;
  do {
    code = makeConfirmationCode();
    exists = await dbGet(`SELECT 1 FROM reservations WHERE confirmation_code = $1`, [code]);
  } while (exists);
  return code;
}

function safeRes(row) {
  if (!row) return null;
  return row;
}

/**
 * @openapi
 * /reservations/my:
 *   get:
 *     summary: List reservations made by the authenticated user
 *     tags: [Reservations]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of reservations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reservation'
 *       401:
 *         description: Unauthorized
 */
router.get("/my", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const rows = await dbAll(
      `SELECT * FROM reservations WHERE api_user_id = $1 ORDER BY reservation_date DESC, reservation_time DESC`,
      [user.id]
    );
    return res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /reservations/confirm/{code}:
 *   get:
 *     summary: Look up a reservation by confirmation code
 *     description: Public endpoint — anyone with the code can retrieve the booking details.
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: 8-character confirmation code (e.g. AB3X7QP2)
 *     responses:
 *       200:
 *         description: Reservation details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reservation'
 *       404:
 *         description: Not found
 */
router.get("/confirm/:code", async (req, res, next) => {
  try {
    const row = await dbGet(
      `SELECT * FROM reservations WHERE confirmation_code = $1`,
      [String(req.params.code).toUpperCase().trim()]
    );
    if (!row) return res.status(404).json({ error: "not_found", hint: "No booking found with this code." });
    return res.json(row);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /reservations/business/{slug}:
 *   get:
 *     summary: List all reservations for a specific business (manager view)
 *     description: Requires manager or super-admin token.
 *     tags: [Reservations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by status (pending, confirmed, cancelled, etc.)
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Filter by reservation date (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated reservations for the business
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a manager of this business
 */
router.get("/business/:slug", async (req, res, next) => {
  try {
    const auth = parseAuthHeader(req);
    if (!auth || (auth.typ !== "mgr" && auth.typ !== "adm" && auth.typ !== "usr")) {
      return res.status(401).json({ error: "unauthorized" });
    }

    // API users can only see reservations for their own businesses
    if (auth.typ === "usr") {
      const biz = await dbGet(`SELECT api_user_id FROM businesses WHERE slug = $1`, [req.params.slug]);
      if (!biz || biz.api_user_id !== auth.sub) {
        return res.status(403).json({ error: "forbidden" });
      }
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions = [`business_slug = $1`];
    const params = [req.params.slug];

    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`status = $${params.length}`);
    }
    if (req.query.date) {
      params.push(req.query.date);
      conditions.push(`reservation_date = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const countRow = await dbGet(`SELECT COUNT(*) AS n FROM reservations ${where}`, params);
    const total = parseInt(countRow?.n || 0);

    params.push(limit, offset);
    const rows = await dbAll(
      `SELECT * FROM reservations ${where} ORDER BY reservation_date ASC, reservation_time ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /reservations:
 *   post:
 *     summary: Create a table reservation
 *     description: No authentication required — anyone can book. If authenticated, the booking is linked to your account.
 *     tags: [Reservations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReservationInput'
 *     responses:
 *       201:
 *         description: Booking confirmed — includes confirmation_code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reservation'
 *       404:
 *         description: Business not found or reservations not enabled
 *       422:
 *         description: Validation error
 */
router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const user = req.apiUser || null;

    // Required fields
    const business_slug = String(body.business_slug || "").trim();
    const customer_name = String(body.customer_name || (user?.name) || "").trim();
    const customer_email = String(body.customer_email || (user?.email) || "").trim().toLowerCase();
    const reservation_date = String(body.reservation_date || "").trim();
    const reservation_time = String(body.reservation_time || "").trim();
    const party_size = parseInt(body.party_size) || 2;

    if (!business_slug) return res.status(422).json({ error: "validation_error", hint: "business_slug is required." });
    if (!customer_name) return res.status(422).json({ error: "validation_error", hint: "customer_name is required." });
    if (!customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
      return res.status(422).json({ error: "validation_error", hint: "A valid customer_email is required." });
    }
    if (!reservation_date || !/^\d{4}-\d{2}-\d{2}$/.test(reservation_date)) {
      return res.status(422).json({ error: "validation_error", hint: "reservation_date must be YYYY-MM-DD." });
    }
    if (!reservation_time || !/^\d{2}:\d{2}$/.test(reservation_time)) {
      return res.status(422).json({ error: "validation_error", hint: "reservation_time must be HH:MM (24h)." });
    }
    if (party_size < 1 || party_size > 50) {
      return res.status(422).json({ error: "validation_error", hint: "party_size must be between 1 and 50." });
    }

    // Validate date is not in the past
    const bookingDate = new Date(`${reservation_date}T${reservation_time}`);
    if (isNaN(bookingDate.getTime()) || bookingDate < new Date()) {
      return res.status(422).json({ error: "validation_error", hint: "Reservation must be in the future." });
    }

    // Check business exists and accepts reservations
    const biz = await dbGet(
      `SELECT slug, name_fa, listing_approval FROM businesses WHERE slug = $1`,
      [business_slug]
    );
    if (!biz) return res.status(404).json({ error: "not_found", hint: "Business not found." });

    // Optional fields
    const occasion = OCCASIONS.includes(body.occasion) ? body.occasion : null;
    const seating_preference = SEATING.includes(body.seating_preference) ? body.seating_preference : "no-preference";
    const special_requests = body.special_requests ? String(body.special_requests).slice(0, 1000) : null;
    const notes = body.notes ? String(body.notes).slice(0, 500) : null;
    const customer_phone = body.customer_phone ? String(body.customer_phone).trim().slice(0, 30) : null;
    const source = body.source === "api" ? "api" : "website";

    const confirmation_code = await uniqueConfCode();

    const row = await dbGet(
      `INSERT INTO reservations (
        business_slug, customer_name, customer_email, customer_phone,
        reservation_date, reservation_time, party_size,
        occasion, seating_preference, special_requests, notes,
        confirmation_code, status, api_user_id, source
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13,$14)
      RETURNING *`,
      [
        business_slug, customer_name, customer_email, customer_phone,
        reservation_date, reservation_time, party_size,
        occasion, seating_preference, special_requests, notes,
        confirmation_code, user?.id || null, source,
      ]
    );

    return res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /reservations/{id}/cancel:
 *   post:
 *     summary: Cancel a reservation
 *     description: Provide either the confirmation_code or be authenticated as the booking owner.
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirmation_code:
 *                 type: string
 *                 description: Required if not authenticated
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reservation cancelled
 *       400:
 *         description: Already cancelled or completed
 *       403:
 *         description: Invalid confirmation code or not authorised
 *       404:
 *         description: Not found
 */
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await dbGet(`SELECT * FROM reservations WHERE id = $1`, [id]);
    if (!existing) return res.status(404).json({ error: "not_found" });

    if (existing.status === "cancelled") {
      return res.status(400).json({ error: "already_cancelled" });
    }
    if (existing.status === "completed") {
      return res.status(400).json({ error: "already_completed", hint: "Cannot cancel a completed reservation." });
    }

    // Auth: either authenticated user who owns it, or correct confirmation code
    const user = req.apiUser;
    const code = String(req.body?.confirmation_code || "").toUpperCase().trim();
    const byCode = code && code === existing.confirmation_code;
    const byUser = user && existing.api_user_id === user.id;
    const byManager = parseAuthHeader(req)?.typ === "mgr" || parseAuthHeader(req)?.typ === "adm";

    if (!byCode && !byUser && !byManager) {
      return res.status(403).json({ error: "forbidden", hint: "Provide your confirmation_code to cancel." });
    }

    const reason = req.body?.reason ? String(req.body.reason).slice(0, 500) : null;
    const updated = await dbGet(
      `UPDATE reservations SET status = 'cancelled', cancelled_at = NOW()::TEXT, cancellation_reason = $2 WHERE id = $1 RETURNING *`,
      [id, reason]
    );
    return res.json(updated);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /reservations/{id}:
 *   patch:
 *     summary: Update reservation status (manager/admin)
 *     description: Allows managers to confirm, seat, complete, or mark no-show.
 *     tags: [Reservations]
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
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, seated, completed, cancelled, no-show]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated reservation
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const auth = parseAuthHeader(req);
    if (!auth || (auth.typ !== "mgr" && auth.typ !== "adm" && auth.typ !== "usr")) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const id = parseInt(req.params.id);
    const existing = await dbGet(`SELECT * FROM reservations WHERE id = $1`, [id]);
    if (!existing) return res.status(404).json({ error: "not_found" });

    const { status, notes } = req.body || {};
    if (!STATUSES.includes(status)) {
      return res.status(422).json({ error: "invalid_status", hint: `Status must be one of: ${STATUSES.join(", ")}` });
    }

    const sets = [`status = $2`];
    const vals = [id, status];

    if (notes !== undefined) {
      vals.push(String(notes).slice(0, 500));
      sets.push(`notes = $${vals.length}`);
    }
    if (status === "confirmed") {
      sets.push(`confirmed_at = NOW()::TEXT`);
    }
    if (status === "cancelled") {
      sets.push(`cancelled_at = NOW()::TEXT`);
    }

    const updated = await dbGet(
      `UPDATE reservations SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
      vals
    );
    return res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
