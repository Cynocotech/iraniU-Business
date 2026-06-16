#!/usr/bin/env node
/**
 * One-time data migration: SQLite -> PostgreSQL.
 *
 * Reads the two legacy SQLite files:
 *   - iraniu-directory.db  (public/app tables)
 *   - iraniu-identity.db   (auth tables -> identity schema)
 * and copies every row into the PostgreSQL database referenced by DATABASE_URL.
 *
 * Usage:
 *   # better-sqlite3 is only needed for this migration; install it temporarily:
 *   npm install better-sqlite3
 *   DATABASE_URL=postgres://user:pass@host:5432/db \
 *     node migrate-sqlite-to-pg.mjs \
 *     --directory ./data/iraniu-directory.db \
 *     --identity ./data/iraniu-identity.db
 *
 * Flags (all optional; sensible defaults under ./data):
 *   --directory <path>   path to iraniu-directory.db
 *   --identity  <path>   path to iraniu-identity.db
 *
 * Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING and resets sequences after.
 */
import "./src/env.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { pool, initDb } from "./src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--directory" && argv[i + 1]) args.directory = argv[++i];
    else if (argv[i] === "--identity" && argv[i + 1]) args.identity = argv[++i];
  }
  return args;
}

const args = parseArgs();
const directoryPath =
  args.directory || process.env.SQLITE_DIRECTORY_PATH || path.join(dataDir, "iraniu-directory.db");
const identityPath =
  args.identity || process.env.SQLITE_IDENTITY_PATH || path.join(dataDir, "iraniu-identity.db");

let Database;
try {
  ({ default: Database } = await import("better-sqlite3"));
} catch {
  console.error(
    "better-sqlite3 is required for migration. Install it temporarily:\n  npm install better-sqlite3"
  );
  process.exit(1);
}

/** Tables in dependency-free / FK-safe order (parents before children). */
const PUBLIC_TABLES = [
  "businesses",
  "business_categories",
  "qr_scans",
  "phone_clicks",
  "claim_requests",
  "billing_records",
  "site_chat_messages",
  "system_logs",
  "reservations",
  "call_logs",
  "business_reports",
  "exchange_banners",
  "exchange_banner_clicks",
  "admin_internal_notes",
  "admin_tasks",
  "app_meta",
];

const IDENTITY_TABLES = [
  "managers",
  "exchange_managers",
  "super_admins",
  "login_ip_throttle",
];

/** Tables whose primary key is a SERIAL `id` and need a sequence reset. */
const SERIAL_TABLES_PUBLIC = PUBLIC_TABLES.filter((t) => t !== "app_meta");
const SERIAL_TABLES_IDENTITY = ["managers", "exchange_managers", "super_admins"];

function sqliteTableExists(db, table) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
    .get(table);
  return !!row;
}

function sqliteColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

async function pgColumns(schema, table) {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
    [schema, table]
  );
  return new Set(res.rows.map((r) => r.column_name));
}

async function migrateTable(srcDb, schema, table) {
  if (!sqliteTableExists(srcDb, table)) {
    console.log(`  - ${schema}.${table}: not found in SQLite, skipping`);
    return 0;
  }
  const srcCols = sqliteColumns(srcDb, table);
  const destCols = await pgColumns(schema, table);
  const cols = srcCols.filter((c) => destCols.has(c));
  if (!cols.length) {
    console.log(`  - ${schema}.${table}: no matching columns, skipping`);
    return 0;
  }
  const rows = srcDb.prepare(`SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM ${table}`).all();
  if (!rows.length) {
    console.log(`  - ${schema}.${table}: 0 rows`);
    return 0;
  }
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `INSERT INTO ${schema}.${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("SET search_path TO public, identity");
    await client.query("BEGIN");
    for (const row of rows) {
      const values = cols.map((c) => row[c]);
      const r = await client.query(sql, values);
      inserted += r.rowCount;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  console.log(`  - ${schema}.${table}: ${inserted}/${rows.length} rows inserted`);
  return inserted;
}

async function resetSequence(schema, table) {
  // pg_get_serial_sequence handles the schema-qualified table + id column.
  await pool.query(
    `SELECT setval(
       pg_get_serial_sequence($1, 'id'),
       COALESCE((SELECT MAX(id) FROM ${schema}.${table}), 0) + 1,
       false
     )`,
    [`${schema}.${table}`]
  );
}

async function main() {
  if (!fs.existsSync(directoryPath)) {
    console.error(`Directory SQLite file not found: ${directoryPath}`);
    process.exit(1);
  }
  console.log("Creating PostgreSQL schema (idempotent)...");
  await initDb();

  console.log(`Opening SQLite directory DB: ${directoryPath}`);
  const dirDb = new Database(directoryPath, { readonly: true });

  console.log("Migrating public tables:");
  for (const t of PUBLIC_TABLES) {
    await migrateTable(dirDb, "public", t);
  }

  // Identity tables may live in a separate file, or (legacy) inside the directory DB.
  let idDb = dirDb;
  if (fs.existsSync(identityPath)) {
    console.log(`Opening SQLite identity DB: ${identityPath}`);
    idDb = new Database(identityPath, { readonly: true });
  } else {
    console.log("No separate identity DB file; reading identity tables from directory DB if present.");
  }
  console.log("Migrating identity tables:");
  for (const t of IDENTITY_TABLES) {
    await migrateTable(idDb, "identity", t);
  }

  console.log("Resetting sequences...");
  for (const t of SERIAL_TABLES_PUBLIC) await resetSequence("public", t);
  for (const t of SERIAL_TABLES_IDENTITY) await resetSequence("identity", t);

  dirDb.close();
  if (idDb !== dirDb) idDb.close();
  console.log("Migration complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Migration failed:", e?.message || e);
    process.exit(1);
  });
