import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  resolveBiolinkHref,
  iconForPreset,
  labelForPreset,
  clampThemeId,
  safeBackgroundImageUrl,
} from "../lib/biolink.js";

const ALERT_KEY = (slug) => `biolink_alert_dismiss_${slug}`;

/**
 * صفحهٔ عمومی Biolink — طراحی اختصاصی /l/:slug
 */
export default function BiolinkPublicView({ slug, businessName = "", coverFallback = "", data }) {
  const headline = (data.headline || businessName || "").trim() || "—";
  const subtitle = (data.bio || "").trim();
  const avatar = (data.avatarUrl || coverFallback || "").trim();
  const alertText = (data.alert?.text || "").trim();
  const alertOn = data.alert?.enabled && alertText.length > 0;

  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    if (!slug) return;
    try {
      if (sessionStorage.getItem(ALERT_KEY(slug)) === "1") setAlertDismissed(true);
    } catch (_) {}
  }, [slug]);

  const dismissAlert = () => {
    setAlertDismissed(true);
    if (slug) {
      try {
        sessionStorage.setItem(ALERT_KEY(slug), "1");
      } catch (_) {}
    }
  };

  const links = Array.isArray(data.links) ? data.links : [];
  const rawSocial = Array.isArray(data.socialLinks) ? data.socialLinks : [];

  const socialOrdered = useMemo(() => {
    return rawSocial.filter((s) => {
      if (!s || s.enabled === false) return false;
      return String(s.url || "").trim().length > 0;
    });
  }, [rawSocial]);

  const themeId = clampThemeId(data.themeId);
  const bgUrl = safeBackgroundImageUrl(data.backgroundImageUrl);
  const overlayRaw = String(data.backgroundOverlay || "dark").toLowerCase();
  const overlay = overlayRaw === "light" || overlayRaw === "none" ? overlayRaw : "dark";
  const bgMode = bgUrl ? "image" : "gradient";

  return (
    <main
      className="biolink-public"
      lang="fa"
      dir="rtl"
      data-biolink-theme={String(themeId)}
      data-biolink-bg={bgMode}
    >
      {bgUrl ? (
        <>
          <div
            className="biolink-public__bg-photo"
            style={{ backgroundImage: `url(${bgUrl})` }}
            aria-hidden="true"
          />
          {overlay !== "none" ? (
            <div
              className={`biolink-public__bg-scrim biolink-public__bg-scrim--${overlay}`}
              aria-hidden="true"
            />
          ) : null}
        </>
      ) : null}
      <div className="biolink-public__noise" aria-hidden="true" />
      <div className="biolink-public__card" role="article">
        <header className="biolink-public__header">
          {avatar ? (
            <div className="biolink-public__avatar-ring">
              <img className="biolink-public__avatar" src={avatar} alt="" />
            </div>
          ) : (
            <div className="biolink-public__avatar-ring biolink-public__avatar-ring--empty">
              <div className="biolink-public__avatar-placeholder" aria-hidden="true">
                <i className="fa-solid fa-store" />
              </div>
            </div>
          )}
          <h1 className="biolink-public__title">{headline}</h1>
          {subtitle ? <p className="biolink-public__bio">{subtitle}</p> : null}
        </header>

        {alertOn && !alertDismissed ? (
          <div className="biolink-public__alert" role="status">
            <span className="biolink-public__alert-ico" aria-hidden="true">
              <i className="fa-solid fa-circle-check" />
            </span>
            <p className="biolink-public__alert-text">{alertText}</p>
            <button type="button" className="biolink-public__alert-close" onClick={dismissAlert} aria-label="بستن">
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <ul className="biolink-public__links">
          {links.map((link) => {
            if (link && link.enabled === false) return null;
            const href = resolveBiolinkHref(link);
            const label = (link.label || "").trim() || "لینک";
            if (href === "#" && !(link.url || "").trim()) return null;
            const local = /^tel:|^mailto:/i.test(href);
            const ic = (link.iconClass || "").trim() || iconForPreset(link.preset);
            return (
              <li key={link.id || label + href}>
                <a
                  className="biolink-public__btn"
                  href={href}
                  {...(local ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                >
                  <span className="biolink-public__btn-ico" aria-hidden="true">
                    <i className={ic} />
                  </span>
                  <span className="biolink-public__btn-text">{label}</span>
                </a>
              </li>
            );
          })}
        </ul>


        <footer className="biolink-public__footer">
          {slug ? (
            <p className="biolink-public__foot">
              <Link to={`/business?slug=${encodeURIComponent(slug)}`}>مشاهده در ایرانیو</Link>
            </p>
          ) : null}
          <p className="biolink-public__brand-foot">{headline !== "—" ? headline : businessName || "ایرانیو"}</p>
        </footer>
      </div>
    </main>
  );
}
