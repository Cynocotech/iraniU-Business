/**
 * انتخاب نامک آگهی برای پنل مدیر: اول صرافی (دسته یا الگوی نامک)، سپس جدیدترین.
 * هم‌خوان با ترتیب سرور پس از افزودن category به linked_businesses.
 */
export function pickPreferredManagerSlug(linked) {
  const list = Array.isArray(linked) ? linked : [];
  if (!list.length) return null;

  const scored = list.map((b) => {
    const cat = String(b?.category || "").trim();
    const slug = String(b?.slug || "");
    const isExchange =
      cat === "صرافی" || /(^|-)exchange($|-)/i.test(slug) || slug.includes("-exchange");
    const id = Number(b?.id) || 0;
    return { slug: b.slug, isExchange, id };
  });

  scored.sort((a, b) => {
    if (a.isExchange !== b.isExchange) return a.isExchange ? -1 : 1;
    return b.id - a.id;
  });

  const first = scored[0];
  return first?.slug ? String(first.slug) : null;
}
