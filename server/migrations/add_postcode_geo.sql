-- Adds four geo-enrichment columns sourced from postcodes.io.
-- These are internal only — not exposed to public API responses.
-- Run with:
--   psql "$DATABASE_URL" -f server/migrations/add_postcode_geo.sql

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS postcode_latitude           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS postcode_longitude          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS postcode_primary_care_trust TEXT,
  ADD COLUMN IF NOT EXISTS postcode_admin_ward         TEXT;
