import "./env.js";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db, dbPath, ensureRestaurantSafraDemo } from "./db.js";
import { base64UrlToString, resolveReviewRedirectUrl, sanitizeBid } from "./lib/redirect.js";
import { parseAuthHeader, stripManagerRow, hashPassword, validatePasswordComplexity } from "./authUtil.js";
import { requireSuperAdmin, requireManager } from "./authMiddleware.js";
import { registerAuthRoutes, ensureSuperAdminFromEnv } from "./authRoutes.js";
import { sendBusinessDirectoryPost } from "./telegramBusinessChannel.js";
import { actorFromAuth, writeSystemLog } from "./systemLog.js";
import { isTwilioModuleEnabled } from "./twilioModuleSettings.js";
import { sendListingApprovedEmail, sendListingRejectedEmail } from "./listingDecisionEmail.js";
import { notifyAdminsNewPendingListing } from "./pendingListingNotify.js";
import multer from "multer";
import { parseBusinessCsv, runBulkInsert } from "./businessBulkImport.js";
import { exportIraniuBusinessesCsv } from "./exportBusinessesCsv.js";
import { cascadeDeleteBusinessBySlug } from "./cascadeDeleteBusiness.js";
import { analyzeDuplicateNames, executeDedupeByName } from "./dedupeBusinessesByName.js";
import { validateIraniuSqliteFile } from "./sqliteDbPending.js";

const PATCHABLE_BUSINESS = new Set([
  "name_fa",
  "description",
  "category",
  "phone",
  "address",
  "google_review_url",
  "subtitle",
  "hours_json",
  "promo_title",
  "promo_description",
  "cover_image_url",
  "gallery_json",
  "listing_title",
  "city",
  "price_range",
  "rating",
  "cta",
  "status",
  "claimed",
  "package",
  "manager_id",
  "exchange_manager_id",
  "biolink_json",
  "careers_title",
  "careers_text",
  "reservation_link",
  "call_tracking_enabled",
  "call_tracking_number",
  "call_forward_number",
  "listing_contact_email",
  "exchange_rates_json",
  "payment_methods_json",
  "exchange_company_verified",
  "exchange_features_json",
  "exchange_today_rate_enabled",
]);

/** گزارش‌های آگهی — کلیدها باید با کلاینت هم‌خوان باشند */
const BUSINESS_REPORT_REASONS = [
  { key: "wrong_info", label: "اطلاعات نادرست یا قدیمی" },
  { key: "spam", label: "هرزنامه یا تبلیغ نامناسب" },
  { key: "duplicate", label: "آگهی تکراری" },
  { key: "impersonation", label: "جعل هویت یا سوءاستفاده" },
  { key: "other", label: "سایر (توضیح دهید)" },
];
const BUSINESS_REPORT_REASON_KEYS = new Set(BUSINESS_REPORT_REASONS.map((r) => r.key));

/** نسخهٔ شرایط ثبت آگهی — باید با مقدار ارسالی از کلاینت و listingTerms.js یکی باشد */
const LISTING_TERMS_VERSION = "1";

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const uploadSqlite = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.db$/i.test(String(file.originalname || ""));
    if (!ok) {
      cb(new Error("فقط فایل با پسوند .db مجاز است"));
      return;
    }
    cb(null, true);
  },
});

const uploadExchangeBanner = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || "")) {
      cb(new Error("bad_file_type"));
      return;
    }
    cb(null, true);
  },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
const looseReviewRedirect =
  process.env.ALLOW_ANY_REVIEW_REDIRECT === "1" || process.env.ALLOW_ANY_REVIEW_REDIRECT === "true" || !isProd;
const PORT = Number(process.env.PORT) || 3001;

const app = express();
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const exchangeBannerDir = path.join(uploadsDir, "exchange-banners");
if (!fs.existsSync(exchangeBannerDir)) fs.mkdirSync(exchangeBannerDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

ensureSuperAdminFromEnv();
registerAuthRoutes(app);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/** عمومی — برای مخفی کردن منوی Twilio در پنل مدیر */
app.get("/api/twilio-module-status", (_req, res) => {
  res.json({ enabled: isTwilioModuleEnabled() });
});

function isListingApproved(row) {
  const a = row && row.listing_approval;
  return a === "approved" || a == null || a === "";
}

/** آگهی روی سایت عمومی — فقط فعال (یا بدون وضعیت = فعال) */
function isBusinessActiveForPublic(row) {
  if (!row) return false;
  const s = row.status;
  return s == null || s === "" || s === "active";
}

function isBusinessVisibleToPublic(row) {
  return isListingApproved(row) && isBusinessActiveForPublic(row);
}

function normalizeExchangeBannerPlacement(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "top") return "top";
  if (s === "fullscreen") return "fullscreen";
  return "between";
}

function normalizeExchangeBannerScope(v) {
  return String(v || "").trim() === "directory" ? "directory" : "exchange";
}

function parseExchangeBannerLink(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.startsWith("/")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "";
}

function normalizeBannerDateTime(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  // accepts: YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm[:ss]
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return "";
  const sec = m[4] || "00";
  return `${m[1]} ${m[2]}:${m[3]}:${sec}`;
}

function normalizeBannerDailyUserCap(v) {
  const n = Number.parseInt(String(v ?? "2"), 10);
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(50, n));
}

app.get("/api/businesses", (req, res) => {
  const auth = parseAuthHeader(req);
  const isAdmin = auth && auth.typ === "adm";
  const rows = isAdmin
    ? db.prepare(`SELECT * FROM businesses ORDER BY name_fa`).all()
    : db
        .prepare(
          `SELECT * FROM businesses WHERE (
             listing_approval = 'approved'
             OR listing_approval IS NULL
             OR listing_approval = ''
             OR (
               listing_approval = 'pending'
               AND (
                 exchange_manager_id IS NOT NULL
                 OR IFNULL(category, '') LIKE '%صراف%'
                 OR lower(IFNULL(category, '')) LIKE '%exchange%'
               )
             )
           )
           AND (status IS NULL OR status = '' OR status = 'active')
           ORDER BY name_fa`
        )
        .all();
  res.json(rows);
});

/** بنرهای تبلیغی صرافی — عمومی */
app.get("/api/exchange-banners", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, image_url, link_url, placement, sort_order, daily_user_cap
       FROM exchange_banners
       WHERE is_active = 1 AND page_scope = 'exchange'
         AND (start_at IS NULL OR trim(start_at) = '' OR start_at <= datetime('now'))
         AND (end_at IS NULL OR trim(end_at) = '' OR end_at >= datetime('now'))
       ORDER BY placement = 'top' DESC, sort_order ASC, id DESC`
    )
    .all();
  res.json(rows);
});

/** بنرهای تبلیغی دایرکتوری — عمومی */
app.get("/api/directory-banners", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, image_url, link_url, placement, sort_order, daily_user_cap
       FROM exchange_banners
       WHERE is_active = 1 AND page_scope = 'directory'
         AND (start_at IS NULL OR trim(start_at) = '' OR start_at <= datetime('now'))
         AND (end_at IS NULL OR trim(end_at) = '' OR end_at >= datetime('now'))
       ORDER BY placement = 'top' DESC, sort_order ASC, id DESC`
    )
    .all();
  res.json(rows);
});

/** ثبت کلیک بنر تبلیغاتی (عمومی) */
app.post("/api/banner-clicks", (req, res) => {
  try {
    const bannerId = Number.parseInt(String(req.body?.banner_id || "0"), 10);
    if (!Number.isFinite(bannerId) || bannerId <= 0) {
      return res.status(400).json({ error: "bad_banner_id" });
    }
    const row = db.prepare(`SELECT id, page_scope FROM exchange_banners WHERE id = ?`).get(bannerId);
    if (!row) return res.status(404).json({ error: "not_found" });
    const scope = row.page_scope === "directory" ? "directory" : "exchange";
    db.prepare(`INSERT INTO exchange_banner_clicks (banner_id, page_scope) VALUES (?, ?)`).run(bannerId, scope);
    return res.json({ ok: true });
  } catch (e) {
    console.error("banner-clicks create", e);
    return res.status(500).json({ error: "click_log_failed", hint: String(e.message || e) });
  }
});

/** بنرهای تبلیغی صرافی — ادمین */
app.get("/api/admin/exchange-banners", requireSuperAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
              COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
       FROM exchange_banners
       ORDER BY sort_order ASC, id DESC`
    )
    .all();
  res.json(rows);
});

app.post("/api/admin/exchange-banners", requireSuperAdmin, (req, res) => {
  uploadExchangeBanner.single("image")(req, res, (err) => {
    if (err) {
      if (String(err.message || "").includes("bad_file_type")) {
        return res.status(400).json({ error: "bad_file_type", hint: "فقط تصویر png/jpg/webp/gif مجاز است." });
      }
      if (String(err.message || "").toLowerCase().includes("file too large")) {
        return res.status(400).json({ error: "file_too_large", hint: "حداکثر حجم تصویر ۸ مگابایت است." });
      }
      return res.status(400).json({ error: "upload_failed", hint: String(err.message || err) });
    }
    try {
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: "missing_file", hint: "فایل تصویر لازم است." });
      }
      const ext = path.extname(String(req.file.originalname || "")).toLowerCase() || ".jpg";
      const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
      const filename = `exchange-banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
      const absPath = path.join(exchangeBannerDir, filename);
      fs.writeFileSync(absPath, req.file.buffer);
      const imageUrl = `/uploads/exchange-banners/${filename}`;
      const title = String(req.body?.title || "").trim();
      const linkUrl = parseExchangeBannerLink(req.body?.link_url);
      const pageScope = normalizeExchangeBannerScope(req.body?.page_scope);
      const placement = normalizeExchangeBannerPlacement(req.body?.placement);
      const dailyUserCap = normalizeBannerDailyUserCap(req.body?.daily_user_cap);
      const startAt = normalizeBannerDateTime(req.body?.start_at);
      const endAt = normalizeBannerDateTime(req.body?.end_at);
      if (startAt && endAt && endAt < startAt) {
        return res.status(400).json({ error: "bad_schedule", hint: "تاریخ پایان باید بعد از تاریخ شروع باشد." });
      }
      const sortOrderNum = Number.parseInt(String(req.body?.sort_order || "0"), 10);
      const sortOrder = Number.isFinite(sortOrderNum) ? sortOrderNum : 0;
      const isActive = String(req.body?.is_active || "1") === "0" ? 0 : 1;
      const info = db
        .prepare(
          `INSERT INTO exchange_banners (title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(title, imageUrl, linkUrl, pageScope, placement, dailyUserCap, startAt, endAt, sortOrder, isActive);
      const row = db
        .prepare(
          `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
                  COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
           FROM exchange_banners WHERE id = ?`
        )
        .get(info.lastInsertRowid);
      writeSystemLog({
        ...actorFromAuth(req.auth),
        action: "exchange_banner_created",
        targetType: "exchange_banner",
        targetId: String(info.lastInsertRowid),
        message: "Exchange banner uploaded",
      });
      return res.json(row);
    } catch (e) {
      console.error("admin exchange-banners create", e);
      return res.status(500).json({ error: "create_failed", hint: String(e.message || e) });
    }
  });
});

app.post("/api/admin/exchange-banners/:id/image", requireSuperAdmin, (req, res) => {
  uploadExchangeBanner.single("image")(req, res, (err) => {
    if (err) {
      if (String(err.message || "").includes("bad_file_type")) {
        return res.status(400).json({ error: "bad_file_type", hint: "فقط تصویر png/jpg/webp/gif مجاز است." });
      }
      if (String(err.message || "").toLowerCase().includes("file too large")) {
        return res.status(400).json({ error: "file_too_large", hint: "حداکثر حجم تصویر ۸ مگابایت است." });
      }
      return res.status(400).json({ error: "upload_failed", hint: String(err.message || err) });
    }
    try {
      const id = Number.parseInt(String(req.params.id || "0"), 10);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "bad_id" });
      const prev = db.prepare(`SELECT id, image_url FROM exchange_banners WHERE id = ?`).get(id);
      if (!prev) return res.status(404).json({ error: "not_found" });
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: "missing_file", hint: "فایل تصویر لازم است." });
      }
      const ext = path.extname(String(req.file.originalname || "")).toLowerCase() || ".jpg";
      const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
      const filename = `exchange-banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
      const absPath = path.join(exchangeBannerDir, filename);
      fs.writeFileSync(absPath, req.file.buffer);
      const imageUrl = `/uploads/exchange-banners/${filename}`;
      db.prepare(`UPDATE exchange_banners SET image_url = ? WHERE id = ?`).run(imageUrl, id);

      const prevRel = String(prev.image_url || "");
      if (prevRel.startsWith("/uploads/exchange-banners/")) {
        const prevAbs = path.join(uploadsDir, prevRel.replace(/^\/uploads\//, ""));
        try {
          if (fs.existsSync(prevAbs)) fs.unlinkSync(prevAbs);
        } catch {}
      }

      const row = db
        .prepare(
          `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
                  COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
           FROM exchange_banners WHERE id = ?`
        )
        .get(id);
      writeSystemLog({
        ...actorFromAuth(req.auth),
        action: "exchange_banner_image_updated",
        targetType: "exchange_banner",
        targetId: String(id),
        message: "Exchange banner image updated",
      });
      return res.json(row);
    } catch (e) {
      console.error("admin exchange-banners image", e);
      return res.status(500).json({ error: "image_update_failed", hint: String(e.message || e) });
    }
  });
});

