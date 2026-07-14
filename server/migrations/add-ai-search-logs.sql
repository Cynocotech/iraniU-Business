-- Run once:
-- psql -d directory_iraniu_uk -f server/migrations/add-ai-search-logs.sql

CREATE TABLE IF NOT EXISTS public.ai_search_logs (
  id             SERIAL PRIMARY KEY,
  query          TEXT NOT NULL,
  parsed_json    TEXT,
  search_text    TEXT,
  returned_slugs TEXT,
  result_count   INTEGER,
  clicked_slug   TEXT,
  feedback       SMALLINT,
  duration_ms    INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON public.ai_search_logs TO directory_user;
GRANT USAGE, SELECT ON SEQUENCE public.ai_search_logs_id_seq TO directory_user;
