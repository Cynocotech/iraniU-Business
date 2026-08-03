import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet, apiPost } from "../api.js";
import {
  parseGalleryJson,
  parseHoursJson,
  resolveBusinessImageUrl,
  pickHeroImageUrlFromBusiness,
} from "../lib/businessProfile.js";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=75";

function trackPhone(slug) {
  apiPost("/api/phone-click", { slug }).catch(() => {});
}

function extractPostcode(raw) {
  const m = String(raw || "").toUpperCase().match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/);
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
}

const DAY_LABELS = { Mon: "دوشنبه", Tue: "سه‌شنبه", Wed: "چهارشنبه", Thu: "پنج‌شنبه", Fri: "جمعه", Sat: "شنبه", Sun: "یکشنبه" };
function localDay() {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];
}
function isOpenNow(hoursRows) {
  if (!hoursRows?.length) return null;
  const today = localDay();
  const row = hoursRows.find((r) => r.day?.startsWith(today));
  if (!row) return null;
  const h = String(row.hours || "").toLowerCase();
  if (h.includes("بسته") || h.includes("closed") || h === "—") return false;
  return true;
}

export default function BusinessPageDemo() {
  const [params] = useSearchParams();
  const slug = params.get("slug") || "";
  const [b, setB] = useState(null);
  const [state, setState] = useState("loading");
  const [activeTab, setActiveTab] = useState("about");
  const [lightbox, setLightbox] = useState(null);
  const [relatedBiz, setRelatedBiz] = useState([]);

  useEffect(() => {
    if (!slug) { setState("error"); return; }
    setState("loading");
    setB(null);
    apiGet(`/api/businesses/${encodeURIComponent(slug)}`)
      .then((row) => { setB(row); setState("ok"); })
      .catch(() => setState("error"));
  }, [slug]);

  useEffect(() => {
    if (!b?.category) return;
    apiGet("/api/businesses")
      .then((rows) => {
        const rel = (rows || [])
          .filter((r) => r.slug !== b.slug && r.category === b.category)
          .slice(0, 3);
        setRelatedBiz(rel);
      })
      .catch(() => {});
  }, [b?.slug, b?.category]);

  useEffect(() => {
    if (lightbox === null) return;
    const fn = (e) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [lightbox]);

  const gallery = useMemo(() => {
    if (!b) return [];
    const slots = parseGalleryJson(b.gallery_json);
    const resolved = slots.map((u) => resolveBusinessImageUrl(String(u || "").trim())).filter(Boolean);
    const cover = pickHeroImageUrlFromBusiness(b);
    const coverResolved = cover ? resolveBusinessImageUrl(cover) : null;
    const all = coverResolved ? [coverResolved, ...resolved.filter((u) => u !== coverResolved)] : resolved;
    return all.length ? all : [FALLBACK_IMG];
  }, [b]);

  const hoursRows = useMemo(() => parseHoursJson(b?.hours_json), [b?.hours_json]);
  const openNow = useMemo(() => isOpenNow(hoursRows), [hoursRows]);
  const postcode = useMemo(() => extractPostcode(b?.address), [b?.address]);
  const mapQuery = postcode || [b?.address, b?.city].filter(Boolean).join(", ");
  const mapEmbed = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed` : "";
  const directionsUrl = b?.google_review_url || (mapQuery ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}` : "");
  const phone = String(b?.call_tracking_number || b?.phone || "").trim();
  const mobile = String(b?.mobile || "").trim();
  const claimHref = b ? `/claim?slug=${encodeURIComponent(b.slug)}&business=${encodeURIComponent(b.name_fa)}` : "/";
  const logoLetter = b?.name_fa ? [...b.name_fa.trim()][0] || "؟" : "؟";

  const TABS = [
    { id: "about", label: "معرفی" },
    { id: "hours", label: "ساعات کاری" },
    { id: "gallery", label: `گالری (${gallery.length})` },
    ...(mapEmbed ? [{ id: "map", label: "نقشه" }] : []),
  ];

  if (state === "loading") {
    return (
      <div className="bdemo-page" dir="rtl" lang="fa">
        <style>{STYLES}</style>
        <BDemoHeader />
        <div className="bdemo-skeleton">
          <div className="bdemo-skeleton__hero" />
          <div className="bdemo-skeleton__body">
            <div className="bdemo-skeleton__main">
              {[1,2,3].map(i=><div key={i} className="bdemo-skeleton__line"/>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error" || !b) {
    return (
      <div className="bdemo-page" dir="rtl" lang="fa">
        <style>{STYLES}</style>
        <BDemoHeader />
        <div className="bdemo-notfound">
          <h1>کسب‌وکار پیدا نشد</h1>
          <p>آدرس نامعتبر است یا این آگهی در دسترس نیست.</p>
          <Link to="/listings" className="bdemo-btn bdemo-btn--primary">بازگشت به فهرست</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bdemo-page" dir="rtl" lang="fa">
      <style>{STYLES}</style>
      <BDemoHeader />

      {/* ── GALLERY HERO ── */}
      <div className="bdemo-gallery-hero">
        <div className="bdemo-gallery-hero__main" onClick={() => setLightbox(0)}>
          <img src={gallery[0]} alt="" loading="eager" />
          {openNow === true && <span className="bdemo-badge bdemo-badge--open">Open Now</span>}
          {openNow === false && <span className="bdemo-badge bdemo-badge--closed">Closed</span>}
          {b.claimed && <span className="bdemo-badge bdemo-badge--verified"><i className="fa-solid fa-circle-check" aria-hidden="true" /> تأیید شده</span>}
        </div>
        {gallery.length > 1 && (
          <div className="bdemo-gallery-hero__grid">
            {gallery.slice(1, 5).map((img, i) => (
              <div key={i} className="bdemo-gallery-hero__thumb" onClick={() => setLightbox(i + 1)}>
                <img src={img} alt="" loading="lazy" />
                {i === 3 && gallery.length > 5 && (
                  <div className="bdemo-gallery-hero__more">+{gallery.length - 5} بیشتر</div>
                )}
              </div>
            ))}
          </div>
        )}
        {gallery.length > 1 && (
          <button className="bdemo-gallery-hero__all-btn" onClick={() => setLightbox(0)}>
            <i className="fa-solid fa-camera" aria-hidden="true" /> مشاهده همه تصاویر ({gallery.length})
          </button>
        )}
      </div>

      {/* ── TITLE BAR ── */}
      <div className="bdemo-titlebar">
        <div className="bdemo-titlebar__inner">
          <div className="bdemo-titlebar__breadcrumb">
            <Link to="/">خانه</Link>
            <span>›</span>
            <Link to="/listings">آگهی‌ها</Link>
            <span>›</span>
            <span>{b.name_fa}</span>
          </div>
          <div className="bdemo-titlebar__head">
            <div className="bdemo-titlebar__logo" aria-hidden="true">{logoLetter}</div>
            <div className="bdemo-titlebar__text">
              <div className="bdemo-titlebar__tags">
                {b.category && <span className="bdemo-tag bdemo-tag--cat">{b.category}</span>}
                {b.claimed && <span className="bdemo-tag bdemo-tag--verified"><i className="fa-solid fa-circle-check" aria-hidden="true" /> تأیید شده</span>}
              </div>
              <h1 className="bdemo-titlebar__name">{b.name_fa}</h1>
              {b.listing_title && b.listing_title !== b.name_fa && (
                <p className="bdemo-titlebar__lead">{b.listing_title}</p>
              )}
              <div className="bdemo-titlebar__meta">
                {b.rating && (
                  <span className="bdemo-stars">
                    {"★".repeat(Math.round(Number(b.rating)))}{"☆".repeat(5 - Math.round(Number(b.rating)))}
                    <strong>{Number(b.rating).toFixed(1)}</strong>
                  </span>
                )}
                {b.city && (
                  <span className="bdemo-titlebar__loc">
                    <i className="fa-solid fa-location-dot" aria-hidden="true" /> {b.address ? `${b.address}${b.city ? `, ${b.city}` : ""}` : b.city}
                  </span>
                )}
                {phone && (
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="bdemo-titlebar__phone" dir="ltr" onClick={() => trackPhone(b.slug)}>
                    <i className="fa-solid fa-phone" aria-hidden="true" /> {phone}
                  </a>
                )}
              </div>
            </div>
            <div className="bdemo-titlebar__actions">
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="bdemo-btn bdemo-btn--primary bdemo-btn--lg" onClick={() => trackPhone(b.slug)}>
                  <i className="fa-solid fa-phone" aria-hidden="true" /> تماس بگیرید
                </a>
              )}
              {!b.claimed && (
                <Link to={claimHref} className="bdemo-btn bdemo-btn--outline">
                  درخواست صفحه مدیریت
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="bdemo-body">
        <div className="bdemo-body__inner">

          {/* MAIN */}
          <main className="bdemo-main">
            {/* TABS */}
            <div className="bdemo-tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={`bdemo-tab${activeTab === t.id ? " bdemo-tab--active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ABOUT TAB */}
            {activeTab === "about" && (
              <div className="bdemo-panel">
                <h2 className="bdemo-panel__title">معرفی کسب‌وکار</h2>
                {b.claimed && b.description ? (
                  <p className="bdemo-panel__text" style={{ whiteSpace: "pre-wrap" }}>{b.description}</p>
                ) : !b.claimed ? (
                  <div className="bdemo-panel__claim-prompt">
                    <i className="fa-solid fa-lock" aria-hidden="true" />
                    <div>
                      <strong>این کسب‌وکار ادعا نشده است</strong>
                      <p>برای افزودن توضیحات و مدیریت آگهی، <Link to={claimHref}>مالکیت را ادعا کنید</Link>.</p>
                    </div>
                  </div>
                ) : (
                  <p className="bdemo-panel__empty">توضیحاتی ثبت نشده است.</p>
                )}

                {/* Promo */}
                {(b.promo_title || b.promo_description) && (
                  <div className="bdemo-promo">
                    <div className="bdemo-promo__label"><i className="fa-solid fa-bullseye" aria-hidden="true" /> پیشنهاد ویژه</div>
                    {b.promo_title && <h3 className="bdemo-promo__title">{b.promo_title}</h3>}
                    {b.promo_description && <p className="bdemo-promo__desc">{b.promo_description}</p>}
                  </div>
                )}

                {/* Careers */}
                {b.careers_text && (
                  <div className="bdemo-careers">
                    <h3 className="bdemo-careers__title"><i className="fa-solid fa-briefcase" aria-hidden="true" /> {b.careers_title || "فرصت‌های شغلی"}</h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>{b.careers_text}</p>
                  </div>
                )}

                {/* Quick info grid */}
                <div className="bdemo-info-grid">
                  {b.category && (
                    <div className="bdemo-info-item">
                      <i className="fa-solid fa-tag bdemo-info-item__icon" aria-hidden="true" />
                      <div><strong>دسته‌بندی</strong><span>{b.category}</span></div>
                    </div>
                  )}
                  {b.city && (
                    <div className="bdemo-info-item">
                      <i className="fa-solid fa-location-dot bdemo-info-item__icon" aria-hidden="true" />
                      <div><strong>شهر</strong><span>{b.city}</span></div>
                    </div>
                  )}
                  {phone && (
                    <div className="bdemo-info-item">
                      <i className="fa-solid fa-phone bdemo-info-item__icon" aria-hidden="true" />
                      <div><strong>تلفن</strong><a href={`tel:${phone.replace(/\s/g,"")}`} dir="ltr">{phone}</a></div>
                    </div>
                  )}
                  {mobile && (
                    <div className="bdemo-info-item">
                      <i className="fa-solid fa-mobile-screen bdemo-info-item__icon" aria-hidden="true" />
                      <div><strong>موبایل</strong><a href={`tel:${mobile.replace(/\s/g,"")}`} dir="ltr">{mobile}</a></div>
                    </div>
                  )}
                  {postcode && (
                    <div className="bdemo-info-item">
                      <i className="fa-solid fa-map-pin bdemo-info-item__icon" aria-hidden="true" />
                      <div><strong>کد پستی</strong><span dir="ltr">{postcode}</span></div>
                    </div>
                  )}
                  {b.price_range && (
                    <div className="bdemo-info-item">
                      <i className="fa-solid fa-sterling-sign bdemo-info-item__icon" aria-hidden="true" />
                      <div><strong>رنج قیمت</strong><span dir="ltr">{b.price_range}</span></div>
                    </div>
                  )}
                  {openNow !== null && (
                    <div className="bdemo-info-item">
                      <i className="fa-solid fa-circle bdemo-info-item__icon" aria-hidden="true" />
                      <div><strong>وضعیت</strong><span style={{ color: openNow ? "#2e7d32" : "#c62828" }}>{openNow ? "هم‌اکنون باز" : "هم‌اکنون بسته"}</span></div>
                    </div>
                  )}
                </div>

                {b.reservation_link && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <a href={b.reservation_link} target="_blank" rel="noopener noreferrer" className="bdemo-btn bdemo-btn--accent bdemo-btn--lg">
                      <i className="fa-solid fa-calendar-check" aria-hidden="true" /> رزرو آنلاین
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* HOURS TAB */}
            {activeTab === "hours" && (
              <div className="bdemo-panel">
                <h2 className="bdemo-panel__title">ساعات کاری</h2>
                {hoursRows.length ? (
                  <div className="bdemo-hours">
                    {hoursRows.map((row, i) => {
                      const isToday = row.day?.startsWith(localDay());
                      return (
                        <div key={i} className={`bdemo-hours__row${isToday ? " bdemo-hours__row--today" : ""}`}>
                          <span className="bdemo-hours__day">{DAY_LABELS[row.day] || row.day}</span>
                          <span className="bdemo-hours__val" dir="ltr">{row.hours || "—"}</span>
                          {isToday && <span className="bdemo-hours__today-badge">امروز</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="bdemo-panel__empty">ساعات کاری ثبت نشده است.</p>
                )}
              </div>
            )}

            {/* GALLERY TAB */}
            {activeTab === "gallery" && (
              <div className="bdemo-panel">
                <h2 className="bdemo-panel__title">گالری تصاویر</h2>
                <div className="bdemo-gallery-grid">
                  {gallery.map((img, i) => (
                    <button key={i} className="bdemo-gallery-grid__item" onClick={() => setLightbox(i)}>
                      <img src={img} alt={`تصویر ${i + 1}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MAP TAB */}
            {activeTab === "map" && mapEmbed && (
              <div className="bdemo-panel">
                <h2 className="bdemo-panel__title">موقعیت روی نقشه</h2>
                {b.address && <p className="bdemo-panel__text" dir="ltr">{b.address}</p>}
                <div className="bdemo-map-wrap">
                  <iframe
                    src={mapEmbed}
                    title="نقشه"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                {directionsUrl && (
                  <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="bdemo-btn bdemo-btn--primary" style={{ marginTop: "1rem", display: "inline-flex" }}>
                    <i className="fa-solid fa-diamond-turn-right" aria-hidden="true" /> مسیریابی
                  </a>
                )}
              </div>
            )}
          </main>

          {/* SIDEBAR */}
          <aside className="bdemo-sidebar">

            {/* Contact card */}
            <div className="bdemo-sidebar-card">
              <h3 className="bdemo-sidebar-card__title">اطلاعات تماس</h3>
              {phone && (
                <a href={`tel:${phone.replace(/\s/g,"")}`} className="bdemo-contact-btn" dir="ltr" onClick={() => trackPhone(b.slug)}>
                  <i className="fa-solid fa-phone" aria-hidden="true" /> {phone}
                </a>
              )}
              {b.address && (
                <div className="bdemo-sidebar-card__row">
                  <i className="fa-solid fa-location-dot" aria-hidden="true" />
                  <span dir="ltr">{b.address}</span>
                </div>
              )}
              {b.city && (
                <div className="bdemo-sidebar-card__row">
                  <i className="fa-solid fa-city" aria-hidden="true" />
                  <span>{b.city}</span>
                </div>
              )}
              {postcode && (
                <div className="bdemo-sidebar-card__row">
                  <i className="fa-solid fa-map-pin" aria-hidden="true" />
                  <span dir="ltr">{postcode}</span>
                </div>
              )}
              {openNow !== null && (
                <div className={`bdemo-sidebar-card__status ${openNow ? "bdemo-sidebar-card__status--open" : "bdemo-sidebar-card__status--closed"}`}>
                  <i className="fa-solid fa-circle" aria-hidden="true" />
                  {openNow ? "هم‌اکنون باز است" : "هم‌اکنون بسته است"}
                </div>
              )}
              {directionsUrl && (
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="bdemo-btn bdemo-btn--primary bdemo-btn--block" style={{ marginTop: "0.85rem" }}>
                  <i className="fa-solid fa-diamond-turn-right" aria-hidden="true" /> دریافت مسیر
                </a>
              )}
            </div>

            {/* Map mini */}
            {mapEmbed && (
              <div className="bdemo-sidebar-card bdemo-sidebar-card--map">
                <iframe src={mapEmbed} title="نقشه" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}

            {/* Hours summary */}
            {hoursRows.length > 0 && (
              <div className="bdemo-sidebar-card">
                <h3 className="bdemo-sidebar-card__title">ساعات کاری</h3>
                {hoursRows.slice(0, 3).map((row, i) => {
                  const isToday = row.day?.startsWith(localDay());
                  return (
                    <div key={i} className={`bdemo-hours__row${isToday ? " bdemo-hours__row--today" : ""}`} style={{ fontSize: "0.85rem" }}>
                      <span className="bdemo-hours__day">{DAY_LABELS[row.day] || row.day}</span>
                      <span dir="ltr">{row.hours || "—"}</span>
                    </div>
                  );
                })}
                {hoursRows.length > 3 && (
                  <button className="bdemo-sidebar-card__more" onClick={() => setActiveTab("hours")}>
                    مشاهده همه ساعات ›
                  </button>
                )}
              </div>
            )}

            {/* Claim CTA */}
            {!b.claimed && (
              <div className="bdemo-sidebar-card bdemo-sidebar-card--claim">
                <div className="bdemo-sidebar-card__claim-icon"><i className="fa-solid fa-building" aria-hidden="true" /></div>
                <h3>این کسب‌وکار شماست؟</h3>
                <p>درخواست دهید تا بتوانید اطلاعات آگهی را ویرایش کنید و با مشتریان در ارتباط باشید.</p>
                <Link to={claimHref} className="bdemo-btn bdemo-btn--accent bdemo-btn--block">
                  درخواست صفحه مدیریت
                </Link>
              </div>
            )}

            {/* Share */}
            <div className="bdemo-sidebar-card">
              <h3 className="bdemo-sidebar-card__title">اشتراک‌گذاری</h3>
              <div className="bdemo-share">
                <button className="bdemo-share__btn bdemo-share__btn--copy" onClick={() => { navigator.clipboard?.writeText(window.location.href); }}>
                  <i className="fa-solid fa-link" aria-hidden="true" /> کپی لینک
                </button>
                <a className="bdemo-share__btn bdemo-share__btn--wa" href={`https://wa.me/?text=${encodeURIComponent(b.name_fa + " — " + window.location.href)}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </div>
            </div>

            {/* Report */}
            <div className="bdemo-sidebar-card">
              <Link to={`/business?slug=${encodeURIComponent(b.slug)}&report=1`} className="bdemo-btn bdemo-btn--ghost bdemo-btn--block">
                <i className="fa-solid fa-flag" aria-hidden="true" /> گزارش مشکل
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* RELATED */}
      {relatedBiz.length > 0 && (
        <div className="bdemo-related">
          <div className="bdemo-related__inner">
            <h2 className="bdemo-related__title">کسب‌وکارهای مشابه</h2>
            <div className="bdemo-related__grid">
              {relatedBiz.map((r) => {
                const rCover = pickHeroImageUrlFromBusiness(r);
                const rImg = rCover ? resolveBusinessImageUrl(rCover) : null;
                return (
                  <Link key={r.slug} to={`/demo-business?slug=${encodeURIComponent(r.slug)}`} className="bdemo-rel-card">
                    <div className="bdemo-rel-card__img">
                      {rImg ? <img src={rImg} alt="" loading="lazy" /> : <div className="bdemo-rel-card__placeholder">{[...r.name_fa][0]}</div>}
                    </div>
                    <div className="bdemo-rel-card__body">
                      <h4>{r.name_fa}</h4>
                      {r.city && <p><i className="fa-solid fa-location-dot" aria-hidden="true" /> {r.city}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox !== null && (
        <div className="bdemo-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button className="bdemo-lightbox__close" onClick={() => setLightbox(null)}>✕</button>
          {gallery.length > 1 && (
            <button className="bdemo-lightbox__prev" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + gallery.length) % gallery.length); }}>‹</button>
          )}
          <img src={gallery[lightbox]} alt="" onClick={(e) => e.stopPropagation()} />
          {gallery.length > 1 && (
            <button className="bdemo-lightbox__next" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % gallery.length); }}>›</button>
          )}
          <span className="bdemo-lightbox__counter">{lightbox + 1} / {gallery.length}</span>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bdemo-footer">
        <div className="bdemo-footer__inner">
          <Link to="/images/iraniu-logo-header.png" style={{ display: "none" }} />
          <span>© ۱۴۰۴ ایرانیو</span>
          <div className="bdemo-footer__links">
            <Link to="/">خانه</Link>
            <Link to="/listings">فهرست آگهی‌ها</Link>
            <Link to="/demo-home">صفحه اصلی جدید</Link>
            <Link to={`/business?slug=${encodeURIComponent(b?.slug || "")}`}>نسخه فعلی این آگهی</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function BDemoHeader() {
  return (
    <header className="bdemo-header">
      <div className="bdemo-header__inner">
        <Link to="/demo-home" className="bdemo-header__logo">
          <img src="/images/iraniu-logo-header.png" alt="ایرانیو" height={36} />
        </Link>
        <nav className="bdemo-header__nav">
          <Link to="/demo-home">خانه</Link>
          <Link to="/listings">آگهی‌ها</Link>
          <Link to="/exchanges">صرافی‌ها</Link>
        </nav>
        <div className="bdemo-header__cta">
          <Link to="/onboarding" className="bdemo-btn bdemo-btn--accent">ثبت کسب‌وکار</Link>
        </div>
      </div>
    </header>
  );
}

const STYLES = `
  @font-face { font-family: 'Yekan Bakh'; font-weight: 400; font-style: normal; src: local('YekanBakh-Regular'), url('/fonts/YekanBakh-Regular.otf') format('opentype'); }
  @font-face { font-family: 'Yekan Bakh'; font-weight: 700; font-style: normal; src: local('YekanBakh-Bold'), url('/fonts/YekanBakh-Bold.otf') format('opentype'); }
  @font-face { font-family: 'Yekan Bakh'; font-weight: 800; font-style: normal; src: local('YekanBakh-ExtraBlack'), url('/fonts/YekanBakh-ExtraBlack.otf') format('opentype'); }
  @font-face { font-family: 'Yekan Bakh'; font-weight: 900; font-style: normal; src: local('YekanBakh-ExtraBlack'), url('/fonts/YekanBakh-ExtraBlack.otf') format('opentype'); }
  .bdemo-page { font-family: 'Yekan Bakh', Tahoma, Arial, sans-serif; color: #1a0a2e; min-height: 100vh; background: #f4f3f7; }

  /* HEADER */
  .bdemo-header { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: rgba(12,8,30,0.96); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.07); }
  .bdemo-header__inner { max-width: 1280px; margin: 0 auto; padding: 0 1.5rem; height: 64px; display: flex; align-items: center; gap: 2rem; }
  .bdemo-header__logo img { height: 34px; display: block; }
  .bdemo-header__nav { display: flex; gap: 0.25rem; flex: 1; }
  .bdemo-header__nav a { color: rgba(255,255,255,0.75); text-decoration: none; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.88rem; transition: all 0.2s; }
  .bdemo-header__nav a:hover { color: #fff; background: rgba(255,255,255,0.1); }
  .bdemo-header__cta { display: flex; gap: 0.6rem; }

  /* BTNS */
  .bdemo-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.1rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: all 0.2s; justify-content: center; }
  .bdemo-btn--primary { background: linear-gradient(135deg,#5c1f6e,#7c3aed); color: #fff; }
  .bdemo-btn--primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 15px rgba(124,58,237,0.4); }
  .bdemo-btn--accent { background: linear-gradient(135deg,#f4511e,#e53935); color: #fff; }
  .bdemo-btn--accent:hover { opacity: 0.9; transform: translateY(-1px); }
  .bdemo-btn--outline { background: transparent; border: 1.5px solid #5c1f6e; color: #5c1f6e; }
  .bdemo-btn--outline:hover { background: #f4f0f7; }
  .bdemo-btn--ghost { background: transparent; border: 1.5px solid #d1c4e9; color: #4a3557; }
  .bdemo-btn--ghost:hover { background: #f4f0f7; }
  .bdemo-btn--lg { padding: 0.7rem 1.5rem; font-size: 1rem; }
  .bdemo-btn--block { width: 100%; }

  /* GALLERY HERO */
  .bdemo-gallery-hero { margin-top: 64px; display: grid; grid-template-columns: 1fr 280px; grid-template-rows: 420px; background: #000; position: relative; }
  @media(max-width:768px){ .bdemo-gallery-hero { grid-template-columns: 1fr; grid-template-rows: 280px; } }
  .bdemo-gallery-hero__main { position: relative; overflow: hidden; cursor: zoom-in; }
  .bdemo-gallery-hero__main img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s; }
  .bdemo-gallery-hero__main:hover img { transform: scale(1.03); }
  .bdemo-gallery-hero__grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 3px; }
  @media(max-width:768px){ .bdemo-gallery-hero__grid { display: none; } }
  .bdemo-gallery-hero__thumb { position: relative; overflow: hidden; cursor: zoom-in; }
  .bdemo-gallery-hero__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s; }
  .bdemo-gallery-hero__thumb:hover img { transform: scale(1.05); }
  .bdemo-gallery-hero__more { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.2rem; font-weight: 700; }
  .bdemo-gallery-hero__all-btn { position: absolute; bottom: 1rem; left: 1rem; background: rgba(255,255,255,0.92); color: #1a0a2e; border: none; border-radius: 8px; padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: background 0.2s; }
  .bdemo-gallery-hero__all-btn:hover { background: #fff; }

  /* BADGES */
  .bdemo-badge { position: absolute; top: 1rem; right: 1rem; padding: 0.3rem 0.75rem; border-radius: 20px; font-size: 0.78rem; font-weight: 700; z-index: 2; }
  .bdemo-badge--open { background: #2e7d32; color: #fff; }
  .bdemo-badge--closed { background: #c62828; color: #fff; }
  .bdemo-badge--verified { background: rgba(92,31,110,0.9); color: #fff; top: 1rem; right: 7rem; }

  /* TITLE BAR */
  .bdemo-titlebar { background: #fff; border-bottom: 1px solid #e8e0f0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .bdemo-titlebar__inner { max-width: 1280px; margin: 0 auto; padding: 1.25rem 1.5rem; }
  .bdemo-titlebar__breadcrumb { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: #6b5f75; margin-bottom: 1rem; flex-wrap: wrap; }
  .bdemo-titlebar__breadcrumb a { color: #5c1f6e; text-decoration: none; }
  .bdemo-titlebar__breadcrumb a:hover { text-decoration: underline; }
  .bdemo-titlebar__head { display: flex; align-items: flex-start; gap: 1.25rem; flex-wrap: wrap; }
  .bdemo-titlebar__logo { width: 72px; height: 72px; border-radius: 14px; background: linear-gradient(135deg,#1a0a2e,#5c1f6e); display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.35); font-size: 2rem; font-weight: 900; flex-shrink: 0; border: 3px solid #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
  .bdemo-titlebar__text { flex: 1; }
  .bdemo-titlebar__tags { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
  .bdemo-tag { padding: 0.2rem 0.65rem; border-radius: 20px; font-size: 0.74rem; font-weight: 700; }
  .bdemo-tag--cat { background: rgba(92,31,110,0.1); color: #5c1f6e; }
  .bdemo-tag--verified { background: rgba(46,125,50,0.1); color: #2e7d32; }
  .bdemo-titlebar__name { font-size: clamp(1.3rem,3vw,1.9rem); font-weight: 800; margin: 0 0 0.25rem; color: #1a0a2e; }
  .bdemo-titlebar__lead { color: #5c1f6e; font-size: 0.92rem; margin: 0 0 0.5rem; }
  .bdemo-titlebar__meta { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; align-items: center; font-size: 0.85rem; color: #4a3557; }
  .bdemo-titlebar__loc { display: flex; align-items: center; gap: 0.3rem; }
  .bdemo-titlebar__phone { display: flex; align-items: center; gap: 0.3rem; color: #5c1f6e; text-decoration: none; font-weight: 600; }
  .bdemo-stars { color: #f4511e; letter-spacing: -1px; display: flex; align-items: center; gap: 0.3rem; }
  .bdemo-stars strong { color: #1a0a2e; font-size: 0.92rem; }
  .bdemo-titlebar__actions { display: flex; flex-direction: column; gap: 0.5rem; min-width: 160px; align-items: stretch; }
  @media(max-width:640px){ .bdemo-titlebar__actions { flex-direction: row; width: 100%; } }

  /* BODY */
  .bdemo-body { max-width: 1280px; margin: 0 auto; padding: 2rem 1.5rem; }
  .bdemo-body__inner { display: grid; grid-template-columns: 1fr 320px; gap: 1.5rem; align-items: start; }
  @media(max-width:900px){ .bdemo-body__inner { grid-template-columns: 1fr; } }

  /* TABS */
  .bdemo-tabs { display: flex; gap: 0; border-bottom: 2px solid #e8e0f0; margin-bottom: 1.5rem; overflow-x: auto; }
  .bdemo-tab { background: transparent; border: none; border-bottom: 3px solid transparent; padding: 0.75rem 1.25rem; font-size: 0.9rem; font-weight: 600; color: #6b5f75; cursor: pointer; white-space: nowrap; margin-bottom: -2px; transition: all 0.2s; }
  .bdemo-tab:hover { color: #5c1f6e; }
  .bdemo-tab--active { color: #5c1f6e; border-bottom-color: #5c1f6e; }

  /* PANELS */
  .bdemo-panel { background: #fff; border-radius: 14px; padding: 1.75rem; box-shadow: 0 2px 12px rgba(0,0,0,0.05); }
  .bdemo-panel__title { font-size: 1.1rem; font-weight: 700; color: #1a0a2e; margin: 0 0 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f0e8f8; }
  .bdemo-panel__text { color: #3a2a4a; line-height: 1.8; font-size: 0.95rem; margin: 0 0 1rem; }
  .bdemo-panel__empty { color: #8b7a9a; font-size: 0.9rem; }
  .bdemo-panel__claim-prompt { display: flex; gap: 0.85rem; background: #f9f0ff; border: 1px solid #d8b4fe; border-radius: 10px; padding: 1rem 1.25rem; align-items: flex-start; }
  .bdemo-panel__claim-prompt span { font-size: 1.5rem; flex-shrink: 0; }
  .bdemo-panel__claim-prompt strong { display: block; margin-bottom: 0.25rem; color: #1a0a2e; }
  .bdemo-panel__claim-prompt p { margin: 0; font-size: 0.88rem; color: #4a3557; }
  .bdemo-panel__claim-prompt a { color: #5c1f6e; font-weight: 600; }

  /* INFO GRID */
  .bdemo-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-top: 1.25rem; }
  @media(max-width:480px){ .bdemo-info-grid { grid-template-columns: 1fr; } }
  .bdemo-info-item { display: flex; align-items: flex-start; gap: 0.75rem; background: #f9f6fc; border-radius: 10px; padding: 0.85rem; }
  .bdemo-info-item__icon { font-size: 1.2rem; flex-shrink: 0; margin-top: 0.1rem; }
  .bdemo-info-item div { display: flex; flex-direction: column; gap: 0.15rem; }
  .bdemo-info-item strong { font-size: 0.75rem; color: #8b7a9a; font-weight: 600; }
  .bdemo-info-item span, .bdemo-info-item a { font-size: 0.9rem; color: #1a0a2e; text-decoration: none; font-weight: 500; }
  .bdemo-info-item a:hover { text-decoration: underline; color: #5c1f6e; }

  /* PROMO */
  .bdemo-promo { background: linear-gradient(135deg,#fff9f0,#fff3e0); border: 1.5px solid #ffcc80; border-radius: 12px; padding: 1.25rem; margin-top: 1.25rem; }
  .bdemo-promo__label { font-size: 0.75rem; font-weight: 700; color: #e65100; margin-bottom: 0.5rem; }
  .bdemo-promo__title { font-size: 1rem; font-weight: 700; color: #1a0a2e; margin: 0 0 0.4rem; }
  .bdemo-promo__desc { font-size: 0.88rem; color: #4a3557; margin: 0; }

  /* CAREERS */
  .bdemo-careers { background: #f0f4ff; border: 1.5px solid #b3c5fd; border-radius: 12px; padding: 1.25rem; margin-top: 1.25rem; }
  .bdemo-careers__title { font-size: 0.95rem; font-weight: 700; color: #1a237e; margin: 0 0 0.75rem; }

  /* HOURS */
  .bdemo-hours { display: flex; flex-direction: column; gap: 0; }
  .bdemo-hours__row { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; border-radius: 8px; }
  .bdemo-hours__row:nth-child(even) { background: #f9f6fc; }
  .bdemo-hours__row--today { background: #f3e8ff !important; border: 1px solid #d8b4fe; }
  .bdemo-hours__day { flex: 1; font-size: 0.88rem; color: #3a2a4a; }
  .bdemo-hours__val { font-size: 0.88rem; color: #1a0a2e; font-weight: 600; }
  .bdemo-hours__today-badge { font-size: 0.7rem; background: #5c1f6e; color: #fff; padding: 0.15rem 0.5rem; border-radius: 10px; }

  /* GALLERY GRID */
  .bdemo-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; }
  .bdemo-gallery-grid__item { aspect-ratio: 1; border-radius: 10px; overflow: hidden; cursor: zoom-in; border: none; padding: 0; background: #e8e0f0; transition: transform 0.2s; }
  .bdemo-gallery-grid__item:hover { transform: scale(1.04); }
  .bdemo-gallery-grid__item img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* MAP */
  .bdemo-map-wrap iframe, .bdemo-sidebar-card--map iframe { width: 100%; height: 220px; border: none; border-radius: 10px; display: block; }
  .bdemo-map-wrap iframe { height: 350px; }

  /* SIDEBAR */
  .bdemo-sidebar { display: flex; flex-direction: column; gap: 1rem; position: sticky; top: 80px; }
  .bdemo-sidebar-card { background: #fff; border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 12px rgba(0,0,0,0.05); }
  .bdemo-sidebar-card--map { padding: 0; overflow: hidden; }
  .bdemo-sidebar-card__title { font-size: 0.9rem; font-weight: 700; color: #1a0a2e; margin: 0 0 0.85rem; }
  .bdemo-sidebar-card__row { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.85rem; color: #4a3557; margin-top: 0.5rem; }
  .bdemo-sidebar-card__status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; margin-top: 0.85rem; padding: 0.5rem 0.75rem; border-radius: 8px; }
  .bdemo-sidebar-card__status--open { background: #e8f5e9; color: #2e7d32; }
  .bdemo-sidebar-card__status--closed { background: #ffebee; color: #c62828; }
  .bdemo-sidebar-card__more { background: transparent; border: none; color: #5c1f6e; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0.4rem 0; }
  .bdemo-sidebar-card--claim { background: linear-gradient(135deg,#f9f0ff,#f3e8ff); border: 1.5px solid #d8b4fe; text-align: center; }
  .bdemo-sidebar-card__claim-icon { font-size: 2rem; margin-bottom: 0.5rem; }
  .bdemo-sidebar-card--claim h3 { font-size: 0.95rem; font-weight: 700; margin: 0 0 0.5rem; }
  .bdemo-sidebar-card--claim p { font-size: 0.82rem; color: #4a3557; margin: 0 0 1rem; line-height: 1.5; }

  /* CONTACT BTN */
  .bdemo-contact-btn { display: flex; align-items: center; gap: 0.6rem; background: linear-gradient(135deg,#5c1f6e,#7c3aed); color: #fff; border-radius: 10px; padding: 0.85rem 1rem; font-size: 1rem; font-weight: 700; text-decoration: none; margin-bottom: 0.75rem; width: 100%; justify-content: center; transition: opacity 0.2s; direction: ltr; }
  .bdemo-contact-btn:hover { opacity: 0.9; }

  /* SHARE */
  .bdemo-share { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .bdemo-share__btn { flex: 1; padding: 0.5rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: 1.5px solid #e8e0f0; text-align: center; text-decoration: none; transition: all 0.2s; }
  .bdemo-share__btn--copy { background: #f4f0f7; color: #5c1f6e; }
  .bdemo-share__btn--wa { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
  .bdemo-share__btn:hover { transform: translateY(-1px); }

  /* RELATED */
  .bdemo-related { background: #fff; border-top: 1px solid #e8e0f0; padding: 3rem 1.5rem; }
  .bdemo-related__inner { max-width: 1280px; margin: 0 auto; }
  .bdemo-related__title { font-size: 1.2rem; font-weight: 800; color: #1a0a2e; margin: 0 0 1.5rem; }
  .bdemo-related__grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; }
  @media(max-width:600px){ .bdemo-related__grid { grid-template-columns: 1fr; } }
  .bdemo-rel-card { display: flex; gap: 1rem; background: #f9f6fc; border-radius: 12px; padding: 1rem; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; border: 1px solid #ede8f4; }
  .bdemo-rel-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
  .bdemo-rel-card__img { width: 64px; height: 64px; border-radius: 10px; overflow: hidden; flex-shrink: 0; background: linear-gradient(135deg,#1a0a2e,#5c1f6e); }
  .bdemo-rel-card__img img { width: 100%; height: 100%; object-fit: cover; }
  .bdemo-rel-card__placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.4); font-size: 1.4rem; font-weight: 800; }
  .bdemo-rel-card__body h4 { font-size: 0.9rem; font-weight: 700; margin: 0 0 0.25rem; color: #1a0a2e; }
  .bdemo-rel-card__body p { font-size: 0.8rem; color: #6b5f75; margin: 0; }

  /* LIGHTBOX */
  .bdemo-lightbox { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.92); display: flex; align-items: center; justify-content: center; }
  .bdemo-lightbox img { max-width: min(90vw,1200px); max-height: 88vh; object-fit: contain; border-radius: 6px; }
  .bdemo-lightbox__close { position: fixed; top: 1rem; right: 1rem; background: rgba(255,255,255,0.15); border: none; color: #fff; width: 42px; height: 42px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; }
  .bdemo-lightbox__prev, .bdemo-lightbox__next { position: fixed; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.15); border: none; color: #fff; width: 48px; height: 48px; border-radius: 50%; font-size: 2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .bdemo-lightbox__prev { right: 1rem; }
  .bdemo-lightbox__next { left: 1rem; }
  .bdemo-lightbox__counter { position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: #fff; padding: 0.3rem 0.9rem; border-radius: 20px; font-size: 0.88rem; }

  /* FOOTER */
  .bdemo-footer { background: #0c081e; color: rgba(255,255,255,0.5); padding: 1.5rem; font-size: 0.82rem; }
  .bdemo-footer__inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
  .bdemo-footer__links { display: flex; gap: 1rem; flex-wrap: wrap; }
  .bdemo-footer__links a { color: rgba(255,255,255,0.5); text-decoration: none; transition: color 0.2s; }
  .bdemo-footer__links a:hover { color: #c8a0ff; }

  /* SKELETON */
  .bdemo-skeleton { margin-top: 64px; }
  .bdemo-skeleton__hero { height: 420px; background: linear-gradient(90deg,#e8e0f0 25%,#f0e8f8 50%,#e8e0f0 75%); background-size: 400% 100%; animation: shimmer 1.5s infinite; }
  .bdemo-skeleton__body { max-width: 1280px; margin: 2rem auto; padding: 0 1.5rem; display: grid; grid-template-columns: 1fr 320px; gap: 1.5rem; }
  .bdemo-skeleton__main { background: #fff; border-radius: 14px; padding: 1.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .bdemo-skeleton__line { height: 16px; border-radius: 8px; background: linear-gradient(90deg,#e8e0f0 25%,#f0e8f8 50%,#e8e0f0 75%); background-size: 400% 100%; animation: shimmer 1.5s infinite; }
  .bdemo-skeleton__line:first-child { width: 60%; height: 24px; }
  .bdemo-skeleton__line:last-child { width: 40%; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* NOT FOUND */
  .bdemo-notfound { margin-top: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 1rem; text-align: center; padding: 2rem; }
  .bdemo-notfound h1 { font-size: 2rem; color: #1a0a2e; }
  .bdemo-notfound p { color: #6b5f75; }
`;
