import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGet } from "../api.js";

/** مسیرهایی که روی دسکتاپ مجازند (پنل، ادمین، ورود، لینک‌تک). بقیهٔ سایت فقط موبایل/تبلت. */
function allowDesktopPathname(pathname) {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
  if (normalized.startsWith("/dashboard")) return true;
  if (normalized.startsWith("/admin")) return true;
  if (normalized.startsWith("/l/")) return true;
  if (normalized.startsWith("/login")) return true;
  if (normalized.startsWith("/onboarding/exchange")) return true;
  if (normalized.startsWith("/exchanges")) return true;
  if (normalized.startsWith("/blog")) return true;
  if (normalized.startsWith("/listings")) return true;
  if (normalized.startsWith("/onboarding")) return true;
  if (normalized.startsWith("/tfl")) return true;
  return false;
}

export default function DesktopGate() {
  const { pathname } = useLocation();
  const [gateEnabled, setGateEnabled] = useState(true);

  useEffect(() => {
    apiGet("/api/desktop-gate-status")
      .then((d) => setGateEnabled(d?.enabled !== false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)");
    let gate = null;

    function allowDesktop() {
      return !gateEnabled || allowDesktopPathname(pathname);
    }

    function removeGate() {
      document.documentElement.classList.remove("iraniu-desktop-blocked");
      if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
      gate = null;
    }

    function showGate() {
      document.documentElement.classList.add("iraniu-desktop-blocked");
      if (!gate) {
        gate = document.createElement("div");
        gate.className = "iraniu-desktop-gate";
        gate.setAttribute("dir", "rtl");
        gate.setAttribute("lang", "fa");
        gate.innerHTML =
          '<div class="iraniu-desktop-gate__inner" role="alert" aria-live="assertive">' +
          '<p class="iraniu-desktop-gate__title" dir="ltr" lang="en">Open this on mobile</p>' +
          '<p class="iraniu-desktop-gate__text iraniu-desktop-gate__text--en" dir="ltr" lang="en">' +
          "This site is for phones and tablets only. Please open this address on your mobile device." +
          "</p>" +
          '<p class="iraniu-desktop-gate__text">این نسخه فقط برای موبایل و تبلت است. لطفاً با گوشی یا تبلت همان آدرس را باز کنید.</p>' +
          "</div>";
        document.body.insertBefore(gate, document.body.firstChild);
      }
    }

    function update() {
      if (allowDesktop()) {
        removeGate();
        return;
      }
      if (mq.matches) showGate();
      else removeGate();
    }

    update();
    mq.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
      removeGate();
    };
  }, [pathname, gateEnabled]);

  return null;
}
