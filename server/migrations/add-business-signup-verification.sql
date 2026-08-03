-- Add email-verification fields for the public business onboarding flow
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS signup_verify_token TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS signup_verify_expires_at TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS signup_email_verified_at TEXT;
