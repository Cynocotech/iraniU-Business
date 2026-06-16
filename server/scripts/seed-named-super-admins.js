/**
 * Creates or resets named super-admin accounts with totp_setup_required=1.
 * Requires DATABASE_URL.
 * Run: node server/scripts/seed-named-super-admins.js
 */
import "../src/env.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool, initDb, dbGet, dbRun } from "../src/db.js";

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

async function main() {
  await initDb();
  const out = [];
  for (const { email, name } of accounts) {
    const em = email.trim().toLowerCase();
    const password = randomPassword();
    const hash = hashPassword(password);
    const row = await dbGet(`SELECT id FROM identity.super_admins WHERE email = $1`, [em]);
    if (row) {
      await dbRun(
        `UPDATE identity.super_admins
           SET password_hash = $1, name = $2, totp_setup_required = 1, totp_enabled = 0, totp_secret = NULL
         WHERE email = $3`,
        [hash, name, em]
      );
    } else {
      await dbRun(
        `INSERT INTO identity.super_admins (email, password_hash, name, totp_setup_required, totp_enabled)
         VALUES ($1, $2, $3, 1, 0)`,
        [em, hash, name]
      );
    }
    out.push({ email: em, password, name });
  }
  console.log(JSON.stringify({ ok: true, accounts: out }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });

// keep pool referenced for clarity
void pool;
