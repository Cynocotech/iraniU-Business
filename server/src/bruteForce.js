/**
 * محدودیت تلاش ورود به‌ازای IP برای جلوگیری از brute force.
 * متغیرهای محیط: AUTH_BRUTE_MAX_FAILS، AUTH_BRUTE_WINDOW_MS، AUTH_BRUTE_BLOCK_MS
 */

import { db } from "./db.js";
import { clientIp } from "./telegramNotify.js";

function maxFails() {
  const n = Number(process.env.AUTH_BRUTE_MAX_FAILS);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

function windowMs() {
  const n = Number(process.env.AUTH_BRUTE_WINDOW_MS);
  return Number.isFinite(n) && n > 0 ? n : 15 * 60 * 1000;
}

function blockMs() {
  const n = Number(process.env.AUTH_BRUTE_BLOCK_MS);
  return Number.isFinite(n) && n > 0 ? n : 30 * 60 * 1000;
}

function ipKey(req) {
  const ip = clientIp(req);
  return ip && String(ip).trim() ? String(ip).trim() : "unknown";
}

/**
 * اگر IP مسدود است، پاسخ 429 می‌فرستد و false برمی‌گرداند.
 */
export function assertLoginNotBlocked(req, res) {
  const ip = ipKey(req);
  const now = Date.now();
  const row = db.prepare(`SELECT fail_count, window_start_ms, blocked_until_ms FROM identity.login_ip_throttle WHERE ip = ?`).get(ip);

  if (row?.blocked_until_ms != null && now < row.blocked_until_ms) {
    const retryAfter = Math.ceil((row.blocked_until_ms - now) / 1000);
    res.setHeader("Retry-After", String(Math.max(1, retryAfter)));
    res.status(429).json({
      error: "too_many_attempts",
      hint: "به‌دلیل تلاش‌های ناموفق متعدد، این IP موقتاً مسدود است. بعداً دوباره تلاش کنید.",
      retry_after_sec: retryAfter,
    });
    return false;
  }

  if (row?.blocked_until_ms != null && now >= row.blocked_until_ms) {
    db.prepare(
      `UPDATE identity.login_ip_throttle SET blocked_until_ms = NULL, fail_count = 0, window_start_ms = ? WHERE ip = ?`
    ).run(now, ip);
  }

  return true;
}

export function recordLoginFailure(req) {
  const ip = ipKey(req);
  const now = Date.now();
  const w = windowMs();
  const max = maxFails();
  const block = blockMs();

  const row = db.prepare(`SELECT * FROM identity.login_ip_throttle WHERE ip = ?`).get(ip);
  if (!row) {
    db.prepare(
      `INSERT INTO identity.login_ip_throttle (ip, fail_count, window_start_ms, blocked_until_ms) VALUES (?, 1, ?, NULL)`
    ).run(ip, now);
    return;
  }

  if (row.blocked_until_ms != null && now < row.blocked_until_ms) {
    return;
  }

  if (now - row.window_start_ms > w) {
    db.prepare(`UPDATE identity.login_ip_throttle SET fail_count = 1, window_start_ms = ?, blocked_until_ms = NULL WHERE ip = ?`).run(
      now,
      ip
    );
    return;
  }

  const next = row.fail_count + 1;
  if (next >= max) {
    const until = now + block;
    db.prepare(`UPDATE identity.login_ip_throttle SET fail_count = ?, blocked_until_ms = ? WHERE ip = ?`).run(next, until, ip);
    console.warn("[auth] brute-force block ip=%s until %s (failures=%s)", ip, new Date(until).toISOString(), next);
  } else {
    db.prepare(`UPDATE identity.login_ip_throttle SET fail_count = ? WHERE ip = ?`).run(next, ip);
  }
}

export function recordLoginSuccess(req) {
  const ip = ipKey(req);
  db.prepare(`DELETE FROM identity.login_ip_throttle WHERE ip = ?`).run(ip);
}
