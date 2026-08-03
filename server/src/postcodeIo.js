/**
 * postcodeIo.js — Thin wrapper around the free postcodes.io API.
 *
 * Exports:
 *   lookupPostcode(postcode)          — single lookup
 *   lookupPostcodesBatch(postcodes)   — batch lookup, up to 100 per call
 *
 * Both functions are fire-and-forget safe: they never throw; on any error
 * they return null / an empty Map and emit a console.warn.
 *
 * Rate-limit guidance: postcodes.io has no published cap for small traffic,
 * but the batch endpoint (up to 100 postcodes per POST) should be used for
 * bulk operations. Add at least 1 s between batch requests in scripts.
 */

const BASE_URL = "https://api.postcodes.io";

function normalizePostcode(raw) {
  return String(raw || "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .trim();
}

function extractFields(r) {
  if (!r) return null;
  return {
    latitude:              r.latitude              ?? null,
    longitude:             r.longitude             ?? null,
    primary_care_trust:    r.primary_care_trust    ?? null,
    admin_ward:            r.admin_ward            ?? null,
  };
}

/**
 * Look up a single UK postcode.
 * Returns { latitude, longitude, primary_care_trust, admin_ward } or null.
 */
export async function lookupPostcode(postcode) {
  const clean = normalizePostcode(postcode);
  if (!clean) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/postcodes/${encodeURIComponent(clean)}`
    );
    if (!res.ok) return null; // 404 = invalid / terminated postcode
    const data = await res.json();
    if (data.status !== 200 || !data.result) return null;
    return extractFields(data.result);
  } catch (e) {
    console.warn("[postcode-io] single lookup failed:", e.message);
    return null;
  }
}

/**
 * Batch-look up up to 100 UK postcodes in a single POST request.
 * Returns a Map<normalised_postcode, geo_object>.
 * Invalid / not-found postcodes are absent from the Map.
 */
export async function lookupPostcodesBatch(postcodes) {
  const cleaned = postcodes.map(normalizePostcode).filter(Boolean);
  if (!cleaned.length) return new Map();
  try {
    const res = await fetch(`${BASE_URL}/postcodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: cleaned }),
    });
    if (!res.ok) return new Map();
    const data = await res.json();
    if (data.status !== 200 || !Array.isArray(data.result)) return new Map();
    const map = new Map();
    for (const item of data.result) {
      if (!item.query || !item.result) continue;
      map.set(normalizePostcode(item.query), extractFields(item.result));
    }
    return map;
  } catch (e) {
    console.warn("[postcode-io] batch lookup failed:", e.message);
    return new Map();
  }
}
