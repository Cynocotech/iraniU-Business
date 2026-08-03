const API_BASE = "https://panel.cybercina.co.uk/api";

let _langId = null;

async function cyberPost(endpoint, params = {}) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`CyberCina ${endpoint} HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.message || `${endpoint} failed`);
  return json;
}

export async function getLanguageId() {
  if (_langId) return _langId;
  const data = await cyberPost("get_languages_list");
  _langId = data.default_language?.id;
  if (!_langId) throw new Error("CyberCina: could not resolve default language");
  return _langId;
}

export async function getExternalPosts({
  limit = 10,
  offset = 0,
  categorySlug,
  tagSlug,
  search,
  slug,
  id,
  languageId,
} = {}) {
  const language_id = languageId ?? await getLanguageId();
  const params = {
    language_id,
    get_user_news: 0,
    limit,
    offset,
    ...(categorySlug && { category_slug: categorySlug }),
    ...(tagSlug && { tag_slug: tagSlug }),
    ...(search && { search }),
    ...(slug && { slug }),
    ...(id && { id }),
  };
  const { total, data } = await cyberPost("get_news", params);
  return { total: Number(total) || 0, posts: Array.isArray(data) ? data : [] };
}

/** Strip HTML tags from a string */
function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Fix malformed HTML from CyberCina where <p is not closed before text, e.g. <pمتن -> <p>متن */
function fixHtml(html) {
  if (!html) return html;
  // Insert missing > after block-level tags when followed directly by non-space, non->  non-/ chars
  return html.replace(/<(p|div|span|h[1-6]|li|td|th)([؀-ۿ‌-‏"'])/gi, "<$1>$2");
}

/** Normalise a CyberCina post to the same shape as a local blog_post row */
export function normalizeExternalPost(p) {
  const tagsArr = Array.isArray(p.tags)
    ? p.tags.map((t) => t.tag_name || t.name || "").filter(Boolean)
    : [];

  const body = fixHtml(p.description || p.content_value || "");
  const excerpt =
    p.short_description
      ? stripHtml(p.short_description).slice(0, 280)
      : p.summarized_description
      ? stripHtml(p.summarized_description).slice(0, 280)
      : stripHtml(body).slice(0, 280);

  return {
    id: `ext-${p.id}`,
    slug: p.slug,
    title_fa: p.title || "",
    excerpt_fa: excerpt,
    body_fa: body,
    cover_image_url: p.image || "",
    author: p.author?.name || p.author?.username || "ایرانیو",
    category: p.category?.category_name || p.subcategory?.subcategory_name || "عمومی",
    tags: tagsArr.join(","),
    is_published: 1,
    view_count: Number(p.views) || 0,
    published_at: p.created_at || new Date().toISOString(),
    updated_at: p.updated_at || p.created_at || new Date().toISOString(),
    source: "external",
  };
}
