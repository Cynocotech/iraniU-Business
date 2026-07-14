import "../env.js";
import { createHash } from "crypto";
import { pool } from "../db.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_BATCH_SIZE = 100;
const TAG_BATCH_SIZE = 10;

const PAYMENT_METHOD_LABELS = {
  visa: "VISA",
  mastercard: "MasterCard",
  bank_transfer: "حواله بانکی",
  card_to_card: "کارت به کارت",
  cash: "نقدی",
  crypto: "Crypto",
};

const EXCHANGE_FEATURE_LABELS = {
  best_rate: "بهترین نرخ",
  physical_branch: "شعبه فیزیکی",
  fast_transfer: "انتقال سریع",
};

// English region name → Farsi equivalents (for cross-language search)
const CITY_FARSI = {
  "north london":      "شمال لندن",
  "south london":      "جنوب لندن",
  "west london":       "غرب لندن",
  "east london":       "شرق لندن",
  "central london":    "مرکز لندن",
  "north west london": "شمال غرب لندن",
  "north east london": "شمال شرق لندن",
  "south west london": "جنوب غرب لندن",
  "south east london": "جنوب شرق لندن",
  "london":            "لندن",
  "manchester":        "منچستر",
  "birmingham":        "بیرمنگام",
  "leeds":             "لیدز",
  "edinburgh":         "ادینبورو",
  "glasgow":           "گلاسکو",
  "bristol":           "بریستول",
};

// UK postcode area → human-readable region (English + Farsi)
const POSTCODE_AREA_REGION = {
  N:  "North London / شمال لندن",
  NW: "North West London / شمال غرب لندن",
  E:  "East London / شرق لندن",
  EC: "East Central London / شرق مرکز لندن",
  SE: "South East London / جنوب شرق لندن",
  SW: "South West London / جنوب غرب لندن",
  W:  "West London / غرب لندن",
  WC: "West Central London / غرب مرکز لندن",
  BR: "Bromley, South East London / جنوب شرق لندن",
  CR: "Croydon, South London / جنوب لندن",
  EN: "Enfield, North London / شمال لندن",
  HA: "Harrow, West London / غرب لندن",
  IG: "Ilford, East London / شرق لندن",
  KT: "Kingston, South West London / جنوب غرب لندن",
  RM: "Romford, East London / شرق لندن",
  SM: "Sutton, South London / جنوب لندن",
  TW: "Twickenham, West London / غرب لندن",
  UB: "Uxbridge, West London / غرب لندن",
  WD: "Watford, North West London / شمال غرب لندن",
  M:  "Manchester / منچستر",
  B:  "Birmingham / بیرمنگام",
  LS: "Leeds / لیدز",
  EH: "Edinburgh / ادینبورو",
  G:  "Glasgow / گلاسکو",
  BS: "Bristol / بریستول",
};

function postcodeToRegion(postcode) {
  if (!postcode) return null;
  const clean = postcode.replace(/\s/g, "").toUpperCase();
  const area2 = clean.slice(0, 2).replace(/[0-9]/g, "");
  const area1 = clean.slice(0, 1);
  if (area2.length === 2 && POSTCODE_AREA_REGION[area2]) return POSTCODE_AREA_REGION[area2];
  if (area1 && POSTCODE_AREA_REGION[area1]) return POSTCODE_AREA_REGION[area1];
  return null;
}

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

function hoursToFarsi(json, id) {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr
      .filter((r) => r && typeof r.day === "string")
      .map((r) => `${r.day}: ${r.hours || "—"}`)
      .join("، ") || null;
  } catch (e) {
    console.warn(`[embed] hoursToFarsi: malformed JSON for id=${id}:`, e.message);
    return null;
  }
}

function paymentsToFarsi(json, id) {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr
      .map((raw) => PAYMENT_METHOD_LABELS[String(raw).toLowerCase()] || String(raw))
      .join("، ") || null;
  } catch (e) {
    console.warn(`[embed] paymentsToFarsi: malformed JSON for id=${id}:`, e.message);
    return null;
  }
}

function exchangeFeaturesToFarsi(json, id) {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr
      .map((raw) => EXCHANGE_FEATURE_LABELS[String(raw).toLowerCase()] || String(raw))
      .join("، ") || null;
  } catch (e) {
    console.warn(`[embed] exchangeFeaturesToFarsi: malformed JSON for id=${id}:`, e.message);
    return null;
  }
}

