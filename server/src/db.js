import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { applyPendingSqliteImportIfAny } from "./sqliteDbPending.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

/** Escape a path for use inside single-quoted SQLite string literals. */
function escapeSqlitePath(p) {
  return String(p).replace(/'/g, "''");
}

const legacyDbPath = process.env.SQLITE_PATH || path.join(dataDir, "iraniu.db");
const directoryPath = process.env.SQLITE_DIRECTORY_PATH || path.join(dataDir, "iraniu-directory.db");
const identityPath = process.env.SQLITE_IDENTITY_PATH || path.join(dataDir, "iraniu-identity.db");

/** Public directory / listings DB (businesses, claims, etc.). */
export const dbPath = directoryPath;
/** Separate identity DB file (managers, super_admins, login throttle). Attached as schema `identity`. */
export const identityDbPath = identityPath;

/**
 * One-time: if only the legacy single file exists, copy it to the directory path so we can split auth out.
 */
function migrateLegacyFileToDirectoryIfNeeded() {
  if (!fs.existsSync(legacyDbPath)) return;
  if (fs.existsSync(directoryPath)) return;
  fs.copyFileSync(legacyDbPath, directoryPath);
  console.log(`[db] Copied legacy ${legacyDbPath} → ${directoryPath}`);
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

migrateLegacyFileToDirectoryIfNeeded();
applyPendingSqliteImportIfAny(directoryPath);

const db = new Database(directoryPath);
db.pragma("journal_mode = WAL");
db.exec(`ATTACH DATABASE '${escapeSqlitePath(identityPath)}' AS identity`);

/**
 * Move auth tables from the main file into `identity` (one-time per legacy DB).
 */
function migrateAuthTablesFromMainToIdentity() {
  const authTables = ["managers", "super_admins", "login_ip_throttle"];
  for (const t of authTables) {
    const mainRow = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t);
    if (!mainRow) continue;
    const idRow = db
      .prepare(`SELECT name FROM identity.sqlite_master WHERE type='table' AND name=?`)
      .get(t);
    if (!idRow) {
      db.exec(`CREATE TABLE identity.${t} AS SELECT * FROM main.${t}`);
    } else {
      const mc = db.prepare(`SELECT COUNT(*) AS c FROM main.${t}`).get().c;
      const ic = db.prepare(`SELECT COUNT(*) AS c FROM identity.${t}`).get().c;
      if (mc > 0 && ic === 0) {
        db.exec(`INSERT INTO identity.${t} SELECT * FROM main.${t}`);
      } else if (mc > 0 && ic > 0) {
        console.warn(`[db] migrate auth: both main and identity have ${t}; keeping identity, dropping main`);
      }
    }
    db.exec(`DROP TABLE main.${t}`);
  }
}

migrateAuthTablesFromMainToIdentity();

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name_fa TEXT NOT NULL,
    description TEXT,
    category TEXT,
    phone TEXT,
    address TEXT,
    google_review_url TEXT,
    claimed INTEGER NOT NULL DEFAULT 0,
    package TEXT NOT NULL DEFAULT 'basic',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    subtitle TEXT,
    hours_json TEXT,
    promo_title TEXT,
    promo_description TEXT,
    cover_image_url TEXT,
    gallery_json TEXT,
    listing_title TEXT,
    city TEXT,
    price_range TEXT,
    rating REAL,
    cta TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS qr_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_slug TEXT NOT NULL,
    scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_qr_scans_slug ON qr_scans(business_slug);

  CREATE TABLE IF NOT EXISTS phone_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_slug TEXT NOT NULL,
    clicked_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_phone_clicks_slug ON phone_clicks(business_slug);
`);

function migrateBusinessesColumns() {
  const info = db.prepare("PRAGMA table_info(businesses)").all();
  const names = new Set(info.map((c) => c.name));
  const add = [
    ["subtitle", "TEXT"],
    ["hours_json", "TEXT"],
    ["promo_title", "TEXT"],
    ["promo_description", "TEXT"],
    ["cover_image_url", "TEXT"],
    ["gallery_json", "TEXT"],
    ["listing_title", "TEXT"],
    ["city", "TEXT"],
    ["price_range", "TEXT"],
    ["rating", "REAL"],
    ["cta", "TEXT"],
    ["status", "TEXT"],
    ["manager_id", "INTEGER"],
    ["biolink_json", "TEXT"],
    ["careers_title", "TEXT"],
    ["careers_text", "TEXT"],
    ["reservation_link", "TEXT"],
    ["call_tracking_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["call_tracking_number", "TEXT"],
    ["call_forward_number", "TEXT"],
    ["listing_approval", "TEXT NOT NULL DEFAULT 'approved'"],
    ["listing_terms_accepted_at", "TEXT"],
    ["listing_terms_version", "TEXT"],
    ["listing_contact_email", "TEXT"],
    ["listing_rejection_reason", "TEXT"],
    ["google_place_id", "TEXT"],
    ["exchange_rates_json", "TEXT"],
    ["payment_methods_json", "TEXT"],
    ["exchange_company_verified", "INTEGER NOT NULL DEFAULT 0"],
    ["exchange_features_json", "TEXT"],
    ["exchange_today_rate_enabled", "INTEGER NOT NULL DEFAULT 1"],
  ];
  for (const [col, typ] of add) {
    if (!names.has(col)) {
      db.exec(`ALTER TABLE businesses ADD COLUMN ${col} ${typ}`);
    }
  }
}

migrateBusinessesColumns();

function ensureAdminTables() {
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
    CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);
    CREATE INDEX IF NOT EXISTS idx_claim_requests_slug ON claim_requests(business_slug);
    CREATE TABLE IF NOT EXISTS billing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_slug TEXT NOT NULL,
      title TEXT NOT NULL,
      amount TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_billing_slug ON billing_records(business_slug);
    CREATE TABLE IF NOT EXISTS site_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_name TEXT,
      message TEXT NOT NULL,
      path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL DEFAULT 'info',
      actor_type TEXT NOT NULL DEFAULT 'system',
      actor_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      message TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
    CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
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
    CREATE INDEX IF NOT EXISTS idx_reservations_business_date ON reservations(business_slug, reservation_date);
    CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_slug TEXT,
      call_sid TEXT UNIQUE,
      from_number TEXT,
      to_number TEXT,
      direction TEXT,
      status TEXT,
      duration_seconds INTEGER,
      recording_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_call_logs_business ON call_logs(business_slug, created_at DESC);
    CREATE TABLE IF NOT EXISTS business_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_business_categories_active_order ON business_categories(is_active, sort_order, name);
    CREATE TABLE IF NOT EXISTS business_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_slug TEXT NOT NULL,
      reason_key TEXT NOT NULL,
      details TEXT,
      reporter_email TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_business_reports_slug ON business_reports(business_slug);
    CREATE INDEX IF NOT EXISTS idx_business_reports_created ON business_reports(created_at DESC);
  `);
}

