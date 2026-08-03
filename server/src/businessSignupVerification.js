import crypto from "crypto";
import { dbGet, dbRun } from "./db.js";
import { hashPassword } from "./authUtil.js";
import { getEffectiveSmtpSettings, sendMailViaSettings } from "./smtpSettings.js";
import { htmlVerifyBusinessSignupBranded } from "./emailBranding.js";

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

async function siteBase() {
  return (
    (await getEffectiveSmtpSettings()).siteUrl ||
    String(process.env.PUBLIC_SITE_URL || process.env.SITE_BASE_URL || "").replace(/\/$/, "")
  );
}

export async function createSignupVerification(businessRow) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  await dbRun(
    `UPDATE businesses SET signup_verify_token = $1, signup_verify_expires_at = $2 WHERE slug = $3`,
    [token, expiresAt, businessRow.slug]
  );
  const base = await siteBase();
  const verifyUrl = base ? `${base}/verify-business-email?token=${token}` : `/verify-business-email?token=${token}`;
  const html = await htmlVerifyBusinessSignupBranded({ nameFa: businessRow.name_fa, verifyUrl });
  return sendMailViaSettings({
    to: businessRow.listing_contact_email,
    subject: `Confirm your email — ${businessRow.name_fa || businessRow.slug}`,
    html,
    text: `Confirm your email to set up your manager login for "${businessRow.name_fa || businessRow.slug}".\n${verifyUrl}`,
  });
}

export async function getBusinessBySignupToken(token) {
  const t = String(token || "").trim();
  if (!t) return null;
  const row = await dbGet(`SELECT * FROM businesses WHERE signup_verify_token = $1`, [t]);
  if (!row) return null;
  if (row.signup_email_verified_at) return null;
  if (!row.signup_verify_expires_at || new Date(row.signup_verify_expires_at).getTime() < Date.now()) return null;
  return row;
}

export async function completeBusinessSignup({ token, login_username, password }) {
  const business = await getBusinessBySignupToken(token);
  if (!business) return { error: "invalid_or_expired_token" };

  const email = String(business.listing_contact_email || "").trim().toLowerCase();
  if (!email) return { error: "missing_listing_contact_email" };

  const existingMgr =
    (await dbGet(`SELECT id FROM identity.managers WHERE email = $1`, [email])) ||
    (await dbGet(`SELECT id FROM identity.exchange_managers WHERE email = $1`, [email]));

  if (existingMgr) {
    // Email already has a manager account — auto-link it to this business
    await dbRun(
      `UPDATE businesses
         SET manager_id = $1, claimed = 1, signup_email_verified_at = NOW()::TEXT, signup_verify_token = NULL
       WHERE slug = $2`,
      [existingMgr.id, business.slug]
    );
    return { ok: true, email, managerId: existingMgr.id };
  }

  if (
    (await dbGet(`SELECT id FROM identity.managers WHERE login_username = $1`, [login_username])) ||
    (await dbGet(`SELECT id FROM identity.exchange_managers WHERE login_username = $1`, [login_username]))
  ) {
    return { error: "username_taken" };
  }

  const passwordHash = hashPassword(password);
  const info = await dbRun(
    `INSERT INTO identity.managers (email, name, phone, password_hash, login_username) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [email, business.name_fa, business.phone, passwordHash, login_username]
  );
  const managerId = info.rows[0].id;

  await dbRun(
    `UPDATE businesses
       SET manager_id = $1, claimed = 1, signup_email_verified_at = NOW()::TEXT, signup_verify_token = NULL
     WHERE slug = $2`,
    [managerId, business.slug]
  );

  return { ok: true, email, managerId };
}