app.patch("/api/admin/exchange-banners/:id", requireSuperAdmin, (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.id || "0"), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "bad_id" });
    }
    const prev = db.prepare(`SELECT * FROM exchange_banners WHERE id = ?`).get(id);
    if (!prev) return res.status(404).json({ error: "not_found" });
    const nextTitle = req.body?.title == null ? prev.title : String(req.body.title || "").trim();
    const nextLink = req.body?.link_url == null ? prev.link_url || "" : parseExchangeBannerLink(req.body.link_url);
    const nextScope = req.body?.page_scope == null ? prev.page_scope : normalizeExchangeBannerScope(req.body.page_scope);
    const nextPlacement = req.body?.placement == null ? prev.placement : normalizeExchangeBannerPlacement(req.body.placement);
    const nextDailyCap =
      req.body?.daily_user_cap == null ? Number(prev.daily_user_cap || 2) : normalizeBannerDailyUserCap(req.body.daily_user_cap);
    const nextStart = req.body?.start_at == null ? prev.start_at || "" : normalizeBannerDateTime(req.body.start_at);
    const nextEnd = req.body?.end_at == null ? prev.end_at || "" : normalizeBannerDateTime(req.body.end_at);
    if (nextStart && nextEnd && nextEnd < nextStart) {
      return res.status(400).json({ error: "bad_schedule", hint: "تاریخ پایان باید بعد از تاریخ شروع باشد." });
    }
    const rawSort = req.body?.sort_order;
    const nextSort =
      rawSort == null ? prev.sort_order : Number.isFinite(Number.parseInt(String(rawSort), 10)) ? Number.parseInt(String(rawSort), 10) : prev.sort_order;
    const nextActive = req.body?.is_active == null ? prev.is_active : req.body.is_active ? 1 : 0;
    db.prepare(
      `UPDATE exchange_banners
       SET title = ?, link_url = ?, page_scope = ?, placement = ?, daily_user_cap = ?, start_at = ?, end_at = ?, sort_order = ?, is_active = ?
       WHERE id = ?`
    ).run(nextTitle, nextLink, nextScope, nextPlacement, nextDailyCap, nextStart, nextEnd, nextSort, nextActive, id);
    const row = db
      .prepare(
        `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
                COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
         FROM exchange_banners WHERE id = ?`
      )
      .get(id);
    res.json(row);
  } catch (e) {
    console.error("admin exchange-banners patch", e);
    res.status(500).json({ error: "update_failed", hint: String(e.message || e) });
  }
});

app.post("/api/admin/exchange-banners/reorder", requireSuperAdmin, (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: "missing_items" });
    const cleaned = [];
    const seen = new Set();
    for (const it of items) {
      const id = Number.parseInt(String(it?.id || "0"), 10);
      const sort_order = Number.parseInt(String(it?.sort_order || "0"), 10);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!Number.isFinite(sort_order)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      cleaned.push({ id, sort_order });
    }
    if (!cleaned.length) return res.status(400).json({ error: "bad_items" });
    const tx = db.transaction((list) => {
      const upd = db.prepare(`UPDATE exchange_banners SET sort_order = ? WHERE id = ?`);
      for (const r of list) upd.run(r.sort_order, r.id);
    });
    tx(cleaned);
    const rows = db
      .prepare(
        `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
                COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
         FROM exchange_banners
         ORDER BY sort_order ASC, id DESC`
      )
      .all();
    res.json({ ok: true, items: rows });
  } catch (e) {
    console.error("admin exchange-banners reorder", e);
    res.status(500).json({ error: "reorder_failed", hint: String(e.message || e) });
  }
});

app.delete("/api/admin/exchange-banners/:id", requireSuperAdmin, (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.id || "0"), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "bad_id" });
    }
    const row = db.prepare(`SELECT id, image_url FROM exchange_banners WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: "not_found" });
    db.prepare(`DELETE FROM exchange_banners WHERE id = ?`).run(id);
    const rel = String(row.image_url || "");
    if (rel.startsWith("/uploads/exchange-banners/")) {
      const abs = path.join(uploadsDir, rel.replace(/^\/uploads\//, ""));
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {}
    }
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "exchange_banner_deleted",
      targetType: "exchange_banner",
      targetId: String(id),
      message: "Exchange banner deleted",
    });
    res.json({ ok: true, id });
  } catch (e) {
    console.error("admin exchange-banners delete", e);
    res.status(500).json({ error: "delete_failed", hint: String(e.message || e) });
  }
});

function adminBusinessMatchesSearchTokens(row, tokens) {
  if (!tokens.length) return true;
  const idStr = row.id != null ? String(row.id) : "";
  const iu = row.id != null ? `iu-${String(row.id).padStart(8, "0")}` : "";
  const iuDisplay = row.id != null ? `IU-${String(row.id).padStart(8, "0")}` : "";
  const blob = [
    row.name_fa,
    row.slug,
    row.category,
    row.city,
    row.phone,
    row.address,
    row.listing_title,
    row.listing_contact_email,
    idStr,
    iu,
    iuDisplay,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every((t) => blob.includes(t));
}

const ADMIN_BUSINESSES_PAGE_SIZE_DEFAULT = 10;
const ADMIN_BUSINESSES_PAGE_SIZE_MAX = 500;
const ADMIN_BULK_DELETE_MAX = 500;

/** جستجوی Ajax برای پنل سوپرادمین — همهٔ آگهی‌ها با فیلتر اختیاری + صفحه‌بندی */
app.get("/api/admin/businesses-search", requireSuperAdmin, (req, res) => {
  const raw = String(req.query.q || "").trim();
  let page = parseInt(String(req.query.page || "1"), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  let limit = parseInt(String(req.query.limit || String(ADMIN_BUSINESSES_PAGE_SIZE_DEFAULT)), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = ADMIN_BUSINESSES_PAGE_SIZE_DEFAULT;
  limit = Math.min(ADMIN_BUSINESSES_PAGE_SIZE_MAX, limit);

  const all = db
    .prepare(
      `SELECT * FROM businesses ORDER BY CASE WHEN listing_approval = 'pending' THEN 0 ELSE 1 END, name_fa`
    )
    .all();
  const tokens = raw ? raw.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const filtered = tokens.length ? all.filter((row) => adminBusinessMatchesSearchTokens(row, tokens)) : all;
  const total = filtered.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  if (page > totalPages) page = totalPages;
  const offset = (page - 1) * limit;
  const items = filtered.slice(offset, offset + limit);
  res.json({ items, total, page, pageSize: limit, totalPages });
});

/** حذف دسته‌ای آگهی — فقط سوپرادمین؛ حداکثر ADMIN_BULK_DELETE_MAX نامک */
app.post("/api/admin/businesses/bulk-delete", requireSuperAdmin, (req, res) => {
  try {
    const raw = req.body?.slugs;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ error: "missing_slugs", hint: "آرایهٔ slugs لازم است" });
    }
    const slugs = [...new Set(raw.map((s) => String(s || "").trim()).filter(Boolean))];
    if (slugs.length === 0) {
      return res.status(400).json({ error: "empty_slugs", hint: "حداقل یک نامک معتبر بفرستید" });
    }
    if (slugs.length > ADMIN_BULK_DELETE_MAX) {
      return res.status(400).json({
        error: "too_many",
        hint: `حداکثر ${ADMIN_BULK_DELETE_MAX} آگهی در هر درخواست`,
      });
    }
    const deleted = [];
    const not_found = [];
    const failed = [];
    for (const slug of slugs) {
      try {
        const r = cascadeDeleteBusinessBySlug(slug);
        if (r.deleted) deleted.push(slug);
        else if (r.reason === "not_found") not_found.push(slug);
        else failed.push({ slug, error: r.reason || "unknown" });
      } catch (e) {
        failed.push({ slug, error: String(e.message || e) });
      }
    }
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "business_bulk_delete",
      targetType: "business",
      targetId: null,
      message: `Bulk delete: removed ${deleted.length}, not_found ${not_found.length}, failed ${failed.length}`,
      meta: { deleted_count: deleted.length, not_found_count: not_found.length, failed_count: failed.length },
    });
    res.json({ ok: true, deleted, not_found, failed });
  } catch (e) {
    console.error("bulk-delete", e);
    res.status(500).json({ error: "bulk_delete_failed", hint: String(e.message || e) });
  }
});

/** پیش‌نمایش آگهی‌های با نام تکراری (پس از یکسان‌سازی فاصله و حروف لاتین) */
app.get("/api/admin/businesses/duplicate-names", requireSuperAdmin, (_req, res) => {
  try {
    const { groups, total_remove } = analyzeDuplicateNames();
    res.json({
      ok: true,
      groups: groups.map((g) => ({
        name_display: g.name_display,
        keep: { slug: g.keep.slug, id: g.keep.id },
        remove: g.remove.map((r) => ({ slug: r.slug, id: r.id })),
      })),
      total_remove,
      duplicate_name_count: groups.length,
    });
  } catch (e) {
    console.error("duplicate-names", e);
    res.status(500).json({ error: "duplicate_names_failed", hint: String(e.message || e) });
  }
});

/**
 * حذف آگهی‌های تکراری با همان نام؛ نسخه با id کم‌تر (قدیمی‌تر) نگه داشته می‌شود.
 * وابستگی‌ها با cascadeDeleteBusinessBySlug پاک می‌شوند.
 */
app.post("/api/admin/businesses/dedupe-by-name", requireSuperAdmin, (req, res) => {
  try {
    const maxRemovals = Math.min(
      50000,
      Math.max(1, Number(req.body?.max_removals) || 5000)
    );
    const result = executeDedupeByName({ maxRemovals });
    if (result.error === "too_many") {
      return res.status(400).json({
        error: "too_many_duplicates",
        hint: `تعداد ردیف‌های قابل حذف ${result.total_remove} است؛ حداکثر مجاز هر بار ${result.maxRemovals}. اگر عمدی است با پشتیبان تماس بگیرید.`,
        total_remove: result.total_remove,
        maxRemovals: result.maxRemovals,
      });
    }
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "business_dedupe_by_name",
      targetType: "business",
      targetId: null,
      message: `Dedupe by name: removed ${result.removed_count} listings (${result.kept_groups} نام تکراری)`,
      meta: {
        removed_count: result.removed_count,
        kept_groups: result.kept_groups,
        failed_count: result.failed?.length ?? 0,
      },
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("dedupe-by-name", e);
    res.status(500).json({ error: "dedupe_failed", hint: String(e.message || e) });
  }
});

app.get("/api/categories", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, sort_order, is_active
       FROM business_categories
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`
    )
    .all();
  res.json(rows);
});

