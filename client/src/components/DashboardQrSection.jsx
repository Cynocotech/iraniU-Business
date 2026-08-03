import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { apiGet, apiPatch } from "../api.js";
import DashboardPanelHead, { dashboardIcons } from "./DashboardPanelHead.jsx";
import {
  THEME_QR_COLORS,
  RIBBON_SOLID_BG,
  BODY_SOFT_BG,
  ACCENT_MID_TEXT,
  QR_THEME_OPTIONS,
  clampThemeNum,
  isValidStoredTheme,
} from "../data/qrPrintThemes.js";

const STORAGE_BID = "iraniu_dashboard_qr_business_id";
const STORAGE_REVIEW_URL = "iraniu_dashboard_qr_google_review_url";
const STORAGE_PRINT_THEME = "iraniu_dashboard_qr_print_theme";
/** پس از «ساخت QR» تا رفرش هم پیش‌نمایش و کد بماند */
const STORAGE_QR_ACTIVE = "iraniu_dashboard_qr_active";
const STORAGE_QR_BIZ_NAME = "iraniu_dashboard_qr_biz_name";

function toBase64Url(str) {
  const b = btoa(unescape(encodeURIComponent(str)));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sanitizeBid(raw) {
  let s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "business";
}

function buildGoUrl(googleReviewUrl, bid) {
  const u = new URL("/go", window.location.origin);
  u.searchParams.set("bid", sanitizeBid(bid));
  u.searchParams.set("t", toBase64Url(googleReviewUrl));
  return u.href;
}

function buildFlyerHtml(themeNum, name, logoSrc, settings = {}) {
  const t = clampThemeNum(themeNum);
  const logoW = Number(settings.logoWidth) || 150;
  const qrS = Number(settings.qrSize) || 220;
  const logoBlock = logoSrc
    ? `<div class="qr-tpl__logo"><img src="${logoSrc}" alt="" style="max-width:${logoW}px;max-height:76px;width:auto;height:auto;object-fit:contain;" /></div>`
    : "";
  const safeName = (name || "نام کسب‌وکار").replace(/</g, "&lt;");
  return (
    `<div class="qr-tpl qr-tpl__sheet" data-qr-theme="${t}">` +
    `<div class="qr-tpl__frame">` +
    `<div class="qr-tpl__ribbon" dir="ltr" lang="en">` +
    `<span class="qr-tpl__deco qr-tpl__deco--tl" aria-hidden="true"></span>` +
    `<img src="/qr-code-template-main/images/iraniu-logo.png" alt="Iraniu" style="display:block;margin:0 auto 14px;width:${logoW}px;height:auto;object-fit:contain;padding:0 1px;box-sizing:border-box;" crossOrigin="anonymous" />` +
    `<img src="/google-reviews-logo.png" alt="Google Reviews" style="display:block;margin:0 auto 4px;max-width:160px;height:auto;filter:brightness(0) invert(1);" crossOrigin="anonymous" />` +
    `<p class="qr-tpl__ribbon-sub">Scan the QR code to leave a review</p>` +
    `<span class="qr-tpl__deco qr-tpl__deco--br" aria-hidden="true"></span>` +
    `</div>` +
    `<div class="qr-tpl__body">` +
    logoBlock +
    `<div class="qr-tpl__qr" style="display:inline-block;line-height:0;"><canvas class="qr-tpl__qr-canvas" width="${qrS}" height="${qrS}" style="display:block;width:${qrS}px;height:${qrS}px;min-width:${qrS}px;min-height:${qrS}px;" aria-hidden="true"></canvas></div>` +
    `<p class="qr-tpl__headline">از حمایت شما سپاسگزاریم</p>` +
    `<p class="qr-tpl__hint">با اسکن کد به صفحهٔ نظرات Google هدایت می‌شوید.</p>` +
    `<p class="qr-tpl__biz">${safeName}</p>` +
    `</div>` +
    `<div class="qr-tpl__strip">` +
    `<div class="qr-tpl__strip-url" dir="ltr" lang="en">www.iraniu.uk</div>` +
    `<div class="qr-tpl__strip-slogan" dir="rtl" lang="fa">فهرست کسب‌وکارهای ایرانی در بریتانیا</div>` +
    `</div>` +
    `</div></div>`
  );
}

async function waitForImages(root) {
  const imgs = root.querySelectorAll("img");
  await Promise.all(
    [...imgs].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth !== 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        })
    )
  );
  await Promise.all(
    [...imgs].map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
  );
}

