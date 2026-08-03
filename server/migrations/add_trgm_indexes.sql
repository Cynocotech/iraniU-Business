-- Enable trigram extension and add GIN indexes for fast fuzzy-text search.
-- Run with:
--   psql "$DATABASE_URL" -f server/migrations/add_trgm_indexes.sql
--
-- Safe to re-run (all statements are idempotent).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS businesses_name_fa_trgm_idx
  ON public.businesses USING gin (name_fa gin_trgm_ops);

CREATE INDEX IF NOT EXISTS businesses_category_trgm_idx
  ON public.businesses USING gin (category gin_trgm_ops);

CREATE INDEX IF NOT EXISTS businesses_description_trgm_idx
  ON public.businesses USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS businesses_ai_tags_json_trgm_idx
  ON public.businesses USING gin (ai_tags_json gin_trgm_ops);