// Build the base blob (without AI tags) — used as content change detector
function buildBaseBlob(b) {
  const locationParts = [b.address, b.city, b.postcode].filter(Boolean);
  const location = locationParts.length ? locationParts.join("، ") : null;
  const cityFarsi = b.city ? CITY_FARSI[b.city.toLowerCase().trim()] : null;
  const postcodeRegion = postcodeToRegion(b.postcode);
  const hoursStr = b.hours_json ? hoursToFarsi(b.hours_json, b.id) : null;
  const paymentsStr = b.payment_methods_json ? paymentsToFarsi(b.payment_methods_json, b.id) : null;
  const featuresStr =
    b.exchange_manager_id != null && b.exchange_features_json
      ? exchangeFeaturesToFarsi(b.exchange_features_json, b.id)
      : null;
  const promoStr =
    b.promo_title || b.promo_description
      ? [b.promo_title, b.promo_description].filter(Boolean).join(" — ")
      : null;
  const careersStr =
    b.careers_title || b.careers_text
      ? [b.careers_title, b.careers_text].filter(Boolean).join(" — ")
      : null;

  const lines = [
    b.name_fa && `نام: ${b.name_fa}`,
    b.listing_title && `عنوان: ${b.listing_title}`,
    b.subtitle && `زیرعنوان: ${b.subtitle}`,
    b.category && `دسته‌بندی: ${b.category}`,
    b.description && `توضیحات: ${stripHtml(b.description).slice(0, 2000)}`,
    location && `مکان: ${location}`,
    cityFarsi && `منطقه: ${cityFarsi}`,
    postcodeRegion && `ناحیهٔ کدپستی: ${postcodeRegion}`,
    b.price_range && `محدوده قیمت: ${b.price_range}`,
    hoursStr && `ساعات کاری: ${hoursStr}`,
    paymentsStr && `روش‌های پرداخت: ${paymentsStr}`,
    promoStr && `تخفیف ویژه: ${promoStr}`,
    careersStr && `فرصت شغلی: ${careersStr}`,
    b.reservation_link && `امکانات: رزرو آنلاین دارد`,
    featuresStr && `خدمات صرافی: ${featuresStr}`,
  ];

  return lines.filter(Boolean).join("\n");
}

// Full blob = base blob + AI tags line (what actually gets embedded)
function buildFullBlob(baseBlob, tags) {
  if (!tags || !tags.length) return baseBlob;
  return baseBlob + `\nبرچسب‌های خدماتی: ${tags.join(", ")}`;
}