app.get("/api/businesses/:slug", (req, res) => {
  const row = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(req.params.slug);
  if (!row) return res.status(404).json({ error: "not_found", slug: req.params.slug });
  const auth = parseAuthHeader(req);
  const publiclyVisible = isBusinessVisibleToPublic(row);
  if (!publiclyVisible) {
    const canSee =
      (auth && auth.typ === "adm") ||
      (auth &&
        auth.typ === "mgr" &&
        row.manager_id != null &&
        Number(row.manager_id) === Number(auth.sub)) ||
      (auth &&
        auth.typ === "mgrx" &&
        row.exchange_manager_id != null &&
        Number(row.exchange_manager_id) === Number(auth.sub));
    if (!canSee) return res.status(404).json({ error: "not_found", slug: req.params.slug });
  }
  const twilioOn = isTwilioModuleEnabled();
  res.json({ ...row, twilio_module_enabled: twilioOn });
});

app.get("/api/business-report-reasons", (_req, res) => {
  res.json({ reasons: BUSINESS_REPORT_REASONS });
});

app.post("/api/businesses/:slug/report", (req, res) => {
  const business_slug = String(req.params.slug || "").trim();
  const biz = db.prepare(`SELECT slug, listing_approval, status FROM businesses WHERE slug = ?`).get(business_slug);
  if (!biz) return res.status(404).json({ error: "not_found" });
  if (!isBusinessVisibleToPublic(biz)) return res.status(404).json({ error: "not_found" });
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const reason_key = String(b.reason_key || "").trim();
  if (!BUSINESS_REPORT_REASON_KEYS.has(reason_key)) {
    return res.status(400).json({ error: "invalid_reason", hint: "دلیل نامعتبر است" });
  }
  let details = String(b.details || "").trim();
  if (details.length > 2000) details = details.slice(0, 2000);
  let reporter_email = String(b.reporter_email || "").trim().toLowerCase();
  if (reporter_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporter_email)) {
    return res.status(400).json({ error: "invalid_email", hint: "ایمیل نامعتبر است" });
  }
  if (!reporter_email) reporter_email = null;
  const info = db
    .prepare(
      `INSERT INTO business_reports (business_slug, reason_key, details, reporter_email) VALUES (?, ?, ?, ?)`
    )
    .run(business_slug, reason_key, details || null, reporter_email);
  const row = db.prepare(`SELECT * FROM business_reports WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

const DEFAULT_JSON_HOURS = "[]";
const DEFAULT_JSON_GALLERY = JSON.stringify(["", "", "", ""]);
const DEFAULT_BIOLINK_JSON = JSON.stringify({
  headline: "",
  bio: "",
  avatarUrl: "",
  themeId: 1,
  backgroundImageUrl: "",
  backgroundOverlay: "dark",
  alert: { enabled: false, text: "" },
  links: [],
  socialLinks: [],
});

app.post("/api/businesses", async (req, res) => {
  ensureRestaurantSafraDemo();
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const slug = String(b.slug || "")
    .trim()
    .toLowerCase();
  const name_fa = String(b.name_fa || "").trim();
  if (!slug || !name_fa) return res.status(400).json({ error: "missing_slug_or_name" });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return res.status(400).json({ error: "invalid_slug", hint: "فقط حروف انگلیسی، اعداد و خط تیره" });
  }
  if (db.prepare(`SELECT 1 FROM businesses WHERE slug = ?`).get(slug)) {
    return res.status(409).json({ error: "slug_taken" });
  }
  let hours_json = typeof b.hours_json === "string" ? b.hours_json : DEFAULT_JSON_HOURS;
  let gallery_json = typeof b.gallery_json === "string" ? b.gallery_json : DEFAULT_JSON_GALLERY;
  let biolink_json = typeof b.biolink_json === "string" ? b.biolink_json : DEFAULT_BIOLINK_JSON;
  try {
    JSON.parse(hours_json);
    JSON.parse(gallery_json);
    JSON.parse(biolink_json);
  } catch {
    return res.status(400).json({ error: "invalid_json_field" });
  }
  const ratingRaw = b.rating;
  let rating = null;
  if (ratingRaw !== null && ratingRaw !== undefined && ratingRaw !== "") {
    const n = typeof ratingRaw === "number" ? ratingRaw : parseFloat(String(ratingRaw));
    if (Number.isFinite(n)) rating = n;
  }

  const auth = parseAuthHeader(req);
  const listing_approval = auth && auth.typ === "adm" ? "approved" : "pending";

  const acceptTerms =
    b.accept_listing_terms === true ||
    b.accept_listing_terms === 1 ||
    String(b.accept_listing_terms || "").toLowerCase() === "true";
  const termsVersionClient = String(b.listing_terms_version || "").trim();
  if (!acceptTerms) {
    return res.status(400).json({
      error: "terms_not_accepted",
      hint: "پذیرش شرایط و قوانین ثبت آگهی الزامی است",
    });
  }
  if (termsVersionClient !== LISTING_TERMS_VERSION) {
    return res.status(400).json({
      error: "terms_version_mismatch",
      hint: "نسخهٔ شرایط قدیمی است؛ صفحه را تازه‌سازی کنید و دوباره تلاش کنید",
    });
  }
  const listing_terms_accepted_at = new Date().toISOString();
  const listing_terms_version = LISTING_TERMS_VERSION;
  let listing_contact_email = String(b.listing_contact_email ?? "").trim().toLowerCase();
  if (!listing_contact_email) {
    return res.status(400).json({
      error: "missing_listing_contact_email",
      hint: "ایمیل تماس برای اطلاع‌رسانی الزامی است",
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(listing_contact_email)) {
    return res.status(400).json({ error: "invalid_listing_contact_email", hint: "ایمیل تماس برای اطلاع‌رسانی نامعتبر است" });
  }

  const city = String(b.city ?? "").trim();
  const phone = String(b.phone ?? "").trim();
  const address = String(b.address ?? "").trim();
  const category = String(b.category ?? "").trim();
  const listing_title = String(b.listing_title ?? "").trim();
  const description = String(b.description ?? "").trim();
  const google_review_url = String(b.google_review_url ?? "").trim();
  const cta = String(b.cta ?? "").trim();
  const price_range = String(b.price_range ?? "").trim();
  if (!city || !phone || !address || !category || !listing_title || !description || !google_review_url || !cta || !price_range) {
    return res.status(400).json({
      error: "missing_business_fields",
      hint: "شهر، تلفن، آدرس، دسته، عنوان، توضیحات، لینک Google، دکمهٔ فراخوان و محدودهٔ قیمت الزامی است",
    });
  }
  try {
    const u = new URL(google_review_url);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
  } catch {
    return res.status(400).json({
      error: "invalid_google_review_url",
      hint: "لینک صفحهٔ نظر Google باید http یا https باشد",
    });
  }

  db.prepare(
    `INSERT INTO businesses (
      slug, name_fa, description, category, phone, address, google_review_url, claimed, package,
      subtitle, hours_json, promo_title, promo_description, cover_image_url, gallery_json,
      listing_title, city, price_range, rating, cta, status, manager_id, biolink_json, listing_approval,
      listing_terms_accepted_at, listing_terms_version, listing_contact_email
    ) VALUES (
      @slug, @name_fa, @description, @category, @phone, @address, @google_review_url, 0, 'basic',
      @subtitle, @hours_json, @promo_title, @promo_description, @cover_image_url, @gallery_json,
      @listing_title, @city, @price_range, @rating, @cta, @status, NULL, @biolink_json, @listing_approval,
      @listing_terms_accepted_at, @listing_terms_version, @listing_contact_email
    )`
  ).run({
    slug,
    name_fa,
    description,
    category,
    phone,
    address,
    google_review_url,
    subtitle: String(b.subtitle ?? ""),
    hours_json,
    promo_title: String(b.promo_title ?? ""),
    promo_description: String(b.promo_description ?? ""),
    cover_image_url: String(b.cover_image_url ?? ""),
    gallery_json,
    listing_title,
    city,
    price_range,
    rating,
    cta,
    status: String(b.status || "active") || "active",
    biolink_json,
    listing_approval,
    listing_terms_accepted_at,
    listing_terms_version,
    listing_contact_email,
  });

  const row = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(slug);
  if (listing_approval === "pending") {
    try {
      await notifyAdminsNewPendingListing(row);
    } catch (e) {
      console.error("[email] pending listing notify", e);
    }
  }
  res.status(201).json(row);
});

app.post("/api/claim-requests", (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const business_slug = String(b.business_slug || "").trim();
  const applicant_name = String(b.applicant_name || "").trim();
  const email = String(b.email || "").trim();
  const phone = String(b.phone || "").trim();
  const message = String(b.message || "").trim();
  if (!business_slug || !applicant_name || !email || !phone || !message) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const biz = db.prepare(`SELECT slug, claimed, listing_approval, status FROM businesses WHERE slug = ?`).get(business_slug);
  if (!biz) return res.status(404).json({ error: "business_not_found" });
  if (!isBusinessVisibleToPublic(biz)) {
    return res.status(400).json({
      error: "listing_not_public",
      hint: "این آگهی در سایت منتشر نشده، رد شده یا غیرفعال است",
    });
  }
  if (biz.claimed) return res.status(400).json({ error: "already_claimed" });
  const dup = db
    .prepare(
      `SELECT id FROM claim_requests WHERE business_slug = ? AND email = ? AND status = 'pending'`
    )
    .get(business_slug, email);
  if (dup) return res.status(409).json({ error: "duplicate_pending" });
  const info = db
    .prepare(
      `INSERT INTO claim_requests (business_slug, applicant_name, email, phone, message, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    )
    .run(business_slug, applicant_name, email, phone || null, message || null);
  const row = db.prepare(`SELECT * FROM claim_requests WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.get("/api/admin/claim-requests", requireSuperAdmin, (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  let rows;
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    rows = db
      .prepare(`SELECT * FROM claim_requests WHERE status = ? ORDER BY created_at DESC`)
      .all(status);
  } else {
    rows = db.prepare(`SELECT * FROM claim_requests ORDER BY created_at DESC`).all();
  }
  res.json(rows);
});

app.get("/api/admin/business-reports", requireSuperAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.business_slug, r.reason_key, r.details, r.reporter_email, r.created_at,
              b.name_fa AS business_name_fa, b.id AS business_id
       FROM business_reports r
       LEFT JOIN businesses b ON b.slug = r.business_slug
       ORDER BY r.created_at DESC`
    )
    .all();
  const labelByKey = Object.fromEntries(BUSINESS_REPORT_REASONS.map((x) => [x.key, x.label]));
  res.json(rows.map((r) => ({ ...r, reason_label: labelByKey[r.reason_key] || r.reason_key })));
});

