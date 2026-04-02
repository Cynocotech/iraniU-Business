/**
 * فیلتر قدیمی بر اساس slug (لینک‌های قبلی ?cat=food و غیره)
 * — هم‌خوان با ListingsPage قبلی
 */
export const CAT_HINTS = {
  food: ["رستوران", "غذا"],
  market: ["سوپر", "خرده", "فروش"],
  health: ["سلامت", "پزشک", "کلینیک"],
  legal: ["حقوق"],
  beauty: ["زیبایی", "آرایش"],
  auto: ["خودرو"],
};

/** گزینه‌های slug برای نمایش در کنار دسته‌های دیتابیس */
export const LEGACY_CATEGORY_SELECT_OPTIONS = [
  { value: "food", label: "غذا و رستوران (جستجوی گسترده)" },
  { value: "market", label: "سوپرمارکت و مواد غذایی (جستجوی گسترده)" },
  { value: "health", label: "سلامت و پزشکی (جستجوی گسترده)" },
  { value: "legal", label: "حقوقی و مهاجرت (جستجوی گسترده)" },
  { value: "beauty", label: "زیبایی و آرایشگاه (جستجوی گسترده)" },
  { value: "auto", label: "خودرو و سرویس (جستجوی گسترده)" },
];

export function filterListingsByCategoryParams(rows, searchParams) {
  let out = [...rows];
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const city = (searchParams.get("city") || "").trim().toLowerCase();
  const cat = (searchParams.get("cat") || "").trim();
  if (city) {
    out = out.filter((b) => (b.city || "").toLowerCase().includes(city));
  }
  if (cat) {
    if (CAT_HINTS[cat]) {
      const hints = CAT_HINTS[cat];
      out = out.filter((b) => {
        const c = b.category || "";
        return hints.some((h) => c.includes(h));
      });
    } else {
      const want = cat.trim();
      out = out.filter((b) => String(b.category || "").trim() === want);
    }
  }
  if (q) {
    out = out.filter((b) => {
      const blob = `${b.name_fa || ""} ${b.category || ""} ${b.listing_title || ""} ${b.address || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }
  return out;
}
