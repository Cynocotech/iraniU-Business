/**
 * اعلان تلگرام هنگام ورود موفق سوپرادمین (نیاز به TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID).
 * دکمهٔ «Kick out» با webhook به /api/telegram/webhook نشست JWT را باطل می‌کند.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db.js";
import { getEffectiveTelegramConfig } from "./telegramSettings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "..", "assets", "iraniu-telegram-logo.png");

function parseChatId(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}

function parseResponseInfo(bodyText) {
  let desc = bodyText;
  try {
    const j = JSON.parse(bodyText);
    if (!j.ok && j.description) desc = j.description;
  } catch {
    /* ignore */
  }
  return desc;
}

export function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "";
}

async function telegramApi(method, jsonBody) {
  const token = getEffectiveTelegramConfig().botToken;
  if (!token) return { ok: false, error: "no_token" };
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jsonBody),
  });
  const bodyText = await r.text();
  let desc = bodyText;
  try {
    const j = JSON.parse(bodyText);
    if (!j.ok && j.description) desc = j.description;
    if (j.ok) return { ok: true };
  } catch {
    /* ignore */
  }
  if (!r.ok) return { ok: false, error: desc };
  return { ok: true };
}

async function sendTelegramMessage(token, chat_id, text, replyMarkup) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id,
    text,
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const bodyText = await r.text();
  const desc = parseResponseInfo(bodyText);
  if (!r.ok) {
    console.warn("[telegram] sendMessage failed", r.status, desc.slice(0, 400));
    return { ok: false, status: r.status, error: desc };
  }
  console.log("[telegram] message sent ok");
  return { ok: true };
}

async function sendTelegramPhotoCaption(token, chat_id, caption, replyMarkup) {
  const safeCap = caption.length > 1024 ? `${caption.slice(0, 1021)}…` : caption;
  const buf = fs.readFileSync(LOGO_PATH);
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;
  const form = new FormData();
  form.append("chat_id", String(chat_id));
  form.append("caption", safeCap);
  const blob = new Blob([buf], { type: "image/png" });
  form.append("photo", blob, "iraniu.png");
  if (replyMarkup) {
    form.append("reply_markup", JSON.stringify(replyMarkup));
  }

  const r = await fetch(url, { method: "POST", body: form });
  const bodyText = await r.text();
  const desc = parseResponseInfo(bodyText);
  if (!r.ok) {
    console.warn("[telegram] sendPhoto failed", r.status, desc.slice(0, 400));
    return { ok: false, status: r.status, error: desc };
  }
  console.log("[telegram] photo+caption sent ok");
  return { ok: true };
}

function kickOutReplyMarkup(adminId) {
  const id = Number(adminId);
  if (!Number.isFinite(id) || id <= 0) return undefined;
  const cb = `k_sa:${id}`;
  if (cb.length > 64) return undefined;
  return {
    inline_keyboard: [[{ text: "Kick out", callback_data: cb }]],
  };
}

async function deliverTelegram(caption, replyMarkup) {
  const { botToken: token, chatId: chatIdRaw } = getEffectiveTelegramConfig();
  if (!token || !chatIdRaw) {
    return { ok: false, skipped: true, reason: "missing_env" };
  }

  const chat_id = parseChatId(chatIdRaw);
  if (chat_id == null || chat_id === "") {
    return { ok: false, error: "invalid_chat_id" };
  }

  try {
    if (fs.existsSync(LOGO_PATH)) {
      const r = await sendTelegramPhotoCaption(token, chat_id, caption, replyMarkup);
      if (r.ok) return r;
      console.warn("[telegram] falling back to text-only sendMessage");
    }
    return sendTelegramMessage(token, chat_id, caption, replyMarkup);
  } catch (e) {
    console.warn("[telegram] deliver error", e?.message || e);
    try {
      return await sendTelegramMessage(token, chat_id, caption, replyMarkup);
    } catch (e2) {
      return { ok: false, error: String(e2?.message || e2) };
    }
  }
}

