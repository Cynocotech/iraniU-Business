import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { usePublicAuth } from "../context/PublicAuthContext.jsx";
import { v1Get, v1Delete } from "../api-v1.js";

const STATUS_LABELS = {
  pending: { label: "در انتظار تأیید", color: "#f59e0b", bg: "#fffbeb" },
  active: { label: "فعال", color: "#10b981", bg: "#ecfdf5" },
  paused: { label: "متوقف", color: "#6b7280", bg: "#f9fafb" },
  expired: { label: "منقضی شده", color: "#6b7280", bg: "#f9fafb" },
  rejected: { label: "رد شده", color: "#ef4444", bg: "#fff1f2" },
};

const AD_TYPE_LABELS = { listing: "آگهی دایرکتوری", banner: "بنر تصویری", spotlight: "ویژه صفحه اصلی" };

function AdCard({ ad, onDelete }) {
  const st = STATUS_LABELS[ad.status] || STATUS_LABELS.pending;
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("آیا مطمئن هستید که می‌خواهید این آگهی را حذف کنید؟")) return;
    setDeleting(true);
    try {
      await v1Delete(`/api/v1/ads/${ad.id}`);
      onDelete(ad.id);
    } catch (ex) {
      alert(ex.message || "خطا در حذف آگهی.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="my-ad-card">
      <div className="my-ad-card__header">
        {ad.image_url && (
          <img src={ad.image_url} alt={ad.title} className="my-ad-card__img" loading="lazy" />
        )}
        <div className="my-ad-card__info">
          <h3 className="my-ad-card__title">{ad.title}</h3>
          <div className="my-ad-card__meta">
            <span className="my-ad-card__type">{AD_TYPE_LABELS[ad.ad_type] || ad.ad_type}</span>
            {ad.budget_gbp && <span className="my-ad-card__budget">£{ad.budget_gbp}/ماه</span>}
          </div>
          {ad.description && <p className="my-ad-card__desc">{ad.description}</p>}
        </div>
      </div>

      <div className="my-ad-card__footer">
        <span className="my-ad-card__status" style={{ color: st.color, background: st.bg }}>
          {st.label}
        </span>
        <div className="my-ad-card__dates">
          {ad.start_date && <span>از {ad.start_date}</span>}
          {ad.end_date && <span>تا {ad.end_date}</span>}
        </div>
        <div className="my-ad-card__stats">
          <span title="تعداد نمایش">👁 {ad.impression_count || 0}</span>
          <span title="تعداد کلیک">👆 {ad.click_count || 0}</span>
        </div>
        <button
          type="button"
          className="my-ad-card__delete"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "…" : "حذف"}
        </button>
      </div>
    </div>
  );
}

function LoginPrompt() {
  return (
    <div className="my-ads-empty">
      <div className="my-ads-empty__icon">🔐</div>
      <h2>برای مشاهده آگهی‌ها وارد شوید</h2>
      <Link to="/account" className="btn btn--primary">ورود / ثبت‌نام</Link>
    </div>
  );
}

