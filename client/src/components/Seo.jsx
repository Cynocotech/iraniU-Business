import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { getSiteUrl } from "../lib/siteUrl.js";
import { SEO_DEFAULT_DESCRIPTION, SEO_DEFAULT_TITLE } from "../lib/seoDefaults.js";

function buildTitle(title, titleFull) {
  if (titleFull) return titleFull;
  if (!title || !String(title).trim()) return SEO_DEFAULT_TITLE;
  const t = String(title).trim();
  if (t.includes("ایرانیو")) return t;
  return `${t} | ایرانیو`;
}

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return undefined;
  const s = String(pathOrUrl).trim();
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  const site = getSiteUrl();
  if (!site) return s.startsWith("/") ? s : `/${s}`;
  return `${site}${s.startsWith("/") ? s : `/${s}`}`;
}

/**
 * Per-route SEO: title, description, canonical, Open Graph, Twitter, optional JSON-LD.
 *
 * articleMeta (only used when ogType="article"):
 *   { publishedTime, modifiedTime, author, section, tags: string[] }
 */
export default function Seo({
  title,
  titleFull,
  description = SEO_DEFAULT_DESCRIPTION,
  image,
  ogType = "website",
  noindex = false,
  keywords,
  jsonLd,
  articleMeta,
}) {
  const { pathname, search } = useLocation();
  const site = getSiteUrl();
  const path = `${pathname}${search || ""}`;
  const canonical = site ? `${site}${path.startsWith("/") ? path : `/${path}`}` : undefined;

  const documentTitle = buildTitle(title, titleFull);
  const desc = String(description || SEO_DEFAULT_DESCRIPTION).slice(0, 320);

  const absImage = (() => {
    if (image) return absoluteUrl(image);
    if (site) return `${site}/favicon.png`;
    return undefined;
  })();

  const ld =
    jsonLd == null
      ? null
      : Array.isArray(jsonLd)
        ? jsonLd.length === 1
          ? jsonLd[0]
          : { "@context": "https://schema.org", "@graph": jsonLd }
        : jsonLd;

  const isArticle = ogType === "article";
  const articleTags = articleMeta?.tags ?? [];

  return (
    <Helmet
      htmlAttributes={{ lang: "fa", dir: "rtl" }}
      prioritizeSeoTags
    >
      <title>{documentTitle}</title>
      <meta name="description" content={desc} />
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      <meta name="author" content={articleMeta?.author || "ایرانیو"} />
      <meta
        name="robots"
        content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}
      />
      {canonical ? <link rel="canonical" href={canonical} /> : null}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="ایرانیو" />
      <meta property="og:locale" content="fa_IR" />
      <meta property="og:title" content={documentTitle} />
      <meta property="og:description" content={desc.slice(0, 300)} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {absImage ? <meta property="og:image" content={absImage} /> : null}
      {absImage ? <meta property="og:image:width" content="1200" /> : null}
      {absImage ? <meta property="og:image:height" content="630" /> : null}
      {absImage ? <meta property="og:image:alt" content={documentTitle} /> : null}

      {/* Article-specific Open Graph */}
      {isArticle && articleMeta?.publishedTime
        ? <meta property="article:published_time" content={articleMeta.publishedTime} />
        : null}
      {isArticle && articleMeta?.modifiedTime
        ? <meta property="article:modified_time" content={articleMeta.modifiedTime} />
        : null}
      {isArticle && articleMeta?.author
        ? <meta property="article:author" content={articleMeta.author} />
        : null}
      {isArticle && articleMeta?.section
        ? <meta property="article:section" content={articleMeta.section} />
        : null}
      {isArticle && articleTags.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@iraniu_uk" />
      <meta name="twitter:title" content={documentTitle} />
      <meta name="twitter:description" content={desc.slice(0, 200)} />
      {absImage ? <meta name="twitter:image" content={absImage} /> : null}
      {absImage ? <meta name="twitter:image:alt" content={documentTitle} /> : null}

      {/* JSON-LD structured data */}
      {ld ? <script type="application/ld+json">{JSON.stringify(ld)}</script> : null}
    </Helmet>
  );
}
