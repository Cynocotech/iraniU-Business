/**
 * حذف همهٔ رستوران‌ها (جدول businesses)، شمارش QR، و پرچم‌های app_meta.
 * سرور را قبلش متوقف کنید وگرنه SQLite قفل می‌ماند (SQLITE_BUSY).
 *
 * بعد از اجرا، با روشن کردن دوبارهٔ API، seed خودکار سه آگهیٔ دمو را دوباره می‌سازد.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbPath = process.env.SQLITE_PATH || path.join(dataDir, "iraniu.db");

if (!fs.existsSync(dbPath)) {
  console.log("No database file at", dbPath);
  process.exit(0);
}

const db = new Database(dbPath);
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      telegram_bot_token TEXT,
      telegram_chat_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
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
    CREATE TABLE IF NOT EXISTS super_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Super Admin',
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS login_ip_throttle (
      ip TEXT PRIMARY KEY,
      fail_count INTEGER NOT NULL DEFAULT 0,
      window_start_ms INTEGER NOT NULL,
      blocked_until_ms INTEGER
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
    DELETE FROM login_ip_throttle;
    DELETE FROM admin_internal_notes;
    DELETE FROM admin_tasks;
    DELETE FROM super_admins;
    DELETE FROM site_chat_messages;
    DELETE FROM reservations;
    DELETE FROM billing_records;
    DELETE FROM claim_requests;
    DELETE FROM qr_scans;
    DELETE FROM businesses;
    DELETE FROM managers;
    DELETE FROM app_meta;
  `);
} catch (e) {
  console.error(e.message);
  console.error("\nStop the API server (Ctrl+C), then run this script again.");
  process.exit(1);
}
db.close();
console.log("Cleared: businesses, managers, super_admins, claims, billing, chat, reservations, qr_scans, app_meta");
console.log("Database file:", dbPath);
console.log("Start the server again — demo restaurants will be re-seeded on startup.");
