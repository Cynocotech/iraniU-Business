import { dbGet, dbAll, dbRun, dbTransaction } from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import {
  hashPassword,
  verifyPassword,
  validatePasswordComplexity,
  signManagerToken,
  signExchangeManagerToken,
  signSuperAdminToken,
  parseAuthHeader,
  totpVerify,
  totpGenerateSecret,
  stripManagerRow,
  stripSuperAdminRow,
} from "./authUtil.js";
import { requireSuperAdmin } from "./authMiddleware.js";
import {
  clientIp,
  notifyTelegramSuperAdminLogin,
  processTelegramWebhook,
  sendTelegramTestMessage,
} from "./telegramNotify.js";
import { assertLoginNotBlocked, recordLoginFailure, recordLoginSuccess } from "./bruteForce.js";
import {
  getTelegramConfigForAdmin,
  applyTelegramConfigPatch,
  getEffectiveTelegramConfig,
} from "./telegramSettings.js";
import {
  getTwilioModuleForAdmin,
  setTwilioModuleEnabled,
  isTwilioModuleEnabled,
} from "./twilioModuleSettings.js";
import { isCareersModuleEnabled, setCareersModuleEnabled } from "./careersModuleSettings.js";
import { getDesktopGateForAdmin, setDesktopGateEnabled } from "./desktopGateSettings.js";
import { verifyTurnstileToken } from "./turnstileVerify.js";
import { getBusinessBySignupToken, completeBusinessSignup } from "./businessSignupVerification.js";
import { requestPasswordReset, resetPassword } from "./passwordReset.js";
import {
  getSmtpSettingsForAdmin,
  applySmtpSettingsPatch,
  sendMailViaSettings,
} from "./smtpSettings.js";
import { wrapBrandedEmail, escapeHtml } from "./emailBranding.js";
import { sendBroadcastToBusinesses } from "./emailBroadcast.js";
import { actorFromAuth, writeSystemLog } from "./systemLog.js";
import {
  getS3ConfigForAdmin,
  applyS3ConfigPatch,
  clearS3ConfigFromDb,
} from "./s3Settings.js";
import { uploadToS3 } from "./s3Upload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarDir = path.join(__dirname, "..", "uploads", "avatars");
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

/** Wrap an async Express handler so rejected promises reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Postgres unique-constraint violation (SQLSTATE 23505). */
function isUniqueViolation(e) {
  return e && (e.code === "23505" || String(e.message || "").toLowerCase().includes("unique"));
}

/** نام کاربری ورود به پنل مدیر — فقط حروف کوچک انگلیسی، اعداد و زیرخط */
const MANAGER_USERNAME_RE = /^[a-z0-9_]{3,32}$/;

async function makeExchangeOnboardingSlug(loginUsername) {
  const baseRaw = String(loginUsername || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = baseRaw || "exchange";
  let slug = `${base}-exchange`;
  let i = 2;
  while (await dbGet(`SELECT 1 FROM businesses WHERE slug = $1`, [slug])) {
    slug = `${base}-exchange-${i}`;
    i += 1;
  }
  return slug;
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
      const p = parseAuthHeader(req);
      const role = p?.typ === "adm" ? "adm" : p?.typ === "mgrx" ? "mgrx" : "mgr";
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${role}-${p?.sub || "u"}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || "")) {
      cb(new Error("bad_file_type"));
      return;
    }
    cb(null, true);
  },
});

async function attachLinkedBusinesses(managerRow, kind = "directory") {
  const managerColumn = kind === "exchange" ? "exchange_manager_id" : "manager_id";
  const categoryWhere =
    kind === "exchange"
      ? `AND COALESCE(TRIM(category), '') = 'صرافی'`
      : `AND COALESCE(TRIM(category), '') <> 'صرافی'`;
  const linked_businesses = await dbAll(
    `SELECT id, slug, name_fa, category, status, claimed, package, city
       FROM businesses
       WHERE ${managerColumn} = $1
       ${categoryWhere}
       ORDER BY CASE WHEN COALESCE(TRIM(category), '') = 'صرافی' THEN 0 ELSE 1 END, id DESC`,
    [managerRow.id]
  );
  return {
    ...stripManagerRow(managerRow),
    linked_businesses,
    manager_kind: kind,
    password_set: !!managerRow.password_hash,
    totp_enabled: !!managerRow.totp_enabled,
    twilio_auth_token_set: !!managerRow.twilio_auth_token,
    twilio_auth_token_masked:
      managerRow.twilio_auth_token && String(managerRow.twilio_auth_token).length > 4
        ? `••••${String(managerRow.twilio_auth_token).slice(-4)}`
        : managerRow.twilio_auth_token
        ? "••••"
        : null,
  };
}

export async function ensureSuperAdminFromEnv() {
  try {
    const n = (await dbGet(`SELECT COUNT(*)::int AS c FROM identity.super_admins`)).c;
    if (n > 0) return;
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;
    if (!email || !password) {
      console.warn(
        "[auth] هیچ سوپرادمینی در دیتابیس نیست. برای ساخت اولیه SUPER_ADMIN_EMAIL و SUPER_ADMIN_PASSWORD را در محیط تنظیم کنید."
      );
      return;
    }
    const hash = hashPassword(password);
    await dbRun(`INSERT INTO identity.super_admins (email, password_hash, name) VALUES ($1, $2, $3)`, [
      email,
      hash,
      "Super Admin",
    ]);
    console.log("[auth] اولین سوپرادمین از متغیرهای محیط ساخته شد.");
  } catch (e) {
    console.error("[auth] ensureSuperAdminFromEnv", e);
  }
}

