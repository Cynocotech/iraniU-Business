import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { dbGet, dbRun } from "../../db.js";
import { assertLoginNotBlocked, recordLoginFailure, recordLoginSuccess } from "../../bruteForce.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "iraniu-dev-jwt-secret-change-me";

function signUserToken(userId) {
  return jwt.sign({ typ: "usr", sub: Number(userId) }, JWT_SECRET, { expiresIn: "7d" });
}

function safeUser(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return rest;
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Min 8 chars, must include uppercase, lowercase, digit, and symbol
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account created — JWT returned immediately
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body || {};

    if (!name || String(name).trim().length < 2) {
      return res.status(422).json({ error: "validation_error", hint: "Name must be at least 2 characters." });
    }
    const emailStr = String(email || "").trim().toLowerCase();
    if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.status(422).json({ error: "validation_error", hint: "A valid email is required." });
    }
    if (!password || String(password).length < 8) {
      return res.status(422).json({ error: "validation_error", hint: "Password must be at least 8 characters." });
    }
    const p = String(password);
    if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[^a-zA-Z0-9]/.test(p)) {
      return res.status(422).json({
        error: "password_weak",
        hint: "Password must contain uppercase, lowercase, a digit, and a special character.",
      });
    }

    const existing = await dbGet(`SELECT id FROM identity.api_users WHERE email = $1`, [emailStr]);
    if (existing) {
      return res.status(409).json({ error: "email_taken", hint: "This email is already registered." });
    }

    const hash = await bcrypt.hash(p, 12);
    const row = await dbGet(
      `INSERT INTO identity.api_users (name, email, password_hash, phone) VALUES ($1,$2,$3,$4) RETURNING *`,
      [String(name).trim(), emailStr, hash, phone ? String(phone).trim() : null]
    );

    const token = signUserToken(row.id);
    return res.status(201).json({ token, user: safeUser(row) });
  } catch (e) {
    if (e?.code === "23505") {
      return res.status(409).json({ error: "email_taken", hint: "This email is already registered." });
    }
    next(e);
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many failed login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/login", async (req, res, next) => {
  try {
    const blocked = await assertLoginNotBlocked(req, res);
    if (blocked === false) return; // assertLoginNotBlocked already sent 429

    const { email, password } = req.body || {};
    const emailStr = String(email || "").trim().toLowerCase();

    const user = await dbGet(`SELECT * FROM identity.api_users WHERE email = $1`, [emailStr]);
    const valid = user && (await bcrypt.compare(String(password || ""), user.password_hash || ""));

    if (!valid) {
      await recordLoginFailure(req);
      return res.status(401).json({ error: "invalid_credentials", hint: "Email or password is incorrect." });
    }

    await recordLoginSuccess(req);
    const token = signUserToken(user.id);
    return res.json({ token, user: safeUser(user) });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/me", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized", hint: "Token required." });
    return res.json(safeUser(user));
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /auth/me:
 *   patch:
 *     summary: Update current user profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized
 */
router.patch("/me", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized", hint: "Token required." });

    const { name, phone } = req.body || {};
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (phone !== undefined) updates.phone = phone ? String(phone).trim() : null;

    if (Object.keys(updates).length === 0) {
      return res.json(safeUser(user));
    }

    const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(", ");
    const vals = Object.values(updates);
    const updated = await dbGet(
      `UPDATE identity.api_users SET ${sets} WHERE id = $1 RETURNING *`,
      [user.id, ...vals]
    );

    return res.json(safeUser(updated));
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     summary: Change password for current user
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed
 *       401:
 *         description: Unauthorized or wrong current password
 */
router.post("/change-password", async (req, res, next) => {
  try {
    const user = req.apiUser;
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const { current_password, new_password } = req.body || {};
    const full = await dbGet(`SELECT * FROM identity.api_users WHERE id = $1`, [user.id]);
    const valid = full && (await bcrypt.compare(String(current_password || ""), full.password_hash || ""));
    if (!valid) return res.status(401).json({ error: "wrong_password", hint: "Current password is incorrect." });

    const np = String(new_password || "");
    if (np.length < 8) return res.status(422).json({ error: "password_too_short" });
    if (!/[a-z]/.test(np) || !/[A-Z]/.test(np) || !/[0-9]/.test(np) || !/[^a-zA-Z0-9]/.test(np)) {
      return res.status(422).json({ error: "password_weak" });
    }

    const hash = await bcrypt.hash(np, 12);
    await dbRun(`UPDATE identity.api_users SET password_hash = $2 WHERE id = $1`, [user.id, hash]);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
