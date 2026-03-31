/**
 * Kill-switch for Twilio (stored in app_meta). Default: enabled when unset.
 */

import { db } from "./db.js";

export const META_KEY = "twilio_module_enabled";

export function isTwilioModuleEnabled() {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(META_KEY);
  if (!row || row.value == null || String(row.value).trim() === "") return true;
  const v = String(row.value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function getTwilioModuleForAdmin() {
  return { enabled: isTwilioModuleEnabled() };
}

export function setTwilioModuleEnabled(enabled) {
  const on = enabled === true || enabled === 1 || enabled === "1" || enabled === "true";
  db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`).run(META_KEY, on ? "1" : "0");
  return getTwilioModuleForAdmin();
}