ensureAdminTables();

function seedBusinessCategories() {
  const c = db.prepare(`SELECT COUNT(*) AS c FROM business_categories`).get().c;
  if (c > 0) return;
  const defaults = ["رستوران", "سلامت", "خرده‌فروشی", "خدمات", "زیبایی", "آموزش"];
  const existing = db.prepare(`SELECT DISTINCT category FROM businesses WHERE category IS NOT NULL AND trim(category) <> ''`).all();
  const names = new Set(defaults);
  for (const r of existing) names.add(String(r.category || "").trim());
  let i = 1;
  const ins = db.prepare(`INSERT OR IGNORE INTO business_categories (name, sort_order, is_active) VALUES (?, ?, 1)`);
  for (const n of names) {
    if (!n) continue;
    ins.run(n, i++);
  }
}

seedBusinessCategories();

function migrateAuthTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS identity.managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const mInfo = db.prepare("PRAGMA identity.table_info(managers)").all();
  const mNames = new Set(mInfo.map((c) => c.name));
  const mAdd = [
    ["login_username", "TEXT"],
    ["password_hash", "TEXT"],
    ["totp_secret", "TEXT"],
    ["totp_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["telegram_bot_token", "TEXT"],
    ["telegram_chat_id", "TEXT"],
    ["avatar_url", "TEXT"],
    ["twilio_account_sid", "TEXT"],
    ["twilio_auth_token", "TEXT"],
    ["twilio_phone_number", "TEXT"],
  ];
  for (const [col, typ] of mAdd) {
    if (!mNames.has(col)) {
      db.exec(`ALTER TABLE identity.managers ADD COLUMN ${col} ${typ}`);
    }
  }
  try {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_managers_login_username ON identity.managers(login_username) WHERE login_username IS NOT NULL AND length(trim(login_username)) > 0`
    );
  } catch (e) {
    console.warn("[db] idx_managers_login_username:", e?.message || e);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS identity.super_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Super Admin',
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const saInfo = db.prepare("PRAGMA identity.table_info(super_admins)").all();
  const saNames = new Set(saInfo.map((c) => c.name));
  if (!saNames.has("token_version")) {
    db.exec(`ALTER TABLE identity.super_admins ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`);
  }
  if (!saNames.has("avatar_url")) {
    db.exec(`ALTER TABLE identity.super_admins ADD COLUMN avatar_url TEXT`);
  }
  if (!saNames.has("totp_setup_required")) {
    db.exec(`ALTER TABLE identity.super_admins ADD COLUMN totp_setup_required INTEGER NOT NULL DEFAULT 0`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS identity.login_ip_throttle (
      ip TEXT PRIMARY KEY,
      fail_count INTEGER NOT NULL DEFAULT 0,
      window_start_ms INTEGER NOT NULL,
      blocked_until_ms INTEGER
    );
  `);
}

