(function () {
  "use strict";

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var r1 = (lat1 * Math.PI) / 180;
    var r2 = (lat2 * Math.PI) / 180;
    var dLat = ((lat2 - lat1) * Math.PI) / 180;
    var dLon = ((lon2 - lon1) * Math.PI) / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(r1) * Math.cos(r2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function parseFloatParam(v) {
    var n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function bindAdvancedToggle(toggle, panel) {
    if (!toggle || !panel) return;
    toggle.addEventListener("click", function () {
      var open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function openPanelIfQuery(panel, toggle, params) {
    if (!panel || !toggle) return;
    if (
      params.get("adv") === "1" ||
      params.has("user_lat") ||
      params.has("sort") ||
      params.has("radius_km") ||
      params.get("has_website") === "1"
    ) {
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
    }
  }

  function fillFormFromParams(form, params) {
    if (!form) return;
    var names = [
      "q",
      "cat",
      "city",
      "sort",
      "radius_km",
      "user_lat",
      "user_lng",
    ];
    names.forEach(function (name) {
      var el = form.elements[name];
      if (!el) return;
      var v = params.get(name);
      if (v === null || v === "") return;
      if (el.type === "checkbox") {
        el.checked = v === "1" || v === "on";
      } else {
        el.value = v;
      }
    });
    var feat = form.elements.featured;
    if (feat && params.get("featured") === "1") feat.checked = true;
    var web = form.elements.has_website;
    if (web && params.get("has_website") === "1") web.checked = true;
  }

  function bindGeolocation(btn, form, statusEl) {
    if (!btn || !form) return;
    var latInput = form.elements.user_lat;
    var lngInput = form.elements.user_lng;
    btn.addEventListener("click", function () {
      if (!navigator.geolocation) {
        if (statusEl) {
          statusEl.textContent =
            "مرورگر شما از موقعیت مکانی پشتیبانی نمی‌کند.";
        }
        return;
      }
      if (statusEl) statusEl.textContent = "در حال دریافت موقعیت…";
      btn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          btn.disabled = false;
          if (latInput) latInput.value = String(pos.coords.latitude);
          if (lngInput) lngInput.value = String(pos.coords.longitude);
          if (statusEl) {
            statusEl.textContent =
              "موقعیت شما ثبت شد. شعاع و «اعمال فیلتر» را بزنید.";
          }
        },
        function () {
          btn.disabled = false;
          if (statusEl) {
            statusEl.textContent =
              "دسترسی به موقعیت رد شد یا خطا رخ داد. می‌توانید شهر را دستی انتخاب کنید.";
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });
  }

  function cardMatches(card, filters) {
    var cat = norm(card.getAttribute("data-cat"));
    var city = norm(card.getAttribute("data-city"));
    var promoted = card.getAttribute("data-promoted") === "1";
    var lat = parseFloat(card.getAttribute("data-lat"));
    var lng = parseFloat(card.getAttribute("data-lng"));
    var title = norm(card.getAttribute("data-search-text"));

    if (filters.cat && cat !== filters.cat) return false;
    if (filters.city && city !== filters.city) return false;
    if (filters.featured && !promoted) return false;
    if (filters.q && title.indexOf(filters.q) === -1) return false;
    if (filters.hasWebsite && card.getAttribute("data-has-website") !== "1") {
      return false;
    }

    if (
      filters.userLat != null &&
      filters.userLng != null &&
      filters.radiusKm > 0 &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      var d = haversineKm(filters.userLat, filters.userLng, lat, lng);
      if (d > filters.radiusKm) return false;
    }

    return true;
  }

  function applyListingFilters() {
    var root = document.querySelector(".listing-cards");
    if (!root) return;
    var params = getParams();
    var filters = {
      q: norm(params.get("q")),
      cat: norm(params.get("cat")),
      city: norm(params.get("city")),
      featured: params.get("featured") === "1",
      hasWebsite: params.get("has_website") === "1",
      userLat: parseFloatParam(params.get("user_lat")),
      userLng: parseFloatParam(params.get("user_lng")),
      radiusKm: parseFloatParam(params.get("radius_km")) || 25,
    };

    var cards = root.querySelectorAll(".listing-card");
    var visible = 0;
    var total = cards.length;

    cards.forEach(function (card) {
      var ok = cardMatches(card, filters);
      card.classList.toggle("listing-card--hidden", !ok);
      card.setAttribute("aria-hidden", ok ? "false" : "true");
      if (ok) visible++;
    });

    var sortMode = params.get("sort") || "relevance";
    if (sortMode === "distance" && filters.userLat != null && filters.userLng != null) {
      var visibleCards = [].slice.call(
        root.querySelectorAll(".listing-card:not(.listing-card--hidden)")
      );
      visibleCards.sort(function (a, b) {
        var la = parseFloat(a.getAttribute("data-lat"));
        var lo = parseFloat(a.getAttribute("data-lng"));
        var lb = parseFloat(b.getAttribute("data-lat"));
        var l2 = parseFloat(b.getAttribute("data-lng"));
        var da = haversineKm(filters.userLat, filters.userLng, la, lo);
        var db = haversineKm(filters.userLat, filters.userLng, lb, l2);
        return da - db;
      });
      visibleCards.forEach(function (c) {
        root.appendChild(c);
      });
    } else if (sortMode === "name") {
      var vis = [].slice.call(
        root.querySelectorAll(".listing-card:not(.listing-card--hidden)")
      );
      vis.sort(function (a, b) {
        var ta = norm(a.getAttribute("data-search-text"));
        var tb = norm(b.getAttribute("data-search-text"));
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        return 0;
      });
      vis.forEach(function (c) {
        root.appendChild(c);
      });
    }

    var empty = document.querySelector(".listings-empty");
    if (empty) {
      empty.hidden = visible > 0;
    }

    var countEl = document.querySelector("[data-listings-count]");
    if (countEl) {
      countEl.innerHTML =
        "نمایش <strong>" +
        visible +
        "</strong> مورد از <strong>" +
        total +
        "</strong> کسب‌وکار";
      if (filters.userLat != null && filters.userLng != null) {
        countEl.innerHTML +=
          " · فیلتر شعاع: حداکثر " + filters.radiusKm + " کیلومتر از موقعیت شما";
      }
    }
  }

  function onSubmitAdvHidden(form, panel, input) {
    if (!form || !input) return;
    form.addEventListener("submit", function () {
      input.value = panel && !panel.hidden ? "1" : "";
    });
  }

  function initForm(formId, toggleSel, panelSel, geoBtnSel, statusSel) {
    var form = document.getElementById(formId);
    if (!form) return;
    var panel = form.querySelector(panelSel) || document.querySelector(panelSel);
    var toggle =
      form.querySelector(toggleSel) || document.querySelector(toggleSel);
    var params = getParams();

    fillFormFromParams(form, params);
    bindAdvancedToggle(toggle, panel);
    openPanelIfQuery(panel, toggle, params);

    var advInput = form.querySelector('input[name="adv"]');
    if (advInput) onSubmitAdvHidden(form, panel, advInput);

    var geoBtn = form.querySelector(geoBtnSel) || document.querySelector(geoBtnSel);
    var statusEl =
      form.querySelector(statusSel) || document.querySelector(statusSel);
    bindGeolocation(geoBtn, form, statusEl);
  }

  var CAT_KEYWORDS = {
    food: ["غذا", "رستوران", "food", "كافه", "cafe", "pizza", "ایرانی"],
    market: ["سوپرمارکت", "مواد غذایی", "grocery", "market", "خواروبار"],
    health: ["سلامت", "پزشک", "dental", "health", "clinic", "کلینیک"],
    legal: ["حقوقی", "مهاجرت", "وکیل", "legal", "immigration", "solicitor"],
    beauty: ["زیبایی", "آرایش", "beauty", "salon", "spa"],
    auto: ["خودرو", "سرویس", "auto", "tire", "تایر", "mechanic"],
  };

  function getCatKey(cat) {
    if (!cat) return "";
    var c = cat.toLowerCase();
    for (var key in CAT_KEYWORDS) {
      var kws = CAT_KEYWORDS[key];
      for (var i = 0; i < kws.length; i++) {
        if (c.indexOf(kws[i].toLowerCase()) !== -1) return key;
      }
    }
    return "";
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildCard(biz) {
    var article = document.createElement("article");
    var slug = encodeURIComponent(String(biz.slug || biz.id || ""));
    var city = String(biz.city || "").toLowerCase().trim();
    var catKey = getCatKey(biz.category);
    var isPromoted = biz.package && biz.package !== "basic" ? "1" : "0";
    var hasWebsite = biz.website || biz.google_review_url ? "1" : "0";
    var lat = biz.lat || biz.latitude || "";
    var lng = biz.lng || biz.longitude || "";
    var searchText = [biz.name_fa, biz.category, biz.city, catKey, city]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    article.className = "listing-card";
    article.setAttribute("data-cat", catKey);
    article.setAttribute("data-city", city);
    article.setAttribute("data-promoted", isPromoted);
    article.setAttribute("data-lat", lat);
    article.setAttribute("data-lng", lng);
    article.setAttribute("data-has-website", hasWebsite);
    article.setAttribute("data-search-text", searchText);

    var businessUrl = "business.html?slug=" + slug;
    var imgHtml = biz.cover_image_url
      ? '<img class="listing-card__img" src="' +
        escHtml(biz.cover_image_url) +
        '" alt="" loading="lazy"/>'
      : '<div class="listing-card__placeholder" aria-hidden="true"></div>';
    var claimBtn = biz.claimed
      ? ""
      : '<a class="btn btn--ghost listing-card__btn" href="claim.html?business=' +
        encodeURIComponent(biz.name_fa || "") +
        '">ادعای مالکیت</a>';
    var phoneHtml = biz.phone
      ? '<p class="listing-card__line"><span class="listing-card__label">تماس</span> <span class="phone-ltr" dir="ltr">' +
        escHtml(biz.phone) +
        "</span></p>"
      : "";
    var addrHtml = biz.address
      ? '<p class="listing-card__line"><span class="listing-card__label">آدرس</span> ' +
        escHtml(biz.address) +
        "</p>"
      : "";

    var mediaClass = biz.cover_image_url
      ? "listing-card__media img-shimmer-host"
      : "listing-card__media";
    article.innerHTML =
      '<a class="' +
      mediaClass +
      '" href="' +
      businessUrl +
      '" tabindex="-1" aria-hidden="true">' +
      imgHtml +
      "</a>" +
      '<div class="listing-card__body">' +
      '<h2 class="listing-card__title"><a href="' +
      businessUrl +
      '">' +
      escHtml(biz.name_fa || biz.listing_title || "") +
      "</a></h2>" +
      '<p class="listing-card__cats">' +
      escHtml(biz.category || "") +
      (biz.subtitle ? " · " + escHtml(biz.subtitle) : "") +
      "</p>" +
      phoneHtml +
      addrHtml +
      '<div class="listing-card__actions">' +
      '<a class="btn btn--primary listing-card__btn" href="' +
      businessUrl +
      '">مشاهده پروفایل</a>' +
      claimBtn +
      "</div>" +
      "</div>";

    return article;
  }

  function showListingsLoading(show) {
    var root = document.querySelector(".listing-cards");
    if (!root) return;
    var existing = root.querySelector(".listings-loading");
    if (show && !existing) {
      var el = document.createElement("p");
      el.className = "listings-loading";
      el.style.cssText = "text-align:center;padding:2rem;color:#64748b;";
      el.textContent = "در حال بارگذاری…";
      root.innerHTML = "";
      root.appendChild(el);
    } else if (!show && existing) {
      existing.remove();
    }
  }

  function fetchAndRenderBusinesses(callback) {
    var root = document.querySelector(".listing-cards");
    if (!root) {
      if (callback) callback();
      return;
    }
    showListingsLoading(true);
    fetch("/api/businesses")
      .then(function (r) {
        return r.json();
      })
      .then(function (businesses) {
        root.innerHTML = "";
        if (!Array.isArray(businesses) || businesses.length === 0) {
          var empty = document.querySelector(".listings-empty");
          if (empty) empty.hidden = false;
          if (callback) callback();
          return;
        }
        businesses.forEach(function (biz) {
          root.appendChild(buildCard(biz));
        });
        if (callback) callback();
      })
      .catch(function () {
        showListingsLoading(false);
        if (callback) callback();
      });
  }

  function bindAjaxFormSubmit(form, panel) {
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var advInput = form.querySelector('input[name="adv"]');
      if (advInput && panel) {
        advInput.value = !panel.hidden ? "1" : "";
      }
      var fd = new FormData(form);
      var params = new URLSearchParams();
      fd.forEach(function (value, key) {
        if (value) params.set(key, value);
      });
      var newUrl =
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "");
      window.history.pushState({}, "", newUrl);
      applyListingFilters();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initForm(
      "listings-search-form",
      ".listings-search__adv-toggle",
      "#listings-advanced-panel",
      "#listings-geo-btn",
      "#listings-geo-status"
    );
    initForm(
      "hero-search-form",
      ".hero-advanced-toggle",
      "#hero-advanced-panel",
      "#hero-geo-btn",
      "#hero-geo-status"
    );

    var listingsForm = document.getElementById("listings-search-form");
    if (listingsForm) {
      var panel = document.getElementById("listings-advanced-panel");
      bindAjaxFormSubmit(listingsForm, panel);
      fetchAndRenderBusinesses(function () {
        applyListingFilters();
      });
    } else {
      applyListingFilters();
    }
  });
})();
