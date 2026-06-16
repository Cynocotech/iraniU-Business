import pg from "pg";

const { Pool } = pg;

/**
 * PostgreSQL connection pool.
 * Uses one database with two schemas:
 *   - public   → directory / listings tables
 *   - identity → auth tables (managers, exchange_managers, super_admins, login_ip_throttle)
 *
 * `search_path` is set on every new connection so existing SQL that references
 * `identity.managers` etc. keeps working, and unqualified names resolve to `public`.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Set the schema search path at connection time so SQL referencing `identity.*`
  // and unqualified `public.*` names both resolve. Done via libpq options (not an
  // `on("connect")` query) to avoid racing the first query on a fresh connection.
  options: "-c search_path=public,identity",
});

pool.on("error", (err) => {
  console.error("[db] unexpected pg pool error", err?.message || err);
});

/** Run a query, return first row or undefined. */
export async function dbGet(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows[0];
}

/** Run a query, return all rows. */
export async function dbAll(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

/** Run a query, return the full pg result (for INSERT/UPDATE/DELETE; use RETURNING for ids). */
export async function dbRun(sql, params = []) {
  return pool.query(sql, params);
}

/**
 * Run multiple statements in a transaction.
 * The callback receives a dedicated client; use `client.query(...)`.
 * search_path is set explicitly on the checked-out client.
 */
export async function dbTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("SET search_path TO public, identity");
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/** گالری دمو — فایل‌ها در client/public/images/sofreh/ */
const SOFREH_GALLERY_JSON = JSON.stringify([
  "/images/sofreh/gallery-1.png",
  "/images/sofreh/gallery-2.png",
  "",
  "",
]);

/** Full Postgres schema (public + identity). Idempotent. */
export const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_fa TEXT NOT NULL,
  description TEXT,
  category TEXT,
  phone TEXT,
  address TEXT,
  google_review_url TEXT,
  claimed INTEGER NOT NULL DEFAULT 0,
  package TEXT NOT NULL DEFAULT 'basic',
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  subtitle TEXT,
  hours_json TEXT,
  promo_title TEXT,
  promo_description TEXT,
  cover_image_url TEXT,
  gallery_json TEXT,
  listing_title TEXT,
  city TEXT,
  price_range TEXT,
  rating DOUBLE PRECISION,
  cta TEXT,
  status TEXT,
  manager_id INTEGER,
  exchange_manager_id INTEGER,
  biolink_json TEXT,
  careers_title TEXT,
  careers_text TEXT,
  reservation_link TEXT,
  call_tracking_enabled INTEGER NOT NULL DEFAULT 0,
  call_tracking_number TEXT,
  call_forward_number TEXT,
  listing_approval TEXT NOT NULL DEFAULT 'approved',
  listing_terms_accepted_at TEXT,
  listing_terms_version TEXT,
  listing_contact_email TEXT,
  listing_rejection_reason TEXT,
  google_place_id TEXT,
  exchange_rates_json TEXT,
  payment_methods_json TEXT,
  exchange_company_verified INTEGER NOT NULL DEFAULT 0,
  exchange_features_json TEXT,
  exchange_today_rate_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS qr_scans (
  id SERIAL PRIMARY KEY,
  business_slug TEXT NOT NULL,
  scanned_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_qr_scans_slug ON qr_scans(business_slug);

CREATE TABLE IF NOT EXISTS phone_clicks (
  id SERIAL PRIMARY KEY,
  business_slug TEXT NOT NULL,
  clicked_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_phone_clicks_slug ON phone_clicks(business_slug);

CREATE TABLE IF NOT EXISTS claim_requests (
  id SERIAL PRIMARY KEY,
  business_slug TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);
CREATE INDEX IF NOT EXISTS idx_claim_requests_slug ON claim_requests(business_slug);

CREATE TABLE IF NOT EXISTS billing_records (
  id SERIAL PRIMARY KEY,
  business_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  amount TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_billing_slug ON billing_records(business_slug);

CREATE TABLE IF NOT EXISTS site_chat_messages (
  id SERIAL PRIMARY KEY,
  visitor_name TEXT,
  message TEXT NOT NULL,
  path TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  message TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);

CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  business_slug TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  reservation_date TEXT NOT NULL,
  reservation_time TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_reservations_business_date ON reservations(business_slug, reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

CREATE TABLE IF NOT EXISTS call_logs (
  id SERIAL PRIMARY KEY,
  business_slug TEXT,
  call_sid TEXT UNIQUE,
  from_number TEXT,
  to_number TEXT,
  direction TEXT,
  status TEXT,
  duration_seconds INTEGER,
  recording_url TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_call_logs_business ON call_logs(business_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS business_categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_business_categories_active_order ON business_categories(is_active, sort_order, name);

CREATE TABLE IF NOT EXISTS business_reports (
  id SERIAL PRIMARY KEY,
  business_slug TEXT NOT NULL,
  reason_key TEXT NOT NULL,
  details TEXT,
  reporter_email TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_business_reports_slug ON business_reports(business_slug);
CREATE INDEX IF NOT EXISTS idx_business_reports_created ON business_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS exchange_banners (
  id SERIAL PRIMARY KEY,
  title TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  page_scope TEXT NOT NULL DEFAULT 'exchange',
  placement TEXT NOT NULL DEFAULT 'between',
  daily_user_cap INTEGER NOT NULL DEFAULT 2,
  start_at TEXT,
  end_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_exchange_banners_active_place_sort
  ON exchange_banners(is_active, placement, sort_order, id DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_banners_scope_active_place_sort
  ON exchange_banners(page_scope, is_active, placement, sort_order, id DESC);

CREATE TABLE IF NOT EXISTS exchange_banner_clicks (
  id SERIAL PRIMARY KEY,
  banner_id INTEGER NOT NULL,
  page_scope TEXT NOT NULL DEFAULT 'exchange',
  clicked_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  FOREIGN KEY (banner_id) REFERENCES exchange_banners(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_exchange_banner_clicks_banner
  ON exchange_banner_clicks(banner_id, clicked_at DESC);

CREATE TABLE IF NOT EXISTS admin_internal_notes (
  id SERIAL PRIMARY KEY,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS admin_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_done_sort ON admin_tasks(done, sort_order DESC, id DESC);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS identity.managers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  login_username TEXT,
  password_hash TEXT,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  avatar_url TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_phone_number TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_managers_login_username
  ON identity.managers(login_username)
  WHERE login_username IS NOT NULL AND length(trim(login_username)) > 0;

CREATE TABLE IF NOT EXISTS identity.exchange_managers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  login_username TEXT,
  password_hash TEXT,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_managers_login_username
  ON identity.exchange_managers(login_username)
  WHERE login_username IS NOT NULL AND length(trim(login_username)) > 0;

CREATE TABLE IF NOT EXISTS identity.super_admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Super Admin',
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  token_version INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  totp_setup_required INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS identity.login_ip_throttle (
  ip TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  window_start_ms BIGINT NOT NULL,
  blocked_until_ms BIGINT
);
`;

/** Create schemas/tables on startup. Idempotent. */
export async function initDb() {
  await pool.query(SCHEMA_SQL);
}

async function seedBusinessCategories() {
  const c = (await dbGet(`SELECT COUNT(*)::int AS c FROM business_categories`)).c;
  if (c > 0) return;
  const defaults = ["رستوران", "سلامت", "خرده‌فروشی", "خدمات", "زیبایی", "آموزش"];
  const existing = await dbAll(
    `SELECT DISTINCT category FROM businesses WHERE category IS NOT NULL AND trim(category) <> ''`
  );
  const names = new Set(defaults);
  for (const r of existing) names.add(String(r.category || "").trim());
  let i = 1;
  for (const n of names) {
    if (!n) continue;
    await dbRun(
      `INSERT INTO business_categories (name, sort_order, is_active) VALUES ($1, $2, 1) ON CONFLICT (name) DO NOTHING`,
      [n, i++]
    );
  }
}

function safraHoursJson() {
  return JSON.stringify([
    { day: "شنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "یکشنبه", hours: "۱۲:۰۰–۲۲:۰۰" },
    { day: "دوشنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "سه‌شنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "چهارشنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "پنج‌شنبه", hours: "۱۲:۰۰–۲۳:۰۰" },
    { day: "جمعه", hours: "۱۴:۰۰–۲۳:۰۰" },
  ]);
}

const INSERT_SEED_BUSINESS_SQL = `
  INSERT INTO businesses (
    slug, name_fa, description, category, phone, address, google_review_url, claimed, package,
    subtitle, hours_json, promo_title, promo_description, cover_image_url, gallery_json,
    listing_title, city, price_range, rating, cta, status
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9,
    $10, $11, $12, $13, $14, $15,
    $16, $17, $18, $19, $20, $21
  )
`;

function seedBusinessParams(r) {
  return [
    r.slug, r.name_fa, r.description, r.category, r.phone, r.address, r.google_review_url, r.claimed, r.package,
    r.subtitle, r.hours_json, r.promo_title, r.promo_description, r.cover_image_url, r.gallery_json,
    r.listing_title, r.city, r.price_range, r.rating, r.cta, r.status,
  ];
}

async function seedIfEmpty() {
  const n = (await dbGet(`SELECT COUNT(*)::int AS c FROM businesses`)).c;
  if (n > 0) return;
  const safraHours = safraHoursJson();
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
  await dbTransaction(async (client) => {
    for (const r of samples) {
      await client.query(INSERT_SEED_BUSINESS_SQL, seedBusinessParams(r));
    }
  });
}

/** اگر دیتابیس قدیمی بدون این نامک باشد، پیش‌فرض دمو برای پنل و PUT/PATCH */
export async function ensureRestaurantSafraDemo() {
  const exists = await dbGet("SELECT 1 FROM businesses WHERE slug = $1", ["restaurant-safra"]);
  if (exists) return;
  await dbRun(
    INSERT_SEED_BUSINESS_SQL,
    seedBusinessParams({
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
      hours_json: safraHoursJson(),
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
    })
  );
}

async function migrateSafraDisplayName() {
  try {
    await dbRun(`UPDATE businesses SET name_fa = $1 WHERE slug = 'restaurant-safra' AND name_fa = $2`, [
      "رستوران نمونه",
      "رستوران سفره",
    ]);
  } catch (_) {}
}

async function applySofrehRestaurantImport() {
  const done = await dbGet(`SELECT 1 FROM app_meta WHERE key = $1`, ["sofreh_restaurant_v1"]);
  if (done) return;
  const row = await dbGet(`SELECT slug FROM businesses WHERE slug = $1`, ["restaurant-safra"]);
  if (!row) return;
  await dbRun(
    `UPDATE businesses SET
      listing_title = $1, city = $2, price_range = $3, rating = $4, phone = $5, address = $6,
      description = $7, cta = $8, status = $9, category = $10, subtitle = $11, google_review_url = $12
     WHERE slug = 'restaurant-safra'`,
    [
      "رستوران ایرانی اصیل در لندن",
      "London",
      "£20-30",
      4.6,
      "+442089495974",
      "103 High St, New Malden, London",
      "ارائه انواع غذاهای اصیل ایرانی شامل کباب، برنج زعفرانی و خورشت‌های سنتی در محیطی گرم و صمیمی.",
      "رزرو کنید",
      "active",
      "رستوران",
      "",
      "https://www.google.com/maps/search/?api=1&query=103+High+St+New+Malden+London",
    ]
  );
  await dbRun(`INSERT INTO app_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [
    "sofreh_restaurant_v1",
    new Date().toISOString(),
  ]);
}

async function applySofrehGalleryImages() {
  const done = await dbGet(`SELECT 1 FROM app_meta WHERE key = $1`, ["sofreh_gallery_v1"]);
  if (done) return;
  const row = await dbGet(`SELECT slug FROM businesses WHERE slug = $1`, ["restaurant-safra"]);
  if (!row) return;
  await dbRun(`UPDATE businesses SET gallery_json = $1 WHERE slug = 'restaurant-safra'`, [SOFREH_GALLERY_JSON]);
  await dbRun(`INSERT INTO app_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [
    "sofreh_gallery_v1",
    new Date().toISOString(),
  ]);
}

/** Normalize legacy manager_id = 0 → NULL. */
async function normalizeLegacyManagerIds() {
  await dbRun(`UPDATE businesses SET manager_id = NULL WHERE manager_id IS NOT NULL AND manager_id <= 0`);
  await dbRun(
    `UPDATE businesses SET exchange_manager_id = NULL WHERE exchange_manager_id IS NOT NULL AND exchange_manager_id <= 0`
  );
}

/**
 * Run schema creation + idempotent seed/migration steps. Call once on startup.
 */
export async function bootstrapDb() {
  await initDb();
  await normalizeLegacyManagerIds();
  await seedBusinessCategories();
  await seedIfEmpty();
  await ensureRestaurantSafraDemo();
  await migrateSafraDisplayName();
  await applySofrehRestaurantImport();
  await applySofrehGalleryImages();
}
