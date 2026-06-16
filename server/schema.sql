-- Iraniu Directory — PostgreSQL schema
-- One database, two schemas: public (directory/app) + identity (auth).
-- Apply with:  psql "$DATABASE_URL" -f server/schema.sql
-- The app also creates these on startup via initDb() (idempotent).

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
