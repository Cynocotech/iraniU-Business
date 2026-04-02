import { useState } from "react";
import { Link } from "react-router-dom";

/** Shared listing / featured business card (matches Listings page). */
export default function ListingCard({ b, titleHeading: TitleTag = "h2" }) {
  const href = `/business?slug=${encodeURIComponent(b.slug)}`;
  const cover = (b.cover_image_url || "").trim();
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(cover) && !imgFailed;

  return (
    <article className="listing-card">
      <Link
        to={href}
        className={`listing-card__media ${showImg ? "img-shimmer-host" : ""}`}
        aria-hidden={showImg ? undefined : true}
        tabIndex={-1}
      >
        {showImg ? (
          <img
            className="listing-card__img"
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(e) => {
              e.currentTarget.closest(".img-shimmer-host")?.classList.add("is-loaded");
            }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="listing-card__placeholder" aria-hidden>
            <span className="listing-card__placeholder-title">{b.name_fa || "Iraniu Listing"}</span>
          </div>
        )}
      </Link>
      <div className="listing-card__body">
        <TitleTag className="listing-card__title">
          <Link to={href}>
            <i className="fa-solid fa-building listing-card__ico" aria-hidden="true" />
            {b.name_fa}
          </Link>
        </TitleTag>
        {(b.category || b.listing_title) && (
          <p className="listing-card__cats">
            <i className="fa-solid fa-tag listing-card__ico" aria-hidden="true" />
            {b.category || b.listing_title}
          </p>
        )}
        {b.address ? (
          <p className="listing-card__line">
            <span className="listing-card__label">
              <i className="fa-solid fa-location-dot listing-card__ico" aria-hidden="true" />
              آدرس
            </span>
            {b.address}
          </p>
        ) : null}
        {b.city ? (
          <p className="listing-card__line">
            <span className="listing-card__label">
              <i className="fa-solid fa-map-location-dot listing-card__ico" aria-hidden="true" />
              منطقه
            </span>
            {b.city}
          </p>
        ) : null}
        <div className="listing-card__actions">
          <Link className="btn btn--primary listing-card__btn" to={href}>
            مشاهدهٔ صفحه
          </Link>
          <Link
            className="btn btn--ghost listing-card__btn"
            to={`/business?slug=${encodeURIComponent(b.slug)}&report=1`}
          >
            گزارش
          </Link>
        </div>
      </div>
    </article>
  );
}
