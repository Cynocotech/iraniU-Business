# AI Search — Setup Guide

Semantic vector search powered by OpenAI (`text-embedding-3-small` + `gpt-4o-mini`).

## Prerequisites

- PostgreSQL with the **pgvector** extension. If your Postgres instance does not have it:
  - Docker: use the `pgvector/pgvector:pg16` image instead of the plain `postgres:16` image.
  - Managed DB (Supabase, Neon, Railway): enable the extension in the DB settings dashboard, then skip the `CREATE EXTENSION` line in the migration.
  - Self-hosted: install the OS package (`postgresql-16-pgvector` on Ubuntu) and restart Postgres.
- An **OpenAI API key** with access to `text-embedding-3-small` and `gpt-4o-mini`.

## 1. Set the environment variable

```bash
# server/.env
OPENAI_API_KEY=sk-...
```

## 2. Run the migration

```bash
psql "$DATABASE_URL" -f server/migrations/add-vector-embedding.sql
```

This adds `embedding vector(1536)` and `embedding_hash TEXT` columns to `businesses`, plus an HNSW index.

## 3. Run the embedding job

```bash
cd server
npm run embed:businesses
```

The job:
- Skips rows whose content hash hasn't changed (safe to re-run).
- NULLs out embeddings for non-approved listings so they drop out of search.
- Batches 100 texts per OpenAI API call.
- Prints a summary: `total / skipped / embedded / failed`.

## 4. Suggested cron (nightly re-embed)

```cron
0 2 * * * cd /path/to/server && npm run embed:businesses >> /var/log/embed.log 2>&1
```

## Manual test

```bash
curl -s -X POST http://localhost:3001/api/ai-search \
  -H "Content-Type: application/json" \
  -d '{"query":"رستوران ایرانی لندن","turnstileToken":""}' | jq .
```

> The `turnstileToken` field is verified by Cloudflare Turnstile. In local dev the
> server skips verification when `TURNSTILE_SECRET_KEY` is not configured.

Expected response shape:
```json
{
  "answer_fa": "چند رستوران ایرانی در لندن پیدا کردم:",
  "businesses": [
    {
      "slug": "some-restaurant",
      "name_fa": "رستوران ...",
      "subtitle": "...",
      "category": "رستوران",
      "city": "London",
      "rating": 4.5,
      "price_range": "متوسط",
      "cover_image_url": "...",
      "reason_fa": "رستوران ایرانی با منوی اصیل در مرکز لندن"
    }
  ]
}
```
