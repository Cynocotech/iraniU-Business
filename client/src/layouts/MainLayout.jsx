import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import SiteHeader from "../components/SiteHeader.jsx";
import FloatingBackButton from "../components/FloatingBackButton.jsx";

export default function MainLayout() {
  const [headerLogoHref, setHeaderLogoHref] = useState("/");
  const { pathname } = useLocation();
  const hideSiteHeader = false;
  const hamburgerOnlyHeader = pathname === "/listings" || pathname === "/";
  const hideHeaderLinks = pathname === "/exchanges";

  return (
    <>
      <a className="skip-link" href="#main">
        پرش به محتوا
      </a>
      {!hideSiteHeader && (
        <SiteHeader logoHref={headerLogoHref} hamburgerOnly={hamburgerOnlyHeader} hideLinks={hideHeaderLinks} />
      )}
      <main id="main" className={hideSiteHeader ? "main--no-site-header" : undefined}>
        <Outlet context={{ setHeaderLogoHref }} />
      </main>
      <FloatingBackButton />
    </>
  );
}
