import { db } from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import {
  hashPassword,
  verifyPassword,
  signManagerToken,
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
import { actorFromAuth, writeSystemLog } from "./systemLog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarDir = path.join(__dirname, "..", "uploads", "avatars");
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
      const p = parseAuthHeader(req);
      const role = p?.typ === "adm" ? "adm" : "mgr";
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

function attachLinkedBusinesses(managerRow) {
  const linked_businesses = db
    .prepare(
      `SELECT slug, name_fa, status, claimed, package, city FROM businesses WHERE manager_id = ? ORDER BY name_fa`
    )
    .all(managerRow.id);
  return {
    ...stripManagerRow(managerRow),
    linked_businesses,
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

export function ensureSuperAdminFromEnv() {
  try {
    const n = db.prepare(`SELECT COUNT(*) AS c FROM super_admins`).get().c;
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
    db.prepare(`INSERT INTO super_admins (email, password_hash, name) VALUES (?, ?, ?)`).run(
      email,
      hash,
      "Super Admin"
    );
    console.log("[auth] اولین سوپرادمین از متغیرهای محیط ساخته شد.");
  } catch (e) {
    console.error("[auth] ensureSuperAdminFromEnv", e);
  }
}

export function registerAuthRoutes(app) {
  app.post("/api/auth/login/manager", (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    const password = String(b.password || "");
    const totp = b.totp != null && b.totp !== "" ? String(b.totp).trim() : null;
    if (!email || !password) {
      return res.status(400).json({ error: "missing_credentials" });
    }
    if (!assertLoginNotBlocked(req, res)) return;

    const m = db.prepare(`SELECT * FROM managers WHERE email = ?`).get(email);
    if (!m || !m.password_hash) {
      recordLoginFailure(req);
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (!verifyPassword(password, m.password_hash)) {
      recordLoginFailure(req);
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (m.totp_enabled) {
      if (!totp || !m.totp_secret) {
        recordLoginFailure(req);
        return res.status(401).json({ error: "totp_required", hint: "کد Google Authenticator را وارد کنید" });
      }
      if (!totpVerify(m.totp_secret, totp)) {
        recordLoginFailure(req);
        return res.status(401).json({ error: "invalid_totp" });
      }
    }
    recordLoginSuccess(req);
    const token = signManagerToken(m.id);
    res.json({
      token,
      user: attachLinkedBusinesses(m),
      role: "manager",
    });
  });

  app.post("/api/auth/login/admin", (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    const password = String(b.password || "");
    const totp = b.totp != null && b.totp !== "" ? String(b.totp).trim() : null;
    if (!email || !password) {
      return res.status(400).json({ error: "missing_credentials" });
    }
    if (!assertLoginNotBlocked(req, res)) return;

    const a = db.prepare(`SELECT * FROM super_admins WHERE email = ?`).get(email);
    if (!a) {
      recordLoginFailure(req);
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (!verifyPassword(password, a.password_hash)) {
      recordLoginFailure(req);
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (a.totp_enabled) {
      if (!totp || !a.totp_secret) {
        recordLoginFailure(req);
        return res.status(401).json({ error: "totp_required" });
      }
      if (!totpVerify(a.totp_secret, totp)) {
        recordLoginFailure(req);
        return res.status(401).json({ error: "invalid_totp" });
      }
    }
    recordLoginSuccess(req);
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
  });

  app.get("/api/auth/me", (req, res) => {
    const p = parseAuthHeader(req);
    if (!p) return res.status(401).json({ error: "unauthorized" });
    if (p.typ === "mgr") {
      const m = db.prepare(`SELECT * FROM managers WHERE id = ?`).get(p.sub);
      if (!m) return res.status(401).json({ error: "invalid_token" });
      return res.json({
        role: "manager",
        user: attachLinkedBusinesses(m),
        totp_enabled: !!m.totp_enabled,
      });
    }
    if (p.typ === "adm") {
      const a = db.prepare(`SELECT * FROM super_admins WHERE id = ?`).get(p.sub);
      if (!a) return res.status(401).json({ error: "invalid_token" });
      return res.json({
        role: "superadmin",
        user: stripSuperAdminRow(a),
        totp_enabled: !!a.totp_enabled,
        totp_setup_required: !!a.totp_setup_required,
      });
    }
    return res.status(401).json({ error: "unauthorized" });
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/auth/profile-avatar", (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || (p.typ !== "mgr" && p.typ !== "adm")) {
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
      if (p.typ === "mgr") {
        db.prepare(`UPDATE managers SET avatar_url = ? WHERE id = ?`).run(avatarUrl, p.sub);
      } else {
        db.prepare(`UPDATE super_admins SET avatar_url = ? WHERE id = ?`).run(avatarUrl, p.sub);
      }
      writeSystemLog({
        ...actorFromAuth(p),
        action: "profile_avatar_uploaded",
        targetType: p.typ === "adm" ? "superadmin" : "manager",
        targetId: p.sub,
        message: "Profile avatar updated",
      });
      res.json({ ok: true, avatar_url: avatarUrl });
    });
  });

  /** شروع TOTP — ذخیرهٔ موقت secret تا تأیید با یک کد */
  app.post("/api/auth/manager/2fa/setup", (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || p.typ !== "mgr") return res.status(401).json({ error: "unauthorized" });
    const sec = totpGenerateSecret();
    db.prepare(`UPDATE managers SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`).run(sec.base32, p.sub);
    res.json({
      secret: sec.base32,
      otpauth_url: sec.otpauth_url,
    });
  });

  app.post("/api/auth/manager/2fa/enable", (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || p.typ !== "mgr") return res.status(401).json({ error: "unauthorized" });
    const token = String((req.body && req.body.token) || "").trim();
    const m = db.prepare(`SELECT * FROM managers WHERE id = ?`).get(p.sub);
    if (!m?.totp_secret) return res.status(400).json({ error: "setup_first" });
    if (!totpVerify(m.totp_secret, token)) {
      return res.status(400).json({ error: "invalid_totp" });
    }
    db.prepare(`UPDATE managers SET totp_enabled = 1 WHERE id = ?`).run(p.sub);
    writeSystemLog({
      ...actorFromAuth(p),
      action: "manager_2fa_enabled",
      targetType: "manager",
      targetId: p.sub,
      message: "Manager enabled 2FA",
    });
    res.json({ ok: true, totp_enabled: true });
  });

  app.post("/api/auth/manager/2fa/disable", (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || p.typ !== "mgr") return res.status(401).json({ error: "unauthorized" });
    const password = String((req.body && req.body.password) || "");
    const m = db.prepare(`SELECT * FROM managers WHERE id = ?`).get(p.sub);
    if (!m || !verifyPassword(password, m.password_hash)) {
      return res.status(401).json({ error: "invalid_password" });
    }
    db.prepare(`UPDATE managers SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?`).run(p.sub);
    writeSystemLog({
      ...actorFromAuth(p),
      action: "manager_2fa_disabled",
      targetType: "manager",
      targetId: p.sub,
      message: "Manager disabled 2FA",
    });
    res.json({ ok: true, totp_enabled: false });
  });

  app.post("/api/auth/admin/2fa/setup", (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || p.typ !== "adm") return res.status(401).json({ error: "unauthorized" });
    const row = db.prepare(`SELECT email FROM super_admins WHERE id = ?`).get(p.sub);
    const label = row?.email ? `Iraniu Admin (${row.email})` : "Iraniu Admin";
    const sec = totpGenerateSecret(label);
    db.prepare(`UPDATE super_admins SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`).run(sec.base32, p.sub);
    res.json({
      secret: sec.base32,
      otpauth_url: sec.otpauth_url,
    });
  });

  app.post("/api/auth/admin/2fa/enable", (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || p.typ !== "adm") return res.status(401).json({ error: "unauthorized" });
    const token = String((req.body && req.body.token) || "").trim();
    const a = db.prepare(`SELECT * FROM super_admins WHERE id = ?`).get(p.sub);
    if (!a?.totp_secret) return res.status(400).json({ error: "setup_first" });
    if (!totpVerify(a.totp_secret, token)) {
      return res.status(400).json({ error: "invalid_totp" });
    }
    db.prepare(`UPDATE super_admins SET totp_enabled = 1, totp_setup_required = 0 WHERE id = ?`).run(p.sub);
    writeSystemLog({
      ...actorFromAuth(p),
      action: "admin_2fa_enabled",
      targetType: "superadmin",
      targetId: p.sub,
      message: "Super admin enabled 2FA",
    });
    res.json({ ok: true, totp_enabled: true });
  });

  app.post("/api/auth/admin/2fa/disable", (req, res) => {
    const p = parseAuthHeader(req);
    if (!p || p.typ !== "adm") return res.status(401).json({ error: "unauthorized" });
    const password = String((req.body && req.body.password) || "");
    const a = db.prepare(`SELECT * FROM super_admins WHERE id = ?`).get(p.sub);
    if (!a || !verifyPassword(password, a.password_hash)) {
      return res.status(401).json({ error: "invalid_password" });
    }
    db.prepare(`UPDATE super_admins SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?`).run(p.sub);
    writeSystemLog({
      ...actorFromAuth(p),
      action: "admin_2fa_disabled",
      targetType: "superadmin",
      targetId: p.sub,
      message: "Super admin disabled 2FA",
    });
    res.json({ ok: true, totp_enabled: false });
  });

  app.get("/api/admin/telegram-status", requireSuperAdmin, (_req, res) => {
    res.json(getTelegramConfigForAdmin());
  });

  app.get("/api/admin/telegram-config", requireSuperAdmin, (_req, res) => {
    res.json(getTelegramConfigForAdmin());
  });

  app.patch("/api/admin/telegram-config", requireSuperAdmin, (req, res) => {
    try {
      const next = applyTelegramConfigPatch(req.body || {});
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
  });

  app.get("/api/admin/twilio-module", requireSuperAdmin, (_req, res) => {
    res.json(getTwilioModuleForAdmin());
  });

  app.patch("/api/admin/twilio-module", requireSuperAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    if (!("enabled" in b)) {
      return res.status(400).json({ error: "missing_enabled", hint: "enabled: true|false" });
    }
    const enabled = b.enabled === true || b.enabled === 1 || b.enabled === "1" || b.enabled === "true";
    const next = setTwilioModuleEnabled(enabled);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_twilio_module_toggled",
      targetType: "settings",
      targetId: "twilio_module",
      message: `Twilio module ${enabled ? "enabled" : "disabled"}`,
    });
    res.json(next);
  });

  /** تلگرام: دکمهٔ Kick out — باید webhook با setWebhook ثبت شود */
  app.post("/api/telegram/webhook", async (req, res) => {
    const secret = getEffectiveTelegramConfig().webhookSecret;
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
  });

  app.post("/api/admin/telegram-test", requireSuperAdmin, async (_req, res) => {
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
  });

  /** سوپرادمین: تعیین/تغییر رمز مدیر */
  app.patch("/api/admin/managers/:id/password", requireSuperAdmin, (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const password = String((req.body && req.body.password) || "").trim();
    if (password.length < 8) {
      return res.status(400).json({ error: "password_too_short", hint: "حداقل ۸ کاراکتر" });
    }
    const m = db.prepare(`SELECT id FROM managers WHERE id = ?`).get(id);
    if (!m) return res.status(404).json({ error: "not_found" });
    const hash = hashPassword(password);
    db.prepare(`UPDATE managers SET password_hash = ? WHERE id = ?`).run(hash, id);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "manager_password_reset",
      targetType: "manager",
      targetId: id,
      message: `Manager password reset for manager #${id}`,
    });
    res.json({ ok: true });
  });

  /** سوپرادمین‌ها: فهرست، ایجاد، حذف (حذفِ خود یا آخرین حساب مجاز نیست) */
  app.get("/api/admin/super-admins", requireSuperAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT id, email, name, totp_enabled, totp_setup_required, created_at, avatar_url
         FROM super_admins ORDER BY id ASC`
      )
      .all();
    res.json(rows);
  });

  app.post("/api/admin/super-admins", requireSuperAdmin, (req, res) => {
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
    if (db.prepare(`SELECT id FROM super_admins WHERE email = ?`).get(email)) {
      return res.status(409).json({ error: "email_taken" });
    }
    const hash = hashPassword(password);
    const ins = db
      .prepare(
        `INSERT INTO super_admins (email, password_hash, name, totp_setup_required, totp_enabled)
         VALUES (?, ?, ?, ?, 0)`
      )
      .run(email, hash, name, totpSetupRequired);
    const row = db
      .prepare(
        `SELECT id, email, name, totp_enabled, totp_setup_required, created_at, avatar_url FROM super_admins WHERE id = ?`
      )
      .get(ins.lastInsertRowid);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "super_admin_created",
      targetType: "superadmin",
      targetId: row.id,
      message: `Super admin created: ${email}`,
      meta: { totp_setup_required: totpSetupRequired },
    });
    res.status(201).json(row);
  });

  app.delete("/api/admin/super-admins/:id", requireSuperAdmin, (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    if (id === Number(req.auth.sub)) {
      return res.status(400).json({ error: "cannot_delete_self", hint: "نمی‌توانید حساب خود را حذف کنید" });
    }
    const total = db.prepare(`SELECT COUNT(*) AS c FROM super_admins`).get().c;
    if (total <= 1) {
      return res.status(400).json({ error: "last_admin", hint: "حداقل یک سوپرادمین باید بماند" });
    }
    const info = db.prepare(`DELETE FROM super_admins WHERE id = ?`).run(id);
    if (info.changes === 0) return res.status(404).json({ error: "not_found" });
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "super_admin_deleted",
      targetType: "superadmin",
      targetId: id,
      message: `Super admin #${id} deleted`,
    });
    res.json({ ok: true });
  });

  app.get("/api/admin/managers/:id/twilio-settings", requireSuperAdmin, (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const m = db
      .prepare(
        `SELECT id, twilio_account_sid, twilio_auth_token, twilio_phone_number
         FROM managers WHERE id = ?`
      )
      .get(id);
    if (!m) return res.status(404).json({ error: "not_found" });
    res.json({
      id: m.id,
      module_enabled: isTwilioModuleEnabled(),
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
  });

  app.patch("/api/admin/managers/:id/twilio-settings", requireSuperAdmin, (req, res) => {
    if (!isTwilioModuleEnabled()) {
      return res.status(403).json({ error: "twilio_module_disabled", hint: "Twilio module is off in super admin settings" });
    }
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const exists = db.prepare(`SELECT id FROM managers WHERE id = ?`).get(id);
    if (!exists) return res.status(404).json({ error: "not_found" });
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const updates = {};
    if ("twilio_account_sid" in b) updates.twilio_account_sid = String(b.twilio_account_sid || "").trim() || null;
    if ("twilio_phone_number" in b) updates.twilio_phone_number = String(b.twilio_phone_number || "").trim() || null;
    if ("twilio_auth_token" in b) updates.twilio_auth_token = String(b.twilio_auth_token || "").trim() || null;
    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ error: "no_fields" });
    const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
    db.prepare(`UPDATE managers SET ${setClause} WHERE id = @id`).run({ ...updates, id });
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_manager_twilio_updated",
      targetType: "manager",
      targetId: id,
      message: `Super admin updated manager #${id} Twilio settings`,
      meta: { fields: keys.filter((k) => k !== "twilio_auth_token") },
    });
    const m = db
      .prepare(`SELECT id, twilio_account_sid, twilio_auth_token, twilio_phone_number FROM managers WHERE id = ?`)
      .get(id);
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
  });

  /** یادداشت و کارهای داخلی سوپرادمین (در API عمومی نیست) */
  app.get("/api/admin/workspace-brief", requireSuperAdmin, (_req, res) => {
    const open_tasks_count = db.prepare(`SELECT COUNT(*) AS c FROM admin_tasks WHERE done = 0`).get().c;
    const recent_notes = db
      .prepare(
        `SELECT id, body, updated_at FROM admin_internal_notes ORDER BY datetime(updated_at) DESC, id DESC LIMIT 5`
      )
      .all()
      .map((row) => {
        const raw = String(row.body || "");
        const preview = raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
        return { id: row.id, updated_at: row.updated_at, preview };
      });
    res.json({ open_tasks_count, recent_notes });
  });

  app.get("/api/admin/internal-notes", requireSuperAdmin, (_req, res) => {
    const rows = db
      .prepare(`SELECT id, body, created_at, updated_at FROM admin_internal_notes ORDER BY datetime(updated_at) DESC, id DESC`)
      .all();
    res.json(rows);
  });

  app.post("/api/admin/internal-notes", requireSuperAdmin, (req, res) => {
    const body = String((req.body && req.body.body) || "").trim();
    if (!body) return res.status(400).json({ error: "missing_body" });
    const ins = db.prepare(`INSERT INTO admin_internal_notes (body) VALUES (?)`).run(body);
    const r = db.prepare(`SELECT id, body, created_at, updated_at FROM admin_internal_notes WHERE id = ?`).get(ins.lastInsertRowid);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_internal_note_created",
      targetType: "admin_note",
      targetId: String(r.id),
      message: "Internal note created",
    });
    res.status(201).json(r);
  });

  app.patch("/api/admin/internal-notes/:id", requireSuperAdmin, (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const body = String((req.body && req.body.body) || "").trim();
    if (!body) return res.status(400).json({ error: "missing_body" });
    const info = db.prepare(`UPDATE admin_internal_notes SET body = ?, updated_at = datetime('now') WHERE id = ?`).run(body, id);
    if (info.changes === 0) return res.status(404).json({ error: "not_found" });
    const row = db.prepare(`SELECT id, body, created_at, updated_at FROM admin_internal_notes WHERE id = ?`).get(id);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_internal_note_updated",
      targetType: "admin_note",
      targetId: String(id),
      message: "Internal note updated",
    });
    res.json(row);
  });

  app.delete("/api/admin/internal-notes/:id", requireSuperAdmin, (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const info = db.prepare(`DELETE FROM admin_internal_notes WHERE id = ?`).run(id);
    if (info.changes === 0) return res.status(404).json({ error: "not_found" });
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_internal_note_deleted",
      targetType: "admin_note",
      targetId: String(id),
      message: "Internal note deleted",
    });
    res.json({ ok: true });
  });

  app.get("/api/admin/tasks", requireSuperAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT id, title, body, done, sort_order, due_at, created_at, updated_at
         FROM admin_tasks
         ORDER BY done ASC, sort_order DESC, id DESC`
      )
      .all();
    res.json(rows);
  });

  app.post("/api/admin/tasks", requireSuperAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const title = String(b.title || "").trim();
    if (!title) return res.status(400).json({ error: "missing_title" });
    const bodyText = String(b.body || "").trim() || null;
    const dueRaw = b.due_at != null && b.due_at !== "" ? String(b.due_at).trim() : null;
    const maxRow = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM admin_tasks`).get();
    const sort_order = Number(maxRow.m) + 1;
    const ins = db
      .prepare(`INSERT INTO admin_tasks (title, body, due_at, sort_order) VALUES (?, ?, ?, ?)`)
      .run(title, bodyText, dueRaw, sort_order);
    const r = db.prepare(`SELECT * FROM admin_tasks WHERE id = ?`).get(ins.lastInsertRowid);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_task_created",
      targetType: "admin_task",
      targetId: String(r.id),
      message: "Internal task created",
    });
    res.status(201).json(r);
  });

  app.patch("/api/admin/tasks/:id", requireSuperAdmin, (req, res) => {
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
    const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
    const info = db
      .prepare(`UPDATE admin_tasks SET ${setClause}, updated_at = datetime('now') WHERE id = @id`)
      .run({ ...updates, id });
    if (info.changes === 0) return res.status(404).json({ error: "not_found" });
    const row = db.prepare(`SELECT * FROM admin_tasks WHERE id = ?`).get(id);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_task_updated",
      targetType: "admin_task",
      targetId: String(id),
      message: "Internal task updated",
      meta: { fields: keys },
    });
    res.json(row);
  });

  app.delete("/api/admin/tasks/:id", requireSuperAdmin, (req, res) => {
    const id = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
    const info = db.prepare(`DELETE FROM admin_tasks WHERE id = ?`).run(id);
    if (info.changes === 0) return res.status(404).json({ error: "not_found" });
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "admin_task_deleted",
      targetType: "admin_task",
      targetId: String(id),
      message: "Internal task deleted",
    });
    res.json({ ok: true });
  });
}
