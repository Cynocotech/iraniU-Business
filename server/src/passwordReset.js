import crypto from "crypto";
import { dbGet, dbRun } from "./db.js";
import { hashPassword, validatePasswordComplexity } from "./authUtil.js";
import { getEffectiveSmtpSettings, sendMailViaSettings } from "./smtpSettings.js";
import { htmlPasswordResetBranded } from "./emailBranding.js";

const TOKEN_TTL_MS = 60 * 60 * 1000;

const ACCOUNT_TABLES = {
  manager: "identity.managers",
  exchange_manager: "identity.exchange_managers",
  superadmin: "identity.super_admins",
};

async function siteBase() {
  return (
    (await getEffectiveSmtpSettings()).siteUrl ||
    String(process.env.PUBLIC_SITE_URL || process.env.SITE_BASE_URL || "").replace(/\/$/, "")
  );
}

async function findAccountByEmail(email) {
  const manager = await dbGet(`SELECT id, email, name FROM identity.managers WHERE email = $1`, [email]);
  if (manager) return { account_type: "manager", ...manager };
  const exchangeManager = await dbGet(`SELECT id, email, name FROM identity.exchange_managers WHERE email = $1`, [email]);
  if (exchangeManager) return { account_type: "exchange_manager", ...exchangeManager };
  const admin = await dbGet(`SELECT id, email, name FROM identity.super_admins WHERE email = $1`, [email]);
  if (admin) return { account_type: "superadmin", ...admin };
  return null;
}

/** همیشه نتیجهٔ یکسان برمی‌گرداند — جلوگیری از کشف ایمیل‌های موجود */
export async function requestPasswordReset(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return { ok: true };
  const account = await findAccountByEmail(normalized);
  if (!account) return { ok: true };

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  await dbRun(
    `INSERT INTO identity.password_resets (account_type, account_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
    [account.account_type, account.id, token, expiresAt]
  );

  const base = await siteBase();
  const resetUrl = base ? `${base}/reset-password?token=${token}` : `/reset-password?token=${token}`;
  const html = await htmlPasswordResetBranded({ name: account.name, resetUrl });
  await sendMailViaSettings({
    to: account.email,
    subject: "Reset your password",
    html,
    text: `Reset your password:\n${resetUrl}`,
  });
  return { ok: true };
}

export async function resetPassword(token, newPassword) {
  const t = String(token || "").trim();
  if (!t) return { error: "invalid_or_expired_token" };

  const reset = await dbGet(`SELECT * FROM identity.password_resets WHERE token = $1`, [t]);
  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
    return { error: "invalid_or_expired_token" };
  }

  const pwCheck = validatePasswordComplexity(newPassword);
  if (!pwCheck.ok) return { error: pwCheck.code || "weak_password", hint: pwCheck.hint };

  const table = ACCOUNT_TABLES[reset.account_type];
  if (!table) return { error: "invalid_or_expired_token" };

  const passwordHash = hashPassword(newPassword);
  await dbRun(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [passwordHash, reset.account_id]);
  await dbRun(`UPDATE identity.password_resets SET used_at = NOW()::TEXT WHERE id = $1`, [reset.id]);

  return { ok: true };
}
