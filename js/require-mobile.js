(function () {
  /* ≥1025px = دسکتاپ؛ ۱۰۲۴px (مثلاً تبلت افقی) همچنان مجاز */
  var mq = window.matchMedia("(min-width: 1025px)");
  var gate = null;

  
  /** پنل ادمین، پنل مالک، تبلیغات و بسته‌ها روی دسکتاپ هم باز می‌شوند؛ بقیهٔ سایت موبایل‌محور می‌ماند */
  function allowDesktop() {
    var path = window.location.pathname || "";
    var file = path.split("/").pop() || "";
    if (file === "dashboard.html") return true;
    if (file === "advertise.html") return true;
    if (file === "admin.html") return true;
    return /^admin-[^/]+\.html$/.test(file);
  }

  function update() {
    // Desktop blocking disabled - allowing all screen sizes
    document.documentElement.classList.remove("iraniu-desktop-blocked");
    if (gate && gate.parentNode) {
      gate.parentNode.removeChild(gate);
    }
    gate = null;
  }

  update();
  if (mq.addEventListener) {
    mq.addEventListener("change", update);
  } else {
    mq.addListener(update);
  }
})();
