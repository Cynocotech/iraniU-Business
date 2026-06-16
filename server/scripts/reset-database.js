/**
 * Clears all directory + identity data from PostgreSQL (businesses, claims, billing,
 * chat, reservations, qr_scans, app_meta, and the identity auth tables).
 *
 * After running, restart the API — the startup seed re-creates the three demo listings.
 *
 * Requires DATABASE_URL. Run: node server/scripts/reset-database.js
 */
import "../src/env.js";
import { pool, initDb } from "../src/db.js";

async function main() {
  await initDb();
  const tables = [
    "admin_internal_notes",
    "admin_tasks",
    "site_chat_messages",
    "reservations",
    "billing_records",
    "claim_requests",
    "business_reports",
    "call_logs",
    "phone_clicks",
    "qr_scans",
    "businesses",
    "app_meta",
    "exchange_banner_clicks",
    "exchange_banners",
    "identity.login_ip_throttle",
    "identity.super_admins",
    "identity.exchange_managers",
    "identity.managers",
  ];
  for (const t of tables) {
    await pool.query(`DELETE FROM ${t}`);
  }
  console.log(
    "Cleared: businesses, identity (managers/exchange_managers/super_admins/throttle), claims, billing, chat, reservations, banners, qr_scans, app_meta"
  );
  console.log("Start the server again — demo restaurants will be re-seeded on startup.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
