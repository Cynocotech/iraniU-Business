-- Forgot-password flow: shared reset-token table for managers, exchange managers, and super admins
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
