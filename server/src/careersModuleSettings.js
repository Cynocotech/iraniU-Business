/**
 * careers_module_enabled — controls Job Vacancies / Careers feature visibility
 * Similar to twilioModuleSettings.js
 */

import { dbGet, dbRun } from "./db.js";

const TABLE = "system_settings";
const KEY = "careers_module_enabled";

/**
 * Check if the careers/job vacancies module is enabled.
 * Defaults to true if not explicitly disabled.
 */
export async function isCareersModuleEnabled() {
  try {
    const row = await dbGet(`SELECT value FROM ${TABLE} WHERE key = $1`, [KEY]);
    if (!row) return true;
    return String(row.value) === "1";
  } catch (e) {
    console.error("[careersModuleSettings] read error", e);
    return true;
  }
}

/**
 * Enable or disable the careers module.
 */
export async function setCareersModuleEnabled(enabled) {
  const value = enabled ? "1" : "0";
  await dbRun(
    `INSERT INTO ${TABLE} (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()::TEXT`,
    [KEY, value]
  );
}
