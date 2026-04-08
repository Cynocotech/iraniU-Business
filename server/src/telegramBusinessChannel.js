/**
 * ارسال آگهی به کانال دایرکتوری ایرانیو (فقط از API سوپرادمین).
 * ربات باید در کانال به‌عنوان ادمین اضافه شود.
 * env: TELEGRAM_DIRECTORY_CHANNEL_ID  (@channelname یا -100...)
 *      PUBLIC_SITE_URL  (لینک دکمه‌ها و تصویر نسبی)
 */

import { db } from "./db.js";
import { getEffectiveTelegramConfig } from "./telegramSettings.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(s, max) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function siteBaseUrl() {
  const u = getEffectiveTelegramConfig().publicSiteUrl || "http://127.0.0.1:5173";
  return String(u).replace(/\/$/, "");
}

function resolvePhotoUrl(row) {
  const base = siteBaseUrl();
  const abs = (u) => {
    const s = String(u || "").trim();
    if (!s) return null;
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("/")) return `${base}${s}`;
    return null;
  };

  const cover = abs(row.cover_image_url);
  if (cover) return cover;

  try {
    const arr = JSON.parse(typeof row.gallery_json === "string" ? row.gallery_json : "[]");
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const u = abs(item);
        if (u) return u;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function normalizeChannelId(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.startsWith("@")) return s;
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}

async function telegramPost(token, method, body) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j = {};
  try {
    j = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { ok: !!j.ok, j, status: r.status };
}

/**
 * @returns {Promise<{ ok: boolean, error?: string, description?: string }>}
 */
export async function sendBusinessDirectoryPost(slug) {
  const { botToken: token, directoryChannelId: channelRaw } = getEffectiveTelegramConfig();
  if (!token || !channelRaw) {
    return { ok: false, error: "not_configured" };
  }

  const row = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(String(slug || "").trim());
  if (!row) {
    return { ok: false, error: "not_found" };
  }

  const chat_id = normalizeChannelId(channelRaw);
  if (chat_id == null) {
    return { ok: false, error: "bad_channel_id" };
  }

  const base = siteBaseUrl();
  const bizUrl = `${base}/business?slug=${encodeURIComponent(row.slug)}`;
  const name = escapeHtml(row.name_fa || row.slug);
  const rawDesc = (row.description || row.subtitle || "").trim();
  const descHtml = rawDesc ? escapeHtml(truncate(rawDesc, 650)) : "";
  const address = String(row.address || "").trim();
  const phone = String(row.phone || "").trim();
  const cat = String(row.category || "").trim();

  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : bizUrl;

  const parts = [
    "<b>✨ آگهی ویژه در دایرکتوری ایرانیو</b>",
    "",
    `🏪 <b>نام کسب‌وکار:</b> <b>${name}</b>`,
    "",
    `🏷️ <b>دسته‌بندی:</b> <b>${cat ? escapeHtml(cat) : "—"}</b>`,
    "",
    `📍 <b>موقعیت:</b> <b>${address ? escapeHtml(truncate(address, 220)) : "—"}</b>`,
  ];
  if (phone) parts.push("", `📞 <b>تماس:</b> <b>${escapeHtml(phone)}</b>`);
  if (descHtml) parts.push("", `📝 <b>توضیحات:</b>\n<b>${descHtml}</b>`);

  let caption = parts.join("\n");
  caption = truncate(caption, 1024);

  /** دکمهٔ url فقط http/https/tg — tel: رد می‌شود (Bad Request: invalid URL). شماره در متن caption است. */
  const keyboard = [];
  if (address) {
    keyboard.push([{ text: "📍 آدرس روی نقشه", url: truncate(mapsUrl, 2000) }]);
  }
  keyboard.push([{ text: "📱 دانلود اپلیکیشن ایرانیو", url: "https://www.iraniu.uk" }]);

  const reply_markup = keyboard.length ? { inline_keyboard: keyboard } : undefined;

  const photoUrl = resolvePhotoUrl(row);

  if (photoUrl) {
    const res = await telegramPost(token, "sendPhoto", {
      chat_id,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
      reply_markup,
    });
    if (res.ok) {
      console.log("[telegram] directory channel: photo sent slug=%s", row.slug);
      return { ok: true };
    }
    console.warn("[telegram] sendPhoto channel failed:", res.j?.description || res.status);
  }

  const res2 = await telegramPost(token, "sendMessage", {
    chat_id,
    text: truncate(caption, 4096),
    parse_mode: "HTML",
    reply_markup,
    disable_web_page_preview: true,
  });

  if (!res2.ok) {
    return {
      ok: false,
      error: "telegram_error",
      description: res2.j?.description || String(res2.status),
    };
  }

  console.log("[telegram] directory channel: message sent slug=%s", row.slug);
  return { ok: true };
}