function sha256(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

// Generate tags for up to TAG_BATCH_SIZE businesses in one GPT call
async function generateTagsBatch(businesses) {
  const input = businesses.map((b) => ({
    id: b.id,
    name: b.name_fa || "",
    category: b.category || "",
    desc: stripHtml(b.description || "").slice(0, 1500),
  }));

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You extract factual service tags for businesses in a UK Iranian directory.
Only tag things EXPLICITLY stated in the description — never infer or guess.
Return JSON: {"tags": {"<id>": ["tag1", "tag2", ...]}}
Max 10 tags per business, in English. Focus on:
- Acceptances: "DSS accepted", "housing benefit accepted", "universal credit accepted", "LHA accepted", "no DSS"
- Certifications: "SRA regulated", "CQC registered", "Gas Safe", "NHS provider", "FCA regulated", "RICS"
- Services: "free consultation", "home visits", "24/7", "emergency service", "online appointments", "same day"
- Accessibility: "wheelchair accessible", "parking available", "disabled access"
- Dietary: "halal", "vegetarian", "vegan", "kosher"
- Clients: "first-time buyers", "refugees", "students", "landlords", "tenants", "asylum seekers"
- Languages: "Farsi speaking", "Arabic speaking", "Kurdish speaking", "Turkish speaking"
- Payment: "crypto accepted", "cash only", "interest-free", "0% finance"
- Features: "free delivery", "home delivery", "collection service"
Return [] if no clear tags apply.`,
        },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`GPT tags ${res.status}: ${body?.error?.message || "unknown"}`);
  }
  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return parsed.tags || {};
  } catch {
    return {};
  }
}

async function embedBatch(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`OpenAI embeddings ${res.status}: ${body?.error?.message || "unknown"}`);
  }
  const data = await res.json();
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error("[embed] OPENAI_API_KEY is not set");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query("SET search_path TO public, identity");

    // Clear embeddings for non-approved rows
    const cleared = await client.query(
      `UPDATE businesses
          SET embedding = NULL, embedding_hash = NULL, ai_tags_json = NULL
        WHERE listing_approval != 'approved'
          AND (embedding IS NOT NULL OR embedding_hash IS NOT NULL)`
    );
    if (cleared.rowCount > 0) {
      console.log(`[embed] Cleared ${cleared.rowCount} non-approved rows`);
    }

    const { rows: businesses } = await client.query(
      `SELECT id, name_fa, listing_title, subtitle, category, description,
              address, city, postcode, price_range, hours_json,
              payment_methods_json, promo_title, promo_description,
              careers_title, careers_text, reservation_link,
              exchange_manager_id, exchange_features_json,
              embedding_hash, ai_tags_json
         FROM businesses
        WHERE listing_approval = 'approved'`
    );

    console.log(`[embed] ${businesses.length} approved businesses`);

    // Determine which businesses need reprocessing:
    // content hash (base blob) changed OR no tags yet
    const toProcess = [];
    let skipped = 0;

    for (const b of businesses) {
      const baseBlob = buildBaseBlob(b);
      const contentHash = sha256(baseBlob);
      if (contentHash === b.embedding_hash && b.ai_tags_json != null) {
        skipped++;
      } else {
        toProcess.push({ ...b, _baseBlob: baseBlob, _contentHash: contentHash });
      }
    }

    console.log(`[embed] ${toProcess.length} to process, ${skipped} unchanged (skipped)`);

    if (toProcess.length === 0) {
      console.log("\n[embed] All up to date — nothing to do.");
      return;
    }

    // ── Phase 1: Generate AI tags ───────────────────────────────────────────
    console.log(`[embed] Generating tags in batches of ${TAG_BATCH_SIZE}…`);
    let tagsDone = 0;
    let tagsFailed = 0;

    for (let i = 0; i < toProcess.length; i += TAG_BATCH_SIZE) {
      const batch = toProcess.slice(i, i + TAG_BATCH_SIZE);
      try {
        const tagMap = await generateTagsBatch(batch);
        for (const b of batch) {
          b._tags = Array.isArray(tagMap[b.id]) ? tagMap[b.id] : [];
          tagsDone++;
        }
      } catch (e) {
        console.warn(`[embed] Tag batch ${Math.floor(i / TAG_BATCH_SIZE) + 1} failed: ${e.message}`);
        for (const b of batch) {
          b._tags = [];
          tagsFailed++;
        }
      }
      if ((i / TAG_BATCH_SIZE + 1) % 10 === 0 || i + TAG_BATCH_SIZE >= toProcess.length) {
        console.log(`[embed] Tags: ${Math.min(i + TAG_BATCH_SIZE, toProcess.length)}/${toProcess.length}`);
      }
    }

    // Build full blobs (base + tags) for embedding
    for (const b of toProcess) {
      b._fullBlob = buildFullBlob(b._baseBlob, b._tags);
    }

    // ── Phase 2: Embed full blobs ───────────────────────────────────────────
    console.log(`[embed] Embedding ${toProcess.length} blobs…`);
    let embedded = 0;
    let embedFailed = 0;

    for (let i = 0; i < toProcess.length; i += EMBED_BATCH_SIZE) {
      const batch = toProcess.slice(i, i + EMBED_BATCH_SIZE);
      try {
        const embeddings = await embedBatch(batch.map((b) => b._fullBlob));
        for (let j = 0; j < batch.length; j++) {
          const b = batch[j];
          try {
            const vecStr = `[${embeddings[j].join(",")}]`;
            await client.query(
              `UPDATE businesses
                  SET embedding = $1::vector,
                      embedding_hash = $2,
                      ai_tags_json = $3
                WHERE id = $4`,
              [vecStr, b._contentHash, JSON.stringify(b._tags), b.id]
            );
            embedded++;
          } catch (e) {
            console.error(`[embed] DB update failed id=${b.id}:`, e.message);
            embedFailed++;
          }
        }
        console.log(`[embed] Embed batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1}: ${batch.length} done`);
      } catch (e) {
        console.error(`[embed] Embed batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1} failed:`, e.message);
        embedFailed += batch.length;
      }
    }

    console.log(
      `\n[embed] Summary — total: ${businesses.length}, processed: ${toProcess.length}, ` +
      `skipped: ${skipped}, embedded: ${embedded}, failed: ${embedFailed}, tag_errors: ${tagsFailed}`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[embed] Fatal:", e.message);
  process.exit(1);
});