export function registerAuthRoutes(app) {
  /** ثبت‌نام عمومی مدیر — نام کاربری + رمز + ایمیل */
  app.post("/api/auth/register/manager", asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};

    // Verify Cloudflare Turnstile captcha
    const captchaToken = b.captcha_token;
    if (captchaToken) {
      const captchaValid = await verifyTurnstileToken(captchaToken, clientIp(req));
      if (!captchaValid) {
        return res.status(400).json({ error: "captcha_failed", hint: "تأیید امنیتی ناموفق بود" });
      }
    }

    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    const name = String(b.name || "").trim();
    const phone = String(b.phone || "").trim();
    const login_username = String(b.login_username || b.username || "")
      .trim()
      .toLowerCase();
    const exchange_onboarding =
      b.exchange_onboarding === true ||
      b.exchange_onboarding === 1 ||
      String(b.exchange_onboarding || "").toLowerCase() === "true";
    const password = String(b.password || "").trim();
    if (!email || !name || !login_username || !password || !phone) {
      return res.status(400).json({
        error: "missing_fields",
        hint: "ایمیل، نام، تلفن، نام کاربری و رمز الزامی است",
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "invalid_email", hint: "ایمیل نامعتبر است" });
    }
    if (!MANAGER_USERNAME_RE.test(login_username)) {
      return res.status(400).json({
        error: "invalid_username",
        hint: "نام کاربری ۳ تا ۳۲ کاراکتر؛ فقط a-z، ۰-۹ و _",
      });
    }
    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.code || "weak_password", hint: pwCheck.hint });
    }
    const existingMgr =
      (await dbGet(`SELECT id FROM identity.managers WHERE email = $1`, [email])) ||
      (await dbGet(`SELECT id FROM identity.exchange_managers WHERE email = $1`, [email]));
    if (existingMgr) {
      const linkedBiz = await dbGet(
        `SELECT name_fa FROM businesses WHERE manager_id = $1 OR exchange_manager_id = $1`,
        [existingMgr.id]
      );
      const hint = linkedBiz
        ? `این ایمیل قبلاً برای آگهی «${linkedBiz.name_fa}» تأیید و ثبت شده است. برای ورود به پنل از صفحهٔ ورود استفاده کنید.`
        : "این ایمیل قبلاً ثبت شده. برای ورود از صفحهٔ ورود استفاده کنید.";
      return res.status(409).json({ error: "email_taken", hint });
    }
    if (
      (await dbGet(`SELECT id FROM identity.managers WHERE login_username = $1`, [login_username])) ||
      (await dbGet(`SELECT id FROM identity.exchange_managers WHERE login_username = $1`, [login_username]))
    ) {
      return res.status(409).json({ error: "username_taken", hint: "این نام کاربری گرفته شده" });
    }
    const ph = hashPassword(password);
    try {
      const table = exchange_onboarding ? "identity.exchange_managers" : "identity.managers";
      const info = await dbRun(
        `INSERT INTO ${table} (email, name, phone, password_hash, login_username) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [email, name, phone, ph, login_username]
      );
      const newManagerId = info.rows[0].id;
      if (exchange_onboarding) {
        const slug = await makeExchangeOnboardingSlug(login_username);
        const managerId = Number(newManagerId);
        await dbRun(
          `INSERT INTO businesses
            (slug, name_fa, category, phone, city, status, exchange_manager_id, package, listing_approval, listing_title, cta, price_range)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, 'basic', 'pending', $7, $8, $9)`,
          [slug, name, "صرافی", phone || null, "", managerId, `${name} | صرافی`, "تماس با ما", "—"]
        );
        writeSystemLog({
          level: "info",
          actorType: "system",
          action: "exchange_onboarding_business_created",
          targetType: "business",
          targetId: slug,
          message: `Exchange onboarding listing created for exchange manager #${managerId}`,
          meta: { exchange_manager_id: managerId, category: "صرافی" },
        });
      }
      writeSystemLog({
        level: "info",
        actorType: "system",
        action: "manager_self_registered",
        targetType: "manager",
        targetId: String(newManagerId),
        message: `Manager registered: ${email} (@${login_username})`,
      });
      res.status(201).json({ ok: true, id: newManagerId });
    } catch (e) {
      if (isUniqueViolation(e)) {
        return res.status(409).json({ error: "username_or_email_taken" });
      }
      throw e;
    }
  }));

  /** بررسی لینک تأیید ایمیل ثبت کسب‌وکار — فقط خواندنی */
  app.get("/api/business-signup/verify", asyncHandler(async (req, res) => {
    const token = String(req.query.token || "").trim();
    const business = await getBusinessBySignupToken(token);
    if (!business) {
      return res.status(400).json({ error: "invalid_or_expired_token" });
    }
    res.json({
      ok: true,
      name_fa: business.name_fa,
      listing_contact_email: business.listing_contact_email,
    });
  }));

  /** تکمیل ثبت کسب‌وکار — ساخت رمز و ساخت/اتصال خودکار حساب مدیر */
  app.post("/api/business-signup/complete", asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};

    const captchaToken = b.captcha_token;
    const captchaValid = await verifyTurnstileToken(captchaToken, clientIp(req));
    if (!captchaValid) {
      return res.status(400).json({ error: "captcha_failed", hint: "تأیید امنیتی ناموفق بود" });
    }

    const token = String(b.token || "").trim();
    const login_username = String(b.login_username || b.username || "")
      .trim()
      .toLowerCase();
    const password = String(b.password || "").trim();
    if (!token || !login_username || !password) {
      return res.status(400).json({ error: "missing_fields", hint: "نام کاربری و رمز الزامی است" });
    }
    if (!MANAGER_USERNAME_RE.test(login_username)) {
      return res.status(400).json({
        error: "invalid_username",
        hint: "نام کاربری ۳ تا ۳۲ کاراکتر؛ فقط a-z، ۰-۹ و _",
      });
    }
    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.code || "weak_password", hint: pwCheck.hint });
    }

    try {
      const result = await completeBusinessSignup({ token, login_username, password });
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      writeSystemLog({
        level: "info",
        actorType: "system",
        action: "business_signup_completed",
        targetType: "manager",
        targetId: String(result.managerId),
        message: `Manager auto-created & linked after email verification: ${result.email}`,
      });
      res.json({ ok: true, email: result.email });
    } catch (e) {
      if (isUniqueViolation(e)) {
        return res.status(409).json({ error: "username_or_email_taken" });
      }
      throw e;
    }
  }));

  app.post("/api/auth/login/manager", asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const identifier = String(b.email || b.login || "")
      .trim()
      .toLowerCase();
    const password = String(b.password || "");
    const totp = b.totp != null && b.totp !== "" ? String(b.totp).trim() : null;
    const captchaToken = b.captcha_token;

    if (!identifier || !password) {
      return res.status(400).json({ error: "missing_credentials" });
    }

    // Verify Cloudflare Turnstile captcha
    if (captchaToken) {
      const captchaValid = await verifyTurnstileToken(captchaToken, clientIp(req));
      if (!captchaValid) {
        return res.status(400).json({ error: "captcha_failed", hint: "تأیید امنیتی ناموفق بود." });
      }
    }

    if (!(await assertLoginNotBlocked(req, res))) return;

    const mDir = await dbGet(
      `SELECT * FROM identity.managers WHERE email = $1 OR login_username = $1`,
      [identifier]
    );
    const mEx = await dbGet(
      `SELECT * FROM identity.exchange_managers WHERE email = $1 OR login_username = $1`,
      [identifier]
    );
    const managerKind = mDir ? "directory" : mEx ? "exchange" : null;
    const m = mDir || mEx;
    if (!m || !m.password_hash) {
      await recordLoginFailure(req);
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (!verifyPassword(password, m.password_hash)) {
      await recordLoginFailure(req);
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (m.totp_enabled) {
      if (!totp || !m.totp_secret) {
        await recordLoginFailure(req);
        return res.status(401).json({ error: "totp_required", hint: "کد Google Authenticator را وارد کنید" });
      }
      if (!totpVerify(m.totp_secret, totp)) {
        await recordLoginFailure(req);
        return res.status(401).json({ error: "invalid_totp" });
      }
    }
    await recordLoginSuccess(req);
    const token = managerKind === "exchange" ? signExchangeManagerToken(m.id) : signManagerToken(m.id);
    res.json({
      token,
      user: await attachLinkedBusinesses(m, managerKind || "directory"),
      role: "manager",
      manager_kind: managerKind || "directory",
    });
  }));

  app.post("/api/auth/login/admin", asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    const password = String(b.password || "");
    const totp = b.totp != null && b.totp !== "" ? String(b.totp).trim() : null;
    const captchaToken = b.captcha_token;

    if (!email || !password) {
      return res.status(400).json({ error: "missing_credentials" });
    }

    // Verify Cloudflare Turnstile captcha
    if (captchaToken) {
      const captchaValid = await verifyTurnstileToken(captchaToken, clientIp(req));
      if (!captchaValid) {
        return res.status(400).json({ error: "captcha_failed", hint: "تأیید امنیتی ناموفق بود." });
      }
    }
    if (!(await assertLoginNotBlocked(req, res))) return;

    const a = await dbGet(`SELECT * FROM identity.super_admins WHERE email = $1`, [email]);
    if (!a) {
      await recordLoginFailure(req);
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (!verifyPassword(password, a.password_hash)) {
      await recordLoginFailure(req);
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (a.totp_enabled) {
      if (!totp || !a.totp_secret) {
        await recordLoginFailure(req);
        return res.status(401).json({ error: "totp_required" });
      }
      if (!totpVerify(a.totp_secret, totp)) {
        await recordLoginFailure(req);
        return res.status(401).json({ error: "invalid_totp" });
      }
    }
    await recordLoginSuccess(req);
    const token = signSuperAdminToken(a.id);
    void notifyTelegramSuperAdminLogin({
      email: a.email,
      ip: clientIp(req),
      userAgent: req.headers["user-agent"],
      adminId: a.id,
      loggedInWith2fa: !!a.totp_enabled,
    });
    res.json({
      token,
      user: stripSuperAdminRow(a),
      role: "superadmin",
    });
  }));

  /** فراموشی رمز — برای مدیر، مدیر صرافی و سوپرادمین (ایمیل‌محور) */
  app.post("/api/auth/forgot-password", asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const captchaToken = b.captcha_token;
    const captchaValid = await verifyTurnstileToken(captchaToken, clientIp(req));
    if (!captchaValid) {
      return res.status(400).json({ error: "captcha_failed", hint: "تأیید امنیتی ناموفق بود" });
    }
    await requestPasswordReset(b.email);
    res.json({ ok: true });
  }));

  app.post("/api/auth/reset-password", asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const password = String(b.password || "").trim();
    if (!b.token || !password) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const result = await resetPassword(b.token, password);
    if (result.error) {
      return res.status(400).json({ error: result.error, hint: result.hint });
    }
    res.json({ ok: true });
  }));

  /** Change own password (requires valid manager JWT) — clears must_change_password flag */
  app.patch("/api/auth/me/password", asyncHandler(async (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || (p.typ !== "mgr" && p.typ !== "mgrx")) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const newPassword = String(b.new_password || b.password || "").trim();
    const pwCheck = validatePasswordComplexity(newPassword);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.code || "weak_password", hint: pwCheck.hint });
    }
    const table = p.typ === "mgrx" ? "identity.exchange_managers" : "identity.managers";
    const hash = hashPassword(newPassword);
    await dbRun(`UPDATE ${table} SET password_hash = $1, must_change_password = 0 WHERE id = $2`, [hash, p.sub]);
    res.json({ ok: true });
  }));

  app.get("/api/auth/me", asyncHandler(async (req, res) => {
    const p = parseAuthHeader(req);
    if (!p) return res.status(401).json({ error: "unauthorized" });
    if (p.typ === "mgr") {
      const m = await dbGet(`SELECT * FROM identity.managers WHERE id = $1`, [p.sub]);
      if (!m) return res.status(401).json({ error: "invalid_token" });
      return res.json({
        role: "manager",
        user: await attachLinkedBusinesses(m, "directory"),
        manager_kind: "directory",
        totp_enabled: !!m.totp_enabled,
      });
    }
    if (p.typ === "mgrx") {
      const m = await dbGet(`SELECT * FROM identity.exchange_managers WHERE id = $1`, [p.sub]);
      if (!m) return res.status(401).json({ error: "invalid_token" });
      return res.json({
        role: "manager",
        user: await attachLinkedBusinesses(m, "exchange"),
        manager_kind: "exchange",
        totp_enabled: !!m.totp_enabled,
      });
    }
    if (p.typ === "adm") {
      const a = await dbGet(`SELECT * FROM identity.super_admins WHERE id = $1`, [p.sub]);
      if (!a) return res.status(401).json({ error: "invalid_token" });
      return res.json({
        role: "superadmin",
        user: stripSuperAdminRow(a),
        totp_enabled: !!a.totp_enabled,
        totp_setup_required: !!a.totp_setup_required,
      });
    }
    return res.status(401).json({ error: "unauthorized" });
  }));

  app.post("/api/auth/logout", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/auth/profile-avatar", (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || (p.typ !== "mgr" && p.typ !== "mgrx" && p.typ !== "adm")) {
      return res.status(401).json({ error: "unauthorized" });
    }
    avatarUpload.single("avatar")(req, res, (err) => {
      if (err) {
        if (String(err.message || "").includes("File too large")) {
          return res.status(400).json({ error: "file_too_large", hint: "حداکثر ۲ مگابایت" });
        }
        if (String(err.message || "").includes("bad_file_type")) {
          return res.status(400).json({ error: "bad_file_type", hint: "فقط تصویر png/jpg/webp/gif" });
        }
        return res.status(400).json({ error: "upload_failed" });
      }
      if (!req.file) return res.status(400).json({ error: "missing_file" });
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      (async () => {
        if (p.typ === "mgr") {
          await dbRun(`UPDATE identity.managers SET avatar_url = $1 WHERE id = $2`, [avatarUrl, p.sub]);
        } else if (p.typ === "mgrx") {
          await dbRun(`UPDATE identity.exchange_managers SET avatar_url = $1 WHERE id = $2`, [avatarUrl, p.sub]);
        } else {
          await dbRun(`UPDATE identity.super_admins SET avatar_url = $1 WHERE id = $2`, [avatarUrl, p.sub]);
        }
        writeSystemLog({
          ...actorFromAuth(p),
          action: "profile_avatar_uploaded",
          targetType: p.typ === "adm" ? "superadmin" : "manager",
          targetId: p.sub,
          message: "Profile avatar updated",
        });
        res.json({ ok: true, avatar_url: avatarUrl });
      })().catch((e) => {
        console.error("profile-avatar", e);
        res.status(500).json({ error: "server_error" });
      });
    });
  });

  /** شروع TOTP — ذخیرهٔ موقت secret تا تأیید با یک کد */
  app.post("/api/auth/manager/2fa/setup", asyncHandler(async (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || (p.typ !== "mgr" && p.typ !== "mgrx")) return res.status(401).json({ error: "unauthorized" });
    const sec = totpGenerateSecret();
    const table = p.typ === "mgrx" ? "identity.exchange_managers" : "identity.managers";
    await dbRun(`UPDATE ${table} SET totp_secret = $1, totp_enabled = 0 WHERE id = $2`, [sec.base32, p.sub]);
    res.json({
      secret: sec.base32,
      otpauth_url: sec.otpauth_url,
    });
  }));

  app.post("/api/auth/manager/2fa/enable", asyncHandler(async (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || (p.typ !== "mgr" && p.typ !== "mgrx")) return res.status(401).json({ error: "unauthorized" });
    const token = String((req.body && req.body.token) || "").trim();
    const table = p.typ === "mgrx" ? "identity.exchange_managers" : "identity.managers";
    const m = await dbGet(`SELECT * FROM ${table} WHERE id = $1`, [p.sub]);
    if (!m?.totp_secret) return res.status(400).json({ error: "setup_first" });
    if (!totpVerify(m.totp_secret, token)) {
      return res.status(400).json({ error: "invalid_totp" });
    }
    await dbRun(`UPDATE ${table} SET totp_enabled = 1 WHERE id = $1`, [p.sub]);
    writeSystemLog({
      ...actorFromAuth(p),
      action: "manager_2fa_enabled",
      targetType: "manager",
      targetId: p.sub,
      message: "Manager enabled 2FA",
    });
    res.json({ ok: true, totp_enabled: true });
  }));

  app.post("/api/auth/manager/2fa/disable", asyncHandler(async (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || (p.typ !== "mgr" && p.typ !== "mgrx")) return res.status(401).json({ error: "unauthorized" });
    const password = String((req.body && req.body.password) || "");
    const table = p.typ === "mgrx" ? "identity.exchange_managers" : "identity.managers";
    const m = await dbGet(`SELECT * FROM ${table} WHERE id = $1`, [p.sub]);
    if (!m || !verifyPassword(password, m.password_hash)) {
      return res.status(401).json({ error: "invalid_password" });
    }
    await dbRun(`UPDATE ${table} SET totp_secret = NULL, totp_enabled = 0 WHERE id = $1`, [p.sub]);
    writeSystemLog({
      ...actorFromAuth(p),
      action: "manager_2fa_disabled",
      targetType: "manager",
      targetId: p.sub,
      message: "Manager disabled 2FA",
    });
    res.json({ ok: true, totp_enabled: false });
  }));

  app.post("/api/auth/admin/2fa/setup", asyncHandler(async (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || p.typ !== "adm") return res.status(401).json({ error: "unauthorized" });
    const row = await dbGet(`SELECT email FROM identity.super_admins WHERE id = $1`, [p.sub]);
    const label = row?.email ? `Iraniu Admin (${row.email})` : "Iraniu Admin";
    const sec = totpGenerateSecret(label);
    await dbRun(`UPDATE identity.super_admins SET totp_secret = $1, totp_enabled = 0 WHERE id = $2`, [sec.base32, p.sub]);
    res.json({
      secret: sec.base32,
      otpauth_url: sec.otpauth_url,
    });
  }));

  app.post("/api/auth/admin/2fa/enable", asyncHandler(async (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || p.typ !== "adm") return res.status(401).json({ error: "unauthorized" });
    const token = String((req.body && req.body.token) || "").trim();
    const a = await dbGet(`SELECT * FROM identity.super_admins WHERE id = $1`, [p.sub]);
    if (!a?.totp_secret) return res.status(400).json({ error: "setup_first" });
    if (!totpVerify(a.totp_secret, token)) {
      return res.status(400).json({ error: "invalid_totp" });
    }
    await dbRun(`UPDATE identity.super_admins SET totp_enabled = 1, totp_setup_required = 0 WHERE id = $1`, [p.sub]);
    writeSystemLog({
      ...actorFromAuth(p),
      action: "admin_2fa_enabled",
      targetType: "superadmin",
      targetId: p.sub,
      message: "Super admin enabled 2FA",
    });
    res.json({ ok: true, totp_enabled: true });
  }));

  app.post("/api/auth/admin/2fa/disable", asyncHandler(async (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || p.typ !== "adm") return res.status(401).json({ error: "unauthorized" });
    const password = String((req.body && req.body.password) || "");
    const a = await dbGet(`SELECT * FROM identity.super_admins WHERE id = $1`, [p.sub]);
    if (!a || !verifyPassword(password, a.password_hash)) {
      return res.status(401).json({ error: "invalid_password" });
    }
    await dbRun(`UPDATE identity.super_admins SET totp_secret = NULL, totp_enabled = 0 WHERE id = $1`, [p.sub]);
    writeSystemLog({
      ...actorFromAuth(p),
      action: "admin_2fa_disabled",
      targetType: "superadmin",
      targetId: p.sub,
      message: "Super admin disabled 2FA",
    });
    res.json({ ok: true, totp_enabled: false });
  }));

  app.get("/api/admin/telegram-status", requireSuperAdmin, asyncHandler(async (_req, res) => {
    res.json(await getTelegramConfigForAdmin());
  }));

  app.get("/api/admin/telegram-config", requireSuperAdmin, asyncHandler(async (_req, res) => {
    res.json(await getTelegramConfigForAdmin());
  }));

  app.patch("/api/admin/telegram-config", requireSuperAdmin, asyncHandler(async (req, res) => {
    try {
      const next = await applyTelegramConfigPatch(req.body || {});
      writeSystemLog({
        ...actorFromAuth(req.auth),
        action: "admin_telegram_config_updated",
        targetType: "settings",
        targetId: "telegram",
        message: "Super admin updated telegram configuration",
      });
      res.json(next);
    } catch (e) {
      console.error("telegram-config patch", e);
      res.status(500).json({ error: "server_error" });
    }
  }));

  app.get("/api/admin/twilio-module", requireSuperAdmin, asyncHandler(async (_req, res) => {
    res.json(await getTwilioModuleForAdmin());
  }));

  app.patch("/api/admin/twilio-module", requireSuperAdmin, asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    if (!("enabled" in b)) {
      return res.status(400).json({ error: "missing_enabled", hint: "enabled: true|false" });
    }
    const enabled = b.enabled === true || b.enabled === 1 || b.enabled === "1" || b.enabled === "true";
    const next = await setTwilioModuleEnabled(enabled);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_twilio_module_toggled",
      targetType: "settings",
      targetId: "twilio_module",
      message: `Twilio module ${enabled ? "enabled" : "disabled"}`,
    });
    res.json(next);
  }));

  app.get("/api/admin/careers-module", requireSuperAdmin, asyncHandler(async (_req, res) => {
    const enabled = await isCareersModuleEnabled();
    res.json({ enabled });
  }));

  app.patch("/api/admin/careers-module", requireSuperAdmin, asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    if (!("enabled" in b)) {
      return res.status(400).json({ error: "missing_enabled", hint: "enabled: true|false" });
    }
    const enabled = b.enabled === true || b.enabled === 1 || b.enabled === "1" || b.enabled === "true";
    await setCareersModuleEnabled(enabled);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_careers_module_toggled",
      targetType: "settings",
      targetId: "careers_module",
      message: `Careers module ${enabled ? "enabled" : "disabled"}`,
    });
    res.json({ enabled });
  }));

  app.get("/api/admin/desktop-gate", requireSuperAdmin, asyncHandler(async (_req, res) => {
    res.json(await getDesktopGateForAdmin());
  }));

  app.patch("/api/admin/desktop-gate", requireSuperAdmin, asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    if (!("enabled" in b)) {
      return res.status(400).json({ error: "missing_enabled", hint: "enabled: true|false" });
    }
    const enabled = b.enabled === true || b.enabled === 1 || b.enabled === "1" || b.enabled === "true";
    const next = await setDesktopGateEnabled(enabled);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_desktop_gate_toggled",
      targetType: "settings",
      targetId: "desktop_gate",
      message: `Desktop gate (mobile-only mode) ${enabled ? "enabled" : "disabled"}`,
    });
    res.json(next);
  }));

  app.get("/api/admin/smtp-settings", requireSuperAdmin, asyncHandler(async (_req, res) => {
    res.json(await getSmtpSettingsForAdmin());
  }));

  app.patch("/api/admin/smtp-settings", requireSuperAdmin, asyncHandler(async (req, res) => {
    try {
      const next = await applySmtpSettingsPatch(req.body || {});
      writeSystemLog({
        ...actorFromAuth(req.auth),
        action: "admin_smtp_settings_updated",
        targetType: "settings",
        targetId: "smtp",
        message: "Super admin updated SMTP / email branding settings",
      });
      res.json(next);
    } catch (e) {
      console.error("smtp-settings patch", e);
      res.status(500).json({ error: "server_error" });
    }
  }));

  app.post("/api/admin/smtp-test", requireSuperAdmin, asyncHandler(async (req, res) => {
    const to = String((req.body && req.body.to) || "").trim().toLowerCase();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: "invalid_to", hint: "ایمیل گیرنده را وارد کنید" });
    }
    const html = await wrapBrandedEmail({
      headerIcon: "✉️",
      title: "SMTP connection test",
      subtitle: "Iraniu — system email",
      bodyHtml:
        "<p style=\"margin:0 0 12px;\">If you are reading this, mail delivery via Zoho / SMTP is working.</p><p style=\"margin:0;color:#6b5f75;font-size:0.88rem;\">Server time: " +
        escapeHtml(new Date().toISOString()) +
        "</p>",
    });
    const r = await sendMailViaSettings({
      to,
      subject: "SMTP test — Iraniu",
      html,
      text: "SMTP test completed successfully.",
    });
    if (r.skipped) {
      return res.status(400).json({
        error: r.reason || "smtp_not_configured",
        hint:
          r.reason === "smtp_not_configured"
            ? "میزبان، نام کاربری و رمز SMTP را ذخیره کنید یا SMTP_PASS در .env"
            : "ایمیل فرستنده یا گیرنده نامعتبر است",
      });
    }
    res.json({ ok: true });
  }));

  /** AWS S3 Configuration */
  app.get("/api/admin/s3-config", requireSuperAdmin, asyncHandler(async (_req, res) => {
    res.json(await getS3ConfigForAdmin());
  }));

  app.patch("/api/admin/s3-config", requireSuperAdmin, asyncHandler(async (req, res) => {
    try {
      const next = await applyS3ConfigPatch(req.body || {});
      writeSystemLog({
        ...actorFromAuth(req.auth),
        action: "admin_s3_config_updated",
        targetType: "settings",
        targetId: "s3",
        message: "Super admin updated S3 configuration",
      });
      res.json(next);
    } catch (e) {
      console.error("s3-config patch", e);
      res.status(500).json({ error: "server_error", hint: String(e.message || e) });
    }
  }));

  app.post("/api/admin/s3-config/clear", requireSuperAdmin, asyncHandler(async (req, res) => {
    try {
      const next = await clearS3ConfigFromDb();
      writeSystemLog({
        ...actorFromAuth(req.auth),
        action: "admin_s3_config_cleared",
        targetType: "settings",
        targetId: "s3",
        message: "Super admin cleared S3 config from database (reverted to .env)",
      });
      res.json(next);
    } catch (e) {
      console.error("s3-config clear", e);
      res.status(500).json({ error: "server_error", hint: String(e.message || e) });
    }
  }));

  app.post("/api/admin/s3-test", requireSuperAdmin, asyncHandler(async (req, res) => {
    try {
      const testKey = `test/connection-test-${Date.now()}.txt`;
      const testContent = Buffer.from(`S3 test from Iraniu at ${new Date().toISOString()}`);

      const result = await uploadToS3(testContent, testKey, "text/plain");

      // Try to delete the test file
      try {
        const { deleteFromS3 } = await import("./s3Upload.js");
        await deleteFromS3(testKey);
      } catch (deleteErr) {
        console.warn("S3 test cleanup failed:", deleteErr);
      }

      res.json({
        ok: true,
        message: "تست موفق بود! فایل آزمایشی آپلود و حذف شد.",
        test_url: result.url
      });
    } catch (e) {
      console.error("s3-test", e);
      const hint = String(e.message || e).includes("not configured")
        ? "لطفاً ابتدا تنظیمات AWS S3 را کامل کنید"
        : String(e.message || e).includes("Access Denied")
        ? "دسترسی رد شد. مجوزهای IAM را بررسی کنید"
        : String(e.message || e);
      res.status(400).json({
        ok: false,
        error: "s3_test_failed",
        hint
      });
    }
  }));

  app.post("/api/admin/email/broadcast", requireSuperAdmin, asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const subject = String(b.subject || "").trim();
    const body_html = String(b.body_html || "");
    const claimed_only =
      b.claimed_only === true || b.claimed_only === 1 || String(b.claimed_only || "").toLowerCase() === "true";
    if (!subject) return res.status(400).json({ error: "missing_subject" });
    if (!body_html.trim()) return res.status(400).json({ error: "missing_body_html" });
    const out = await sendBroadcastToBusinesses({ subject, body_html, claimed_only });
    if (out.error) {
      return res.status(400).json({ error: out.error });
    }
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_email_broadcast",
      targetType: "email",
      targetId: "broadcast",
      message: `Broadcast sent=${out.sent_count} failed=${out.failed_count} claimed_only=${claimed_only}`,
    });
    res.json(out);
  }));

  /** تلگرام: دکمهٔ Kick out — باید webhook با setWebhook ثبت شود */
  app.post("/api/telegram/webhook", asyncHandler(async (req, res) => {
    const secret = (await getEffectiveTelegramConfig()).webhookSecret;
    if (secret) {
      const got = req.headers["x-telegram-bot-api-secret-token"];
      if (got !== secret) {
        return res.status(401).json({ error: "unauthorized" });
      }
    } else {
      console.warn("[telegram] webhook called but TELEGRAM_WEBHOOK_SECRET is not set — ignoring");
      return res.status(503).json({ error: "webhook_not_configured" });
    }
    try {
      await processTelegramWebhook(req.body || {});
    } catch (e) {
      console.error("[telegram] webhook", e);
    }
    res.sendStatus(200);
  }));

  app.post("/api/admin/telegram-test", requireSuperAdmin, asyncHandler(async (_req, res) => {
    const r = await sendTelegramTestMessage();
    if (r.skipped) {
      return res.status(400).json({
        error: "telegram_not_configured",
        hint: "توکن ربات و شناسهٔ چت را در امنیت و تلگرام ذخیره کنید یا در .env بگذارید",
      });
    }
    if (!r.ok) {
      return res.status(502).json({
        error: "telegram_send_failed",
        hint: typeof r.error === "string" ? r.error : "پاسخ ناموفق از تلگرام — سرور را ببینید",
      });
    }
    res.json({ ok: true });
  }));

  /** سوپرادمین: تعیین/تغییر رمز مدیر */
  app.patch("/api/admin/managers/:id/password", requireSuperAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const password = String((req.body && req.body.password) || "").trim();
    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.code || "weak_password", hint: pwCheck.hint });
    }
    const m = await dbGet(`SELECT id FROM identity.managers WHERE id = $1`, [id]);
    if (!m) return res.status(404).json({ error: "not_found" });
    const hash = hashPassword(password);
    await dbRun(`UPDATE identity.managers SET password_hash = $1 WHERE id = $2`, [hash, id]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "manager_password_reset",
      targetType: "manager",
      targetId: id,
      message: `Manager password reset for manager #${id}`,
    });
    res.json({ ok: true });
  }));

  /** سوپرادمین: تعیین/تغییر رمز مدیر صرافی */
  app.patch("/api/admin/exchange-managers/:id/password", requireSuperAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const password = String((req.body && req.body.password) || "").trim();
    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.code || "weak_password", hint: pwCheck.hint });
    }
    const m = await dbGet(`SELECT id FROM identity.exchange_managers WHERE id = $1`, [id]);
    if (!m) return res.status(404).json({ error: "not_found" });
    const hash = hashPassword(password);
    await dbRun(`UPDATE identity.exchange_managers SET password_hash = $1 WHERE id = $2`, [hash, id]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "exchange_manager_password_reset",
      targetType: "exchange_manager",
      targetId: id,
      message: `Exchange manager password reset for exchange manager #${id}`,
    });
    res.json({ ok: true });
  }));

  /** سوپرادمین‌ها: فهرست، ایجاد، حذف (حذفِ خود یا آخرین حساب مجاز نیست) */
  app.get("/api/admin/super-admins", requireSuperAdmin, asyncHandler(async (_req, res) => {
    const rows = await dbAll(
      `SELECT id, email, name, totp_enabled, totp_setup_required, created_at, avatar_url
         FROM identity.super_admins ORDER BY id ASC`
    );
    res.json(rows);
  }));

  app.post("/api/admin/super-admins", requireSuperAdmin, asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    const password = String(b.password || "").trim();
    const name = String(b.name || "").trim() || "Super Admin";
    const totpSetupRequired =
      b.totp_setup_required === false || b.totp_setup_required === 0 || b.totp_setup_required === "0" ? 0 : 1;
    if (!email) {
      return res.status(400).json({ error: "missing_email" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "invalid_email" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "password_too_short", hint: "حداقل ۸ کاراکتر" });
    }
    if (await dbGet(`SELECT id FROM identity.super_admins WHERE email = $1`, [email])) {
      return res.status(409).json({ error: "email_taken" });
    }
    const hash = hashPassword(password);
    const ins = await dbRun(
      `INSERT INTO identity.super_admins (email, password_hash, name, totp_setup_required, totp_enabled)
         VALUES ($1, $2, $3, $4, 0) RETURNING id`,
      [email, hash, name, totpSetupRequired]
    );
    const row = await dbGet(
      `SELECT id, email, name, totp_enabled, totp_setup_required, created_at, avatar_url FROM identity.super_admins WHERE id = $1`,
      [ins.rows[0].id]
    );
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "super_admin_created",
      targetType: "superadmin",
      targetId: row.id,
      message: `Super admin created: ${email}`,
      meta: { totp_setup_required: totpSetupRequired },
    });
    res.status(201).json(row);
  }));

  app.delete("/api/admin/super-admins/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    if (id === Number(req.auth.sub)) {
      return res.status(400).json({ error: "cannot_delete_self", hint: "نمی‌توانید حساب خود را حذف کنید" });
    }
    const total = (await dbGet(`SELECT COUNT(*)::int AS c FROM identity.super_admins`)).c;
    if (total <= 1) {
      return res.status(400).json({ error: "last_admin", hint: "حداقل یک سوپرادمین باید بماند" });
    }
    const info = await dbRun(`DELETE FROM identity.super_admins WHERE id = $1`, [id]);
    if (info.rowCount === 0) return res.status(404).json({ error: "not_found" });
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "super_admin_deleted",
      targetType: "superadmin",
      targetId: id,
      message: `Super admin #${id} deleted`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/admin/managers/:id/twilio-settings", requireSuperAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const m = await dbGet(
      `SELECT id, twilio_account_sid, twilio_auth_token, twilio_phone_number
         FROM identity.managers WHERE id = $1`,
      [id]
    );
    if (!m) return res.status(404).json({ error: "not_found" });
    res.json({
      id: m.id,
      module_enabled: await isTwilioModuleEnabled(),
      twilio_account_sid: m.twilio_account_sid || "",
      twilio_phone_number: m.twilio_phone_number || "",
      twilio_auth_token_set: !!m.twilio_auth_token,
      twilio_auth_token_masked:
        m.twilio_auth_token && String(m.twilio_auth_token).length > 4
          ? `••••${String(m.twilio_auth_token).slice(-4)}`
          : m.twilio_auth_token
          ? "••••"
          : null,
    });
  }));

  app.patch("/api/admin/managers/:id/twilio-settings", requireSuperAdmin, asyncHandler(async (req, res) => {
    if (!(await isTwilioModuleEnabled())) {
      return res.status(403).json({ error: "twilio_module_disabled", hint: "Twilio module is off in super admin settings" });
    }
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const exists = await dbGet(`SELECT id FROM identity.managers WHERE id = $1`, [id]);
    if (!exists) return res.status(404).json({ error: "not_found" });
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const updates = {};
    if ("twilio_account_sid" in b) updates.twilio_account_sid = String(b.twilio_account_sid || "").trim() || null;
    if ("twilio_phone_number" in b) updates.twilio_phone_number = String(b.twilio_phone_number || "").trim() || null;
    if ("twilio_auth_token" in b) updates.twilio_auth_token = String(b.twilio_auth_token || "").trim() || null;
    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ error: "no_fields" });
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = keys.map((k) => updates[k]);
    await dbRun(`UPDATE identity.managers SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_manager_twilio_updated",
      targetType: "manager",
      targetId: id,
      message: `Super admin updated manager #${id} Twilio settings`,
      meta: { fields: keys.filter((k) => k !== "twilio_auth_token") },
    });
    const m = await dbGet(
      `SELECT id, twilio_account_sid, twilio_auth_token, twilio_phone_number FROM identity.managers WHERE id = $1`,
      [id]
    );
    res.json({
      id: m.id,
      twilio_account_sid: m.twilio_account_sid || "",
      twilio_phone_number: m.twilio_phone_number || "",
      twilio_auth_token_set: !!m.twilio_auth_token,
      twilio_auth_token_masked:
        m.twilio_auth_token && String(m.twilio_auth_token).length > 4
          ? `••••${String(m.twilio_auth_token).slice(-4)}`
          : m.twilio_auth_token
          ? "••••"
          : null,
    });
  }));

  /** یادداشت و کارهای داخلی سوپرادمین (در API عمومی نیست) */
  app.get("/api/admin/workspace-brief", requireSuperAdmin, asyncHandler(async (_req, res) => {
    const open_tasks_count = (await dbGet(`SELECT COUNT(*)::int AS c FROM admin_tasks WHERE done = 0`)).c;
    const recent_notes = (
      await dbAll(
        `SELECT id, body, updated_at FROM admin_internal_notes ORDER BY updated_at DESC, id DESC LIMIT 5`
      )
    ).map((row) => {
      const raw = String(row.body || "");
      const preview = raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
      return { id: row.id, updated_at: row.updated_at, preview };
    });
    res.json({ open_tasks_count, recent_notes });
  }));

  app.get("/api/admin/internal-notes", requireSuperAdmin, asyncHandler(async (_req, res) => {
    const rows = await dbAll(
      `SELECT id, body, created_at, updated_at FROM admin_internal_notes ORDER BY updated_at DESC, id DESC`
    );
    res.json(rows);
  }));

  app.post("/api/admin/internal-notes", requireSuperAdmin, asyncHandler(async (req, res) => {
    const body = String((req.body && req.body.body) || "").trim();
    if (!body) return res.status(400).json({ error: "missing_body" });
    const ins = await dbRun(`INSERT INTO admin_internal_notes (body) VALUES ($1) RETURNING id`, [body]);
    const r = await dbGet(
      `SELECT id, body, created_at, updated_at FROM admin_internal_notes WHERE id = $1`,
      [ins.rows[0].id]
    );
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_internal_note_created",
      targetType: "admin_note",
      targetId: String(r.id),
      message: "Internal note created",
    });
    res.status(201).json(r);
  }));

  app.patch("/api/admin/internal-notes/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const body = String((req.body && req.body.body) || "").trim();
    if (!body) return res.status(400).json({ error: "missing_body" });
    const info = await dbRun(`UPDATE admin_internal_notes SET body = $1, updated_at = NOW()::TEXT WHERE id = $2`, [body, id]);
    if (info.rowCount === 0) return res.status(404).json({ error: "not_found" });
    const row = await dbGet(`SELECT id, body, created_at, updated_at FROM admin_internal_notes WHERE id = $1`, [id]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_internal_note_updated",
      targetType: "admin_note",
      targetId: String(id),
      message: "Internal note updated",
    });
    res.json(row);
  }));

  app.delete("/api/admin/internal-notes/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const info = await dbRun(`DELETE FROM admin_internal_notes WHERE id = $1`, [id]);
    if (info.rowCount === 0) return res.status(404).json({ error: "not_found" });
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_internal_note_deleted",
      targetType: "admin_note",
      targetId: String(id),
      message: "Internal note deleted",
    });
    res.json({ ok: true });
  }));

  app.get("/api/admin/tasks", requireSuperAdmin, asyncHandler(async (_req, res) => {
    const rows = await dbAll(
      `SELECT id, title, body, done, sort_order, due_at, created_at, updated_at
         FROM admin_tasks
         ORDER BY done ASC, sort_order DESC, id DESC`
    );
    res.json(rows);
  }));

  app.post("/api/admin/tasks", requireSuperAdmin, asyncHandler(async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const title = String(b.title || "").trim();
    if (!title) return res.status(400).json({ error: "missing_title" });
    const bodyText = String(b.body || "").trim() || null;
    const dueRaw = b.due_at != null && b.due_at !== "" ? String(b.due_at).trim() : null;
    const maxRow = await dbGet(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM admin_tasks`);
    const sort_order = Number(maxRow.m) + 1;
    const ins = await dbRun(
      `INSERT INTO admin_tasks (title, body, due_at, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
      [title, bodyText, dueRaw, sort_order]
    );
    const r = await dbGet(`SELECT * FROM admin_tasks WHERE id = $1`, [ins.rows[0].id]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_task_created",
      targetType: "admin_task",
      targetId: String(r.id),
      message: "Internal task created",
    });
    res.status(201).json(r);
  }));

  app.patch("/api/admin/tasks/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const updates = {};
    if ("title" in b) updates.title = String(b.title || "").trim() || null;
    if ("body" in b) updates.body = String(b.body || "").trim() || null;
    if ("done" in b) updates.done = b.done === true || b.done === 1 || b.done === "1" ? 1 : 0;
    if ("due_at" in b) {
      const d = b.due_at;
      updates.due_at = d == null || d === "" ? null : String(d).trim();
    }
    if ("sort_order" in b) {
      const n = parseInt(String(b.sort_order), 10);
      if (Number.isFinite(n)) updates.sort_order = n;
    }
    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ error: "no_fields" });
    if (updates.title === null) return res.status(400).json({ error: "invalid_title" });
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = keys.map((k) => updates[k]);
    const info = await dbRun(
      `UPDATE admin_tasks SET ${setClause}, updated_at = NOW()::TEXT WHERE id = $${keys.length + 1}`,
      [...values, id]
    );
    if (info.rowCount === 0) return res.status(404).json({ error: "not_found" });
    const row = await dbGet(`SELECT * FROM admin_tasks WHERE id = $1`, [id]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_task_updated",
      targetType: "admin_task",
      targetId: String(id),
      message: "Internal task updated",
      meta: { fields: keys },
    });
    res.json(row);
  }));

  app.delete("/api/admin/tasks/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const info = await dbRun(`DELETE FROM admin_tasks WHERE id = $1`, [id]);
    if (info.rowCount === 0) return res.status(404).json({ error: "not_found" });
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_task_deleted",
      targetType: "admin_task",
      targetId: String(id),
      message: "Internal task deleted",
    });
    res.json({ ok: true });
  }));
}
