import { dbRun } from "../db.js";

export async function initApiDb() {
  // Public API users table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS identity.api_users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    )
  `);

  // Link businesses to API users
  await dbRun(`
    ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS api_user_id INTEGER REFERENCES identity.api_users(id) ON DELETE SET NULL
  `);

  // Services table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      service_type TEXT,
      provider_name TEXT,
      phone TEXT,
      mobile TEXT,
      email TEXT,
      whatsapp TEXT,
      website TEXT,
      instagram TEXT,
      city TEXT,
      area_coverage TEXT,
      postcode TEXT,
      pricing_info TEXT,
      pricing_from TEXT,
      pricing_currency TEXT NOT NULL DEFAULT 'GBP',
      languages TEXT,
      availability TEXT,
      cover_image_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      api_user_id INTEGER REFERENCES identity.api_users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    )
  `);

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_api_users_email ON identity.api_users(email)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_businesses_api_user ON businesses(api_user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_services_status ON services(status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_services_api_user ON services(api_user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_services_city ON services(city)`);

  // Enhance reservations table with additional fields
  const reservationColumns = [
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS confirmation_code TEXT`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS occasion TEXT`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS special_requests TEXT`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS seating_preference TEXT`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS api_user_id INTEGER REFERENCES identity.api_users(id) ON DELETE SET NULL`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at TEXT`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS confirmed_at TEXT`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'website'`,
  ];
  for (const sql of reservationColumns) await dbRun(sql);

  await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_conf_code ON reservations(confirmation_code) WHERE confirmation_code IS NOT NULL`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_reservations_api_user ON reservations(api_user_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_reservations_created ON reservations(created_at DESC)`);

  // Ads / promotions table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ads (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      target_url TEXT,
      ad_type TEXT NOT NULL DEFAULT 'listing',
      placement TEXT NOT NULL DEFAULT 'listings',
      business_slug TEXT,
      contact_name TEXT,
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      budget_gbp NUMERIC(10,2),
      start_date DATE,
      end_date DATE,
      status TEXT NOT NULL DEFAULT 'pending',
      api_user_id INTEGER REFERENCES identity.api_users(id) ON DELETE SET NULL,
      impression_count INTEGER NOT NULL DEFAULT 0,
      click_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    )
  `);

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_ads_type ON ads(ad_type)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_ads_api_user ON ads(api_user_id)`);

  // Home page sections — admin-controlled content blocks
  await dbRun(`
    CREATE TABLE IF NOT EXISTS home_sections (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      eyebrow TEXT,
      section_type TEXT NOT NULL DEFAULT 'category-grid',
      category_filter TEXT,
      icon TEXT,
      background TEXT NOT NULL DEFAULT 'gray',
      max_items INTEGER NOT NULL DEFAULT 8,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_home_sections_order ON home_sections(is_active, sort_order)`);

  // Add category_filter to exchange_banners for targeted placement
  await dbRun(`ALTER TABLE exchange_banners ADD COLUMN IF NOT EXISTS category_filter TEXT DEFAULT ''`);
}
