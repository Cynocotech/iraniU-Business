-- Add postcode field to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS postcode TEXT;

-- Add index for faster postcode lookups
CREATE INDEX IF NOT EXISTS idx_businesses_postcode ON businesses(postcode);
