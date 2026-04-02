import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import FloatingBackButton from "../components/FloatingBackButton.jsx";
import { apiGet } from "../api.js";
import { parseBiolinkJson } from "../lib/biolink.js";
import BiolinkPublicView from "../components/BiolinkPublicView.jsx";
import { pickHeroImageUrlFromBusiness, resolveBusinessImageUrl } from "../lib/businessProfile.js";
import { SEO_DEFAULT_DESCRIPTION } from "../lib/seoDefaults.js";

export default function BiolinkPublicPage() {
  const { slug } = useParams();
  const [biz, setBiz] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    document.body.classList.add("biolink-public-body");
    return () => document.body.classList.remove("biolink-public-body");
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setErr(null);
    setBiz(null);
    apiGet(`/api/businesses/${encodeURIComponent(slug)}`)
      .then((b) => {
        if (!cancelled) setBiz(b);
      })
      .catch(() => {
        if (!cancelled) setErr("not_found");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return (
      <>
        <Seo title="آدرس نامعتبر" noindex description="لینک Biolink نامعتبر است." />
        <FloatingBackButton />
        <div className="biolink-public biolink-public--center">
          <p>آدرس نامعتبر است.</p>
          <Link to="/listings">بازگشت به فهرست</Link>
        </div>
      </>
    );
  }

  if (err) {
    return (
      <>
        <Seo title="صفحه یافت نشد" noindex description="این صفحهٔ لینک در ایرانیو وجود ندارد." />
        <FloatingBackButton />
        <div className="biolink-public biolink-public--center">
          <p>این صفحه یافت نشد.</p>
          <Link to="/listings">بازگشت به فهرست</Link>
        </div>
      </>
    );
  }

  if (biz === null) {
    return (
      <>
        <Seo title="صفحهٔ لینک" description={SEO_DEFAULT_DESCRIPTION} />
        <FloatingBackButton />
        <div className="biolink-public biolink-public--center">
          <p>در حال بارگذاری…</p>
        </div>
      </>
    );
  }

  const data = parseBiolinkJson(biz.biolink_json);
  const pageTitle = (data.headline || biz.name_fa || "").trim() || "صفحهٔ لینک";
  const bio = (data.bio || "").replace(/\s+/g, " ").trim();
  const seoDesc =
    bio.slice(0, 300) ||
    `${biz.name_fa || "کسب‌وکار"} — لینک‌های تماس و شبکه‌های اجتماعی در ایرانیو.`.slice(0, 300);
  const hero = pickHeroImageUrlFromBusiness(biz);
  const ogImage = hero ? resolveBusinessImageUrl(hero) : "";

  return (
    <>
      <Seo
        title={`${pageTitle} · صفحهٔ لینک`}
        description={seoDesc}
        image={ogImage || undefined}
        ogType="website"
      />
      <BiolinkPublicView
        slug={slug}
        businessName={biz.name_fa || ""}
        coverFallback={biz.cover_image_url || ""}
        data={data}
      />
      <FloatingBackButton />
    </>
  );
}
