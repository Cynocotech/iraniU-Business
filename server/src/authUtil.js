import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";

const JWT_SECRET = process.env.JWT_SECRET || "iraniu-dev-jwt-secret-change-me";

/** قوانین رمز قوی برای مدیران — حداقل ۱۲ کاراکتر + حروف بزرگ/کوچک + رقم + نماد */
export function validatePasswordComplexity(plain) {
  const p = String(plain || "");
  if (p.length < 12) {
    return { ok: false, code: "password_too_short", hint: "رمز باید حداقل ۱۲ کاراکتر باشد." };
  }
  if (p.length > 200) {
    return { ok: false, code: "password_too_long", hint: "رمز خیلی طولانی است." };
  }
  if (!/[a-z]/.test(p)) {
    return { ok: false, code: "password_no_lower", hint: "حداقل یک حرف کوچک انگلیسی (a-z) لازم است." };
  }
  if (!/[A-Z]/.test(p)) {
    return { ok: false, code: "password_no_upper", hint: "حداقل یک حرف بزرگ انگلیسی (A-Z) لازم است." };
  }
  if (!/[0-9]/.test(p)) {
    return { ok: false, code: "password_no_digit", hint: "حداقل یک رقم لازم است." };
  }
  if (!/[^a-zA-Z0-9_]/.test(p)) {
    return {
      ok: false,
      code: "password_no_special",
      hint: "حداقل یک نماد یا علامت (غیر از حرف، رقم و _) لازم است؛ مثلاً ! @ # $ %",
    };
  }
  return { ok: true };
}

export function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), 12);
}

export function verifyPassword(plain, hash) {
  if (!hash || !plain) return false;
  return bcrypt.compareSync(String(plain), hash);
}

export function signManagerToken(managerId) {
  return jwt.sign({ typ: "mgr", sub: Number(managerId) }, JWT_SECRET, { expiresIn: "7d" });
}

export function signExchangeManagerToken(managerId) {
  return jwt.sign({ typ: "mgrx", sub: Number(managerId) }, JWT_SECRET, { expiresIn: "7d" });
}

export function signSuperAdminToken(adminId) {
  return jwt.sign({ typ: "adm", sub: Number(adminId) }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyBearerToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function parseAuthHeader(req) {
  const h = req.headers.authorization;
  if (!h || !String(h).startsWith("Bearer ")) return null;
  return verifyBearerToken(h.slice(7).trim());
}

export function totpVerify(secretBase32, token6) {
  if (!secretBase32 || !token6) return false;
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: "base32",
    token: String(token6).replace(/\s/g, ""),
    window: 2,
  });
}

export function totpGenerateSecret(accountLabel = "Iraniu") {
  return speakeasy.generateSecret({ length: 20, name: String(accountLabel || "Iraniu") });
}

export function stripManagerRow(row) {
  if (!row) return null;
  const { password_hash, totp_secret, telegram_bot_token, twilio_auth_token, ...rest } = row;
  return rest;
}

export function stripSuperAdminRow(row) {
  if (!row) return null;
  const { password_hash, totp_secret, token_version, ...rest } = row;
  return rest;
}
