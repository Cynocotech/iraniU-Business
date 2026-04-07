import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import SiteHeader from "../components/SiteHeader.jsx";
import FloatingBackButton from "../components/FloatingBackButton.jsx";

export default function MainLayout() {
  const location = useLocation();
  const hideSiteHeader = location.pathname === "/exchanges";
  const [headerLogoHref, setHeaderLogoHref] = useState("/");

  return (
    <>
      <a className="skip-link" href="#main">
        پرش به محتوا
      </a>
      {!hideSiteHeader ? <SiteHeader logoHref={headerLogoHref} /> : null}
      <main id="main">
        <Outlet context={{ setHeaderLogoHref }} />
      </main>
      <FloatingBackButton />
    </>
  );
}