/** الگوی CSV — یک خط هدر؛ preset=london مطابق London_Bussines_List، preset=iraniu مطابق جدول businesses */
app.get("/api/admin/businesses/csv-template", requireSuperAdmin, (req, res) => {
  const preset = String(req.query.preset || "london").toLowerCase();
  if (preset === "iraniu") {
    const header = [
      "slug",
      "name_fa",
      "description",
      "category",
      "phone",
      "address",
      "city",
      "google_review_url",
      "listing_title",
      "price_range",
      "cta",
      "hours_json",
      "gallery_json",
      "cover_image_url",
      "subtitle",
      "package",
      "listing_approval",
      "claimed",
    ].join(",");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="iraniu-businesses-template.csv"');
    return res.send("\uFEFF" + header + "\n");
  }
  if (preset === "london") {
    const header = [
      "id",
      "name",
      "category_1",
      "category_2",
      "description",
      "updated_description",
      "phone",
      "mobile",
      "address",
      "postcode",
      "googleMap",
      "imageUrl",
      "instagram",
      "website",
      "facebook",
      "twitter",
      "linkedin",
      "telegram",
      "calendarUrl",
      "workingHours_Sat",
      "workingHours_Sun",
      "workingHours_Mon",
      "workingHours_Tue",
      "workingHours_Wed",
      "workingHours_Thu",
      "workingHours_Fri",
      "borough",
    ].join(",");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="london-businesses-template.csv"');
    return res.send("\uFEFF" + header + "\n");
  }
  return res.status(400).json({ error: "invalid_preset" });
});

/** خروجی CSV همهٔ آگهی‌ها — همان فرمت iraniu برای ورود مجدد / بک‌آپ */
app.get("/api/admin/businesses/export-csv", requireSuperAdmin, (req, res) => {
  try {
    const preset = String(req.query.preset || "iraniu").toLowerCase();
    if (preset !== "iraniu") {
      return res.status(400).json({
        error: "invalid_preset",
        hint: "فعلاً فقط preset=iraniu پشتیبانی می‌شود (خروجی مطابق جدول businesses)",
      });
    }
    const { csvText, rowCount } = exportIraniuBusinessesCsv();
    const date = new Date().toISOString().slice(0, 10);
    const filename = `businesses-export-iraniu-${date}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "business_csv_export",
      targetType: "business",
      targetId: null,
      message: `CSV export iraniu (${rowCount} rows)`,
      meta: { preset: "iraniu", rowCount },
    });
    return res.send(csvText);
  } catch (e) {
    console.error("export-csv", e);
    return res.status(500).json({ error: "export_failed", hint: String(e.message || e) });
  }
});

/** دانلود فایل کامل SQLite (iraniu.db) — پس از checkpoint وال */
app.get("/api/admin/database/sqlite", requireSuperAdmin, (req, res) => {
  try {
    db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
    const buf = fs.readFileSync(dbPath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", 'attachment; filename="iraniu.db"');
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "sqlite_db_export",
      targetType: "business",
      targetId: null,
      message: "SQLite iraniu.db export",
      meta: { bytes: buf.length },
    });
    return res.send(buf);
  } catch (e) {
    console.error("sqlite-db-export", e);
    return res.status(500).json({ error: "export_failed", hint: String(e.message || e) });
  }
});

/** آپلود فایل SQLite — در کنار دیتابیس ذخیره می‌شود و با ری‌استارت بعدی اعمال می‌شود */
app.post(
  "/api/admin/database/sqlite",
  requireSuperAdmin,
  (req, res, next) => {
    uploadSqlite.single("db")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: "upload_error", hint: String(err.message || err) });
      }
      next();
    });
  },
  (req, res) => {
    try {
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: "missing_file", hint: "فیلد db با فایل .db را بفرستید" });
      }
      const pending = path.join(path.dirname(dbPath), "iraniu.db.uploaded");
      fs.writeFileSync(pending, req.file.buffer);
      const v = validateIraniuSqliteFile(pending);
      if (!v.ok) {
        try {
          fs.unlinkSync(pending);
        } catch {
          /* ignore */
        }
        return res.status(400).json({
          error: "invalid_sqlite",
          hint: v.error || "فایل باید SQLite معتبر با جدول businesses باشد",
        });
      }
      writeSystemLog({
        ...actorFromAuth(req.auth),
        action: "sqlite_db_upload_pending",
        targetType: "business",
        targetId: null,
        message: "SQLite upload pending until restart",
        meta: { bytes: req.file.buffer.length },
      });
      return res.json({
        ok: true,
        restart_required: true,
        hint:
          "فایل ذخیره شد. یک بار سرویس را ری‌استارت کنید تا جایگزین شود. نسخهٔ قبلی به iraniu.db.bak.<زمان> تغییر نام می‌یابد.",
      });
    } catch (e) {
      console.error("sqlite-db-upload", e);
      return res.status(500).json({ error: "upload_failed", hint: String(e.message || e) });
    }
  }
);

app.post("/api/admin/businesses/import-csv", requireSuperAdmin, uploadCsv.single("csv"), (req, res) => {
  try {
    const preset = String(req.body?.preset || "london").toLowerCase();
    if (preset !== "iraniu" && preset !== "london") {
      return res.status(400).json({ error: "invalid_preset", hint: "london یا iraniu" });
    }
    const default_contact_email = String(req.body?.default_contact_email || "").trim().toLowerCase();
    if (!default_contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(default_contact_email)) {
      return res.status(400).json({
        error: "missing_default_contact_email",
        hint: "ایمیل تماس برای فیلد listing_contact_email الزامی است",
      });
    }
    let csvText = "";
    if (req.file?.buffer) {
      csvText = req.file.buffer.toString("utf8");
    } else if (typeof req.body?.csv_text === "string") {
      csvText = req.body.csv_text;
    }
    if (!csvText || !String(csvText).trim()) {
      return res.status(400).json({ error: "missing_csv", hint: "فایل csv یا متن csv_text" });
    }

    let parsed;
    try {
      parsed = parseBusinessCsv({
        csvText,
        preset,
        defaultContactEmail: default_contact_email,
        listingTermsVersion: LISTING_TERMS_VERSION,
      });
    } catch (e) {
      const msg = String(e.message || e);
      if (msg === "invalid_default_contact_email") {
        return res.status(400).json({ error: "invalid_default_contact_email" });
      }
      if (msg.startsWith("csv_parse_error:")) {
        return res.status(400).json({ error: "csv_parse_error", hint: msg.replace(/^csv_parse_error:\s*/i, "") });
      }
      if (msg === "csv_empty") {
        return res.status(400).json({ error: "csv_empty" });
      }
      throw e;
    }

    const { rows, errors } = parsed;
    if (!rows.length) {
      return res.status(400).json({
        error: "no_valid_rows",
        parse_errors: errors,
      });
    }

    const { inserted, skipped, failed } = runBulkInsert(rows, { onDuplicate: "skip" });

    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "business_csv_import",
      targetType: "business",
      targetId: null,
      message: `CSV import preset=${preset} inserted=${inserted.length} skipped=${skipped.length} failed=${failed.length}`,
      meta: { preset, inserted: inserted.length, skipped: skipped.length, failed: failed.length },
    });

    res.json({
      ok: true,
      preset,
      parse_errors: errors,
      inserted_count: inserted.length,
      inserted_slugs: inserted,
      skipped,
      failed,
    });
  } catch (e) {
    console.error("import-csv", e);
    res.status(500).json({ error: "import_failed", hint: String(e.message || e) });
  }
});

app.post("/api/admin/businesses/:slug/approve", requireSuperAdmin, async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  const rowBefore = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(slug);
  if (!rowBefore) return res.status(404).json({ error: "not_found" });
  const info = db.prepare(`UPDATE businesses SET listing_approval = 'approved', listing_rejection_reason = NULL WHERE slug = ?`).run(slug);
  if (info.changes === 0) return res.status(404).json({ error: "not_found" });
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "listing_approved",
    targetType: "business",
    targetId: slug,
    message: `Listing approved: ${slug}`,
  });
  const row = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(slug);
  try {
    await sendListingApprovedEmail({
      to: row.listing_contact_email,
      nameFa: row.name_fa,
      slug: row.slug,
    });
  } catch (e) {
    console.error("listing approve email", e);
  }
  res.json(row);
});

app.post("/api/admin/businesses/:slug/reject", requireSuperAdmin, async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const reason = String(body.reason ?? "").trim();
  const rowBefore = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(slug);
  if (!rowBefore) return res.status(404).json({ error: "not_found" });
  const info = db
    .prepare(`UPDATE businesses SET listing_approval = 'rejected', listing_rejection_reason = ? WHERE slug = ?`)
    .run(reason || null, slug);
  if (info.changes === 0) return res.status(404).json({ error: "not_found" });
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "listing_rejected",
    targetType: "business",
    targetId: slug,
    message: `Listing rejected: ${slug}`,
  });
  const row = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(slug);
  try {
    await sendListingRejectedEmail({
      to: row.listing_contact_email,
      nameFa: row.name_fa,
      slug: row.slug,
      reason: reason || "دلیلی توسط مدیر ثبت نشده است.",
    });
  } catch (e) {
    console.error("listing reject email", e);
  }
  res.json(row);
});

app.post("/api/admin/claim-requests/:id/decide", requireSuperAdmin, (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const action = String((req.body && req.body.action) || "").toLowerCase();
  if (action !== "approve" && action !== "reject") {
    return res.status(400).json({ error: "bad_action" });
  }
  const row = db.prepare(`SELECT * FROM claim_requests WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.status !== "pending") return res.status(400).json({ error: "already_decided" });
  const now = new Date().toISOString();
  if (action === "reject") {
    db.prepare(`UPDATE claim_requests SET status = 'rejected', decided_at = ? WHERE id = ?`).run(now, id);
    return res.json(db.prepare(`SELECT * FROM claim_requests WHERE id = ?`).get(id));
  }
  const biz = db.prepare(`SELECT claimed FROM businesses WHERE slug = ?`).get(row.business_slug);
  if (!biz) return res.status(404).json({ error: "business_missing" });
  if (biz.claimed) {
    db.prepare(`UPDATE claim_requests SET status = 'rejected', decided_at = ? WHERE id = ?`).run(now, id);
    return res.status(409).json({ error: "business_already_claimed" });
  }
  db.prepare(`UPDATE claim_requests SET status = 'approved', decided_at = ? WHERE id = ?`).run(now, id);
  db.prepare(`UPDATE businesses SET claimed = 1 WHERE slug = ?`).run(row.business_slug);
  res.json(db.prepare(`SELECT * FROM claim_requests WHERE id = ?`).get(id));
});