function patchFlyerCloneForCanvas(_doc, clonedRoot, themeNum) {
  if (!clonedRoot) return;
  const t = clampThemeNum(themeNum);
  const solid = RIBBON_SOLID_BG[t] || RIBBON_SOLID_BG[1];
  const ribbon = clonedRoot.querySelector(".qr-tpl__ribbon");
  if (ribbon) {
    ribbon.style.zIndex = "0";
    ribbon.style.background = solid;
    ribbon.style.backgroundImage = "none";
    ribbon.style.direction = "ltr";
    ribbon.style.textAlign = "center";
    ribbon.style.unicodeBidi = "isolate";
    ribbon.style.fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';
  }
  const body = clonedRoot.querySelector(".qr-tpl__body");
  if (body) {
    body.style.position = "relative";
    body.style.zIndex = "1";
    body.style.background = BODY_SOFT_BG[t] || "#ffffff";
    body.style.backgroundImage = "none";
    body.style.fontFamily = '"Yekan Bakh", Tahoma, "Segoe UI", sans-serif';
  }
  const strip = clonedRoot.querySelector(".qr-tpl__strip");
  if (strip) {
    strip.style.zIndex = "0";
    strip.style.background = solid;
    strip.style.backgroundImage = "none";
    strip.style.display = "flex";
    strip.style.flexDirection = "column";
    strip.style.alignItems = "center";
    strip.style.justifyContent = "center";
    strip.style.textAlign = "center";
    strip.style.unicodeBidi = "isolate";
  }
  const stripUrl = clonedRoot.querySelector(".qr-tpl__strip-url");
  if (stripUrl) {
    stripUrl.style.fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';
    stripUrl.style.color = "#ffffff";
  }
  const stripSlogan = clonedRoot.querySelector(".qr-tpl__strip-slogan");
  if (stripSlogan) {
    stripSlogan.style.fontFamily = '"Yekan Bakh", Tahoma, sans-serif';
    stripSlogan.style.color = "#ffffff";
  }
  const qrWrap = clonedRoot.querySelector(".qr-tpl__qr");
  if (qrWrap) {
    qrWrap.style.display = "inline-block";
    qrWrap.style.lineHeight = "0";
    qrWrap.style.position = "relative";
    qrWrap.style.zIndex = "3";
    qrWrap.style.isolation = "isolate";
  }
  const qrCv = clonedRoot.querySelector(".qr-tpl__qr-canvas");
  if (qrCv) {
    qrCv.style.display = "block";
    qrCv.style.width = "220px";
    qrCv.style.height = "220px";
    qrCv.style.minWidth = "220px";
    qrCv.style.minHeight = "220px";
    qrCv.style.position = "relative";
    qrCv.style.zIndex = "1";
    qrCv.style.background = "#ffffff";
    qrCv.style.mixBlendMode = "normal";
  }
  clonedRoot.style.fontFamily = '"Yekan Bakh", Tahoma, "Segoe UI", sans-serif';
  clonedRoot.style.direction = "rtl";
  clonedRoot.style.textAlign = "center";
  clonedRoot.style.color = "#1a1f24";
  clonedRoot.style.setProperty("-webkit-font-smoothing", "antialiased");
  const headline = clonedRoot.querySelector(".qr-tpl__headline");
  if (headline) {
    headline.style.fontFamily = '"Yekan Bakh", Tahoma, sans-serif';
    headline.style.fontWeight = "800";
    headline.style.color = solid;
  }
  const hintEl = clonedRoot.querySelector(".qr-tpl__hint");
  if (hintEl) {
    hintEl.style.fontFamily = '"Yekan Bakh", Tahoma, sans-serif';
    hintEl.style.fontWeight = "400";
    hintEl.style.color = "#5c6670";
  }
  const bizEl = clonedRoot.querySelector(".qr-tpl__biz");
  if (bizEl) {
    bizEl.style.fontFamily = '"Yekan Bakh", Tahoma, sans-serif';
    bizEl.style.fontWeight = "700";
    bizEl.style.color = ACCENT_MID_TEXT[t] || ACCENT_MID_TEXT[1];
  }
  const ribbonTitle = clonedRoot.querySelector(".qr-tpl__ribbon-title");
  const ribbonSub = clonedRoot.querySelector(".qr-tpl__ribbon-sub");
  if (ribbonTitle) {
    ribbonTitle.style.fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';
    ribbonTitle.style.color = "#ffffff";
  }
  if (ribbonSub) {
    ribbonSub.style.fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';
    ribbonSub.style.color = "rgba(255,255,255,0.95)";
  }
}

