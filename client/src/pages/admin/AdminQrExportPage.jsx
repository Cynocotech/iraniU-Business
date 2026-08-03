import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { apiGet, apiPatch } from "../../api.js";
import html2canvas from "html2canvas";
import { clampThemeNum } from "../../data/qrPrintThemes.js";

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

function buildFlyerHtml(themeNum, name) {
  const t = clampThemeNum(themeNum);
  const safeName = (name || "نام کسب‌وکار").replace(/</g, "&lt;");
  return (
    `<div class="qr-tpl qr-tpl__sheet" data-qr-theme="${t}">` +
    `<div class="qr-tpl__frame">` +
    `<div class="qr-tpl__ribbon" dir="ltr" lang="en">` +
    `<span class="qr-tpl__deco qr-tpl__deco--tl" aria-hidden="true"></span>` +
    `<img src="/google-reviews-logo.png" alt="Google Reviews" style="display:block;margin:0 auto 4px;max-width:160px;height:auto;filter:brightness(0) invert(1);" crossOrigin="anonymous" />` +
    `<p class="qr-tpl__ribbon-sub">Scan the QR code to leave a review</p>` +
    `<span class="qr-tpl__deco qr-tpl__deco--br" aria-hidden="true"></span>` +
    `</div>` +
    `<div class="qr-tpl__body">` +
    `<div class="qr-tpl__logo qr-tpl__logo--empty"></div>` +
    `<div class="qr-tpl__qr"><canvas class="qr-tpl__qr-canvas" width="220" height="220" aria-hidden="true"></canvas></div>` +
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

function patchFlyerCloneForCanvas(clonedRoot) {
  if (!clonedRoot) return;
  clonedRoot.style.fontFamily = '"Yekan Bakh", Tahoma, "Segoe UI", sans-serif';
  clonedRoot.style.direction = "rtl";
  clonedRoot.style.textAlign = "center";
  clonedRoot.style.color = "#1a1f24";
  clonedRoot.style.setProperty("-webkit-font-smoothing", "antialiased");
}

function hasValidGoogleReviewUrl(b) {
  const u = String(b?.google_review_url || "").trim();
  return u.startsWith("http");
}

export default function AdminQrExportPage() {
  const [busy, setBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(null);
  const [msg, setMsg] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [listErr, setListErr] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [tplSettings, setTplSettings] = useState({ logoWidth: 150, qrSize: 220, previewScale: 0.55 });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  useEffect(() => {
    apiGet("/api/qr-template-settings").then(s => setTplSettings(s)).catch(() => {});
  }, []);

  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg("");
    try {
      const updated = await apiPatch("/api/admin/qr-template-settings", tplSettings);
      setTplSettings(updated);
      setSettingsMsg("ذخیره شد.");
    } catch (e) {
      setSettingsMsg(e.message || "خطا");
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setListErr(null);
    apiGet("/api/businesses")
      .then((data) => {
        if (!cancelled) setBusinesses(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setListErr("بارگذاری فهرست آگهی‌ها ناموفق بود.");
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBusinesses = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    let list = businesses;
    if (q) {
      list = businesses.filter((b) => {
        const blob = [b.name_fa, b.slug, b.city, b.category, b.listing_title, b.id != null ? `iu-${String(b.id).padStart(8, "0")}` : ""]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }
    return [...list].sort((a, b) => String(a.name_fa || "").localeCompare(String(b.name_fa || ""), "fa"));
  }, [businesses, filterText]);

  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);

  const toggleSlug = (slug) => {
    const s = String(slug || "").trim();
    if (!s) return;
    setSelectedSlugs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedSlugs);
    for (const b of filteredBusinesses) {
      if (b.slug) next.add(b.slug);
    }
    setSelectedSlugs([...next]);
  };

  const selectFilteredWithReviewOnly = () => {
    const next = new Set(selectedSlugs);
    for (const b of filteredBusinesses) {
      if (b.slug && hasValidGoogleReviewUrl(b)) next.add(b.slug);
    }
    setSelectedSlugs([...next]);
  };

  const clearSelection = () => setSelectedSlugs([]);

  const generate = async () => {
    setBusy(true);
    setMsg("");
    setPdfProgress(null);
    try {
      if (!selectedSlugs.length) {
        setMsg("حداقل یک آگهی را از فهرست زیر انتخاب کنید (تیک بزنید).");
        return;
      }
      const bySlug = new Map(businesses.map((b) => [b.slug, b]));
      const list = selectedSlugs.map((slug) => bySlug.get(slug)).filter(Boolean);
      if (!list.length) {
        setMsg("آگهی انتخاب‌شده معتبر نیست؛ فهرست را دوباره بارگذاری کنید.");
        return;
      }
      const totalSteps = list.length;
      setPdfProgress({ current: 0, total: totalSteps });

      /* A6 = 105 × 148 mm — one QR per page, no margin, edge-to-edge */
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
      const pageW = pdf.internal.pageSize.getWidth();  /* 105 */
      const pageH = pdf.internal.pageSize.getHeight(); /* 148 */
      let printedCount = 0;

      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        try {
          const reviewUrl = String(b.google_review_url || "").trim();
          const target =
            reviewUrl && reviewUrl.startsWith("http") ? buildGoUrl(reviewUrl, b.slug || b.name_fa || "business") : null;
          if (!target) continue;
          if (printedCount > 0) {
            pdf.addPage();
          }

          const outer = document.createElement("div");
          outer.setAttribute("dir", "rtl");
          outer.setAttribute("lang", "fa");
          outer.className = "dashboard-qr-print-mount dashboard-qr-print-mount--pdf-capture dashboard-qr-pdf-root";
          outer.innerHTML = buildFlyerHtml("1", b.name_fa || b.slug || "");
          document.body.appendChild(outer);

          const el = outer.firstElementChild;
          if (!el) {
            if (outer.parentNode) outer.parentNode.removeChild(outer);
            continue;
          }

          const pdfQrCanvas = el.querySelector(".qr-tpl__qr-canvas");
          if (pdfQrCanvas) {
            await QRCode.toCanvas(pdfQrCanvas, target, {
              width: 220,
              margin: 2,
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
            onclone: (_documentClone, referenceElement) => {
              const root =
                referenceElement?.classList?.contains?.("qr-tpl")
                  ? referenceElement
                  : referenceElement?.querySelector?.(".qr-tpl");
              if (root) patchFlyerCloneForCanvas(root);

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
          /* Full bleed — image fills the A6 page edge-to-edge */
          pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);
          printedCount += 1;

          if (outer.parentNode) outer.parentNode.removeChild(outer);
        } finally {
          setPdfProgress({ current: i + 1, total: totalSteps });
        }
      }

      if (!printedCount) {
        const skipped = list.filter((b) => !hasValidGoogleReviewUrl(b)).length;
        setMsg(
          skipped > 0
            ? `هیچ آگهی انتخاب‌شده‌ای لینک معتبر نظر Google ندارد (${skipped} مورد بدون لینک یا نامعتبر).`
            : "هیچ آگهی‌ای لینک نظر Google ثبت نکرده است، بنابراین QRی برای خروجی وجود ندارد."
        );
        return;
      }
      const skippedNoUrl = list.length - printedCount;
      pdf.save("iraniu-qr-export.pdf");
      setMsg(
        `فایل PDF ساخته شد (${printedCount} صفحهٔ A6، هر صفحه یک QR).` +
          (skippedNoUrl > 0 ? ` ${skippedNoUrl} آگهی بدون لینک Google رد شد.` : "")
      );
    } catch (e) {
      console.error(e);
      setMsg(e.message || "خطا در ساخت PDF");
    } finally {
      setBusy(false);
      setPdfProgress(null);
    }
  };

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
      </p>

      <section className="dashboard-panel" style={{ marginBottom: "var(--space-lg)" }}>
        <h2 style={{ marginBottom: "var(--space-md)" }}>تنظیمات اندازهٔ قالب QR</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="tpl-logo-width">عرض لوگو (px)</label>
            <input
              id="tpl-logo-width"
              type="number"
              min="40"
              max="600"
              value={tplSettings.logoWidth}
              onChange={e => setTplSettings(s => ({ ...s, logoWidth: Number(e.target.value) }))}
            />
            <span className="field-hint">{tplSettings.logoWidth}px — اندازهٔ لوگوی ایرانیو در بالای قالب</span>
          </div>
          <div className="field">
            <label htmlFor="tpl-qr-size">اندازهٔ QR (px)</label>
            <input
              id="tpl-qr-size"
              type="number"
              min="80"
              max="500"
              value={tplSettings.qrSize}
              onChange={e => setTplSettings(s => ({ ...s, qrSize: Number(e.target.value) }))}
            />
            <span className="field-hint">{tplSettings.qrSize}px — عرض و ارتفاع کد QR</span>
          </div>
          <div className="field">
            <label htmlFor="tpl-preview-scale">مقیاس پیش‌نمایش داشبورد</label>
            <input
              id="tpl-preview-scale"
              type="range"
              min="0.2"
              max="1.2"
              step="0.05"
              value={tplSettings.previewScale}
              onChange={e => setTplSettings(s => ({ ...s, previewScale: Number(e.target.value) }))}
              style={{ width: "100%" }}
            />
            <span className="field-hint">{Math.round((tplSettings.previewScale || 0.55) * 100)}% — بزرگنمایی پیش‌نمایش در پنل کسب‌وکار</span>
          </div>
        </div>
        <div className="dashboard-actions dashboard-actions--inline" style={{ marginTop: "var(--space-md)" }}>
          <button type="button" className="btn btn--primary" onClick={saveSettings} disabled={settingsSaving}>
            {settingsSaving ? "در حال ذخیره…" : "ذخیره تنظیمات"}
          </button>
          {settingsMsg && (
            <span className="field-hint" style={{ color: settingsMsg === "ذخیره شد." ? "#15803d" : "#b71c1c" }}>
              {settingsMsg}
            </span>
          )}
        </div>
      </section>

      <section className="dashboard-panel">
        <h2>خروجی PDF QR آگهی‌ها</h2>
        <p className="field-hint">
          ابتدا آگهی‌های مورد نظر را انتخاب کنید (جستجو نام، شهر، نامک یا IU-…). این ابزار یک فایل PDF می‌سازد که هر آگهی روی یک صفحهٔ A6 (۱۰۵×۱۴۸ میلیمتر) قرار می‌گیرد. برای چاپ QR باید در فیلد{" "}
          <strong>لینک صفحهٔ نظر Google</strong> مقدار معتبر ثبت شده باشد؛ آگهی بدون لینک در PDF نمی‌آید.
        </p>

        {loadingList && <p className="field-hint">در حال بارگذاری فهرست آگهی‌ها…</p>}
        {listErr && <p className="field-hint" style={{ color: "#b71c1c" }}>{listErr}</p>}

        {!loadingList && !listErr && (
          <>
            <div className="field field--block" style={{ maxWidth: "min(100%, 32rem)", marginBottom: "var(--space-md)" }}>
              <label htmlFor="qr-export-search">جستجو در نام، شهر، نامک، دسته، IU-…</label>
              <input
                id="qr-export-search"
                type="search"
                className="app-shell__search"
                style={{ width: "100%" }}
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="مثلاً رستوران، لندن، slug-…"
                autoComplete="off"
                dir="rtl"
              />
            </div>

            <div className="dashboard-actions" style={{ flexWrap: "wrap", gap: "0.5rem", marginBottom: "var(--space-sm)" }}>
              <button type="button" className="btn btn--ghost" disabled={busy || filteredBusinesses.length === 0} onClick={selectAllFiltered}>
                انتخاب همهٔ نتایج فعلی
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy || filteredBusinesses.length === 0} onClick={selectFilteredWithReviewOnly}>
                افزودن نتایج فعلی (فقط دارای لینک Google)
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy || selectedSlugs.length === 0} onClick={clearSelection}>
                لغو همهٔ انتخاب‌ها
              </button>
            </div>

            <p className="field-hint" style={{ marginBottom: "0.5rem" }}>
              نمایش {filteredBusinesses.length} از {businesses.length} آگهی —{" "}
              <strong>{selectedSlugs.length}</strong> انتخاب‌شده
            </p>

            <div
              className="qr-export-picker"
              style={{
                maxHeight: "min(50vh, 22rem)",
                overflowY: "auto",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: "var(--radius-md, 8px)",
                padding: "0.5rem 0.75rem",
                marginBottom: "var(--space-md)",
                background: "rgba(255,255,255,0.6)",
              }}
            >
              {filteredBusinesses.length === 0 ? (
                <p className="field-hint" style={{ margin: 0 }}>
                  موردی با این جستجو پیدا نشد.
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filteredBusinesses.map((b) => {
                    const slug = b.slug;
                    const checked = selectedSet.has(slug);
                    const okReview = hasValidGoogleReviewUrl(b);
                    return (
                      <li
                        key={slug}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                          padding: "0.35rem 0",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        <input
                          type="checkbox"
                          id={`qr-pick-${slug}`}
                          checked={checked}
                          onChange={() => toggleSlug(slug)}
                          disabled={busy}
                          style={{ marginTop: "0.2rem" }}
                        />
                        <label htmlFor={`qr-pick-${slug}`} style={{ cursor: busy ? "default" : "pointer", flex: 1, margin: 0 }}>
                          <span className="field-hint" style={{ display: "block", fontSize: "0.95rem", color: "var(--color-text, #1a1f24)" }}>
                            {b.name_fa || slug}
                          </span>
                          <span className="field-hint" style={{ display: "block", fontSize: "0.8rem", opacity: 0.85 }} dir="ltr">
                            {slug}
                            {b.city ? ` · ${b.city}` : ""}
                            {!okReview ? " · بدون لینک Google" : ""}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="dashboard-actions">
          <button type="button" className="btn btn--primary" disabled={busy || loadingList || !!listErr} onClick={generate}>
            {busy ? "در حال ساخت PDF…" : "دانلود PDF برای آگهی‌های انتخاب‌شده"}
          </button>
        </div>

        {busy && pdfProgress && pdfProgress.total > 0 && (
          <div
            className="qr-export-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={pdfProgress.total}
            aria-valuenow={pdfProgress.current}
            aria-label="پیشرفت ساخت PDF"
            style={{ marginTop: "var(--space-md)", maxWidth: "min(100%, 28rem)" }}
          >
            <p className="field-hint" style={{ marginBottom: "0.4rem" }}>
              در حال آماده‌سازی QR…{" "}
              <strong dir="ltr">
                {pdfProgress.current} / {pdfProgress.total}
              </strong>
            </p>
            <div
              style={{
                height: "10px",
                borderRadius: "999px",
                background: "rgba(0,0,0,0.08)",
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.round((pdfProgress.current / pdfProgress.total) * 100))}%`,
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, var(--color-accent, #7b4d8e), var(--color-accent-strong, #5a3868))",
                  transition: "width 0.15s ease-out",
                }}
              />
            </div>
          </div>
        )}

        {!!msg && <p className="field-hint" style={{ marginTop: "0.75rem" }}>{msg}</p>}
      </section>
    </>
  );
}

