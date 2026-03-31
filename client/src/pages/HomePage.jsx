import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api.js";

export default function HomePage() {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    document.body.classList.add("page-home");
    return () => document.body.classList.remove("page-home");
  }, []);

  useEffect(() => {
    apiGet("/api/businesses")
      .then((rows) => {
        setFeatured((rows || []).slice(0, 6));
      })
      .catch(() => setFeatured([]));
  }, []);

  return (
    <>
      <section className="hero hero--home page-home" aria-labelledby="hero-title">
        <div className="hero__bg" aria-hidden="true"></div>
        <div className="hero__inner">
          <header className="hero__intro">
            <p className="hero__eyebrow">فهرست کسب‌وکارهای ایرانی در بریتانیا</p>
            <h1 id="hero-title" className="hero__display">
              کسب‌وکار ایرانی را پیدا کنید
            </h1>
            <p className="hero__tagline">نام، شهر یا دسته را انتخاب کنید؛ نتیجه در لیست دیده می‌شود.</p>
            <div className="hero__map-row">
              <Link className="btn btn--ghost hero__map-btn" to="/map">
                <span className="hero__map-btn-ico" aria-hidden="true">
                  🗺
                </span>
                نقشهٔ کسب‌وکارها
              </Link>
            </div>
          </header>

          <form
            id="hero-search-form"
            className="hero__form hero__panel"
            action="/listings"
            method="get"
            role="search"
            aria-label="جستجو و فیلتر کسب‌وکار"
          >
            <input type="hidden" name="adv" value="" id="hero-adv-flag" />
            <div className="search-bar hero__search search-bar--home">
              <input
                type="search"
                name="q"
                id="hero-search-q"
                placeholder="نام کسب‌وکار، رستوران، وکیل، آرایشگاه…"
                autoComplete="off"
              />
              <label htmlFor="hero-search-city" className="visually-hidden">
                شهر
              </label>
              <select id="hero-search-city" name="city" aria-label="شهر">
                <option value="">همه شهرها</option>
                <option value="london">لندن</option>
                <option value="manchester">منچستر</option>
                <option value="birmingham">برمنگام</option>
                <option value="glasgow">گلاسگو</option>
              </select>
              <label htmlFor="hero-search-cat" className="visually-hidden">
                دسته
              </label>
              <select id="hero-search-cat" name="cat" aria-label="دسته">
                <option value="">همه دسته‌ها</option>
                <option value="food">غذا و رستوران</option>
                <option value="market">سوپرمارکت و مواد غذایی</option>
                <option value="health">سلامت و پزشکی</option>
                <option value="legal">حقوقی و مهاجرت</option>
                <option value="beauty">زیبایی و آرایشگاه</option>
                <option value="auto">خودرو و سرویس</option>
              </select>
              <button type="submit" className="btn btn--accent">
                جستجو
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="section section--home container" aria-labelledby="cat-title">
        <div className="section__head section__head--home">
          <h2 id="cat-title" className="section__title section__title--home">
            دسته‌بندی‌های پرطرفدار
          </h2>
        </div>
        <div className="category-grid category-grid--home">
          <Link className="category-card category-card--home" to="/listings">
            غذا و رستوران
          </Link>
          <Link className="category-card category-card--home" to="/listings">
            سلامت
          </Link>
          <Link className="category-card category-card--home" to="/listings">
            حقوقی
          </Link>
        </div>
      </section>

      <section className="section section--home section--featured-strip container" aria-labelledby="feat-title">
        <div className="section__head section__head--home">
          <h2 id="feat-title" className="section__title section__title--home">
            کسب‌وکارهای ویژه
          </h2>
        </div>
        <div className="card-grid card-grid--home">
          {featured.length === 0 ? (
            <p className="field-hint" style={{ gridColumn: "1 / -1" }}>
              هنوز آگهی‌ای ثبت نشده.{" "}
              <Link to="/listings">مشاهدهٔ همهٔ آگهی‌ها</Link>
            </p>
          ) : (
            featured.map((b) => (
              <article key={b.slug} className="card card--home card--promoted">
                <div className="card__body">
                  <h3 className="card__title">
                    <Link to={`/business?slug=${encodeURIComponent(b.slug)}`}>{b.name_fa}</Link>
                  </h3>
                  <p className="card__meta">{b.city || b.address || "—"}</p>
                  <div className="card__actions">
                    <Link
                      className="btn btn--primary"
                      to={`/business?slug=${encodeURIComponent(b.slug)}`}
                    >
                      مشاهده
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}
