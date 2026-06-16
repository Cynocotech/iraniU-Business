/**
 * تنظیمات SMTP (ذخیره در app_meta) + اولویت با متغیرهای محیطی در صورت خالی بودن DB.
 * پیش‌فرض میزبان: smtp.zoho.eu
 */

import nodemailer from "nodemailer";
import { dbGet, dbRun } from "./db.js";

export const META_KEY_SMTP = "smtp_email_settings_v1";

const DEFAULTS = {
  host: "smtp.zoho.eu",
  port: 587,
  secure: false,
  user: "",
  password: "",
  fromName: "Iraniu",
  fromEmail: "",
  replyTo: "",
  siteUrl: "",
  logoUrl: "",
  primaryColor: "#3a0b47",
  primaryMid: "#5c1f6e",
  accentSuccess: "#15803d",
  accentDanger: "#b91c1c",
  notifyOnNewListing: true,
  /** ایمیل‌های داخلی جدا با کاما یا خط جدید — اطلاع از آگهی جدید در انتظار تأیید */
  notifyEmails: "",
};

let cachedTransport = null;
let cachedTransportKey = "";

async function parseStored() {
  const row = await dbGet(`SELECT value FROM app_meta WHERE key = $1`, [META_KEY_SMTP]);
  if (!row || row.value == null || String(row.value).trim() === "") return {};
  try {
    const o = JSON.parse(String(row.value));
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

async function saveStored(obj) {
  const s = JSON.stringify(obj);
  await dbRun(
    `INSERT INTO app_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [META_KEY_SMTP, s]
  );
}

/** تنظیمات نهایی برای nodemailer و قالب‌ها */
export async function getEffectiveSmtpSettings() {
  const stored = await parseStored();
  const envHost = process.env.SMTP_HOST?.trim();
  const envPort = Number(process.env.SMTP_PORT || 0);
  const envSecure = process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true";
  const envUser = process.env.SMTP_USER?.trim();
  const envPass = process.env.SMTP_PASS?.trim();
  const envFrom = process.env.EMAIL_FROM?.trim();
  const envSite = (process.env.PUBLIC_SITE_URL || process.env.SITE_BASE_URL || "").replace(/\/$/, "");

  let fromEmail = String(stored.fromEmail || "").trim();
  let fromName = String(stored.fromName || DEFAULTS.fromName).trim() || DEFAULTS.fromName;
  if (!fromEmail && envFrom) {
    const m = envFrom.match(/^(.+?)\s*<\s*([^>]+)\s*>$/);
    if (m) {
      fromName = m[1].trim();
      fromEmail = m[2].trim();
    } else if (envFrom.includes("@")) {
      fromEmail = envFrom;
    }
  }

  const host = String(stored.host || envHost || DEFAULTS.host).trim() || DEFAULTS.host;
  const port = Number(stored.port || (envPort > 0 ? envPort : DEFAULTS.port)) || DEFAULTS.port;
  const secure =
    stored.secure === true ||
    stored.secure === 1 ||
    String(stored.secure || "").toLowerCase() === "true" ||
    envSecure;
  const user = String(stored.user || envUser || "").trim();
  const password = String(stored.password || envPass || "").trim();

  return {
    ...DEFAULTS,
    ...stored,
    host,
    port,
    secure,
    user,
    password,
    fromName,
    fromEmail: fromEmail || user || "",
    replyTo: String(stored.replyTo || "").trim(),
    siteUrl: String(stored.siteUrl || envSite || "").replace(/\/$/, ""),
    logoUrl: String(stored.logoUrl || "").trim(),
    primaryColor: String(stored.primaryColor || DEFAULTS.primaryColor).trim(),
    primaryMid: String(stored.primaryMid || DEFAULTS.primaryMid).trim(),
    accentSuccess: String(stored.accentSuccess || DEFAULTS.accentSuccess).trim(),
    accentDanger: String(stored.accentDanger || DEFAULTS.accentDanger).trim(),
    notifyOnNewListing:
      stored.notifyOnNewListing === false ||
      stored.notifyOnNewListing === 0 ||
      String(stored.notifyOnNewListing || "").toLowerCase() === "false"
        ? false
        : true,
    notifyEmails: String(stored.notifyEmails || "").trim(),
  };
}

export function maskSecret(s) {
  const t = String(s || "");
  if (!t) return null;
  if (t.length <= 4) return "••••";
  return `••••${t.slice(-4)}`;
}

function transportKey(cfg) {
  return [cfg.host, cfg.port, cfg.secure, cfg.user, cfg.password].join("|");
}

export function invalidateMailTransporter() {
  cachedTransport = null;
  cachedTransportKey = "";
}

export async function getMailTransporter() {
  const cfg = await getEffectiveSmtpSettings();
  if (!cfg.host || !cfg.user || !cfg.password) return null;
  const k = transportKey(cfg);
  if (cachedTransport && k === cachedTransportKey) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
  });
  cachedTransportKey = k;
  return cachedTransport;
}

/** پاسخ امن برای پنل — رمز SMTP نمایش داده نمی‌شود */
export async function getSmtpSettingsForAdmin() {
  const raw = await parseStored();
  const eff = await getEffectiveSmtpSettings();
  const hasDbPassword = !!(raw && String(raw.password || "").trim());
  const hasEnvPassword = !!process.env.SMTP_PASS?.trim();
  return {
    host: eff.host,
    port: eff.port,
    secure: eff.secure,
    user: eff.user,
    password_set: !!(eff.password && eff.password.length > 0),
    password_masked: maskSecret(eff.password),
    password_source: hasDbPassword ? "database" : hasEnvPassword ? "env" : "none",
    from_name: eff.fromName,
    from_email: eff.fromEmail,
    reply_to: eff.replyTo,
    site_url: eff.siteUrl,
    logo_url: eff.logoUrl,
    primary_color: eff.primaryColor,
    primary_mid: eff.primaryMid,
    accent_success: eff.accentSuccess,
    accent_danger: eff.accentDanger,
    notify_on_new_listing: eff.notifyOnNewListing,
    notify_emails: eff.notifyEmails,
    smtp_configured: !!(eff.host && eff.user && eff.password),
  };
}

/**
 * PATCH — رمز خالی یعنی «تغییر نده» اگر قبلاً ذخیره شده؛ برای پاک کردن DB باید کلید خاص ارسال شود.
 */
export async function applySmtpSettingsPatch(body) {
  const b = body && typeof body === "object" ? body : {};
  const cur = { ...DEFAULTS, ...(await parseStored()) };

  if ("host" in b) cur.host = String(b.host ?? "").trim() || DEFAULTS.host;
  if ("port" in b) {
    const n = parseInt(String(b.port), 10);
    cur.port = Number.isFinite(n) && n > 0 ? n : DEFAULTS.port;
  }
  if ("secure" in b) cur.secure = !!(b.secure === true || b.secure === 1 || String(b.secure).toLowerCase() === "true");
  if ("user" in b) cur.user = String(b.user ?? "").trim();
  if ("password" in b) {
    const p = String(b.password ?? "");
    if (p.trim() === "" || p === "••••••••") {
      /* no change */
    } else if (p === "__CLEAR__") {
      cur.password = "";
    } else {
      cur.password = p.trim();
    }
  }
  if ("from_name" in b) cur.fromName = String(b.from_name ?? "").trim() || DEFAULTS.fromName;
  if ("from_email" in b) cur.fromEmail = String(b.from_email ?? "").trim();
  if ("reply_to" in b) cur.replyTo = String(b.reply_to ?? "").trim();
  if ("site_url" in b) cur.siteUrl = String(b.site_url ?? "").trim().replace(/\/$/, "");
  if ("logo_url" in b) cur.logoUrl = String(b.logo_url ?? "").trim();
  if ("primary_color" in b) cur.primaryColor = String(b.primary_color ?? "").trim() || DEFAULTS.primaryColor;
  if ("primary_mid" in b) cur.primaryMid = String(b.primary_mid ?? "").trim() || DEFAULTS.primaryMid;
  if ("accent_success" in b) cur.accentSuccess = String(b.accent_success ?? "").trim() || DEFAULTS.accentSuccess;
  if ("accent_danger" in b) cur.accentDanger = String(b.accent_danger ?? "").trim() || DEFAULTS.accentDanger;
  if ("notify_on_new_listing" in b) {
    cur.notifyOnNewListing =
      b.notify_on_new_listing === true ||
      b.notify_on_new_listing === 1 ||
      String(b.notify_on_new_listing || "").toLowerCase() === "true";
  }
  if ("notify_emails" in b) cur.notifyEmails = String(b.notify_emails ?? "").trim();

  await saveStored(cur);
  invalidateMailTransporter();
  return getSmtpSettingsForAdmin();
}

export async function buildFromAddress() {
  const c = await getEffectiveSmtpSettings();
  const email = c.fromEmail || c.user;
  if (!email) return null;
  const name = c.fromName || "Iraniu";
  return `${name} <${email}>`;
}

export async function sendMailViaSettings({ to, subject, html, text, replyTo }) {
  const tx = await getMailTransporter();
  if (!tx) return { skipped: true, reason: "smtp_not_configured" };
  const toAddr = String(to || "").trim().toLowerCase();
  if (!toAddr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) return { skipped: true, reason: "no_valid_email" };
  const from = await buildFromAddress();
  if (!from) return { skipped: true, reason: "no_from" };
  const cfg = await getEffectiveSmtpSettings();
  const r = cfg.replyTo || replyTo;
  await tx.sendMail({
    from,
    to: toAddr,
    subject: String(subject || "").trim() || "Message",
    html,
    text: text != null ? String(text) : undefined,
    replyTo: r && String(r).includes("@") ? String(r).trim() : undefined,
  });
  return { ok: true };
}

/** Parse "a@b.com, c@d.com" or newline-separated */
export function parseNotifyEmailList(s) {
  return String(s || "")
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
}