function attachLinkedBusinesses(managerRow, kind = "directory") {
  const managerColumn = kind === "exchange" ? "exchange_manager_id" : "manager_id";
  const categoryWhere =
    kind === "exchange"
      ? `AND IFNULL(TRIM(category), '') = 'صرافی'`
      : `AND IFNULL(TRIM(category), '') <> 'صرافی'`;
  const linked_businesses = db
    .prepare(
      `SELECT id, slug, name_fa, category, status, claimed, package, city
       FROM businesses
       WHERE ${managerColumn} = ?
       ${categoryWhere}
       ORDER BY CASE WHEN IFNULL(TRIM(category), '') = 'صرافی' THEN 0 ELSE 1 END, id DESC`
    )
    .all(managerRow.id);
  return {
    ...stripManagerRow(managerRow),
    linked_businesses,
    manager_kind: kind,
    password_set: !!managerRow.password_hash,
    totp_enabled: !!managerRow.totp_enabled,
  };
}

app.get("/api/managers", requireSuperAdmin, (_req, res) => {
  const rows = db.prepare(`SELECT * FROM identity.managers ORDER BY created_at DESC`).all();
  res.json(rows.map((m) => attachLinkedBusinesses(m)));
});

app.get("/api/managers/:id", requireSuperAdmin, (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const m = db.prepare(`SELECT * FROM identity.managers WHERE id = ?`).get(id);
  if (!m) return res.status(404).json({ error: "not_found" });
  res.json(attachLinkedBusinesses(m));
});

app.get("/api/exchange-managers", requireSuperAdmin, (_req, res) => {
  const rows = db.prepare(`SELECT * FROM identity.exchange_managers ORDER BY created_at DESC`).all();
  res.json(rows.map((m) => attachLinkedBusinesses(m, "exchange")));
});

app.get("/api/exchange-managers/:id", requireSuperAdmin, (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const m = db.prepare(`SELECT * FROM identity.exchange_managers WHERE id = ?`).get(id);
  if (!m) return res.status(404).json({ error: "not_found" });
  res.json(attachLinkedBusinesses(m, "exchange"));
});

app.delete("/api/managers/:id", requireSuperAdmin, (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "bad_id" });
  const existing = db.prepare(`SELECT id, email FROM identity.managers WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: "not_found" });
  const tx = db.transaction(() => {
    db.prepare(`UPDATE businesses SET manager_id = NULL WHERE manager_id = ?`).run(id);
    db.prepare(`DELETE FROM identity.managers WHERE id = ?`).run(id);
  });
  tx();
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "manager_deleted",
    targetType: "manager",
    targetId: id,
    message: `Manager deleted: #${id} (${existing.email})`,
  });
  res.json({ ok: true, id });
});

app.delete("/api/exchange-managers/:id", requireSuperAdmin, (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "bad_id" });
  const existing = db.prepare(`SELECT id, email FROM identity.exchange_managers WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: "not_found" });
  const tx = db.transaction(() => {
    db.prepare(`UPDATE businesses SET exchange_manager_id = NULL WHERE exchange_manager_id = ?`).run(id);
    db.prepare(`DELETE FROM identity.exchange_managers WHERE id = ?`).run(id);
  });
  tx();
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "exchange_manager_deleted",
    targetType: "exchange_manager",
    targetId: id,
    message: `Exchange manager deleted: #${id} (${existing.email})`,
  });
  res.json({ ok: true, id });
});

const MANAGER_LOGIN_USERNAME_RE = /^[a-z0-9_]{3,32}$/;

app.post("/api/managers", requireSuperAdmin, (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const email = String(b.email || "").trim().toLowerCase();
  const name = String(b.name || "").trim();
  const password = String(b.password || "").trim();
  const login_username_raw = String(b.login_username || b.username || "").trim().toLowerCase();
  const phone = String(b.phone || "").trim();
  if (!email || !name) return res.status(400).json({ error: "missing_email_or_name" });
  if (!phone) return res.status(400).json({ error: "missing_phone", hint: "تلفن الزامی است" });
  if (!login_username_raw) {
    return res.status(400).json({ error: "missing_username", hint: "نام کاربری الزامی است" });
  }
  const pwCheck = validatePasswordComplexity(password);
  if (!pwCheck.ok) {
    return res.status(400).json({ error: pwCheck.code || "weak_password", hint: pwCheck.hint });
  }
  const login_username = login_username_raw;
  if (!MANAGER_LOGIN_USERNAME_RE.test(login_username)) {
    return res.status(400).json({
      error: "invalid_username",
      hint: "نام کاربری ۳ تا ۳۲ کاراکتر؛ فقط a-z، ۰-۹ و _",
    });
  }
  if (db.prepare(`SELECT id FROM identity.managers WHERE email = ?`).get(email)) {
    return res.status(409).json({ error: "email_taken", hint: "این ایمیل قبلاً برای یک مدیر ثبت شده" });
  }
  if (db.prepare(`SELECT id FROM identity.managers WHERE login_username = ?`).get(login_username)) {
    return res.status(409).json({ error: "username_taken", hint: "این نام کاربری گرفته شده" });
  }
  try {
    const ph = hashPassword(password);
    const info = db
      .prepare(
        `INSERT INTO identity.managers (email, name, phone, password_hash, login_username) VALUES (?, ?, ?, ?, ?)`
      )
      .run(email, name, phone, ph, login_username);
    const row = db.prepare(`SELECT * FROM identity.managers WHERE id = ?`).get(info.lastInsertRowid);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "manager_created",
      targetType: "manager",
      targetId: row.id,
      message: `Manager created: ${row.email}`,
    });
    res.status(201).json(attachLinkedBusinesses(row));
  } catch (e) {
    if (String(e.message || "").includes("UNIQUE")) {
      return res.status(409).json({
        error: "email_or_username_taken",
        hint: "ایمیل یا نام کاربری تکراری است",
      });
    }
    throw e;
  }
});

app.post("/api/exchange-managers", requireSuperAdmin, (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const email = String(b.email || "").trim().toLowerCase();
  let name = String(b.name || "").trim();
  const password = String(b.password || "").trim();
  let login_username_raw = String(b.login_username || b.username || "").trim().toLowerCase();
  const phone = String(b.phone || "").trim();
  if (!email) return res.status(400).json({ error: "missing_email", hint: "ایمیل الزامی است" });
  if (!name) {
    const fromEmail = String(email.split("@")[0] || "")
      .replace(/[._-]+/g, " ")
      .trim();
    name = fromEmail || "Exchange Manager";
  }
  if (!login_username_raw) {
    const base = String(email.split("@")[0] || "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    const suffix = Math.random().toString(36).slice(2, 6).toLowerCase();
    const candidate = (base.length >= 3 ? base : `exmgr_${suffix}`).slice(0, 32);
    login_username_raw = candidate;
  }
  if (!login_username_raw) {
    return res.status(400).json({ error: "missing_username", hint: "نام کاربری الزامی است" });
  }
  const pwCheck = validatePasswordComplexity(password);
  if (!pwCheck.ok) {
    return res.status(400).json({ error: pwCheck.code || "weak_password", hint: pwCheck.hint });
  }
  const login_username = login_username_raw;
  if (!MANAGER_LOGIN_USERNAME_RE.test(login_username)) {
    return res.status(400).json({
      error: "invalid_username",
      hint: "نام کاربری ۳ تا ۳۲ کاراکتر؛ فقط a-z، ۰-۹ و _",
    });
  }
  if (
    db.prepare(`SELECT id FROM identity.exchange_managers WHERE email = ?`).get(email) ||
    db.prepare(`SELECT id FROM identity.managers WHERE email = ?`).get(email)
  ) {
    return res.status(409).json({ error: "email_taken", hint: "این ایمیل قبلاً برای یک مدیر ثبت شده" });
  }
  if (
    db.prepare(`SELECT id FROM identity.exchange_managers WHERE login_username = ?`).get(login_username) ||
    db.prepare(`SELECT id FROM identity.managers WHERE login_username = ?`).get(login_username)
  ) {
    return res.status(409).json({ error: "username_taken", hint: "این نام کاربری گرفته شده" });
  }
  try {
    const ph = hashPassword(password);
    const info = db
      .prepare(
        `INSERT INTO identity.exchange_managers (email, name, phone, password_hash, login_username) VALUES (?, ?, ?, ?, ?)`
      )
      .run(email, name, phone || null, ph, login_username);
    const row = db.prepare(`SELECT * FROM identity.exchange_managers WHERE id = ?`).get(info.lastInsertRowid);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "exchange_manager_created",
      targetType: "exchange_manager",
      targetId: row.id,
      message: `Exchange manager created: ${row.email}`,
    });
    res.status(201).json(attachLinkedBusinesses(row, "exchange"));
  } catch (e) {
    if (String(e.message || "").includes("UNIQUE")) {
      return res.status(409).json({
        error: "email_or_username_taken",
        hint: "ایمیل یا نام کاربری تکراری است",
      });
    }
    throw e;
  }
});

