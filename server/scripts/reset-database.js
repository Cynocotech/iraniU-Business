/**
 * حذف همهٔ رستوران‌ها (جدول businesses)، شمارش QR، و پرچم‌های app_meta.
 * سرور را قبلش متوقف کنید وگرنه SQLite قفل می‌ماند (SQLITE_BUSY).
 *
 * بعد از اجرا، با روشن کردن دوبارهٔ API، seed خودکار سه آگهیٔ دمو را دوباره می‌سازد.
 *
 * دیتابیس دایرکتوری و هویت (ورود) جدا هستند؛ همان مسیرهای env سرور را استفاده می‌کند.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

function escapeSqlitePath(p) {
  return String(p).replace(/'/g, "''");
}

const directoryPath = process.env.SQLITE_DIRECTORY_PATH || path.join(dataDir, "iraniu-directory.db");
const identityPath = process.env.SQLITE_IDENTITY_PATH || path.join(dataDir, "iraniu-identity.db");

if (!fs.existsSync(directoryPath)) {
  console.log("No directory database at", directoryPath);
  process.exit(0);
}

const db = new Database(directoryPath);
try {
  db.exec(`ATTACH DATABASE '${escapeSqlitePath(identityPath)}' AS identity`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS claim_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_slug TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      decided_at TEXT
    );
    CREATE TABLE IF NOT EXISTS billing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_slug TEXT NOT NULL,
      title TEXT NOT NULL,
      amount TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS site_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_name TEXT,
      message TEXT NOT NULL,
      path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_slug TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      reservation_date TEXT NOT NULL,
      reservation_time TEXT NOT NULL,
      party_size INTEGER NOT NULL DEFAULT 2,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS admin_internal_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS admin_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      due_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    DELETE FROM admin_internal_notes;
    DELETE FROM admin_tasks;
    DELETE FROM site_chat_messages;
    DELETE FROM reservations;
    DELETE FROM billing_records;
    DELETE FROM claim_requests;
    DELETE FROM qr_scans;
    DELETE FROM businesses;
    DELETE FROM app_meta;
  `);
  for (const t of ["login_ip_throttle", "super_admins", "managers"]) {
    const row = db.prepare(`SELECT name FROM identity.sqlite_master WHERE type='table' AND name=?`).get(t);
    if (row) db.prepare(`DELETE FROM identity.${t}`).run();
  }
} catch (e) {
  console.error(e.message);
  console.error("\nStop the API server (Ctrl+C), then run this script again.");
  process.exit(1);
}
db.close();
console.log("Cleared: businesses, identity (managers/super_admins/throttle), claims, billing, chat, reservations, qr_scans, app_meta");
console.log("Directory DB:", directoryPath);
console.log("Identity DB:", identityPath);
console.log("Start the server again — demo restaurants will be re-seeded on startup.");
