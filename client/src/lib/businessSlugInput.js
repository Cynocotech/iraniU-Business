/** هم‌راستا با اعتبارسنجی سرور برای slug آگهی */
export function normalizeBusinessSlugInput(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
