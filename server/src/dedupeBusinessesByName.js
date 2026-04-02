import { db } from "./db.js";
import { cascadeDeleteBusinessBySlug } from "./cascadeDeleteBusiness.js";

/** یکسان‌سازی برای تشخیص نام تکراری: trim، فاصله‌های پیاپی، حروف کوچک لاتین */
export function normalizeListingName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * گروه‌بندی آگهی‌ها با نام یکسان (پس از normalize).
 * در هر گروه نگه‌داشتن ردیف با کم‌ترین id (قدیمی‌تر).
 */
export function analyzeDuplicateNames() {
  const rows = db.prepare(`SELECT id, slug, name_fa FROM businesses`).all();
  const byKey = new Map();
  for (const r of rows) {
    const key = normalizeListingName(r.name_fa);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  const groups = [];
  let total_remove = 0;
  for (const [, list] of byKey) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.id - b.id);
    const keep = list[0];
    const remove = list.slice(1);
    total_remove += remove.length;
    groups.push({
      name_key: normalizeListingName(keep.name_fa),
      name_display: String(keep.name_fa || "").trim(),
      keep,
      remove,
    });
  }
  groups.sort((a, b) => b.remove.length - a.remove.length || a.name_display.localeCompare(b.name_display, "fa"));
  return { groups, total_remove };
}

/**
 * حذف آگهی‌های تکراری؛ در هر گروه فقط id کم‌تر باقی می‌ماند.
 */
export function executeDedupeByName({ maxRemovals = 5000 } = {}) {
  const { groups, total_remove } = analyzeDuplicateNames();
  if (total_remove === 0) {
    return { deleted: [], kept_groups: 0, removed_count: 0, failed: [] };
  }
  if (total_remove > maxRemovals) {
    return { error: "too_many", total_remove, maxRemovals };
  }
  const deleted = [];
  const failed = [];
  for (const g of groups) {
    for (const r of g.remove) {
      const res = cascadeDeleteBusinessBySlug(r.slug);
      if (res.deleted) deleted.push(r.slug);
      else failed.push({ slug: r.slug, reason: res.reason || "unknown" });
    }
  }
  return {
    deleted,
    kept_groups: groups.length,
    removed_count: deleted.length,
    failed,
  };
}
