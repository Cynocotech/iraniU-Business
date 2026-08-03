/**
 * Reservation modal — attaches to any page that has #resv-open-btn and #resv-modal.
 * Submits to /api/v1/reservations and shows a confirmation code on success.
 */
(function () {
  "use strict";

  const API = "/api/v1/reservations";

  function $(id) { return document.getElementById(id); }

  function getTodayStr() {
    return new Date().toISOString().split("T")[0];
  }

  function getMinDate() {
    // tomorrow minimum
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }

  function openModal() {
    const modal = $("resv-modal");
    if (!modal) return;
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    const firstInput = modal.querySelector("input, select");
    if (firstInput) firstInput.focus();
  }

  function closeModal() {
    const modal = $("resv-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function showNotice(type, html) {
    const el = $("resv-notice");
    if (!el) return;
    el.className = `resv-notice resv-notice--${type}`;
    el.innerHTML = html;
    el.hidden = false;
  }

  function hideNotice() {
    const el = $("resv-notice");
    if (el) el.hidden = true;
  }

  function getBusinessSlug() {
    // Try meta tag, then URL param
    const meta = document.querySelector('meta[name="business-slug"]');
    if (meta) return meta.getAttribute("content");
    const params = new URLSearchParams(window.location.search);
    return params.get("slug") || params.get("business") || "";
  }

  async function submitReservation(form) {
    hideNotice();
    const btn = form.querySelector(".resv-form__submit");
    btn.disabled = true;
    btn.textContent = "در حال ارسال…";

    const data = {
      business_slug: getBusinessSlug(),
      customer_name: form.resv_name.value.trim(),
      customer_email: form.resv_email.value.trim(),
      customer_phone: form.resv_phone.value.trim() || null,
      reservation_date: form.resv_date.value,
      reservation_time: form.resv_time.value,
      party_size: parseInt(form.resv_party.value) || 2,
      occasion: form.resv_occasion.value || null,
      seating_preference: form.resv_seating.value || "no-preference",
      special_requests: form.resv_special.value.trim() || null,
    };

    try {
      const resp = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await resp.json();

      if (!resp.ok) {
        showNotice("error", json.hint || json.error || "خطایی رخ داد. لطفاً دوباره امتحان کنید.");
        btn.disabled = false;
        btn.textContent = "تأیید رزرو";
        return;
      }

      // Success
      form.style.display = "none";
      showNotice(
        "success",
        `<strong>رزرو شما با موفقیت ثبت شد!</strong><br>` +
        `کد تأیید رزرو شما:<br>` +
        `<span class="resv-conf-code">${json.confirmation_code}</span><br>` +
        `<small>این کد را برای لغو یا پیگیری نگه دارید. ایمیل تأیید به <strong>${json.customer_email}</strong> ارسال خواهد شد.</small>`
      );
    } catch {
      showNotice("error", "اتصال به سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.");
      btn.disabled = false;
      btn.textContent = "تأیید رزرو";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const openBtn = $("resv-open-btn");
    const modal = $("resv-modal");
    const closeBtn = $("resv-close-btn");
    const backdrop = $("resv-backdrop");
    const form = $("resv-form");

    if (!modal || !form) return;

    // Set min date on date picker
    const dateInput = $("resv-date");
    if (dateInput) dateInput.min = getMinDate();

    if (openBtn) openBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (backdrop) backdrop.addEventListener("click", closeModal);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitReservation(form);
    });
  });
})();
