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
  mobile TEXT,
  address TEXT,
  postcode TEXT,
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
  exchange_today_rate_enabled INTEGER NOT NULL DEFAULT 1,
  signup_verify_token TEXT,
  signup_verify_expires_at TEXT,
  signup_email_verified_at TEXT
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

CREATE TABLE IF NOT EXISTS identity.password_resets (
  id SERIAL PRIMARY KEY,
  account_type TEXT NOT NULL,
  account_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON identity.password_resets(token);

CREATE TABLE IF NOT EXISTS identity.login_ip_throttle (
  ip TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  window_start_ms BIGINT NOT NULL,
  blocked_until_ms BIGINT
);

ALTER TABLE identity.managers ADD COLUMN IF NOT EXISTS must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE identity.exchange_managers ADD COLUMN IF NOT EXISTS must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE claim_requests ADD COLUMN IF NOT EXISTS claim_manager_id INTEGER;
ALTER TABLE business_categories ADD COLUMN IF NOT EXISTS icon TEXT;

CREATE TABLE IF NOT EXISTS token_wallets (
  id SERIAL PRIMARY KEY,
  business_slug TEXT UNIQUE NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_token_wallets_slug ON token_wallets(business_slug);

CREATE TABLE IF NOT EXISTS token_transactions (
  id SERIAL PRIMARY KEY,
  business_slug TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  ref_id TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_token_tx_slug ON token_transactions(business_slug);
CREATE INDEX IF NOT EXISTS idx_token_tx_type ON token_transactions(type);

CREATE TABLE IF NOT EXISTS ad_boosts (
  id SERIAL PRIMARY KEY,
  business_slug TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  tokens_spent INTEGER NOT NULL,
  boost_days INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_ad_boosts_slug ON ad_boosts(business_slug);
CREATE INDEX IF NOT EXISTS idx_ad_boosts_active ON ad_boosts(is_active, ends_at);

ALTER TABLE exchange_banners ADD COLUMN IF NOT EXISTS adsense_code TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS name_en TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS qr_tracking_url TEXT;

CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title_fa TEXT NOT NULL,
  excerpt_fa TEXT,
  body_fa TEXT,
  cover_image_url TEXT,
  author TEXT NOT NULL DEFAULT 'تیم ایرانیو',
  category TEXT NOT NULL DEFAULT 'عمومی',
  tags TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  view_count INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, published_at DESC);
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

const BLOG_POSTS = [
  {
    slug: "sabt-sherkate-limited-dar-engelestan",
    title_fa: "راهنمای جامع ثبت شرکت Limited در انگلستان برای ایرانیان",
    excerpt_fa: "اگر به فکر راه‌اندازی کسب‌وکار در بریتانیا هستید، ثبت شرکت Limited یکی از محبوب‌ترین گزینه‌هاست. در این مقاله گام‌به‌گام توضیح می‌دهیم چگونه می‌توانید شرکت خود را در Companies House ثبت کنید.",
    body_fa: `<h2>چرا شرکت Limited؟</h2><p>شرکت Limited (Ltd) ساختاری حقوقی است که مسئولیت سهام‌داران را محدود می‌کند. این یعنی در صورت ورشکستگی، دارایی‌های شخصی شما در خطر نیست.</p><h2>مدارک مورد نیاز</h2><ul><li>مدرک هویت معتبر (پاسپورت یا کارت اقامت)</li><li>آدرس ثبت‌شده در بریتانیا</li><li>انتخاب نام شرکت منحصربه‌فرد</li><li>حداقل یک مدیر (Director) که بالای ۱۶ سال باشد</li></ul><h2>مراحل ثبت</h2><ol><li>بررسی نام شرکت در سایت Companies House</li><li>تهیه Memorandum of Association</li><li>ثبت‌نام آنلاین در gov.uk (هزینه: ۱۲ پوند)</li><li>دریافت Certificate of Incorporation</li><li>باز کردن حساب بانکی تجاری</li><li>ثبت‌نام در HMRC برای مالیات</li></ol><h2>نکات مهم</h2><p>پس از ثبت شرکت، باید در HMRC ثبت‌نام کنید و اگر گردش مالی شما بیش از ۸۵,۰۰۰ پوند در سال باشد، برای VAT نیز ثبت‌نام کنید.</p>`,
    category: "کسب‌وکار",
    tags: "ثبت شرکت,Limited Company,Companies House,کسب‌وکار",
    author: "تیم ایرانیو",
  },
  {
    slug: "hesab-banki-tejari-britaniya",
    title_fa: "چگونه حساب بانکی تجاری در بریتانیا باز کنیم؟",
    excerpt_fa: "باز کردن حساب بانکی تجاری برای ایرانیان مقیم بریتانیا یکی از چالش‌های اولیه است. در این راهنما با بهترین بانک‌ها و مدارک مورد نیاز آشنا می‌شوید.",
    body_fa: `<h2>اهمیت حساب بانکی تجاری</h2><p>داشتن حساب بانکی تجاری جدا از حساب شخصی برای هر کسب‌وکاری در بریتانیا ضروری است. این کار مدیریت مالی را ساده‌تر می‌کند و در زمان مالیات‌دهی بسیار کمک‌کننده است.</p><h2>بانک‌های مناسب</h2><ul><li><strong>Starling Bank</strong> – افتتاح آنلاین، بدون کارمزد ماهانه</li><li><strong>Tide</strong> – مناسب برای فریلنسرها و شرکت‌های کوچک</li><li><strong>Revolut Business</strong> – کارت‌های چندارزی و حواله بین‌المللی</li><li><strong>HSBC / Barclays</strong> – بانک‌های سنتی با شعب فیزیکی</li></ul><h2>مدارک مورد نیاز</h2><ul><li>Certificate of Incorporation شرکت</li><li>مدرک هویت مدیر</li><li>اثبات آدرس (قبض برق یا اجاره‌نامه)</li><li>Memorandum of Association</li></ul><h2>نکته مهم برای ایرانیان</h2><p>برخی بانک‌های سنتی ممکن است به دلیل محدودیت‌های تحریم از افتتاح حساب خودداری کنند. بانک‌های دیجیتال مثل Starling و Tide معمولاً انعطاف بیشتری دارند.</p>`,
    category: "مالی",
    tags: "حساب بانکی,بانک تجاری,Starling,Tide",
    author: "تیم ایرانیو",
  },
  {
    slug: "maliyat-corporation-tax-engelestan",
    title_fa: "مالیات شرکت (Corporation Tax) در انگلستان: راهنمای ایرانیان",
    excerpt_fa: "درک مالیات در بریتانیا برای کارآفرینان ایرانی اهمیت حیاتی دارد. از Corporation Tax گرفته تا Self Assessment، این مقاله همه چیز را توضیح می‌دهد.",
    body_fa: `<h2>انواع مالیات در بریتانیا</h2><p>اگر صاحب کسب‌وکار در بریتانیا هستید، با چند نوع مالیات سروکار خواهید داشت:</p><ul><li><strong>Corporation Tax</strong>: مالیات بر سود شرکت (در حال حاضر ۱۹-۲۵٪)</li><li><strong>VAT</strong>: مالیات بر ارزش افزوده (۲۰٪ برای اکثر کالاها)</li><li><strong>PAYE</strong>: مالیات حقوق کارمندان</li><li><strong>Self Assessment</strong>: برای مدیرانی که از شرکت حقوق یا سود دریافت می‌کنند</li></ul><h2>مهلت‌های مهم</h2><ul><li>Corporation Tax باید ۹ ماه بعد از پایان سال مالی پرداخت شود</li><li>اظهارنامه Corporation Tax باید ۱۲ ماه بعد از پایان سال مالی ارسال شود</li><li>Self Assessment تا ۳۱ ژانویه هر سال</li></ul><h2>توصیه</h2><p>استفاده از نرم‌افزارهای حسابداری مثل Xero یا QuickBooks، یا استخدام یک حسابدار آشنا به زبان فارسی، می‌تواند بسیار کمک‌کننده باشد.</p>`,
    category: "مالی",
    tags: "مالیات,Corporation Tax,HMRC,حسابداری",
    author: "تیم ایرانیو",
  },
  {
    slug: "national-insurance-bime-meli-britaniya",
    title_fa: "بیمه ملی (National Insurance) در بریتانیا: همه چیز برای ایرانیان",
    excerpt_fa: "National Insurance یکی از پایه‌های سیستم رفاهی بریتانیاست. بدانید چه کسانی باید پرداخت کنند، چه مقدار، و چه مزایایی دریافت می‌کنند.",
    body_fa: `<h2>NI چیست؟</h2><p>National Insurance (NI) پرداختی است که به کارمندان، کارفرمایان و افراد خوداشتغال در بریتانیا تعلق می‌گیرد. این پرداخت‌ها حق دسترسی به مزایای دولتی مثل State Pension، بیمه بیکاری و NHS را فراهم می‌کند.</p><h2>شماره NI</h2><p>اولین قدم دریافت شماره National Insurance است. می‌توانید از طریق سایت gov.uk یا تماس با HMRC این کار را انجام دهید. این شماره مادام‌العمر است.</p><h2>نرخ‌های NI (۲۰۲۴)</h2><ul><li>کارمندان: ۸٪ بر درآمد بین £۱۲,۵۷۰ تا £۵۰,۲۷۰</li><li>کارفرمایان: ۱۳.۸٪ بر هر پوند بالای £۹,۱۰۰</li><li>خوداشتغالان: Class 2 و Class 4</li></ul><h2>مزایا</h2><p>با پرداخت NI، حق دریافت State Pension، مرخصی زایمان پولی، و مزایای بیماری را خواهید داشت.</p>`,
    category: "حقوقی",
    tags: "National Insurance,بیمه,مزایا,NI Number",
    author: "تیم ایرانیو",
  },
  {
    slug: "viza-innovator-founder-britaniya",
    title_fa: "ویزای Innovator Founder: مسیر کارآفرینی در بریتانیا",
    excerpt_fa: "اگر ایده‌ای نوآورانه دارید و می‌خواهید در بریتانیا کسب‌وکار راه‌اندازی کنید، ویزای Innovator Founder می‌تواند مسیر شما باشد.",
    body_fa: `<h2>ویزای Innovator Founder چیست؟</h2><p>این ویزا از آوریل ۲۰۲۳ جایگزین ویزاهای Start-up و Innovator شد. برای افرادی طراحی شده که می‌خواهند یک کسب‌وکار نوآورانه، قابل رشد و جدید در بریتانیا تأسیس کنند.</p><h2>شرایط اصلی</h2><ul><li>داشتن ایده تجاری نوآورانه و قابل توسعه</li><li>تأییدیه از یک Endorsing Body معتبر</li><li>توانایی مالی اثبات‌شده</li><li>مدرک زبان انگلیسی (B2 یا بالاتر)</li></ul><h2>مزایا</h2><ul><li>اجازه کار آزاد در بریتانیا</li><li>همراه بردن خانواده</li><li>پس از ۳ سال، امکان دریافت Indefinite Leave to Remain</li></ul><h2>Endorsing Bodies فعال</h2><p>سازمان‌هایی مثل Innovate UK، انجمن‌های دانشگاهی و شتاب‌دهنده‌های تجاری می‌توانند به عنوان Endorsing Body عمل کنند.</p>`,
    category: "مهاجرت",
    tags: "ویزا,Innovator Founder,کارآفرینی,مهاجرت",
    author: "تیم ایرانیو",
  },
  {
    slug: "estekhdaam-karmand-dar-britaniya",
    title_fa: "استخدام کارمند در بریتانیا: راهنمای جامع برای کارفرمایان ایرانی",
    excerpt_fa: "استخدام اولین کارمند در بریتانیا با قوانین و مسئولیت‌های خاصی همراه است. از PAYE گرفته تا حداقل دستمزد، این راهنما همه چیز را پوشش می‌دهد.",
    body_fa: `<h2>قبل از استخدام</h2><ul><li>ثبت‌نام به عنوان کارفرما در HMRC</li><li>بررسی حق کار متقاضی در بریتانیا (Right to Work check)</li><li>تهیه قرارداد کار مکتوب</li><li>بیمه مسئولیت کارفرمایی (Employers' Liability Insurance) - اجباری</li></ul><h2>حداقل دستمزد ۲۰۲۴</h2><ul><li>بالای ۲۱ سال: £۱۱.۴۴ در ساعت</li><li>۱۸ تا ۲۰ سال: £۸.۶۰ در ساعت</li><li>زیر ۱۸ سال: £۶.۴۰ در ساعت</li></ul><h2>مرخصی استحقاقی</h2><p>هر کارمند حق دارد حداقل ۲۸ روز مرخصی پولی در سال داشته باشد (شامل روزهای تعطیل رسمی).</p><h2>PAYE</h2><p>باید مالیات و National Insurance کارمندان را از حقوق کسر و به HMRC پرداخت کنید.</p>`,
    category: "کسب‌وکار",
    tags: "استخدام,PAYE,حداقل دستمزد,کارفرما",
    author: "تیم ایرانیو",
  },
  {
    slug: "khane-kharid-dar-britaniya",
    title_fa: "خرید خانه در بریتانیا: راهنمای کامل برای ایرانیان",
    excerpt_fa: "خرید ملک در بریتانیا برای ایرانیان مقیم این کشور یکی از بزرگ‌ترین تصمیمات مالی است. از وام مسکن گرفته تا مالیات خرید، همه چیز را اینجا بیاموزید.",
    body_fa: `<h2>مراحل خرید خانه</h2><ol><li>تعیین بودجه و گرفتن Agreement in Principle از بانک</li><li>جستجوی ملک از طریق Rightmove، Zoopla یا مشاور</li><li>ارائه پیشنهاد قیمت (Making an Offer)</li><li>تعیین وکیل (Solicitor/Conveyancer)</li><li>انجام Survey (بازرسی ملک)</li><li>تبادل قراردادها (Exchange of Contracts)</li><li>اتمام معامله (Completion)</li></ol><h2>مالیات خرید ملک (Stamp Duty)</h2><p>برای ملک‌های بالای £۲۵۰,۰۰۰ مالیات Stamp Duty پرداخت می‌شود. اگر خانه اول شماست، معافیت‌هایی وجود دارد.</p><h2>وام مسکن (Mortgage)</h2><p>بانک‌ها معمولاً ۴ تا ۵ برابر درآمد سالانه شما وام می‌دهند و نیاز به ۱۰-۲۰٪ پیش‌پرداخت دارید.</p>`,
    category: "زندگی",
    tags: "خانه,ملک,وام مسکن,Stamp Duty",
    author: "تیم ایرانیو",
  },
  {
    slug: "barin-manategh-london-zendegi-irani",
    title_fa: "بهترین مناطق لندن برای زندگی ایرانیان",
    excerpt_fa: "لندن خانه بزرگ‌ترین جامعه ایرانی در اروپاست. اما کدام محله‌ها بیشترین جمعیت ایرانی دارند و برای زندگی مناسب‌ترند؟",
    body_fa: `<h2>محله‌های محبوب ایرانیان در لندن</h2><h3>هرو (Harrow)</h3><p>با فروشگاه‌ها، رستوران‌ها و مطب‌های ایرانی فراوان، هرو قلب جامعه ایرانی لندن است. نرخ اجاره معقول‌تری نسبت به مرکز لندن دارد.</p><h3>ایلینگ (Ealing) و آکتون (Acton)</h3><p>منطقه‌ای پر از ایرانیان با دسترسی خوب به حمل‌ونقل عمومی.</p><h3>شمال لندن (Finchley, Golders Green)</h3><p>محله‌های آرام خانوادگی با مدارس خوب و فرهنگ متنوع.</p><h3>کینگستون و ریچموند</h3><p>مناطق سبز و آرام جنوب غربی لندن، محبوب خانواده‌های ایرانی با بودجه بیشتر.</p><h2>هزینه زندگی</h2><p>اجاره یک خانه ۳ خوابه در هرو: ۱,۸۰۰-۲,۵۰۰ پوند در ماه. در مرکز لندن: ۳,۵۰۰-۵,۰۰۰ پوند.</p>`,
    category: "زندگی",
    tags: "لندن,محله,هرو,زندگی",
    author: "تیم ایرانیو",
  },
  {
    slug: "restoran-irani-britaniya-rahandazi",
    title_fa: "راه‌اندازی رستوران ایرانی در بریتانیا: گام‌های ضروری",
    excerpt_fa: "رستوران‌های ایرانی در بریتانیا با اقبال خوبی روبرو هستند. اگر به فکر راه‌اندازی رستوران هستید، این چک‌لیست کامل را بخوانید.",
    body_fa: `<h2>مجوزهای لازم</h2><ul><li><strong>Food Business Registration</strong>: از شورای محلی (شهرداری)</li><li><strong>Food Hygiene Rating</strong>: بازرسی سلامت غذایی</li><li><strong>Premises Licence</strong>: مجوز محل (اگر الکل سرو می‌کنید)</li><li><strong>Planning Permission</strong>: اگر محل را تغییر کاربری می‌دهید</li></ul><h2>الزامات بهداشتی</h2><p>آموزش Food Safety اجباری است. گواهی Level 2 برای همه کارکنان و Level 3 برای مدیران توصیه می‌شود.</p><h2>هزینه‌های اولیه تخمینی</h2><ul><li>اجاره و ودیعه: ۳۰,۰۰۰-۱۰۰,۰۰۰ پوند</li><li>تجهیزات آشپزخانه: ۲۰,۰۰۰-۵۰,۰۰۰ پوند</li><li>دکوراسیون و فیت‌اوت: ۵۰,۰۰۰-۱۵۰,۰۰۰ پوند</li></ul><h2>بازاریابی</h2><p>ثبت در Google My Business، Deliveroo/Uber Eats، و شبکه‌های اجتماعی از همان روز اول ضروری است.</p>`,
    category: "کسب‌وکار",
    tags: "رستوران,غذا,مجوز,Food Business",
    author: "تیم ایرانیو",
  },
  {
    slug: "shahrvandi-britaniya-masir-va-elzamat",
    title_fa: "شهروندی بریتانیا: مسیر و الزامات برای ایرانیان",
    excerpt_fa: "دریافت شهروندی بریتانیا یکی از آرزوهای بسیاری از ایرانیان مقیم این کشور است. بیایید مراحل، شرایط و زمان‌بندی این مسیر را با هم مرور کنیم.",
    body_fa: `<h2>مسیر استاندارد</h2><ol><li>دریافت ویزای اقامت (Skilled Worker, Family, Student...)</li><li>پس از ۵ سال اقامت مداوم: درخواست Indefinite Leave to Remain (ILR)</li><li>پس از ۱ سال با ILR: درخواست شهروندی (Naturalisation)</li></ol><h2>شرایط ILR</h2><ul><li>۵ سال اقامت قانونی</li><li>قبولی در آزمون Life in the UK</li><li>مدرک زبان انگلیسی (B1)</li><li>عدم غیبت بیش از ۱۸۰ روز در هر سال</li></ul><h2>شرایط شهروندی</h2><ul><li>حداقل ۱ سال با ILR</li><li>ثبت کردن ۳ سال اخیر در بریتانیا</li><li>قصد ادامه زندگی در بریتانیا</li><li>شخصیت خوب (good character)</li></ul><h2>هزینه‌ها</h2><p>هزینه درخواست ILR: حدود £۲,۸۸۵. هزینه شهروندی: £۱,۴۲۲ (۲۰۲۴).</p>`,
    category: "مهاجرت",
    tags: "شهروندی,ILR,مهاجرت,بریتانیا",
    author: "تیم ایرانیو",
  },
  {
    slug: "nhs-khadamat-behdashti-britaniya-irani",
    title_fa: "راهنمای NHS: چگونه از خدمات بهداشتی بریتانیا استفاده کنیم",
    excerpt_fa: "NHS (National Health Service) سیستم بهداشتی رایگان بریتانیاست. بیاموزید چطور ثبت‌نام کنید، پزشک انتخاب کنید و از خدمات استفاده کنید.",
    body_fa: `<h2>ثبت‌نام در NHS</h2><p>برای استفاده از NHS باید ابتدا یک GP (پزشک عمومی) انتخاب کنید. سایت nhs.uk به شما کمک می‌کند GP نزدیک به خانه‌تان را پیدا کنید.</p><h2>خدمات رایگان NHS</h2><ul><li>ویزیت پزشک عمومی (GP)</li><li>بستری در بیمارستان</li><li>عمل جراحی اورژانسی</li><li>مراقبت از کودکان</li><li>بهداشت روان</li></ul><h2>خدمات با هزینه</h2><ul><li>دندانپزشکی (NHS Dental charges)</li><li>دارو (Prescription charge: £۹.۹۰ در ۲۰۲۴)</li><li>برخی خدمات چشم‌پزشکی</li></ul><h2>کارت Exemption</h2><p>اگر درآمد کمی دارید، بیکار هستید یا کودکان زیر ۱۶ سال دارید، ممکن است از پرداخت هزینه معاف باشید.</p><h2>اورژانس</h2><p>برای اورژانس‌های واقعی: ۹۹۹. برای مشکلات غیراورژانسی: ۱۱۱.</p>`,
    category: "زندگی",
    tags: "NHS,بهداشت,GP,پزشک",
    author: "تیم ایرانیو",
  },
  {
    slug: "hoghooq-mostajer-dar-britaniya",
    title_fa: "حقوق مستأجر در بریتانیا: آنچه هر ایرانی باید بداند",
    excerpt_fa: "قوانین اجاره در بریتانیا از مستأجر حمایت می‌کنند. از ودیعه گرفته تا اخراج غیرقانونی، حقوق خود را بشناسید.",
    body_fa: `<h2>ودیعه (Deposit)</h2><p>موجر موظف است ودیعه را در یک طرح ودیعه مجاز (Deposit Protection Scheme) مثل DPS، MyDeposits یا TDS نگهداری کند. اگر این کار را نکند، می‌توانید ۳ برابر ودیعه غرامت بگیرید.</p><h2>اخراج قانونی</h2><p>موجر نمی‌تواند بدون اطلاع قبلی شما را اخراج کند. باید Section 21 یا Section 8 Notice داده شود. در اغلب موارد حداقل ۲ ماه اطلاع‌رسانی لازم است.</p><h2>تعمیرات</h2><p>موجر مسئول تعمیر و نگهداری ساختمان، لوله‌کشی، گرمایش و تأسیسات اصلی است. اگر موجر اقدام نکرد، می‌توانید شکایت به شورای محلی ببرید.</p><h2>افزایش اجاره</h2><p>در طول قرارداد، موجر نمی‌تواند بدون توافق اجاره را افزایش دهد. بعد از پایان قرارداد، باید با Rent Review Clause یا Notice صحیح عمل کند.</p>`,
    category: "حقوقی",
    tags: "اجاره,مستأجر,ودیعه,حقوق",
    author: "تیم ایرانیو",
  },
  {
    slug: "shabake-sazi-tejari-jame-irani-britaniya",
    title_fa: "شبکه‌سازی تجاری در جامعه ایرانی بریتانیا",
    excerpt_fa: "موفقیت در تجارت بریتانیا تنها به مهارت‌های فنی بستگی ندارد؛ شبکه ارتباطی قوی می‌تواند درهای بسیاری را باز کند. در این مقاله روش‌های موثر شبکه‌سازی را معرفی می‌کنیم.",
    body_fa: `<h2>اتاق بازرگانی ایرانی-بریتانیایی</h2><p>Iran-Britain Chamber of Commerce (IBCC) یکی از مهم‌ترین سازمان‌های تجاری ایرانیان در بریتانیاست. عضویت در این اتاق امکان دسترسی به رویدادها و ارتباطات تجاری را فراهم می‌کند.</p><h2>رویدادهای کارآفرینی</h2><p>سازمان‌هایی مثل Techiran London، Persian Entrepreneurs Network و رویدادهای Meetup تجاری ایرانی در لندن به طور منظم برگزار می‌شوند.</p><h2>LinkedIn</h2><p>پروفایل حرفه‌ای LinkedIn داشته باشید و در گروه‌های ایرانیان مقیم بریتانیا عضو شوید. ارسال محتوای ارزشمند باعث می‌شود دیگران شما را بشناسید.</p><h2>انجمن‌های صنفی</h2><p>در انجمن‌های صنفی مرتبط با حوزه کاری‌تان عضو شوید. این کار اعتبار حرفه‌ای شما را افزایش می‌دهد.</p>`,
    category: "کسب‌وکار",
    tags: "شبکه‌سازی,ارتباطات,تجارت,لندن",
    author: "تیم ایرانیو",
  },
  {
    slug: "vam-va-tejhizat-mali-baraye-kasbokar-jaded",
    title_fa: "وام و تأمین مالی برای کسب‌وکارهای نوپا در بریتانیا",
    excerpt_fa: "از Start Up Loans دولتی گرفته تا سرمایه‌گذاران Angel، بریتانیا گزینه‌های متعددی برای تأمین مالی کسب‌وکار نوپا ارائه می‌دهد.",
    body_fa: `<h2>Start Up Loan</h2><p>برنامه دولتی Start Up Loans تا £۲۵,۰۰۰ وام با نرخ بهره ۶٪ برای کسب‌وکارهای جدید ارائه می‌دهد. همراه با مشاوره رایگان است.</p><h2>Innovate UK Grants</h2><p>Innovate UK کمک‌هزینه‌های تحقیق و توسعه برای استارت‌آپ‌های فناوری‌محور ارائه می‌دهد.</p><h2>Angel Investors</h2><p>شبکه‌هایی مثل AngelList، UK Angel Investors Network و Seedrs می‌توانند سرمایه اولیه در ازای سهام شرکت فراهم کنند.</p><h2>Crowdfunding</h2><p>پلتفرم‌هایی مثل Kickstarter، Indiegogo و Crowdcube برای جذب سرمایه از عموم مردم گزینه خوبی هستند.</p><h2>SEIS/EIS</h2><p>این طرح‌های مالیاتی دولتی، سرمایه‌گذاری در استارت‌آپ‌ها را برای سرمایه‌گذاران جذاب می‌کند و جذب سرمایه را آسان‌تر می‌سازد.</p>`,
    category: "مالی",
    tags: "وام,سرمایه,Start Up Loan,Crowdfunding",
    author: "تیم ایرانیو",
  },
  {
    slug: "ersal-pool-iran-az-britaniya",
    title_fa: "ارسال پول به ایران از بریتانیا: بهترین روش‌ها در ۲۰۲۴",
    excerpt_fa: "با توجه به تحریم‌ها، ارسال پول به ایران از بریتانیا با چالش‌هایی همراه است. اما روش‌های قانونی و امنی وجود دارند که ایرانیان مقیم بریتانیا از آن‌ها استفاده می‌کنند.",
    body_fa: `<h2>صرافی‌ها (Hawala)</h2><p>صرافی‌های ایرانی مقیم بریتانیا (عمدتاً در لندن) یکی از رایج‌ترین روش‌ها هستند. این روش سریع است اما باید از صرافی‌های معتبر و دارای مجوز FCA استفاده کنید.</p><h2>کریپتو</h2><p>در سال‌های اخیر، بیت‌کوین و ارزهای دیجیتال دیگر به روشی برای انتقال ارزش تبدیل شده‌اند. این روش ریسک نوسان قیمت دارد.</p><h2>نکات مهم</h2><ul><li>همیشه از صرافی‌های دارای مجوز FCA استفاده کنید</li><li>مبالغ بالا را باید به HMRC گزارش دهید</li><li>رسیدهای همه تراکنش‌ها را نگه دارید</li></ul><h2>محدودیت‌های قانونی</h2><p>به دلیل تحریم‌ها، بانک‌های بریتانیایی معمولاً امکان حواله مستقیم به ایران را نمی‌دهند. صرافی‌های مجاز این کار را از طریق شبکه‌های خود انجام می‌دهند.</p>`,
    category: "مالی",
    tags: "حواله,صرافی,ارز,ایران",
    author: "تیم ایرانیو",
  },
  {
    slug: "tahsil-farzandan-madares-britaniya",
    title_fa: "تحصیل فرزندان در مدارس بریتانیا: راهنمای خانواده‌های ایرانی",
    excerpt_fa: "سیستم آموزشی بریتانیا برای خانواده‌های ایرانی تازه‌وارد ممکن است پیچیده به نظر برسد. از انتخاب مدرسه تا امتحانات GCSEو A-Level، این راهنما کمک می‌کند.",
    body_fa: `<h2>ساختار سیستم آموزشی</h2><ul><li><strong>Primary School</strong>: ۴ تا ۱۱ سال</li><li><strong>Secondary School</strong>: ۱۱ تا ۱۶ سال</li><li><strong>Sixth Form/College</strong>: ۱۶ تا ۱۸ سال (GCSE → A-Level)</li><li><strong>University</strong>: ۱۸ سال به بالا</li></ul><h2>انتخاب مدرسه</h2><p>سایت Ofsted به شما امتیاز مدارس را نشان می‌دهد. برای مدارس دولتی، باید در ناحیه جغرافیایی آن‌ها زندگی کنید. برای مدارس خصوصی، مصاحبه و آزمون ورودی لازم است.</p><h2>حمایت از فرزندان ایرانی</h2><p>اگر فرزندتان EAL (English as Additional Language) است، مدارس موظفند حمایت ویژه زبانی ارائه دهند.</p><h2>GCSE و A-Level</h2><p>GCSEها در سن ۱۶ سالگی و A-Levelها در ۱۸ سالگی برگزار می‌شوند. نتایج A-Level اساس پذیرش دانشگاه هستند.</p>`,
    category: "زندگی",
    tags: "مدرسه,تحصیل,GCSE,A-Level",
    author: "تیم ایرانیو",
  },
  {
    slug: "kaar-freelance-va-khodashteghali-dar-britaniya",
    title_fa: "کار فریلنس و خوداشتغالی در بریتانیا: راهنمای ایرانیان",
    excerpt_fa: "فریلنسینگ و خوداشتغالی در بریتانیا محبوب است اما مسئولیت‌های مالیاتی خاص خود را دارد. در این مقاله همه چیز از Self Assessment تا بیمه را توضیح می‌دهیم.",
    body_fa: `<h2>ثبت به عنوان Self-Employed</h2><p>باید تا ۵ اکتبر سال بعد از شروع کارتان به HMRC اطلاع دهید. ثبت‌نام رایگان و آنلاین است.</p><h2>Self Assessment</h2><p>هر سال باید اظهارنامه مالیاتی Self Assessment پر کنید. مهلت آنلاین: ۳۱ ژانویه. مهلت کاغذی: ۳۱ اکتبر.</p><h2>National Insurance برای خوداشتغالان</h2><ul><li>Class 2: £۳.۴۵ در هفته (اگر سود بالای £۱۲,۵۷۰ باشد)</li><li>Class 4: ۹٪ بر سود بین £۱۲,۵۷۰ تا £۵۰,۲۷۰</li></ul><h2>هزینه‌های قابل کسر</h2><p>هزینه‌های مرتبط با کار مثل دفتر خانگی، تجهیزات، سفر تجاری و آموزش حرفه‌ای را می‌توانید از درآمد کسر کنید.</p><h2>مشتریان بین‌المللی</h2><p>اگر از مشتریان خارج از بریتانیا درآمد دارید، معمولاً VAT اعمال نمی‌شود (Zero-rated).</p>`,
    category: "کسب‌وکار",
    tags: "فریلنس,خوداشتغالی,Self Assessment,مالیات",
    author: "تیم ایرانیو",
  },
  {
    slug: "mostajer-yaa-malekiyat-dar-britaniya",
    title_fa: "اجاره یا خرید: کدام گزینه برای ایرانیان در بریتانیا بهتر است؟",
    excerpt_fa: "یکی از بزرگ‌ترین تصمیمات مالی در بریتانیا، انتخاب بین اجاره و خرید ملک است. این مقاله مزایا و معایب هر گزینه را بررسی می‌کند.",
    body_fa: `<h2>مزایای اجاره</h2><ul><li>انعطاف‌پذیری بیشتر برای جابجایی</li><li>سرمایه اولیه کمتر</li><li>بدون نگرانی از تعمیرات اساسی</li><li>مناسب برای تازه‌واردان</li></ul><h2>مزایای خرید</h2><ul><li>سرمایه‌گذاری بلندمدت</li><li>آزادی در تغییر و تزئین</li><li>عدم وابستگی به موجر</li><li>امنیت بیشتر برای خانواده</li></ul><h2>وضعیت بازار مسکن</h2><p>قیمت مسکن در لندن در سال ۲۰۲۴ به طور میانگین حدود £۵۰۰,۰۰۰ است. در مناطق شمالی انگلستان می‌توان با £۱۵۰,۰۰۰-۲۰۰,۰۰۰ خانه خرید.</p><h2>محاسبه</h2><p>اگر اجاره ماهانه شما بیش از ۳۰٪ هزینه وام مسکن معادل باشد، خرید ممکن است به صرفه‌تر باشد.</p>`,
    category: "مالی",
    tags: "اجاره,خرید,مسکن,سرمایه‌گذاری",
    author: "تیم ایرانیو",
  },
  {
    slug: "farhang-kar-dar-britaniya-irani",
    title_fa: "فرهنگ کار در بریتانیا: تفاوت‌هایی که ایرانیان باید بدانند",
    excerpt_fa: "موفقیت در محیط کار بریتانیایی نیازمند درک فرهنگ و عرف‌های آن است. از punctuality گرفته تا ارتباطات غیررسمی، این مقاله تفاوت‌های مهم را توضیح می‌دهد.",
    body_fa: `<h2>دقت در وقت‌شناسی</h2><p>در بریتانیا وقت‌شناسی بسیار مهم است. برای جلسات کاری حتماً ۵ دقیقه زودتر حاضر باشید. دیر رسیدن به جلسه بدون اطلاع‌رسانی قبلی بسیار بی‌ادبانه تلقی می‌شود.</p><h2>ارتباطات غیرمستقیم</h2><p>بریتانیایی‌ها معمولاً از روش‌های غیرمستقیم برای انتقاد استفاده می‌کنند. "That's interesting" ممکن است به معنای مخالفت باشد!</p><h2>Small Talk</h2><p>صحبت درباره آب‌وهوا، تعطیلات آخر هفته یا ورزش رایج است. این نوع گفتگو روابط کاری را گرم‌تر می‌کند.</p><h2>تعادل کار و زندگی</h2><p>در بریتانیا حداکثر ۴۸ ساعت کار در هفته قانونی است (با توافق می‌توان این حق را موقتاً کنار گذاشت). فرهنگ باقی ماندن بی‌دلیل در اداره مثبت تلقی نمی‌شود.</p>`,
    category: "زندگی",
    tags: "فرهنگ,محیط کار,بریتانیا,ارتباطات",
    author: "تیم ایرانیو",
  },
  {
    slug: "online-presence-kasbokar-irani-britaniya",
    title_fa: "حضور آنلاین برای کسب‌وکارهای ایرانی در بریتانیا",
    excerpt_fa: "در دنیای امروز، کسب‌وکارهای ایرانی در بریتانیا برای جذب مشتری باید حضور آنلاین قوی داشته باشند. از Google My Business تا شبکه‌های اجتماعی، راهنمای کاملی اینجاست.",
    body_fa: `<h2>Google My Business</h2><p>ثبت‌نام در Google My Business (اکنون Google Business Profile) اولین و مهم‌ترین قدم است. این کار باعث می‌شود کسب‌وکارتان در جستجوهای محلی گوگل ظاهر شود.</p><h2>وبسایت حرفه‌ای</h2><p>حتی یک وبسایت ساده و حرفه‌ای اعتبار کسب‌وکارتان را بالا می‌برد. پلتفرم‌هایی مثل Wix، Squarespace یا WordPress با هزینه کم این امکان را می‌دهند.</p><h2>شبکه‌های اجتماعی</h2><ul><li>Instagram برای کسب‌وکارهای غذایی، زیبایی و خرده‌فروشی</li><li>LinkedIn برای B2B و خدمات حرفه‌ای</li><li>WhatsApp Business برای ارتباط مستقیم با مشتری</li></ul><h2>نقد و نظرات آنلاین</h2><p>درخواست از مشتریان راضی برای نوشتن نظر در Google و Trustpilot بسیار مهم است. ۸۷٪ مشتریان قبل از خرید نقد آنلاین می‌خوانند.</p><h2>دایرکتوری ایرانیو</h2><p>ثبت کسب‌وکارتان در دایرکتوری directory.iraniu.uk یکی از بهترین راه‌ها برای دسترسی به جامعه ایرانی بریتانیاست.</p>`,
    category: "کسب‌وکار",
    tags: "آنلاین,دیجیتال,Google,شبکه اجتماعی",
    author: "تیم ایرانیو",
  },
];

async function seedBlogPosts() {
  const countRow = await dbGet(`SELECT COUNT(*)::int AS c FROM blog_posts`);
  if (countRow.c > 0) return;
  for (const post of BLOG_POSTS) {
    await dbRun(
      `INSERT INTO blog_posts (slug, title_fa, excerpt_fa, body_fa, cover_image_url, author, category, tags, is_published, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (slug) DO NOTHING`,
      [
        post.slug,
        post.title_fa,
        post.excerpt_fa || "",
        post.body_fa || "",
        post.cover_image_url || "",
        post.author || "تیم ایرانیو",
        post.category || "عمومی",
        post.tags || "",
        1,
        new Date().toISOString(),
      ]
    );
  }
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
  await seedBlogPosts();
}