app.patch("/api/admin/businesses/:slug/manager", requireSuperAdmin, (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  const exists = db.prepare(`SELECT slug, category FROM businesses WHERE slug = ?`).get(slug);
  if (!exists) return res.status(404).json({ error: "not_found" });
  const cat = String(exists.category || "").trim();
  if (cat.includes("صراف") || cat.toLowerCase().includes("exchange")) {
    return res
      .status(400)
      .json({ error: "exchange_use_separate_manager", hint: "برای صرافی‌ها از لینک مدیر صرافی استفاده کنید." });
  }
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const mid = b.manager_id;
  const midRaw = String(mid ?? "")
    .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, "")
    .trim();
  const midLooksEmpty = !midRaw || /^(null|undefined|nan)$/i.test(midRaw);
  const managerIdentifier = String(b.manager_email || b.manager_login || "")
    .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, "")
    .trim()
    .toLowerCase();

  if (midLooksEmpty && !managerIdentifier) {
    db.prepare(`UPDATE businesses SET manager_id = NULL WHERE slug = ?`).run(slug);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "business_manager_unlinked",
      targetType: "business",
      targetId: slug,
      message: `Manager unlinked from business ${slug}`,
    });
  } else {
    let id = null;
    let managerRow = null;
    let source = "id";
    if (!midLooksEmpty) {
      const parsed = parseInt(midRaw, 10);
      if (Number.isFinite(parsed)) {
        id = parsed;
        managerRow = db.prepare(`SELECT id FROM identity.managers WHERE id = ?`).get(id);
      } else if (!managerIdentifier) {
        return res.status(400).json({ error: "bad_manager_id" });
      } else {
        source = "email_or_username_after_bad_id";
      }
    } else if (managerIdentifier) {
      source = "email_or_username";
      const mByIdent = db
        .prepare(`SELECT id FROM identity.managers WHERE lower(email) = ? OR lower(login_username) = ?`)
        .get(managerIdentifier, managerIdentifier);
      if (!mByIdent) {
        return res.status(400).json({ error: "invalid_manager_identifier", hint: "ایمیل یا نام‌کاربری مدیر پیدا نشد" });
      }
      id = Number(mByIdent.id);
      managerRow = mByIdent;
    }
    // If ID was sent but no longer valid, fallback to email/login when provided.
    if (!managerRow && managerIdentifier) {
      source = "email_or_username_fallback";
      const mByIdent = db
        .prepare(`SELECT id FROM identity.managers WHERE lower(email) = ? OR lower(login_username) = ?`)
        .get(managerIdentifier, managerIdentifier);
      if (mByIdent) {
        id = Number(mByIdent.id);
        managerRow = mByIdent;
      }
    }
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_manager_id" });
    if (!managerRow) {
      if (managerIdentifier) {
        return res.status(400).json({ error: "invalid_manager_identifier", hint: "ایمیل یا نام‌کاربری مدیر پیدا نشد" });
      }
      return res.status(400).json({ error: "invalid_manager_id" });
    }
    db.prepare(`UPDATE businesses SET manager_id = ? WHERE slug = ?`).run(id, slug);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "business_manager_linked",
      targetType: "business",
      targetId: slug,
      message: `Manager #${id} linked to business ${slug} (${source})`,
    });
  }
  const row = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(slug);
  const manager =
    row?.manager_id != null
      ? db.prepare(`SELECT id, name, email, login_username FROM identity.managers WHERE id = ?`).get(row.manager_id)
      : null;
  res.json({ ...row, manager });
});

app.patch("/api/admin/exchange-businesses/:slug/manager", requireSuperAdmin, (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  const exists = db.prepare(`SELECT slug, category FROM businesses WHERE slug = ?`).get(slug);
  if (!exists) return res.status(404).json({ error: "not_found" });
  // Super admin can pre-link exchange managers even before category is persisted as "exchange".
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const mid = b.manager_id;
  const midRaw = String(mid ?? "")
    .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, "")
    .trim();
  const midLooksEmpty = !midRaw || /^(null|undefined|nan)$/i.test(midRaw);
  const managerIdentifier = String(b.manager_email || b.manager_login || "")
    .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, "")
    .trim()
    .toLowerCase();
  if (midLooksEmpty && !managerIdentifier) {
    db.prepare(`UPDATE businesses SET exchange_manager_id = NULL WHERE slug = ?`).run(slug);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "exchange_business_manager_unlinked",
      targetType: "business",
      targetId: slug,
      message: `Exchange manager unlinked from business ${slug}`,
    });
  } else {
    let id = null;
    let managerRow = null;
    let source = "id";
    if (!midLooksEmpty) {
      const parsed = parseInt(midRaw, 10);
      if (Number.isFinite(parsed)) {
        id = parsed;
        managerRow = db.prepare(`SELECT id FROM identity.exchange_managers WHERE id = ?`).get(id);
      } else if (!managerIdentifier) {
        return res.status(400).json({ error: "bad_manager_id" });
      } else {
        source = "email_or_username_after_bad_id";
      }
    } else if (managerIdentifier) {
      source = "email_or_username";
      managerRow = db
        .prepare(`SELECT id FROM identity.exchange_managers WHERE lower(email) = ? OR lower(login_username) = ?`)
        .get(managerIdentifier, managerIdentifier);
      if (managerRow) id = Number(managerRow.id);
    }
    // If ID was sent but no longer valid, fallback to email/login when provided.
    if (!managerRow && managerIdentifier) {
      source = "email_or_username_fallback";
      const mByIdent = db
        .prepare(`SELECT id FROM identity.exchange_managers WHERE lower(email) = ? OR lower(login_username) = ?`)
        .get(managerIdentifier, managerIdentifier);
      if (mByIdent) {
        id = Number(mByIdent.id);
        managerRow = mByIdent;
      }
    }
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_manager_id" });
    if (!managerRow) {
      if (managerIdentifier) {
        return res.status(400).json({ error: "invalid_exchange_manager_identifier", hint: "ایمیل یا نام کاربری مدیر صرافی پیدا نشد" });
      }
      return res.status(400).json({ error: "invalid_exchange_manager_id" });
    }
    db.prepare(`UPDATE businesses SET exchange_manager_id = ? WHERE slug = ?`).run(id, slug);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "exchange_business_manager_linked",
      targetType: "business",
      targetId: slug,
      message: `Exchange manager #${id} linked to business ${slug} (${source})`,
    });
  }
  const row = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(slug);
  const manager =
    row?.exchange_manager_id != null
      ? db.prepare(`SELECT id, name, email, login_username FROM identity.exchange_managers WHERE id = ?`).get(row.exchange_manager_id)
      : null;
  res.json({ ...row, manager });
});

app.post("/api/admin/businesses/:slug/send-to-telegram-channel", requireSuperAdmin, async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  try {
    const result = await sendBusinessDirectoryPost(slug);
    if (result.error === "not_found") return res.status(404).json({ error: "not_found" });
    if (result.error === "bad_channel_id") {
      return res.status(503).json({
        error: "bad_channel_id",
        hint: "TELEGRAM_DIRECTORY_CHANNEL_ID را به‌صورت @channelname یا عدد -100… تنظیم کنید.",
      });
    }
    if (result.error === "not_configured") {
      return res.status(503).json({
        error: "not_configured",
        hint: "TELEGRAM_BOT_TOKEN، TELEGRAM_DIRECTORY_CHANNEL_ID و PUBLIC_SITE_URL را در سرور تنظیم کنید. ربات را در کانال ادمین کنید.",
      });
    }
    if (!result.ok) {
      writeSystemLog({
        ...actorFromAuth(req.auth),
        level: "warn",
        action: "telegram_channel_post_failed",
        targetType: "business",
        targetId: slug,
        message: `Telegram post failed for ${slug}`,
        meta: { description: result.description || null },
      });
      return res.status(502).json({
        error: "telegram_failed",
        hint: result.description || "ارسال ناموفق",
      });
    }
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "telegram_channel_post_sent",
      targetType: "business",
      targetId: slug,
      message: `Business posted to telegram channel: ${slug}`,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("send-to-telegram-channel", e);
    res.status(500).json({ error: "server_error" });
  }
});

app.get("/api/admin/categories", requireSuperAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, sort_order, is_active, created_at
       FROM business_categories
       ORDER BY sort_order ASC, name ASC`
    )
    .all();
  res.json(rows);
});

app.post("/api/admin/categories", requireSuperAdmin, (req, res) => {
  const name = String((req.body && req.body.name) || "").trim();
  if (!name) return res.status(400).json({ error: "missing_name" });
  const nextOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM business_categories`).get().n;
  try {
    const info = db
      .prepare(`INSERT INTO business_categories (name, sort_order, is_active) VALUES (?, ?, 1)`)
      .run(name, nextOrder);
    const row = db.prepare(`SELECT id, name, sort_order, is_active, created_at FROM business_categories WHERE id = ?`).get(info.lastInsertRowid);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "category_created",
      targetType: "category",
      targetId: row.id,
      message: `Category created: ${row.name}`,
    });
    res.status(201).json(row);
  } catch (e) {
    if (String(e.message || "").includes("UNIQUE")) return res.status(409).json({ error: "name_taken" });
    throw e;
  }
});

app.patch("/api/admin/categories/:id", requireSuperAdmin, (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const old = db.prepare(`SELECT id FROM business_categories WHERE id = ?`).get(id);
  if (!old) return res.status(404).json({ error: "not_found" });
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const updates = {};
  if ("name" in b) {
    const n = String(b.name || "").trim();
    if (!n) return res.status(400).json({ error: "bad_name" });
    updates.name = n;
  }
  if ("sort_order" in b) {
    const n = parseInt(String(b.sort_order), 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: "bad_sort_order" });
    updates.sort_order = n;
  }
  if ("is_active" in b) updates.is_active = b.is_active ? 1 : 0;
  const keys = Object.keys(updates);
  if (!keys.length) return res.status(400).json({ error: "no_fields" });
  const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE business_categories SET ${setClause} WHERE id = @id`).run({ ...updates, id });
  const row = db.prepare(`SELECT id, name, sort_order, is_active, created_at FROM business_categories WHERE id = ?`).get(id);
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "category_updated",
    targetType: "category",
    targetId: row.id,
    message: `Category updated: ${row.name}`,
    meta: { fields: keys },
  });
  res.json(row);
});

app.get("/api/admin/billing", requireSuperAdmin, (_req, res) => {
  const rows = db.prepare(`SELECT * FROM billing_records ORDER BY created_at DESC`).all();
  res.json(rows);
});

app.post("/api/admin/billing", requireSuperAdmin, (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const business_slug = String(b.business_slug || "").trim();
  const title = String(b.title || "").trim();
  if (!business_slug || !title) return res.status(400).json({ error: "missing_fields" });
  if (!db.prepare(`SELECT 1 FROM businesses WHERE slug = ?`).get(business_slug)) {
    return res.status(404).json({ error: "business_not_found" });
  }
  const info = db
    .prepare(
      `INSERT INTO billing_records (business_slug, title, amount, status, note) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      business_slug,
      title,
      String(b.amount ?? ""),
      String(b.status || "pending") || "pending",
      String(b.note ?? "")
    );
  const row = db.prepare(`SELECT * FROM billing_records WHERE id = ?`).get(info.lastInsertRowid);
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "billing_created",
    targetType: "business",
    targetId: business_slug,
    message: `Billing record created for ${business_slug}`,
    meta: { status: row.status, amount: row.amount || null },
  });
  res.status(201).json(row);
});

