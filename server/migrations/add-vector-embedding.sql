-- Requires pgvector extension: https://github.com/pgvector/pgvector
-- Run against your Postgres instance AFTER enabling the extension.
-- Apply with: psql "$DATABASE_URL" -f server/migrations/add-vector-embedding.sql

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_hash TEXT;

CREATE INDEX IF NOT EXISTS businesses_embedding_idx
  ON public.businesses USING hnsw (embedding vector_cosine_ops);