export async function notifyTelegramSuperAdminLogin({ email, ip, userAgent, adminId, loggedInWith2fa }) {
  const lines = [
    "🔐 ورود به پنل سوپرادمین",
    ...(loggedInWith2fa
      ? ["🔒 ورود با احراز هویت دو مرحله‌ای (Google Authenticator)"]
      : []),
    `📧 ایمیل: ${email}`,
    `🕐 زمان (UTC): ${new Date().toISOString()}`,
  ];
  if (ip) lines.push(`🌐 IP: ${ip}`);
  if (userAgent) lines.push(`💻 مرورگر: ${String(userAgent).slice(0, 200)}`);

  const hasWebhook = !!getEffectiveTelegramConfig().webhookSecret;
  const replyMarkup = hasWebhook ? kickOutReplyMarkup(adminId) : undefined;
  await deliverTelegram(lines.join("\n"), replyMarkup);
}

export async function sendTelegramTestMessage() {
  const text = ["✅ تست اتصال Iraniu", `🕐 ${new Date().toISOString()}`].join("\n");
  return deliverTelegram(text, undefined);
}

/**
 * Notify admin Telegram chat when a public user submits a listing (pending review).
 * Uses the same bot + TELEGRAM_CHAT_ID as super-admin login alerts. Text-only (no photo).
 */
export async function notifyTelegramNewPendingListing(row) {
  const token = getEffectiveTelegramConfig().botToken;
  const chatIdRaw = getEffectiveTelegramConfig().chatId;
  if (!token || !chatIdRaw) {
    return { skipped: true, reason: "telegram_not_configured" };
  }
  const chat_id = parseChatId(chatIdRaw);
  if (chat_id == null) {
    return { skipped: true, reason: "invalid_chat_id" };
  }
  const base = String(
    getEffectiveTelegramConfig().publicSiteUrl || process.env.PUBLIC_SITE_URL || process.env.SITE_BASE_URL || ""
  ).replace(/\/$/, "");
  const adminUrl = base ? `${base}/admin` : "";
  const name = String(row?.name_fa || "").trim() || "—";
  const slug = String(row?.slug || "").trim();
  const city = String(row?.city || "").trim() || "—";
  const text = [
    "📋 New listing pending review",
    "",
    `Name: ${name}`,
    `Slug: ${slug}`,
    `City: ${city}`,
    "",
    `UTC: ${new Date().toISOString()}`,
    "",
    "Open the admin panel to approve or reject this listing.",
  ].join("\n");
  const replyMarkup = adminUrl
    ? { inline_keyboard: [[{ text: "Open admin panel", url: adminUrl }]] }
    : undefined;
  return sendTelegramMessage(token, chat_id, text, replyMarkup);
}

/**
 * پردازش به‌روزرسانی تلگرام (دکمهٔ Kick out). باید webhook با همان TELEGRAM_CHAT_ID تنظیم شود.
 */
export async function processTelegramWebhook(body) {
  const cq = body && body.callback_query;
  if (!cq || typeof cq.data !== "string" || !cq.data.startsWith("k_sa:")) {
    return { handled: false };
  }

  const adminId = parseInt(cq.data.slice(5), 10);
  if (!Number.isFinite(adminId)) {
    await telegramApi("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: "Invalid",
      show_alert: true,
    });
    return { handled: true };
  }

  const msgChatId = cq.message?.chat?.id;
  const expectedRaw = getEffectiveTelegramConfig().chatId;
  if (msgChatId == null || !expectedRaw) {
    await telegramApi("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: "Not configured",
      show_alert: true,
    });
    return { handled: true };
  }

  const expected = parseChatId(expectedRaw);
  if (String(msgChatId) !== String(expected)) {
    console.warn("[telegram] webhook chat id mismatch");
    await telegramApi("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: "Unauthorized chat",
      show_alert: true,
    });
    return { handled: true };
  }

  const info = db.prepare(`UPDATE super_admins SET token_version = token_version + 1 WHERE id = ?`).run(adminId);
  if (info.changes === 0) {
    await telegramApi("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: "Admin not found",
      show_alert: false,
    });
    return { handled: true };
  }

  await telegramApi("answerCallbackQuery", {
    callback_query_id: cq.id,
    text: "Session ended (kicked out)",
    show_alert: false,
  });

  const mid = cq.message?.message_id;
  if (mid != null) {
    await telegramApi("editMessageReplyMarkup", {
      chat_id: msgChatId,
      message_id: mid,
      reply_markup: { inline_keyboard: [] },
    });
  }

  console.log("[telegram] kick out super admin id=%s via callback", adminId);
  return { handled: true };
}