export default function MyAdsPage() {
  const { user, loading: authLoading } = usePublicAuth();
  const location = useLocation();
  const justCreated = location.state?.created;

  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    v1Get("/api/v1/ads/my")
      .then((d) => setAds(Array.isArray(d) ? d : []))
      .catch((ex) => setError(ex.message || "خطا در بارگذاری آگهی‌ها."))
      .finally(() => setLoading(false));
  }, [user]);

  function handleDelete(id) {
    setAds((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div dir="rtl" className="my-ads-page">
      <Seo title="آگهی‌های من — ایرانیو" />

      <div className="my-ads-page__inner">
        <div className="my-ads-page__header">
          <div className="my-ads-page__header-row">
            <div>
              <Link to="/listings" className="my-ads-page__back">← بازگشت به دایرکتوری</Link>
              <h1 className="my-ads-page__title">آگهی‌های من</h1>
            </div>
            {user && (
              <Link to="/create-ad" className="btn btn--primary my-ads-page__cta">
                + آگهی جدید
              </Link>
            )}
          </div>
        </div>

        <div className="my-ads-page__body">
          {authLoading ? (
            <div className="my-ads-loading">در حال بارگذاری…</div>
          ) : !user ? (
            <LoginPrompt />
          ) : (
            <>
              {justCreated && (
                <div className="my-ads-success">
                  ✅ آگهی شما با موفقیت ثبت شد! پس از تأیید تیم ایرانیو، منتشر خواهد شد.
                </div>
              )}
              {error && <div className="my-ads-error">{error}</div>}
              {loading ? (
                <div className="my-ads-loading">در حال بارگذاری آگهی‌ها…</div>
              ) : ads.length === 0 ? (
                <div className="my-ads-empty">
                  <div className="my-ads-empty__icon">📋</div>
                  <h2>هنوز آگهی‌ای ثبت نکرده‌اید</h2>
                  <p>با ثبت آگهی، کسب‌وکار یا خدمات خود را به جامعه ایرانی انگلستان معرفی کنید.</p>
                  <Link to="/create-ad" className="btn btn--primary">ثبت اولین آگهی</Link>
                </div>
              ) : (
                <div className="my-ads-list">
                  {ads.map((ad) => (
                    <AdCard key={ad.id} ad={ad} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .my-ads-page {
          min-height: 100vh; background: #f8f9fc;
          padding: 2rem 1rem; font-family: inherit;
        }
        .my-ads-page__inner {
          max-width: 720px; margin: 0 auto;
          background: #fff; border-radius: 16px;
          box-shadow: 0 2px 24px rgba(0,0,0,.08); overflow: hidden;
        }
        .my-ads-page__header {
          padding: 1.75rem 2rem;
          border-bottom: 1px solid #f0f0f0;
        }
        .my-ads-page__header-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; }
        .my-ads-page__back { color: #4f67ff; text-decoration: none; font-size: .85rem; }
        .my-ads-page__title { margin: .5rem 0 0; font-size: 1.4rem; font-weight: 700; color: #111827; }
        .my-ads-page__cta { white-space: nowrap; }
        .my-ads-page__body { padding: 1.5rem 2rem 2rem; }

        .my-ads-loading { text-align: center; color: #9ca3af; padding: 2rem; }
        .my-ads-success {
          background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px;
          padding: 1rem 1.25rem; color: #065f46; font-size: .9rem; margin-bottom: 1.5rem;
        }
        .my-ads-error {
          background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px;
          padding: 1rem 1.25rem; color: #991b1b; font-size: .9rem; margin-bottom: 1.5rem;
        }

        .my-ads-empty { text-align: center; padding: 3rem 1rem; }
        .my-ads-empty__icon { font-size: 3rem; margin-bottom: 1rem; }
        .my-ads-empty h2 { font-size: 1.2rem; margin: 0 0 .5rem; color: #374151; }
        .my-ads-empty p { color: #6b7280; font-size: .9rem; margin-bottom: 1.5rem; }

        .my-ads-list { display: flex; flex-direction: column; gap: 1rem; }

        .my-ad-card {
          border: 1.5px solid #e5e7eb; border-radius: 12px;
          overflow: hidden; transition: border-color .2s;
        }
        .my-ad-card:hover { border-color: #c7d0ff; }
        .my-ad-card__header { display: flex; gap: 1rem; padding: 1.25rem; }
        .my-ad-card__img {
          width: 80px; height: 80px; object-fit: cover;
          border-radius: 8px; flex-shrink: 0;
        }
        .my-ad-card__info { flex: 1; min-width: 0; }
        .my-ad-card__title { margin: 0 0 .4rem; font-size: 1rem; font-weight: 700; color: #111827; }
        .my-ad-card__meta { display: flex; gap: .75rem; align-items: center; margin-bottom: .4rem; }
        .my-ad-card__type { font-size: .78rem; background: #eef0ff; color: #4f67ff; border-radius: 6px; padding: .2rem .5rem; }
        .my-ad-card__budget { font-size: .78rem; color: #059669; font-weight: 600; }
        .my-ad-card__desc { font-size: .85rem; color: #6b7280; margin: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .my-ad-card__footer {
          display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
          padding: .875rem 1.25rem; background: #fafafa; border-top: 1px solid #f0f0f0;
        }
        .my-ad-card__status { font-size: .8rem; font-weight: 600; border-radius: 6px; padding: .25rem .65rem; }
        .my-ad-card__dates { font-size: .78rem; color: #9ca3af; display: flex; gap: .5rem; }
        .my-ad-card__stats { font-size: .78rem; color: #9ca3af; display: flex; gap: .75rem; margin-right: auto; }
        .my-ad-card__delete {
          background: none; border: 1px solid #fecdd3; color: #ef4444;
          border-radius: 8px; padding: .3rem .75rem; font-size: .8rem;
          cursor: pointer; font-family: inherit; transition: all .2s;
        }
        .my-ad-card__delete:hover:not(:disabled) { background: #fff1f2; }
        .my-ad-card__delete:disabled { opacity: .5; }
      `}</style>
    </div>
  );
}
