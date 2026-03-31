import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** مسیرهایی که روی دسکتاپ هم بدون «فقط موبایل» نمایش داده می‌شوند (لینک عمومی، پنل، تبلیغات، ادمین). */
const ALLOW = /^\/(login|dashboard|advertise|admin|l\/)/;

export default function DesktopGate() {
  const { pathname } = useLocation();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)");
    let gate = null;

    function allowDesktop() {
      return ALLOW.test(pathname);
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
          '<p class="iraniu-desktop-gate__title">فقط موبایل و تبلت</p>' +
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
  }, [pathname]);

  return null;
}