migrateAuthTables();

function ensureAdminWorkspaceTables() {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_admin_tasks_done_sort ON admin_tasks(done, sort_order DESC, id DESC);
  `);
}

ensureAdminWorkspaceTables();

/** گالری دمو — فایل‌ها در client/public/images/sofreh/ */
const SOFREH_GALLERY_JSON = JSON.stringify([
  "/images/sofreh/gallery-1.png",
  "/images/sofreh/gallery-2.png",
  "",
  "",
]);

function seedIfEmpty() {
  const n = db.prepare("SELECT COUNT(*) AS c FROM businesses").get().c;
  if (n > 0) return;

  const insert = db.prepare(`
    INSERT INTO businesses (
      slug, name_fa, description, category, phone, address, google_review_url, claimed, package,
      subtitle, hours_json, promo_title, promo_description, cover_image_url, gallery_json,
      listing_title, city, price_range, rating, cta, status
    )
    VALUES (
      @slug, @name_fa, @description, @category, @phone, @address, @google_review_url, @claimed, @package,
      @subtitle, @hours_json, @promo_title, @promo_description, @cover_image_url, @gallery_json,
      @listing_title, @city, @price_range, @rating, @cta, @status
    )
  `);

  const safraHours = JSON.stringify([
    { day: "شنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "یکشنبه", hours: "۱۲:۰۰–۲۲:۰۰" },
    { day: "دوشنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "سه‌شنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "چهارشنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "پنج‌شنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "جمعه", hours: "۱۴:۰۰–۲۳:۰۰" },
  ]);

  const samples = [
    {
      slug: "restaurant-safra",
      name_fa: "رستوران نمونه",
      description:
        "ارائه انواع غذاهای اصیل ایرانی شامل کباب، برنج زعفرانی و خورشت‌های سنتی در محیطی گرم و صمیمی.",
      category: "رستوران",
      phone: "+442089495974",
      address: "103 High St, New Malden, London",
      google_review_url: "https://www.google.com/maps/search/?api=1&query=103+High+St+New+Malden+London",
      claimed: 1,
      package: "featured",
      subtitle: "",
      hours_json: safraHours,
      promo_title: "۲۰٪ تخفیف آخر هفته برای خانواده‌ها",
      promo_description:
        "هر جمعه و شنبه تا پایان ماه جاری، روی منوی اصلی و نوشیدنی‌ها بیست درصد تخفیف بگیرید. برای رزرو گروهی بیش از شش نفر، یک پیش غذا به‌صورت رایگان اضافه می‌شود.",
      cover_image_url: "",
      gallery_json: SOFREH_GALLERY_JSON,
      listing_title: "رستوران ایرانی اصیل در لندن",
      city: "London",
      price_range: "£20-30",
      rating: 4.6,
      cta: "رزرو کنید",
      status: "active",
    },
    {
      slug: "clinic-pars",
      name_fa: "کلینیک پارس",
      description: "نوبت آنلاین و حضوری، خدمات خانواده.",
      category: "سلامت",
      phone: "+44 20 0000 0001",
      address: "لندن",
      google_review_url: "https://www.google.com/maps",
      claimed: 1,
      package: "featured",
      subtitle: "پزشک عمومی و واکسن — Manchester",
      hours_json: safraHours,
      promo_title: "ویزیت اول رایگان برای کودکان زیر ۵ سال",
      promo_description: "تا پایان فصل، اولین ویزیت عمومی برای هر کودک زیر پنج سال رایگان است.",
      cover_image_url: "",
      gallery_json: JSON.stringify(["", "", "", ""]),
      listing_title: "",
      city: "",
      price_range: "",
      rating: null,
      cta: "",
      status: "active",
    },
    {
      slug: "supermarket-barakat",
      name_fa: "سوپرمارکت برکت",
      description: "مواد غذایی و محصولات ایرانی.",
      category: "خرده‌فروشی",
      phone: "+44 20 0000 0002",
      address: "منچستر",
      google_review_url: "",
      claimed: 0,
      package: "basic",
      subtitle: "",
      hours_json: safraHours,
      promo_title: "",
      promo_description: "",
      cover_image_url: "",
      gallery_json: JSON.stringify(["", "", "", ""]),
      listing_title: "",
      city: "",
      price_range: "",
      rating: null,
      cta: "",
      status: "active",
    },
  ];

  const tx = db.transaction((rows) => {
    for (const r of rows) insert.run(r);
  });
  tx(samples);
}

seedIfEmpty();

/** اگر دیتابیس قدیمی بدون این نامک باشد، پیش‌فرض دمو برای پنل و PUT/PATCH */
function ensureRestaurantSafraDemo() {
  const exists = db.prepare("SELECT 1 FROM businesses WHERE slug = ?").get("restaurant-safra");
  if (exists) return;

  const safraHours = JSON.stringify([
    { day: "شنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "یکشنبه", hours: "۱۲:۰۰–۲۲:۰۰" },
    { day: "دوشنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "سه‌شنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "چهارشنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "پنج‌شنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "جمعه", hours: "۱۴:۰۰–۲۳:۰۰" },
  ]);

  const insert = db.prepare(`
    INSERT INTO businesses (
      slug, name_fa, description, category, phone, address, google_review_url, claimed, package,
      subtitle, hours_json, promo_title, promo_description, cover_image_url, gallery_json,
      listing_title, city, price_range, rating, cta, status
    )
    VALUES (
      @slug, @name_fa, @description, @category, @phone, @address, @google_review_url, @claimed, @package,
      @subtitle, @hours_json, @promo_title, @promo_description, @cover_image_url, @gallery_json,
      @listing_title, @city, @price_range, @rating, @cta, @status
    )
  `);

  insert.run({
    slug: "restaurant-safra",
    name_fa: "رستوران نمونه",
    description:
      "ارائه انواع غذاهای اصیل ایرانی شامل کباب، برنج زعفرانی و خورشت‌های سنتی در محیطی گرم و صمیمی.",
    category: "رستوران",
    phone: "+442089495974",
    address: "103 High St, New Malden, London",
    google_review_url: "https://www.google.com/maps/search/?api=1&query=103+High+St+New+Malden+London",
    claimed: 1,
    package: "featured",
    subtitle: "",
    hours_json: safraHours,
    promo_title: "۲۰٪ تخفیف آخر هفته برای خانواده‌ها",
    promo_description:
      "هر جمعه و شنبه تا پایان ماه جاری، روی منوی اصلی و نوشیدنی‌ها بیست درصد تخفیف بگیرید. برای رزرو گروهی بیش از شش نفر، یک پیش غذا به‌صورت رایگان اضافه می‌شود.",
    cover_image_url: "",
    gallery_json: SOFREH_GALLERY_JSON,
    listing_title: "رستوران ایرانی اصیل در لندن",
    city: "London",
    price_range: "£20-30",
    rating: 4.6,
    cta: "رزرو کنید",
    status: "active",
  });
}

ensureRestaurantSafraDemo();

/** نام نمایشی قدیمی «رستوران سفره» → «رستوران نمونه» */
function migrateSafraDisplayName() {
  try {
    db.prepare(`UPDATE businesses SET name_fa = ? WHERE slug = 'restaurant-safra' AND name_fa = ?`).run(
      "رستوران نمونه",
      "رستوران سفره"
    );
  } catch (_) {}
}

migrateSafraDisplayName();

/** یک‌بار برای دیتابیس‌های قدیمی: به‌روزرسانی فیلدهای دمو (Sofreh) */
db.exec(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

function applySofrehRestaurantImport() {
  const done = db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get("sofreh_restaurant_v1");
  if (done) return;
  const row = db.prepare(`SELECT slug FROM businesses WHERE slug = ?`).get("restaurant-safra");
  if (!row) return;
  db.prepare(`
    UPDATE businesses SET
      listing_title = @listing_title,
      city = @city,
      price_range = @price_range,
      rating = @rating,
      phone = @phone,
      address = @address,
      description = @description,
      cta = @cta,
      status = @status,
      category = @category,
      subtitle = @subtitle,
      google_review_url = @google_review_url
    WHERE slug = 'restaurant-safra'
  `).run({
    listing_title: "رستوران ایرانی اصیل در لندن",
    city: "London",
    price_range: "£20-30",
    rating: 4.6,
    phone: "+442089495974",
    address: "103 High St, New Malden, London",
    description:
      "ارائه انواع غذاهای اصیل ایرانی شامل کباب، برنج زعفرانی و خورشت‌های سنتی در محیطی گرم و صمیمی.",
    cta: "رزرو کنید",
    status: "active",
    category: "رستوران",
    subtitle: "",
    google_review_url: "https://www.google.com/maps/search/?api=1&query=103+High+St+New+Malden+London",
  });
  db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run("sofreh_restaurant_v1", new Date().toISOString());
}

applySofrehRestaurantImport();

/** یک‌بار: گالری تصویر برای سفره */
function applySofrehGalleryImages() {
  const done = db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get("sofreh_gallery_v1");
  if (done) return;
  const row = db.prepare(`SELECT slug FROM businesses WHERE slug = ?`).get("restaurant-safra");
  if (!row) return;
  db.prepare(`UPDATE businesses SET gallery_json = ? WHERE slug = 'restaurant-safra'`).run(SOFREH_GALLERY_JSON);
  db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run("sofreh_gallery_v1", new Date().toISOString());
}

applySofrehGalleryImages();

/**
 * یک‌بار: نامک‌های واردات لندن به شکل lb-{هش بلند} → iu- + ۸ رقم (همان عدد آگهی، با فرمت شبیه IU-… در UI).
 * جداول وابسته به business_slug را هم به‌روز می‌کند.
 */
function migrateLbHashSlugsToIuIdSlugs() {
  const key = "migrate_lb_slug_to_iu_v1";
  if (db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(key)) return;

  const candidates = db
    .prepare(
      `SELECT id, slug FROM businesses
       WHERE slug LIKE 'lb-%' AND length(slug) >= 40`
    )
    .all();

  if (candidates.length === 0) {
    db.prepare(`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`).run(key, new Date().toISOString());
    return;
  }

  const tx = db.transaction(() => {
    for (const { id, slug: oldSlug } of candidates) {
      const newSlug = `iu-${String(id).padStart(8, "0")}`;
      const clash = db.prepare(`SELECT id FROM businesses WHERE slug = ? AND id != ?`).get(newSlug, id);
      if (clash) {
        console.warn(`[db] migrate lb→iu: skip id=${id}, slug ${newSlug} already used`);
        continue;
      }
      for (const t of [
        "qr_scans",
        "phone_clicks",
        "claim_requests",
        "billing_records",
        "reservations",
        "call_logs",
        "business_reports",
      ]) {
        db.prepare(`UPDATE ${t} SET business_slug = ? WHERE business_slug = ?`).run(newSlug, oldSlug);
      }
      db.prepare(`UPDATE businesses SET slug = ? WHERE id = ?`).run(newSlug, id);
    }
    db.prepare(`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`).run(key, new Date().toISOString());
  });
  tx();
}

migrateLbHashSlugsToIuIdSlugs();

export { db, ensureRestaurantSafraDemo };
