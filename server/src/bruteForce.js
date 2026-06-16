/**
 * محدودیت تلاش ورود به‌ازای IP برای جلوگیری از brute force.
 * متغیرهای محیط: AUTH_BRUTE_MAX_FAILS، AUTH_BRUTE_WINDOW_MS، AUTH_BRUTE_BLOCK_MS
 */

import { dbGet, dbRun } from "./db.js";
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
export async function assertLoginNotBlocked(req, res) {
  const ip = ipKey(req);
  const now = Date.now();
  const row = await dbGet(
    `SELECT fail_count, window_start_ms, blocked_until_ms FROM identity.login_ip_throttle WHERE ip = $1`,
    [ip]
  );

  const blockedUntil = row?.blocked_until_ms != null ? Number(row.blocked_until_ms) : null;

  if (blockedUntil != null && now < blockedUntil) {
    const retryAfter = Math.ceil((blockedUntil - now) / 1000);
    res.setHeader("Retry-After", String(Math.max(1, retryAfter)));
    res.status(429).json({
      error: "too_many_attempts",
      hint: "به‌دلیل تلاش‌های ناموفق متعدد، این IP موقتاً مسدود است. بعداً دوباره تلاش کنید.",
      retry_after_sec: retryAfter,
    });
    return false;
  }

  if (blockedUntil != null && now >= blockedUntil) {
    await dbRun(
      `UPDATE identity.login_ip_throttle SET blocked_until_ms = NULL, fail_count = 0, window_start_ms = $1 WHERE ip = $2`,
      [now, ip]
    );
  }

  return true;
}

export async function recordLoginFailure(req) {
  const ip = ipKey(req);
  const now = Date.now();
  const w = windowMs();
  const max = maxFails();
  const block = blockMs();

  const row = await dbGet(`SELECT * FROM identity.login_ip_throttle WHERE ip = $1`, [ip]);
  if (!row) {
    await dbRun(
      `INSERT INTO identity.login_ip_throttle (ip, fail_count, window_start_ms, blocked_until_ms) VALUES ($1, 1, $2, NULL)`,
      [ip, now]
    );
    return;
  }

  const blockedUntil = row.blocked_until_ms != null ? Number(row.blocked_until_ms) : null;
  if (blockedUntil != null && now < blockedUntil) {
    return;
  }

  if (now - Number(row.window_start_ms) > w) {
    await dbRun(
      `UPDATE identity.login_ip_throttle SET fail_count = 1, window_start_ms = $1, blocked_until_ms = NULL WHERE ip = $2`,
      [now, ip]
    );
    return;
  }

  const next = Number(row.fail_count) + 1;
  if (next >= max) {
    const until = now + block;
    await dbRun(`UPDATE identity.login_ip_throttle SET fail_count = $1, blocked_until_ms = $2 WHERE ip = $3`, [
      next,
      until,
      ip,
    ]);
    console.warn("[auth] brute-force block ip=%s until %s (failures=%s)", ip, new Date(until).toISOString(), next);
  } else {
    await dbRun(`UPDATE identity.login_ip_throttle SET fail_count = $1 WHERE ip = $2`, [next, ip]);
  }
}

export async function recordLoginSuccess(req) {
  const ip = ipKey(req);
  await dbRun(`DELETE FROM identity.login_ip_throttle WHERE ip = $1`, [ip]);
}