app.post("/api/site-chat", (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const message = String(b.message || "").trim();
  if (!message) return res.status(400).json({ error: "empty_message" });
  const name = String(b.name || b.visitor_name || "").trim() || null;
  const pathVal = String(b.path || "").trim() || null;
  const info = db
    .prepare(`INSERT INTO site_chat_messages (visitor_name, message, path) VALUES (?, ?, ?)`)
    .run(name, message, pathVal);
  const row = db.prepare(`SELECT * FROM site_chat_messages WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.get("/api/admin/site-chat", requireSuperAdmin, (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || "100"), 10) || 100));
  const rows = db
    .prepare(`SELECT * FROM site_chat_messages ORDER BY created_at DESC LIMIT ?`)
    .all(limit);
  res.json(rows);
});

app.get("/api/admin/system-logs", requireSuperAdmin, (req, res) => {
  const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit || "200"), 10) || 200));
  const level = String(req.query.level || "").trim().toLowerCase();
  const actor = String(req.query.actor_type || "").trim().toLowerCase();
  const levelOk = ["info", "warn", "error"].includes(level);
  const actorOk = ["system", "superadmin", "manager", "exchange_manager"].includes(actor);
  const where = [];
  const params = [];
  if (levelOk) {
    where.push("sl.level = ?");
    params.push(level);
  }
  if (actorOk) {
    where.push("sl.actor_type = ?");
    params.push(actor);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const q = `
    SELECT sl.*,
      COALESCE(sa.name, mg.name, xmg.name) AS actor_name
    FROM system_logs sl
    LEFT JOIN identity.super_admins sa
      ON sl.actor_type = 'superadmin'
      AND sl.actor_id IS NOT NULL AND TRIM(sl.actor_id) != ''
      AND sa.id = CAST(sl.actor_id AS INTEGER)
    LEFT JOIN identity.managers mg
      ON sl.actor_type = 'manager'
      AND sl.actor_id IS NOT NULL AND TRIM(sl.actor_id) != ''
      AND mg.id = CAST(sl.actor_id AS INTEGER)
    LEFT JOIN identity.exchange_managers xmg
      ON sl.actor_type = 'exchange_manager'
      AND sl.actor_id IS NOT NULL AND TRIM(sl.actor_id) != ''
      AND xmg.id = CAST(sl.actor_id AS INTEGER)
    ${whereSql}
    ORDER BY datetime(sl.created_at) DESC, sl.id DESC
    LIMIT ?
  `;
  const rows = db.prepare(q).all(...params, limit);
  res.json(rows);
});


function updateBusinessBySlug(req, res) {
  ensureRestaurantSafraDemo();
  const slug = decodeURIComponent(
    String((req.params && req.params.slug) || (req.body && req.body.slug) || "").trim()
  );
  if (!slug) {
    return res.status(400).json({ error: "missing_slug" });
  }
  const exists = db
    .prepare(`SELECT slug, manager_id, exchange_manager_id FROM businesses WHERE slug = ?`)
    .get(slug);
  if (!exists) {
    return res.status(404).json({ error: "not_found", slug, hint: "GET /api/businesses برای فهرست نامک‌ها" });
  }

  const auth = parseAuthHeader(req);
  if (!auth || (auth.typ !== "mgr" && auth.typ !== "mgrx" && auth.typ !== "adm")) {
    return res.status(401).json({
      error: "unauthorized",
      hint: "برای ذخیرهٔ آگهی ابتدا به‌عنوان مدیر یا سوپرادمین وارد شوید",
    });
  }
  if (auth.typ === "mgr") {
    if (exists.manager_id == null || Number(exists.manager_id) !== Number(auth.sub)) {
      return res.status(403).json({ error: "forbidden", hint: "این آگهی به حساب شما وصل نیست" });
    }
  }
  if (auth.typ === "mgrx") {
    if (exists.exchange_manager_id == null || Number(exists.exchange_manager_id) !== Number(auth.sub)) {
      return res.status(403).json({ error: "forbidden", hint: "این آگهی صرافی به حساب شما وصل نیست" });
    }
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const updates = {};

  for (const key of Object.keys(body)) {
    if (!PATCHABLE_BUSINESS.has(key)) continue;
    let val = body[key];
    if (val === undefined) continue;
    if (key === "claimed") {
      const v = val === true || val === 1 || val === "1" ? 1 : 0;
      updates[key] = v;
      continue;
    }
    if (key === "call_tracking_enabled") {
      const v = val === true || val === 1 || val === "1" ? 1 : 0;
      updates[key] = v;
      continue;
    }
    if (key === "exchange_company_verified") {
      const v = val === true || val === 1 || val === "1" ? 1 : 0;
      updates[key] = v;
      continue;
    }
    if (key === "exchange_today_rate_enabled") {
      const v = val === true || val === 1 || val === "1" ? 1 : 0;
      updates[key] = v;
      continue;
    }
    if (key === "package") {
      updates[key] = String(val);
      continue;
    }
    if (key === "manager_id") {
      if (val === null || val === "") {
        updates[key] = null;
      } else {
        const mid = parseInt(String(val), 10);
        if (!Number.isFinite(mid)) continue;
        const m = db.prepare(`SELECT id FROM identity.managers WHERE id = ?`).get(mid);
        if (!m) return res.status(400).json({ error: "invalid_manager_id" });
        updates[key] = mid;
      }
      continue;
    }
    if (key === "exchange_manager_id") {
      if (val === null || val === "") {
        updates[key] = null;
      } else {
        const mid = parseInt(String(val), 10);
        if (!Number.isFinite(mid)) continue;
        const m = db.prepare(`SELECT id FROM identity.exchange_managers WHERE id = ?`).get(mid);
        if (!m) return res.status(400).json({ error: "invalid_exchange_manager_id" });
        updates[key] = mid;
      }
      continue;
    }
    if (key === "rating") {
      if (val === null) {
        updates[key] = null;
        continue;
      }
      const n = typeof val === "number" ? val : parseFloat(String(val));
      if (!Number.isFinite(n)) continue;
      updates[key] = n;
      continue;
    }
    if (key === "listing_contact_email") {
      const e = val === null || val === "" ? null : String(val).trim().toLowerCase();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        return res.status(400).json({ error: "invalid_listing_contact_email", hint: "ایمیل نامعتبر است" });
      }
      updates[key] = e;
      continue;
    }
    if (
      key === "hours_json" ||
      key === "gallery_json" ||
      key === "biolink_json" ||
      key === "exchange_rates_json" ||
      key === "payment_methods_json" ||
      key === "exchange_features_json"
    ) {
      if (typeof val !== "string") {
        try {
          val = JSON.stringify(val);
        } catch {
          return res.status(400).json({ error: "invalid_json_field" });
        }
      }
      try {
        JSON.parse(val);
      } catch {
        return res.status(400).json({ error: "invalid_json_field" });
      }
    }
    if (typeof val === "string" || val === null) updates[key] = val === null ? null : String(val);
  }

  if (auth.typ === "mgr") {
    delete updates.manager_id;
    delete updates.exchange_manager_id;
    delete updates.claimed;
    delete updates.package;
    delete updates.exchange_company_verified;
    if (!isTwilioModuleEnabled()) {
      delete updates.call_tracking_enabled;
      delete updates.call_tracking_number;
      delete updates.call_forward_number;
    }
  }
  if (auth.typ === "mgrx") {
    delete updates.manager_id;
    delete updates.exchange_manager_id;
    delete updates.claimed;
    delete updates.package;
    delete updates.exchange_company_verified;
    delete updates.call_tracking_enabled;
    delete updates.call_tracking_number;
    delete updates.call_forward_number;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "no_fields" });
  }

  const keys = Object.keys(updates);
  const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
  const params = { ...updates, where_slug: slug };
  db.prepare(`UPDATE businesses SET ${setClause} WHERE slug = @where_slug`).run(params);
  writeSystemLog({
    ...actorFromAuth(auth),
    action: "business_profile_updated",
    targetType: "business",
    targetId: slug,
    message: `Business profile updated: ${slug}`,
    meta: { fields: keys },
  });
  const row = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(slug);
  res.json(row);
}

/** مسیر تخت — بدون بخش /slug/save که روی بعضی سرورها ۴۰۴ می‌شود */
app.post("/api/businesses/update", updateBusinessBySlug);

/** PUT / PATCH / POST — پشتیبان */
app.put("/api/businesses/:slug", updateBusinessBySlug);
app.patch("/api/businesses/:slug", updateBusinessBySlug);
app.post("/api/businesses/:slug/save", updateBusinessBySlug);

/** آمار تجمیعی برای داشبورد سوپرادمین */
app.get("/api/admin/stats", requireSuperAdmin, (_req, res) => {
  try {
    const total_businesses = db.prepare(`SELECT COUNT(*) AS c FROM businesses`).get().c;
    const active_businesses = db
      .prepare(
        `SELECT COUNT(*) AS c FROM businesses WHERE status IS NULL OR status = '' OR status = 'active'`
      )
      .get().c;
    const inactive_businesses = db
      .prepare(`SELECT COUNT(*) AS c FROM businesses WHERE status = 'inactive'`)
      .get().c;
    const featured_businesses = db
      .prepare(`SELECT COUNT(*) AS c FROM businesses WHERE package = 'featured'`)
      .get().c;
    const pending_listing_approvals = db
      .prepare(`SELECT COUNT(*) AS c FROM businesses WHERE listing_approval = 'pending'`)
      .get().c;
    const total_qr_scans = db.prepare(`SELECT COUNT(*) AS c FROM qr_scans`).get().c;
    const qr_scans_7d = db
      .prepare(`SELECT COUNT(*) AS c FROM qr_scans WHERE scanned_at >= datetime('now', '-7 days')`)
      .get().c;
    res.json({
      total_businesses,
      active_businesses,
      inactive_businesses,
      featured_businesses,
      pending_listing_approvals,
      total_qr_scans,
      qr_scans_7d,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "stats_failed" });
  }
});

app.get("/api/qr/stats/:bid", (req, res) => {
  const bid = sanitizeBid(req.params.bid);
  const key = "qr_" + bid.slice(0, 80);
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM qr_scans WHERE business_slug = ?`)
    .get(key);
  res.json({ count: row.c, bid: key });
});

/** تعداد کلیک روی شمارهٔ تماس در صفحهٔ عمومی آگهی */
app.get("/api/phone/stats/:slug", (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim()).toLowerCase();
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  const row = db.prepare(`SELECT COUNT(*) AS c FROM phone_clicks WHERE business_slug = ?`).get(slug);
  res.json({ count: row ? row.c : 0, slug });
});

