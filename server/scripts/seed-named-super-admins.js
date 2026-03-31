/**
 * Creates or resets named super-admin accounts with totp_setup_required=1.
 * Run: node server/scripts/seed-named-super-admins.js
 * (from repo root, or from server/ with node scripts/seed-named-super-admins.js)
 */
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbPath = process.env.SQLITE_PATH || path.join(dataDir, "iraniu.db");

function randomPassword() {
  const a = crypto.randomBytes(18).toString("base64url");
  const b = crypto.randomBytes(6).toString("hex");
  return `${a.slice(0, 14)}${b.slice(0, 6)}`;
}

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), 12);
}

const accounts = [
  { email: "anita@iraniu.uk", name: "Anita" },
  { email: "reza@iraniu.uk", name: "Reza" },
];

const db = new Database(dbPath);

try {
  db.exec(`ALTER TABLE super_admins ADD COLUMN totp_setup_required INTEGER NOT NULL DEFAULT 0`);
} catch {
  /* exists */
}

const out = [];
for (const { email, name } of accounts) {
  const em = email.trim().toLowerCase();
  const password = randomPassword();
  const hash = hashPassword(password);
  const row = db.prepare(`SELECT id FROM super_admins WHERE email = ?`).get(em);
  if (row) {
    db.prepare(
      `UPDATE super_admins SET password_hash = @hash, name = @name, totp_setup_required = 1, totp_enabled = 0, totp_secret = NULL WHERE email = @email`
    ).run({ hash, name, email: em });
  } else {
    db.prepare(
      `INSERT INTO super_admins (email, password_hash, name, totp_setup_required, totp_enabled) VALUES (?, ?, ?, 1, 0)`
    ).run(em, hash, name);
  }
  out.push({ email: em, password, name });
}

db.close();

console.log(JSON.stringify({ ok: true, dbPath, accounts: out }, null, 2));
