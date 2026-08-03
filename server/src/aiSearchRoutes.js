import express from "express";
import { pool } from "./db.js";
import { verifyTurnstileToken } from "./turnstileVerify.js";
import { clientIp } from "./telegramNotify.js";

const router = express.Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MOBILE_APP_KEY = process.env.MOBILE_APP_KEY || "";
const GPT_MODEL = "gpt-4o-mini";
const EMBED_MODEL = "text-embedding-3-small";

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ── Rate limiter ──────────────────────────────────────────────────────────────
const _rateMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [ip, entry] of _rateMap) {
    if (entry.windowStart < cutoff) _rateMap.delete(ip);
  }
}, 5 * 60_000).unref();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = _rateMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    _rateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Category cache (refreshed every 6 hours) ──────────────────────────────────
let _categoryCache = [];
let _categoryCacheTime = 0;
const CATEGORY_TTL_MS = 6 * 60 * 60 * 1000;

async function getCategories() {
  if (Date.now() - _categoryCacheTime < CATEGORY_TTL_MS && _categoryCache.length > 0) {
    return _categoryCache;
  }
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT category FROM public.businesses
        WHERE listing_approval = 'approved' AND category IS NOT NULL
        ORDER BY category`
    );
    _categoryCache = rows.map((r) => r.category);
    _categoryCacheTime = Date.now();
    console.log(`[ai-search] category cache refreshed: ${_categoryCache.length} categories`);
  } catch (e) {
    console.warn("[ai-search] category cache refresh failed:", e.message);
  }
  return _categoryCache;
}

// Warm cache at startup
getCategories().catch(() => {});

// ── OpenAI helpers ────────────────────────────────────────────────────────────
async function openaiChat(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: GPT_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`OpenAI chat ${res.status}: ${body?.error?.message || "unknown"}`);
  }
  const data = await res.json();
  try {
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    return {};
  }
}

async function openaiEmbed(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`OpenAI embed ${res.status}: ${body?.error?.message || "unknown"}`);
  }
  const data = await res.json();
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error("Invalid embedding response from OpenAI");
  return embedding;
}

// ── DB retrieval helpers ──────────────────────────────────────────────────────
const BUSINESS_COLS = `id, slug, name_fa, listing_title, subtitle, description,
            category, city, address, postcode, rating, price_range,
            phone, reservation_link, cover_image_url, promo_title,
            careers_title, exchange_manager_id, ai_tags_json`;

async function retrieveByName(nameKeyword, { city, isExchange, isJob, isPromo }) {
  // Search only name_fa — listing_title is auto-generated ("X ایرانی در Y لندن") and
  // would falsely match "ایران" for every business in the directory.
  // Uses pg_trgm word-similarity ($1 <% name_fa) so typos and partial Farsi names match.
  const { rows } = await pool.query(
    `SELECT ${BUSINESS_COLS}
       FROM public.businesses
      WHERE listing_approval = 'approved'
        AND $1::text <% name_fa
        AND ($2::text IS NULL OR city ILIKE '%' || $2 || '%' OR address ILIKE '%' || $2 || '%')
        AND (NOT $3 OR exchange_manager_id IS NOT NULL)
        AND (NOT $4 OR (careers_title IS NOT NULL AND careers_title != ''))
        AND (NOT $5 OR (promo_title IS NOT NULL AND promo_title != ''))
      ORDER BY word_similarity($1::text, name_fa) DESC, rating DESC NULLS LAST
      LIMIT 20`,
    [nameKeyword, city || null, !!isExchange, !!isJob, !!isPromo]
  );
  return rows;
}

// Extract keywords from a query that should match literally in descriptions
// (acronyms, brand names, specific terms not well-captured by vectors alone)
function extractLiteralKeywords(query) {
  const keywords = [];
  // Uppercase acronyms of 2–6 chars (DSS, NHS, DWP, etc.)
  const acronyms = query.match(/\b[A-Z]{2,6}\b/g) || [];
  keywords.push(...acronyms);
  // English words mixed in Farsi text
  const enWords = query.match(/\b[A-Za-z]{3,}\b/g) || [];
  enWords.forEach((w) => { if (!keywords.includes(w.toUpperCase())) keywords.push(w); });
  return [...new Set(keywords)].filter((k) => k.length >= 2);
}

async function retrieveByDescriptionKeyword(keywords, { city, isExchange, isJob, isPromo }) {
  if (!keywords.length) return [];
  // Match acronyms/brand terms (e.g. DSS, NHS) in description OR ai_tags_json.
  // Uses word-similarity ($kw <% field) so short English tokens match robustly.
  const conditions = keywords.map((_, i) =>
    `($${i + 6}::text <% description OR $${i + 6}::text <% ai_tags_json)`
  ).join(" OR ");
  const { rows } = await pool.query(
    `SELECT ${BUSINESS_COLS}
       FROM public.businesses
      WHERE listing_approval = 'approved'
        AND ($1::text IS NULL OR city ILIKE '%' || $1 || '%' OR address ILIKE '%' || $1 || '%')
        AND (NOT $2 OR exchange_manager_id IS NOT NULL)
        AND (NOT $3 OR (careers_title IS NOT NULL AND careers_title != ''))
        AND (NOT $4 OR (promo_title IS NOT NULL AND promo_title != ''))
        AND (${conditions})
      ORDER BY rating DESC NULLS LAST
      LIMIT $5`,
    [city || null, !!isExchange, !!isJob, !!isPromo, 15, ...keywords]
  );
  return rows;
}

// Return the most relevant 400-char excerpt from a description for a set of keywords
function bestExcerpt(text, keywords, maxLen = 400) {
  if (!text) return "";
  const clean = stripHtml(text);
  if (!keywords.length) return clean.slice(0, maxLen);
  const lower = clean.toLowerCase();
  let bestPos = -1;
  for (const kw of keywords) {
    const pos = lower.indexOf(kw.toLowerCase());
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) bestPos = pos;
  }
  if (bestPos === -1) return clean.slice(0, maxLen);
  const start = Math.max(0, bestPos - 80);
  return (start > 0 ? "…" : "") + clean.slice(start, start + maxLen);
}

async function retrieveByCategory(category, { city, isExchange, isJob, isPromo }) {
  // category is a short controlled-vocabulary string — plain similarity (%) is appropriate.
  const { rows } = await pool.query(
    `SELECT ${BUSINESS_COLS}
       FROM public.businesses
      WHERE listing_approval = 'approved'
        AND category % $1::text
        AND ($2::text IS NULL OR city ILIKE '%' || $2 || '%' OR address ILIKE '%' || $2 || '%')
        AND (NOT $3 OR exchange_manager_id IS NOT NULL)
        AND (NOT $4 OR (careers_title IS NOT NULL AND careers_title != ''))
        AND (NOT $5 OR (promo_title IS NOT NULL AND promo_title != ''))
      ORDER BY similarity(category, $1::text) DESC, rating DESC NULLS LAST
      LIMIT 15`,
    [category, city || null, !!isExchange, !!isJob, !!isPromo]
  );
  return rows;
}

// Reciprocal Rank Fusion of vector cosine distance and pg_trgm text similarity.
// RRF_Score = 1/(60+vec_rank) + 1/(60+text_rank)
// A business only in one leg still contributes via that leg; text_rank/vec_rank
// defaults to 9999 when the business is absent from the other leg.
async function retrieveByRRF(queryVec, searchQuery, { city, isExchange, isJob, isPromo }) {
  const vecStr = `[${queryVec.join(",")}]`;
  const { rows } = await pool.query(
    `WITH vector_leg AS (
       SELECT id,
              ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS vec_rank
         FROM public.businesses
        WHERE listing_approval = 'approved'
          AND embedding IS NOT NULL
          AND ($2::text IS NULL OR city ILIKE '%' || $2 || '%' OR address ILIKE '%' || $2 || '%')
          AND (NOT $3 OR exchange_manager_id IS NOT NULL)
          AND (NOT $4 OR (careers_title IS NOT NULL AND careers_title != ''))
          AND (NOT $5 OR (promo_title IS NOT NULL AND promo_title != ''))
        ORDER BY embedding <=> $1::vector
        LIMIT 60
     ),
     text_leg AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY text_sim DESC) AS text_rank
         FROM (
           SELECT id,
                  GREATEST(
                    COALESCE(similarity(name_fa,    $6::text), 0),
                    COALESCE(similarity(category,   $6::text), 0),
                    COALESCE(word_similarity($6::text, description),  0),
                    COALESCE(word_similarity($6::text, ai_tags_json), 0)
                  ) AS text_sim
             FROM public.businesses
            WHERE listing_approval = 'approved'
              AND (
                    name_fa  % $6::text
                 OR category % $6::text
                 OR $6::text <% description
                 OR $6::text <% ai_tags_json
              )
              AND ($2::text IS NULL OR city ILIKE '%' || $2 || '%' OR address ILIKE '%' || $2 || '%')
              AND (NOT $3 OR exchange_manager_id IS NOT NULL)
              AND (NOT $4 OR (careers_title IS NOT NULL AND careers_title != ''))
              AND (NOT $5 OR (promo_title IS NOT NULL AND promo_title != ''))
            ORDER BY text_sim DESC
            LIMIT 60
         ) sub
     ),
     rrf_merged AS (
       SELECT
         COALESCE(v.id, t.id) AS id,
         (1.0 / (60 + COALESCE(v.vec_rank,  9999))) +
         (1.0 / (60 + COALESCE(t.text_rank, 9999))) AS rrf_score
         FROM vector_leg v
         FULL OUTER JOIN text_leg t ON v.id = t.id
     )
     SELECT b.id, b.slug, b.name_fa, b.listing_title, b.subtitle, b.description,
            b.category, b.city, b.address, b.postcode, b.rating, b.price_range,
            b.phone, b.reservation_link, b.cover_image_url, b.promo_title,
            b.careers_title, b.exchange_manager_id, b.ai_tags_json
       FROM rrf_merged r
       JOIN public.businesses b ON b.id = r.id
      ORDER BY r.rrf_score DESC
      LIMIT 35`,
    [vecStr, city || null, !!isExchange, !!isJob, !!isPromo, searchQuery]
  );
  return rows;
}

function mergeCandidates(primary, secondary) {
  const seen = new Set(primary.map((r) => r.slug));
  const extra = secondary.filter((r) => !seen.has(r.slug));
  return [...primary, ...extra].slice(0, 35);
}

// ── Main search endpoint ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const t0 = Date.now();
  const ip = clientIp(req);

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: "rate_limited",
      answer_fa: "تعداد درخواست‌های شما در این دقیقه بیش از حد مجاز است. لطفاً کمی صبر کنید.",
    });
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({
      error: "ai_unavailable",
      answer_fa: "سرویس هوش مصنوعی در حال حاضر پیکربندی نشده است.",
    });
  }

  const { query, turnstileToken } = req.body || {};
  const q = String(query || "").trim();

  if (!q) {
    return res.status(400).json({ error: "empty_query", answer_fa: "عبارت جستجو خالی است." });
  }
  if ([...q].length > 300) {
    return res.status(400).json({
      error: "query_too_long",
      answer_fa: "عبارت جستجو بیش از حد مجاز طولانی است.",
    });
  }

  const mobileKey = req.headers["x-mobile-key"] || "";
  const isMobile = MOBILE_APP_KEY && mobileKey === MOBILE_APP_KEY;
  const captchaValid = isMobile || await verifyTurnstileToken(String(turnstileToken || ""), ip);
  if (!captchaValid) {
    return res.status(400).json({
      error: "captcha_failed",
      answer_fa: "تأیید امنیتی ناموفق بود. لطفاً دوباره امتحان کنید.",
    });
  }

  // Build parse prompt with injected real category list
  const categories = await getCategories();
  const categoryEnum =
    categories.length > 0
      ? `\n\nدسته‌بندی‌های دقیق موجود (category باید دقیقاً یکی از این مقادیر باشد یا null):\n${categories.join("، ")}`
      : "";

  // Parse query intent
  let parsed = {};
  try {
    parsed = await openaiChat([
      {
        role: "system",
        content: `شما یک دستیار تجزیه‌گر جستجو برای دایرکتوری کسب‌وکارهای ایرانی در بریتانیا هستید. خروجی باید JSON با این کلیدها باشد:
{"category": string|null, "city": string|null, "price_range": string|null, "is_exchange_query": boolean, "is_job_query": boolean, "is_promo_query": boolean, "name_contains": string|null, "is_off_topic": boolean, "keywords_en": string|null, "search_text": string|null}
- is_off_topic: true اگر سوال اصلاً مربوط به پیدا کردن کسب‌وکار، خدمات یا محصول نیست (اخبار، دستور غذا، سیاست و غیره).
- is_exchange_query: true اگر کاربر صرافی یا تبادل ارز می‌خواهد.
- is_job_query: true اگر کاربر موقعیت شغلی یا استخدام می‌خواهد — هم «دنبال کار هستم» هم «شرکت‌هایی که نیرو می‌خواهند» و هم «استخدام می‌کنند» را شامل می‌شود.
- is_promo_query: true اگر کاربر به دنبال تخفیف، پیشنهاد ویژه، آفر یا پروموشن است — مثلاً «کجا تخفیف می‌دن»، «آفر ویژه»، «پیشنهاد ارزان».
- name_contains: پر کنید اگر کاربر به دنبال کسب‌وکارهایی با کلمه‌ای خاص در نامشان است (مثلاً «نامشان ایران دارد» → «ایران»).
- keywords_en: ترجمه انگلیسی کلیدواژه‌های اصلی جستجو برای بهبود جستجوی معنایی.
- search_text: درخواست کاربر را به یک جمله توصیفی فارسی روشن بازنویسی کنید — اختصارات را گسترش دهید، اصطلاحات عامیانه را به کلمات رسمی تبدیل کنید، نام‌های مکانی را نگه‌دارید. این متن برای بردار-جستجوی معنایی استفاده می‌شود.
- city: همیشه به انگلیسی. شهرها و محله‌های لندن را نیز ترجمه کنید — مثال: لندن→London، منچستر→Manchester، بارنت→Barnet، هرو→Harrow، ایلینگ→Ealing، وستمینستر→Westminster، انفیلد→Enfield، کرویدون→Croydon، برنت→Brent، هکنی→Hackney، ایزلینگتون→Islington، لوییشام→Lewisham، ساوت‌وارک→Southwark، لمبث→Lambeth، نیوهام→Newham، ردبریج→Redbridge، والتام فارست→Waltham Forest، هاورینگ→Havering، کینگستون→Kingston، ریچموند→Richmond، ساتن→Sutton، مرتون→Merton، کنزینگتون→Kensington، همرسمیت→Hammersmith، هیلینگدون→Hillingdon، هاونزلو→Hounslow، کیمبریج→Cambridge، برمینگام→Birmingham.${categoryEnum}`,
      },
      { role: "user", content: q },
    ]);
  } catch (e) {
    console.error("[ai-search] parse step failed:", e.message);
    return res.status(503).json({
      error: "ai_error",
      answer_fa: "سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً دوباره امتحان کنید.",
    });
  }

  if (parsed.is_off_topic) {
    pool.query(
      `INSERT INTO public.ai_search_logs (query, parsed_json, search_text, result_count, duration_ms)
       VALUES ($1, $2, $3, 0, $4)`,
      [q, JSON.stringify(parsed), null, Date.now() - t0]
    ).catch((e) => console.warn("[ai-search] log insert failed:", e.message));
    return res.json({
      answer_fa:
        "این دستیار فقط برای جستجوی کسب‌وکارهای ایرانی در بریتانیا طراحی شده است. لطفاً نام یک کسب‌وکار، خدمت یا محصول را جستجو کنید — مثلاً «رستوران در لندن» یا «وکیل مهاجرت».",
      businesses: [],
    });
  }

  const city =
    typeof parsed.city === "string" && parsed.city.trim() ? parsed.city.trim() : null;
  const isExchange = !!parsed.is_exchange_query;
  const isJob = !!parsed.is_job_query;
  const nameContains =
    typeof parsed.name_contains === "string" && parsed.name_contains.trim()
      ? parsed.name_contains.trim()
      : null;
  const category =
    typeof parsed.category === "string" && parsed.category.trim()
      ? parsed.category.trim()
      : null;
  const keywordsEn =
    typeof parsed.keywords_en === "string" && parsed.keywords_en.trim()
      ? parsed.keywords_en.trim()
      : null;
  const searchText =
    typeof parsed.search_text === "string" && parsed.search_text.trim()
      ? parsed.search_text.trim()
      : null;
  const isPromo = !!parsed.is_promo_query;

  // Embedding input: prefer the expanded search_text, fall back to bilingual raw query
  const embeddingInput = searchText || (keywordsEn ? `${q}\n${keywordsEn}` : q);

  // Literal keywords that should match directly in descriptions (acronyms, brand names, etc.)
  const literalKeywords = extractLiteralKeywords(q);

  // Retrieve candidates
  let candidates = [];
  let cityFallback = false;
  let queryVec = null;

  try {
    // Always run a direct name search with the raw query — catches exact/partial name
    // entries (e.g. "ایرانیو-1") even when the AI doesn't set name_contains and even
    // when the business has no embedding stored.
    const directNameHits = await retrieveByName(q, { city, isExchange, isJob, isPromo });

    if (nameContains) {
      // AI detected a name-keyword query — prioritise name matches
      const nameHits = nameContains !== q
        ? await retrieveByName(nameContains, { city, isExchange, isJob, isPromo })
        : [];
      candidates = mergeCandidates(directNameHits, nameHits);
    } else {
      // Semantic query: embed → RRF(vector + trigram) → city fallback → category hybrid
      try {
        queryVec = await openaiEmbed(embeddingInput);
      } catch (e) {
        console.error("[ai-search] embed step failed:", e.message);
        return res.status(503).json({
          error: "ai_error",
          answer_fa: "سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً دوباره امتحان کنید.",
        });
      }
      const trgmQuery = searchText || q;
      candidates = await retrieveByRRF(queryVec, trgmQuery, { city, isExchange, isJob, isPromo });
      if (candidates.length < 3 && city) {
        const broader = await retrieveByRRF(queryVec, trgmQuery, { city: null, isExchange, isJob, isPromo });
        if (broader.length > candidates.length) {
          candidates = broader;
          cityFallback = true;
        }
      }
      if (category) {
        const catRows = await retrieveByCategory(category, { city, isExchange, isJob, isPromo });
        candidates = mergeCandidates(candidates, catRows);
      }
      // Keyword leg: find businesses whose description explicitly mentions specific terms
      // (e.g. DSS, NHS, DWP) — these often rank low in vector search but are directly relevant
      if (literalKeywords.length) {
        const kwRows = await retrieveByDescriptionKeyword(literalKeywords, { city, isExchange, isJob, isPromo });
        if (kwRows.length) candidates = mergeCandidates(kwRows, candidates);
      }
      // Merge direct name hits at the front so exact name matches always surface
      if (directNameHits.length) candidates = mergeCandidates(directNameHits, candidates);
    }

    // Final retry: if 0 candidates and city/category were restrictive filters,
    // drop both and run RRF without geographic constraint.
    if (candidates.length === 0 && queryVec && (city || category)) {
      const fallback = await retrieveByRRF(queryVec, searchText || q, { city: null, isExchange, isJob, isPromo });
      if (fallback.length > 0) {
        candidates = fallback;
        if (city) cityFallback = true;
      }
    }
  } catch (e) {
    console.error("[ai-search] retrieval failed:", e.message);
    return res.status(503).json({
      error: "ai_error",
      answer_fa: "خطا در جستجوی پایگاه داده. لطفاً دوباره امتحان کنید.",
    });
  }

  if (candidates.length === 0) {
    pool.query(
      `INSERT INTO public.ai_search_logs (query, parsed_json, search_text, result_count, duration_ms)
       VALUES ($1, $2, $3, 0, $4)`,
      [q, JSON.stringify(parsed), searchText || null, Date.now() - t0]
    ).catch((e) => console.warn("[ai-search] log insert failed:", e.message));
    return res.json({
      answer_fa:
        "متأسفانه کسب‌وکاری با این مشخصات در فهرست ایرانیو پیدا نشد. عبارت دیگری امتحان کنید.",
      businesses: [],
    });
  }

  // Build slim candidate list for the recommender
  // Keywords to anchor the description excerpt (literal terms from query + English keywords)
  const excerptKeywords = [
    ...literalKeywords,
    ...(keywordsEn ? keywordsEn.split(/[\s,]+/).filter((w) => w.length >= 3) : []),
  ];

  const slim = candidates.map((c) => {
    let tags = [];
    try { tags = JSON.parse(c.ai_tags_json || "[]"); } catch {}
    const about = [
      c.listing_title,
      c.subtitle,
      bestExcerpt(c.description, excerptKeywords, 120),
      c.careers_title && `استخدام: ${c.careers_title}`,
      c.promo_title && `تخفیف: ${c.promo_title}`,
    ].filter(Boolean).join(" — ").slice(0, 150);
    return {
      slug: c.slug,
      name: c.name_fa,
      category: c.category || undefined,
      city: c.city || undefined,
      tags: tags.length ? tags.join(", ") : undefined,
      about: about || undefined,
    };
  });

  const cityFallbackNote =
    cityFallback && city
      ? `\nنکته مهم: دایرکتوری ایرانیو در حال حاضر فقط کسب‌وکارهای ایرانی لندن را پوشش می‌دهد و در شهر "${city}" نتیجه‌ای یافت نشد. نتایج زیر از لندن هستند. لطفاً این موضوع را در ابتدای answer_fa به کاربر اطلاع دهید.`
      : "";

  let recommendation = {};
  try {
    recommendation = await openaiChat([
      {
        role: "system",
        content: `شما یک دستیار راهنمای کسب‌وکار ایرانی در بریتانیا (ایرانیو) هستید. فقط از لیست ارائه‌شده انتخاب کنید — هیچ slug دیگری را اختراع نکنید. حداکثر ۸ کسب‌وکار. خروجی JSON:
{"answer_fa": string, "businesses": [{"slug": string, "reason_fa": string}]}
- فقط کسب‌وکارهایی را انتخاب کنید که واقعاً با درخواست کاربر مرتبط هستند.
- اگر کاربر دنبال نوع خاصی از کسب‌وکار است (مثلاً آژانس املاک)، وکلا و مشاوران غیرمرتبط را حذف کنید.
- به فیلد «tags» توجه کنید — کسب‌وکاری که دقیقاً برچسب درخواست‌شده دارد اولویت بیشتری دارد.
- اگر هیچ‌کدام واقعاً مناسب نبودند، businesses را خالی بگذارید و در answer_fa توضیح دهید.${cityFallbackNote}`,
      },
      {
        role: "user",
        content: `جستجو: "${q}"\n\nکسب‌وکارهای کاندید:\n${JSON.stringify(slim)}`,
      },
    ]);
  } catch (e) {
    console.error("[ai-search] recommendation step failed:", e.message);
    return res.status(503).json({
      error: "ai_error",
      answer_fa: "سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً دوباره امتحان کنید.",
    });
  }

  const answerFa =
    typeof recommendation.answer_fa === "string"
      ? recommendation.answer_fa
      : "نتایج جستجوی شما:";

  // Discard any slug the LLM invented
  const bySlug = new Map(candidates.map((c) => [c.slug, c]));
  const allowedSlugs = new Set(candidates.map((c) => c.slug));

  const businesses = Array.isArray(recommendation.businesses)
    ? recommendation.businesses
        .filter((r) => r?.slug && allowedSlugs.has(r.slug))
        .slice(0, 8)
        .map((r) => {
          const c = bySlug.get(r.slug);
          return {
            slug: c.slug,
            name_fa: c.name_fa,
            subtitle: c.subtitle,
            category: c.category,
            city: c.city,
            rating: c.rating,
            price_range: c.price_range,
            cover_image_url: c.cover_image_url,
            reason_fa: typeof r.reason_fa === "string" ? r.reason_fa : "",
          };
        })
    : [];

  // Insert search log row; failure must never fail the search response
  let searchId = null;
  try {
    const logRes = await pool.query(
      `INSERT INTO public.ai_search_logs
         (query, parsed_json, search_text, returned_slugs, result_count, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        q,
        JSON.stringify(parsed),
        searchText || null,
        businesses.map((b) => b.slug).join(",") || null,
        businesses.length,
        Date.now() - t0,
      ]
    );
    searchId = logRes.rows[0]?.id ?? null;
  } catch (e) {
    console.warn("[ai-search] log insert failed:", e.message);
  }

  return res.json({ answer_fa: answerFa, businesses, search_id: searchId });
});

// ── Feedback endpoint ─────────────────────────────────────────────────────────
router.post("/feedback", async (req, res) => {
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: "rate_limited" });

  const { search_id, clicked_slug, feedback } = req.body || {};

  const id = Number(search_id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "invalid_search_id" });
  }
  if (feedback !== undefined && feedback !== 1 && feedback !== -1) {
    return res.status(400).json({ error: "invalid_feedback", hint: "feedback must be 1 or -1" });
  }

  const sets = [];
  const params = [];
  if (typeof clicked_slug === "string") {
    sets.push(`clicked_slug = $${params.push(clicked_slug.slice(0, 200))}`);
  }
  if (feedback !== undefined) {
    sets.push(`feedback = $${params.push(Number(feedback))}`);
  }
  if (sets.length === 0) {
    return res.status(400).json({ error: "nothing_to_update" });
  }
  params.push(id);

  try {
    await pool.query(
      `UPDATE public.ai_search_logs SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params
    );
    return res.json({ ok: true });
  } catch (e) {
    console.warn("[ai-search] feedback update failed:", e.message);
    return res.status(503).json({ error: "db_error" });
  }
});

export const aiSearchRouter = router;