export default function DashboardQrSection({ onScanCount, businessSlug, syncedGoogleReviewUrl, syncedBusinessName, syncedQrTrackingUrl }) {
  const [bid, setBid] = useState("safra-demo");
  const [reviewUrl, setReviewUrl] = useState("");
  const [bizName, setBizName] = useState("");
  const [theme, setTheme] = useState("1");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [scanCount, setScanCount] = useState(null);
  const [hint, setHint] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [canExportPdf, setCanExportPdf] = useState(false);
  const [pdfWorking, setPdfWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [tplSettings, setTplSettings] = useState({ logoWidth: 150, qrSize: 220, previewScale: 0.55 });
  const [logoKey, setLogoKey] = useState(0);
  const canvasRef = useRef(null);
  const logoRef = useRef(null);
  const logoObjectUrl = useRef(null);
  const previewRef = useRef(null);
  const previewOuterRef = useRef(null);
  const skipBizNamePersistFirst = useRef(true);

  const refreshStats = useCallback(async () => {
    try {
      const data = await apiGet(`/api/qr/stats/${encodeURIComponent(sanitizeBid(bid))}`);
      const n = data.count;
      setScanCount(n);
      if (onScanCount) onScanCount(n);
      setHint("اسکن با باز کردن لینک ردیابی (QR) ثبت می‌شود.");
    } catch {
      setScanCount(null);
      if (onScanCount) onScanCount(null);
      setHint("شمارش در دسترس نیست.");
    }
  }, [bid, onScanCount]);

  useEffect(() => {
    apiGet("/api/qr-template-settings").then(s => setTplSettings(s)).catch(() => {});
  }, []);

  useEffect(() => {
    const container = previewRef.current;
    const outer = previewOuterRef.current;
    if (!container || !outer || !previewOpen) return;
    const html = buildFlyerHtml(theme, bizName, logoObjectUrl.current || "", tplSettings);
    container.innerHTML = html;
    const scale = tplSettings.previewScale || 0.55;
    const qrS = Number(tplSettings.qrSize) || 220;
    const colors = THEME_QR_COLORS[theme] || THEME_QR_COLORS[1];
    const cv = container.querySelector(".qr-tpl__qr-canvas");
    if (cv && trackingUrl) {
      QRCode.toCanvas(cv, trackingUrl, { width: qrS, margin: 2, color: colors }).catch(() => {});
    }
    requestAnimationFrame(() => {
      if (container && outer) {
        outer.style.height = `${Math.round(container.scrollHeight * scale)}px`;
      }
    });
  }, [previewOpen, trackingUrl, theme, bizName, tplSettings, logoKey]);

  useEffect(() => {
    try {
      const storedActive = localStorage.getItem(STORAGE_QR_ACTIVE) === "1";
      const storedReview = localStorage.getItem(STORAGE_REVIEW_URL) || "";
      const storedBid = localStorage.getItem(STORAGE_BID);
      const th = localStorage.getItem(STORAGE_PRINT_THEME);
      if (th && isValidStoredTheme(th)) setTheme(String(clampThemeNum(th)));

      if (storedActive && storedReview.trim()) {
        const sb = sanitizeBid(storedBid || businessSlug || "safra-demo");
        setBid(sb);
        setReviewUrl(storedReview);
        const bn = localStorage.getItem(STORAGE_QR_BIZ_NAME);
        if (bn) setBizName(bn);
        setTrackingUrl(buildGoUrl(storedReview.trim(), sb));
        setPreviewOpen(true);
        setCanExportPdf(true);
        return;
      }

      if (businessSlug) {
        setBid(sanitizeBid(businessSlug));
      } else {
        setBid(storedBid ? sanitizeBid(storedBid) : "safra-demo");
      }
      setReviewUrl(storedReview);
    } catch (_) {}
  }, [businessSlug]);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_QR_ACTIVE) === "1") return;
    } catch (_) {
      return;
    }
    if (syncedGoogleReviewUrl !== undefined && syncedGoogleReviewUrl !== null && String(syncedGoogleReviewUrl).trim()) {
      setReviewUrl(String(syncedGoogleReviewUrl));
    }
  }, [syncedGoogleReviewUrl]);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_QR_ACTIVE) === "1") return;
    } catch (_) {
      return;
    }
    if (syncedBusinessName) setBizName(syncedBusinessName);
  }, [syncedBusinessName]);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_QR_ACTIVE) === "1") return;
    } catch (_) {
      return;
    }
    const saved = String(syncedQrTrackingUrl || "").trim();
    if (saved) {
      setTrackingUrl(saved);
      setPreviewOpen(true);
      setCanExportPdf(true);
    }
  }, [syncedQrTrackingUrl]);

  useEffect(() => {
    refreshStats();

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshStats();
    };
    const onFocus = () => refreshStats();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    /* Poll every 30 s as hard fallback (catches mobile where visibilitychange is unreliable) */
    const poll = setInterval(refreshStats, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      clearInterval(poll);
    };
  }, [refreshStats]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PRINT_THEME, theme);
    } catch (_) {}
  }, [theme]);

  useEffect(() => {
    if (skipBizNamePersistFirst.current) {
      skipBizNamePersistFirst.current = false;
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_QR_ACTIVE) !== "1") return;
      localStorage.setItem(STORAGE_QR_BIZ_NAME, (bizName || "").trim());
    } catch (_) {}
  }, [bizName]);

  const onLogoChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (logoObjectUrl.current) {
      URL.revokeObjectURL(logoObjectUrl.current);
      logoObjectUrl.current = null;
    }
    if (!f || !f.type.startsWith("image/")) {
      if (logoRef.current) logoRef.current.removeAttribute("src");
      return;
    }
    logoObjectUrl.current = URL.createObjectURL(f);
    if (logoRef.current) logoRef.current.src = logoObjectUrl.current;
    setLogoKey(k => k + 1);
  };

  const saveTracking = async () => {
    if (!businessSlug) {
      setSaveMsg("شناسهٔ کسب‌وکار موجود نیست — ابتدا لاگین کنید.");
      return;
    }
    const urlToSave = trackingUrl.trim();
    if (!urlToSave) {
      setSaveMsg("ابتدا QR را بسازید.");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    try {
      await apiPatch(`/api/businesses/${encodeURIComponent(businessSlug)}`, {
        qr_tracking_url: urlToSave,
        ...(reviewUrl.trim() ? { google_review_url: reviewUrl.trim() } : {}),
      });
      setSaveMsg("ذخیره شد.");
    } catch (e) {
      setSaveMsg(e.message || "خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    const url = (reviewUrl || "").trim();
    if (!url) {
      alert("لینک صفحهٔ نظر Google را وارد کنید.");
      return;
    }
    const sb = sanitizeBid(bid);
    try {
      localStorage.setItem(STORAGE_BID, sb);
      localStorage.setItem(STORAGE_REVIEW_URL, url);
      localStorage.setItem(STORAGE_QR_ACTIVE, "1");
      localStorage.setItem(STORAGE_QR_BIZ_NAME, (bizName || "").trim());
    } catch (_) {}
    setBid(sb);
    const track = buildGoUrl(url, sb);
    setTrackingUrl(track);
    setPreviewOpen(true);
    setCanExportPdf(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const colors = THEME_QR_COLORS[theme] || THEME_QR_COLORS[1];
    await QRCode.toCanvas(canvas, track, {
      width: 220,
      margin: 2,
      color: colors,
    });
    refreshStats();
  };

  useEffect(() => {
    if (!previewOpen || !trackingUrl) return;
    const colors = THEME_QR_COLORS[theme] || THEME_QR_COLORS[1];
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      QRCode.toCanvas(canvas, trackingUrl, { width: 220, margin: 2, color: colors }).catch(() => {});
      return true;
    };
    if (draw()) return;
    const id = requestAnimationFrame(() => {
      draw();
    });
    return () => cancelAnimationFrame(id);
  }, [theme, trackingUrl, previewOpen]);

  const downloadPdf = async () => {
    if (!trackingUrl?.trim()) return;
    const colors = THEME_QR_COLORS[theme] || THEME_QR_COLORS[1];
    const logoSrc = logoObjectUrl.current || "";
    const html = buildFlyerHtml(theme, bizName, logoSrc, tplSettings);

    const outer = document.createElement("div");
    outer.setAttribute("dir", "rtl");
    outer.setAttribute("lang", "fa");
    /** همان الگوی css: z-index منفی باعث می‌شد html2canvas تصویر QR را خالی بگیرد */
    outer.className =
      "dashboard-qr-print-mount dashboard-qr-print-mount--pdf-capture dashboard-qr-pdf-root";
    outer.innerHTML = html;
    document.body.appendChild(outer);

    const el = outer.firstElementChild;
    if (!el) {
      document.body.removeChild(outer);
      return;
    }

    setPdfWorking(true);
    try {
      const pdfQrCanvas = el.querySelector(".qr-tpl__qr-canvas");
      if (pdfQrCanvas) {
        await QRCode.toCanvas(pdfQrCanvas, trackingUrl, {
          width: Number(tplSettings.qrSize) || 220,
          margin: 2,
          color: colors,
        });
      }

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready.catch(() => {});
      }
      try {
        if (document.fonts?.load) {
          await Promise.all([
            document.fonts.load('400 1rem "Yekan Bakh"'),
            document.fonts.load('700 1.08rem "Yekan Bakh"'),
            document.fonts.load('800 1.2rem "Yekan Bakh"'),
          ]);
        }
      } catch (_) {
        /* ignore */
      }
      await waitForImages(outer);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 120));

      const snap = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        foreignObjectRendering: false,
        imageTimeout: 15000,
        scrollX: 0,
        scrollY: 0,
        /**
         * html2canvas صدا می‌زند: onclone(documentClone, referenceElement)
         * referenceElement همان ریشهٔ کلون‌شدهٔ el است (مثلاً .qr-tpl)، نه document —
         * پس querySelector('.qr-tpl') روی آن null می‌شد و استایل‌های تخت اعمال نمی‌شد.
         * کپی صریح canvas→clone برای اطمینان از دیده شدن QR در iframe.
         */
        onclone: (_documentClone, referenceElement) => {
          const root =
            referenceElement?.classList?.contains?.("qr-tpl")
              ? referenceElement
              : referenceElement?.querySelector?.(".qr-tpl");
          if (root) patchFlyerCloneForCanvas(null, root, theme);

          const liveCanvas = el.querySelector(".qr-tpl__qr-canvas");
          const clonedCanvas = referenceElement?.querySelector?.(".qr-tpl__qr-canvas");
          if (liveCanvas && clonedCanvas && liveCanvas.width && liveCanvas.height) {
            try {
              clonedCanvas.width = liveCanvas.width;
              clonedCanvas.height = liveCanvas.height;
              const ctx = clonedCanvas.getContext("2d");
              if (ctx) ctx.drawImage(liveCanvas, 0, 0);
            } catch (_) {
              /* ignore */
            }
          }
        },
      });

      const imgData = snap.toDataURL("image/png");
      /* A6 = 105 × 148 mm — full bleed, no margin, no radius */
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
      const pageW = pdf.internal.pageSize.getWidth();  /* 105 */
      const pageH = pdf.internal.pageSize.getHeight(); /* 148 */
      pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);
      const safeBid = sanitizeBid(bid).replace(/[^a-z0-9_-]/g, "-") || "qr";
      pdf.save(`iraniu-qr-${safeBid}.pdf`);
    } catch (e) {
      console.error(e);
      alert("دانلود PDF انجام نشد. مرورگر را به‌روز کنید یا دوباره تلاش کنید.");
    } finally {
      if (outer.parentNode) outer.parentNode.removeChild(outer);
      setPdfWorking(false);
    }
  };

  return (
    <section className="dashboard-panel dashboard-panel--qr-review" id="qr-review" aria-labelledby="qr-review-heading">
      <DashboardPanelHead headingId="qr-review-heading" title="QR نظر Google" icon={dashboardIcons.qr} />
      <p className="field-hint">
        لینک نظر Google را وارد کنید. QR به آدرس <code>/go</code> روی همین سرور می‌رود؛ اسکن در SQLite ثبت
        می‌شود سپس کاربر به Google هدایت می‌شود.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="qr-review-bid">شناسهٔ یکتا برای آمار</label>
          <input
            id="qr-review-bid"
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="field field--block">
          <label htmlFor="qr-review-google-url">لینک صفحهٔ نظر Google</label>
          <input
            id="qr-review-google-url"
            type="url"
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            placeholder="https://g.page/.../review"
          />
        </div>
        <div className="field field--block">
          <label htmlFor="qr-review-business-name">نام روی چاپ</label>
          <input id="qr-review-business-name" value={bizName} onChange={(e) => setBizName(e.target.value)} />
        </div>
        <div className="field field--block">
          <label htmlFor="qr-print-theme">قالب چاپ (رنگ)</label>
          <select id="qr-print-theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
            {QR_THEME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field field--block">
          <label htmlFor="qr-review-logo">لوگو روی چاپ</label>
          <input id="qr-review-logo" type="file" accept="image/*" onChange={onLogoChange} />
          <div className="dashboard-qr-logo-preview-wrap">
            <img ref={logoRef} className="dashboard-qr-logo-preview" alt="" width="120" height="120" />
          </div>
        </div>
      </div>
      <div className="dashboard-actions dashboard-actions--inline">
        <button type="button" className="btn btn--primary" onClick={generate}>
          ساخت QR و لینک ردیابی
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canExportPdf || pdfWorking}
          onClick={downloadPdf}
        >
          {pdfWorking ? "در حال ساخت PDF…" : "دانلود PDF با قالب"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={refreshStats}>
          بروزرسانی آمار اسکن
        </button>
      </div>

      {previewOpen && (
        <div className="dashboard-qr-preview">
          <div className="dashboard-qr-analytics">
            <p className="dashboard-qr-analytics__line">
              <strong>تعداد اسکن QR:</strong>{" "}
              <span className="dashboard-qr-analytics__value">{scanCount === null ? "—" : scanCount}</span>
            </p>
            <p className="field-hint">{hint}</p>
          </div>
          <label className="dashboard-qr-tracking-label" htmlFor="qr-tracking-url">
            لینک ردیابی (درون کد QR)
            <span className="field-hint" style={{ display: "block", fontWeight: 400, fontSize: "0.78rem", marginTop: "0.15rem" }}>
              اگر لینک Google را مستقیم جایگذاری کنید، به‌طور خودکار از مسیر <code>/go</code> (ردیابی) عبور داده می‌شود.
            </span>
          </label>
          <input
            className="dashboard-qr-tracking-url"
            id="qr-tracking-url"
            value={trackingUrl}
            dir="ltr"
            onChange={(e) => {
              const trimmed = e.target.value.trim();
              /* Always route through /go so scans are counted — use businessSlug (not bid state) to avoid stale closure */
              const effectiveBid = sanitizeBid(businessSlug || bid);
              let val = trimmed;
              if (trimmed && !trimmed.includes("/go?")) {
                try {
                  const u = new URL(trimmed);
                  if (u.protocol === "https:" || u.protocol === "http:") {
                    val = buildGoUrl(trimmed, effectiveBid);
                  }
                } catch (_) {}
              }
              setTrackingUrl(val);
              setPreviewOpen(true);
              setCanExportPdf(!!val);
              try { localStorage.setItem(STORAGE_QR_ACTIVE, val ? "1" : "0"); } catch (_) {}
            }}
          />
          {trackingUrl && !trackingUrl.includes("/go?") && (
            <p className="field-hint" style={{ marginTop: "0.3rem", color: "#b45309", fontWeight: 600 }}>
              ⚠️ این لینک از مسیر ردیابی عبور نمی‌کند — اسکن‌ها شمارش نخواهند شد.
            </p>
          )}
          <div className="dashboard-actions dashboard-actions--inline" style={{ marginTop: "0.6rem" }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={saving || !trackingUrl.trim()}
              onClick={saveTracking}
            >
              {saving ? "در حال ذخیره…" : "ذخیره لینک ردیابی"}
            </button>
          </div>
          {saveMsg && (
            <p className="field-hint" style={{ marginTop: "0.4rem", color: saveMsg === "ذخیره شد." ? "#15803d" : "#b71c1c" }}>
              {saveMsg}
            </p>
          )}
          <div className="dashboard-qr-canvas-wrap">
            <canvas ref={canvasRef} aria-label="کد QR" />
          </div>

          <div className="dashboard-qr-tpl-preview-outer">
            <p className="dashboard-qr-tpl-preview-label">پیش‌نمایش قالب چاپ</p>
            <div
              ref={previewOuterRef}
              className="dashboard-qr-tpl-preview-scroll"
            >
              <div
                ref={previewRef}
                className="dashboard-qr-tpl-preview-inner"
                style={{ transform: `scale(${tplSettings.previewScale || 0.55})`, transformOrigin: "top center" }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      )}

      <div id="qr-print-mount" className="dashboard-qr-print-mount" aria-hidden="true" />
    </section>
  );
}
