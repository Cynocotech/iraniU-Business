import { db } from "./db.js";

/** Columns aligned with GET csv-template?preset=iraniu and mapIraniuRow import. */
export const IRANIU_EXPORT_COLUMNS = [
  "slug",
  "name_fa",
  "description",
  "category",
  "phone",
  "address",
  "city",
  "google_review_url",
  "listing_title",
  "price_range",
  "cta",
  "hours_json",
  "gallery_json",
  "cover_image_url",
  "subtitle",
  "package",
  "listing_approval",
  "claimed",
];

export function csvEscapeCell(v) {
  if (v == null || v === "") return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildIraniuCsvFromRows(rows) {
  const header = IRANIU_EXPORT_COLUMNS.join(",");
  const body = rows.map((row) => IRANIU_EXPORT_COLUMNS.map((c) => csvEscapeCell(row[c])).join(","));
  return "\uFEFF" + [header, ...body].join("\n");
}

/**
 * Full export string for all businesses (iraniu preset).
 * @returns {{ csvText: string, rowCount: number }}
 */
export function exportIraniuBusinessesCsv() {
  const rows = db
    .prepare(`SELECT ${IRANIU_EXPORT_COLUMNS.join(", ")} FROM businesses ORDER BY id ASC`)
    .all();
  return {
    csvText: buildIraniuCsvFromRows(rows),
    rowCount: rows.length,
  };
}
