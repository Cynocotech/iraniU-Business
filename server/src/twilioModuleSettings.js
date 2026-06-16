/**
 * Kill-switch for Twilio (stored in app_meta). Default: enabled when unset.
 */

import { dbGet, dbRun } from "./db.js";

export const META_KEY = "twilio_module_enabled";

export async function isTwilioModuleEnabled() {
  const row = await dbGet(`SELECT value FROM app_meta WHERE key = $1`, [META_KEY]);
  if (!row || row.value == null || String(row.value).trim() === "") return true;
  const v = String(row.value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export async function getTwilioModuleForAdmin() {
  return { enabled: await isTwilioModuleEnabled() };
}

export async function setTwilioModuleEnabled(enabled) {
  const on = enabled === true || enabled === 1 || enabled === "1" || enabled === "true";
  await dbRun(
    `INSERT INTO app_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [META_KEY, on ? "1" : "0"]
  );
  return getTwilioModuleForAdmin();
}