app.post("/api/phone-click", (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const slug = String(b.slug || "")
    .trim()
    .toLowerCase();
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  const bizPhone = db.prepare(`SELECT slug, listing_approval, status FROM businesses WHERE slug = ?`).get(slug);
  if (!bizPhone || !isBusinessVisibleToPublic(bizPhone)) {
    return res.status(404).json({ error: "not_found" });
  }
  try {
    db.prepare(`INSERT INTO phone_clicks (business_slug) VALUES (?)`).run(slug);
  } catch (e) {
    console.error("phone_clicks insert", e);
  }
  res.status(201).json({ ok: true });
});

function normalizePhone(raw) {
  return String(raw || "").trim().replace(/\s+/g, "");
}

function twimlDial(to, slug) {
  const safeTo = String(to).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const callbackBase = process.env.PUBLIC_SITE_URL || "";
  const callbackUrl = callbackBase
    ? `${callbackBase.replace(/\/+$/, "")}/api/twilio/voice/status?slug=${encodeURIComponent(slug)}`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-GB">Please wait while we connect your call.</Say>
  <Dial callerId="${safeTo}" record="record-from-answer">
    <Number${callbackUrl ? ` statusCallback="${callbackUrl}" statusCallbackEvent="initiated ringing answered completed"` : ""}>${safeTo}</Number>
  </Dial>
</Response>`;
}

app.post("/api/twilio/voice/incoming", (req, res) => {
  if (!isTwilioModuleEnabled()) {
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`);
  }
  const toNumber = normalizePhone(req.body?.To);
  if (!toNumber) return res.status(400).send("missing to");
  const biz = db
    .prepare(
      `SELECT b.slug, b.call_forward_number, b.phone, b.call_tracking_enabled, b.call_tracking_number,
              m.twilio_phone_number
       FROM businesses b
       LEFT JOIN identity.managers m ON m.id = b.manager_id
       WHERE replace(ifnull(b.call_tracking_number, m.twilio_phone_number, ''), ' ', '') = ?
       LIMIT 1`
    )
    .get(toNumber);
  if (!biz || !biz.call_tracking_enabled) {
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`);
  }
  const forwardTo = normalizePhone(biz.call_forward_number || biz.phone);
  if (!forwardTo) {
    return res
      .type("text/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>No destination configured.</Say><Hangup/></Response>`);
  }
  res.type("text/xml").send(twimlDial(forwardTo, biz.slug));
});

app.post("/api/twilio/voice/status", (req, res) => {
  if (!isTwilioModuleEnabled()) {
    return res.json({ ok: true, skipped: true });
  }
  const slugQ = String(req.query.slug || "").trim().toLowerCase();
  const toNumber = normalizePhone(req.body?.To);
  const slugByTo = toNumber
    ? db
        .prepare(
          `SELECT b.slug
           FROM businesses b
           LEFT JOIN identity.managers m ON m.id = b.manager_id
           WHERE replace(ifnull(b.call_tracking_number, m.twilio_phone_number, ''), ' ', '') = ?
           LIMIT 1`
        )
        .get(toNumber)?.slug
    : null;
  const businessSlug = slugQ || slugByTo || null;
  const callSid = String(req.body?.CallSid || "").trim() || null;
  if (!callSid) return res.status(400).send("missing call sid");
  const durationRaw = parseInt(String(req.body?.CallDuration || ""), 10);
  const duration = Number.isFinite(durationRaw) ? durationRaw : null;
  const payload = {
    business_slug: businessSlug,
    call_sid: callSid,
    from_number: normalizePhone(req.body?.From) || null,
    to_number: toNumber || null,
    direction: String(req.body?.Direction || "").trim() || null,
    status: String(req.body?.CallStatus || "").trim() || null,
    duration_seconds: duration,
    recording_url: String(req.body?.RecordingUrl || "").trim() || null,
  };
  db.prepare(
    `INSERT INTO call_logs
      (business_slug, call_sid, from_number, to_number, direction, status, duration_seconds, recording_url)
     VALUES
      (@business_slug, @call_sid, @from_number, @to_number, @direction, @status, @duration_seconds, @recording_url)
     ON CONFLICT(call_sid) DO UPDATE SET
      business_slug=excluded.business_slug,
      from_number=excluded.from_number,
      to_number=excluded.to_number,
      direction=excluded.direction,
      status=excluded.status,
      duration_seconds=excluded.duration_seconds,
      recording_url=excluded.recording_url`
  ).run(payload);
  res.json({ ok: true });
});

app.get("/api/manager/call-logs", requireManager, (req, res) => {
  if (!isTwilioModuleEnabled()) {
    return res.status(403).json({ error: "twilio_module_disabled" });
  }
  const limit = Math.min(300, Math.max(1, parseInt(String(req.query.limit || "100"), 10) || 100));
  const rows = db
    .prepare(
      `SELECT c.*, b.name_fa AS business_name
       FROM call_logs c
       JOIN businesses b ON b.slug = c.business_slug
       WHERE b.manager_id = ?
       ORDER BY datetime(c.created_at) DESC, c.id DESC
       LIMIT ?`
    )
    .all(req.auth.sub, limit);
  res.json(rows);
});

app.get("/api/manager/linked-businesses", requireManager, (req, res) => {
  const managerColumn = req.auth.typ === "mgrx" ? "exchange_manager_id" : "manager_id";
  const categoryWhere =
    req.auth.typ === "mgrx"
      ? `AND IFNULL(TRIM(category), '') = 'صرافی'`
      : `AND IFNULL(TRIM(category), '') <> 'صرافی'`;
  const rows = db
    .prepare(
      `SELECT id, slug, name_fa, category, status, claimed, package, city
       FROM businesses
       WHERE ${managerColumn} = ?
       ${categoryWhere}
       ORDER BY CASE WHEN IFNULL(TRIM(category), '') = 'صرافی' THEN 0 ELSE 1 END, id DESC`
    )
    .all(req.auth.sub);
  res.json({ linked_businesses: rows });
});

app.get("/api/manager/twilio-settings", requireManager, (req, res) => {
  const m = db
    .prepare(
      `SELECT twilio_account_sid, twilio_auth_token, twilio_phone_number
       FROM identity.managers WHERE id = ?`
    )
    .get(req.auth.sub);
  if (!m) return res.status(404).json({ error: "not_found" });
  const masked =
    m.twilio_auth_token && String(m.twilio_auth_token).length > 4
      ? `••••${String(m.twilio_auth_token).slice(-4)}`
      : m.twilio_auth_token
      ? "••••"
      : null;
  res.json({
    module_enabled: isTwilioModuleEnabled(),
    twilio_account_sid: m.twilio_account_sid || "",
    twilio_phone_number: m.twilio_phone_number || "",
    twilio_auth_token_set: !!m.twilio_auth_token,
    twilio_auth_token_masked: masked,
  });
});

app.patch("/api/manager/twilio-settings", requireManager, (req, res) => {
  if (!isTwilioModuleEnabled()) {
    return res.status(403).json({ error: "twilio_module_disabled", hint: "Twilio module is off in super admin settings" });
  }
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const updates = {};
  if ("twilio_account_sid" in b) updates.twilio_account_sid = String(b.twilio_account_sid || "").trim() || null;
  if ("twilio_phone_number" in b) updates.twilio_phone_number = String(b.twilio_phone_number || "").trim() || null;
  if ("twilio_auth_token" in b) updates.twilio_auth_token = String(b.twilio_auth_token || "").trim() || null;
  const keys = Object.keys(updates);
  if (!keys.length) return res.status(400).json({ error: "no_fields" });
  const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE identity.managers SET ${setClause} WHERE id = @id`).run({ ...updates, id: req.auth.sub });
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "manager_twilio_settings_updated",
    targetType: "manager",
    targetId: req.auth.sub,
    message: "Manager updated Twilio settings",
    meta: { fields: keys.filter((k) => k !== "twilio_auth_token") },
  });
  const m = db
    .prepare(
      `SELECT twilio_account_sid, twilio_auth_token, twilio_phone_number
       FROM identity.managers WHERE id = ?`
    )
    .get(req.auth.sub);
  res.json({
    twilio_account_sid: m?.twilio_account_sid || "",
    twilio_phone_number: m?.twilio_phone_number || "",
    twilio_auth_token_set: !!m?.twilio_auth_token,
    twilio_auth_token_masked:
      m?.twilio_auth_token && String(m.twilio_auth_token).length > 4
        ? `••••${String(m.twilio_auth_token).slice(-4)}`
        : m?.twilio_auth_token
        ? "••••"
        : null,
  });
});

/** Google review redirect: increment SQLite then 302 */
app.get("/go", (req, res) => {
  const t = req.query.t;
  const bidRaw = req.query.bid || "default";
  const bid = sanitizeBid(bidRaw);
  const key = "qr_" + bid.slice(0, 80);
  const decoded = base64UrlToString(String(t || ""));
  const target = resolveReviewRedirectUrl(decoded, { loose: looseReviewRedirect });

  if (!target) {
    const hint = looseReviewRedirect
      ? "لینک https معتبر نیست."
      : "فقط لینک‌های Google Maps / نظر Google مجاز است، یا سرور را با ALLOW_ANY_REVIEW_REDIRECT=1 برای تست با هر آدرس https اجرا کنید.";
    return res.status(400).send(`<!DOCTYPE html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>خطا</title>
      <body style="font-family:Tahoma;padding:2rem;text-align:center"><p>${hint}</p></body></html>`);
  }

  try {
    db.prepare(`INSERT INTO qr_scans (business_slug) VALUES (?)`).run(key);
  } catch (e) {
    console.error("qr_scans insert", e);
  }

  res.redirect(302, target);
});

const clientDist = path.join(__dirname, "..", "..", "client", "dist");

function mountProdStatic() {
  if (!fs.existsSync(clientDist)) {
    console.warn("client/dist not found — run: npm run build --prefix client");
    return;
  }
  const staticMw = express.static(clientDist, { index: false });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/go") return next();
    return staticMw(req, res, next);
  });
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/go") return next();
    const indexHtml = path.join(clientDist, "index.html");
    if (fs.existsSync(indexHtml)) res.sendFile(indexHtml);
    else next();
  });
}

async function main() {
  if (isProd) {
    mountProdStatic();
  } else {
    const { attachViteMiddleware } = await import("./dev-vite.js");
    await attachViteMiddleware(app);
    console.log("Vite middleware (SPA dev) enabled");
  }

  app.use((err, _req, res, _next) => {
    console.error(err);
    writeSystemLog({
      level: "error",
      actorType: "system",
      action: "server_error",
      message: err?.message || "Unhandled server error",
      meta: { stack: err?.stack ? String(err.stack).slice(0, 2000) : null },
    });
    res.status(500).json({ error: "server_error" });
  });

  app.listen(PORT, () => {
    const mode = isProd ? "production" : "development";
    console.log(`Iraniu ${mode} — http://127.0.0.1:${PORT} (site + /api + /go on one port)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
