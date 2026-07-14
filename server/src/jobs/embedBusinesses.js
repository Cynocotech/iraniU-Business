import "../env.js";
import { createHash } from "crypto";
import { pool } from "../db.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

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

function buildBlob(b) {
  const locationParts = [b.address, b.city, b.postcode].filter(Boolean);
  const location = locationParts.length ? locationParts.join("، ") : null;

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
    b.description && `توضیحات: ${String(b.description).slice(0, 2000)}`,
    location && `مکان: ${location}`,
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

function sha256(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

async function embedBatch(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
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

    // Null out embeddings for non-approved rows
    const cleared = await client.query(
      `UPDATE businesses
          SET embedding = NULL, embedding_hash = NULL
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
              exchange_manager_id, exchange_features_json, embedding_hash
         FROM businesses
        WHERE listing_approval = 'approved'`
    );

    console.log(`[embed] ${businesses.length} approved businesses`);

    let embedded = 0;
    let failed = 0;

    const toEmbed = businesses.map((b) => {
      const blob = buildBlob(b);
      return { ...b, _blob: blob, _hash: sha256(blob) };
    });

    console.log(`[embed] ${toEmbed.length} businesses to embed`);

    for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + BATCH_SIZE);
      try {
        const embeddings = await embedBatch(batch.map((b) => b._blob));
        for (let j = 0; j < batch.length; j++) {
          const b = batch[j];
          try {
            const vecStr = `[${embeddings[j].join(",")}]`;
            await client.query(
              `UPDATE businesses SET embedding = $1::vector, embedding_hash = $2 WHERE id = $3`,
              [vecStr, b._hash, b.id]
            );
            embedded++;
          } catch (e) {
            console.error(`[embed] DB update failed id=${b.id}:`, e.message);
            failed++;
          }
        }
        console.log(`[embed] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} done`);
      } catch (e) {
        console.error(`[embed] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, e.message);
        failed += batch.length;
      }
    }

    console.log(
      `\n[embed] Summary — total: ${businesses.length}, embedded: ${embedded}, failed: ${failed}`
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
