import "./env.js";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dbGet, dbAll, dbRun, dbTransaction, ensureRestaurantSafraDemo, bootstrapDb } from "./db.js";
import { base64UrlToString, resolveReviewRedirectUrl, sanitizeBid } from "./lib/redirect.js";
import { parseAuthHeader, stripManagerRow, hashPassword, validatePasswordComplexity } from "./authUtil.js";
import { requireSuperAdmin, requireManager, requireManagerOrSuperAdmin } from "./authMiddleware.js";
import { registerAuthRoutes, ensureSuperAdminFromEnv } from "./authRoutes.js";
import { sendBusinessDirectoryPost } from "./telegramBusinessChannel.js";
import { actorFromAuth, writeSystemLog } from "./systemLog.js";
import { isTwilioModuleEnabled } from "./twilioModuleSettings.js";
import { isCareersModuleEnabled, setCareersModuleEnabled } from "./careersModuleSettings.js";
import { isDesktopGateEnabled } from "./desktopGateSettings.js";
import { sendListingApprovedEmail, sendListingRejectedEmail } from "./listingDecisionEmail.js";
import {
  htmlBusinessRegistrationReceivedFa,
  htmlBusinessActivatedFa,
  htmlClaimReceivedFa,
  htmlClaimVerifiedFa,
  htmlAdminAddedBusinessWelcomeFa,
} from "./emailBranding.js";
import { getEffectiveSmtpSettings, sendMailViaSettings } from "./smtpSettings.js";
import { notifyAdminsNewPendingListing } from "./pendingListingNotify.js";
import { verifyTurnstileToken } from "./turnstileVerify.js";
import { clientIp } from "./telegramNotify.js";
import { createSignupVerification } from "./businessSignupVerification.js";
import multer from "multer";
import { parseBusinessCsv, runBulkInsert } from "./businessBulkImport.js";
import { exportIraniuBusinessesCsv } from "./exportBusinessesCsv.js";
import { cascadeDeleteBusinessBySlug } from "./cascadeDeleteBusiness.js";
import { analyzeDuplicateNames, executeDedupeByName } from "./dedupeBusinessesByName.js";
import { chatbotRouter } from "./chatbotApi.js";
import { aiSearchRouter } from "./aiSearchRoutes.js";
import { uploadToS3, deleteFromS3, extractS3KeyFromUrl, generateExchangeBannerKey, getStorageMode, isS3Enabled } from "./s3Upload.js";
import { getWalletWithTransactions, grantTokens, spendTokensForBoost, checkAndAwardMilestones, checkWeeklyEditBonus, BOOST_PLANS } from "./tokenWallet.js";
import { getExternalPosts, normalizeExternalPost } from "./newsApi.js";

const PATCHABLE_BUSINESS = new Set([
  "name_fa",
  "name_en",
  "description",
  "category",
  "phone",
  "address",
  "postcode",
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
  "logo_url",
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

const uploadBusinessImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

/** Wrap an async Express handler so rejected promises reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

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
app.use("/uploads", express.static(uploadsDir, {
  maxAge: "7d",
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "public, max-age=604800");
  },
}));

registerAuthRoutes(app);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/storage-status", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const mode = await getStorageMode();
  const { getEffectiveS3Config } = await import("./s3Settings.js");
  const s3Config = await getEffectiveS3Config();
  const config = {
    mode,
    bucket: mode === "s3" ? s3Config.bucket : null,
    region: mode === "s3" ? s3Config.region : null,
  };
  res.json(config);
}));

/** عمومی — برای مخفی کردن منوی Twilio در پنل مدیر */
app.get("/api/twilio-module-status", (_req, res) => {
  res.json({ enabled: isTwilioModuleEnabled() });
});

/** عمومی — برای مخفی کردن فیلدهای Job Vacancies در پنل مدیر */
app.get("/api/careers-module-status", asyncHandler(async (_req, res) => {
  const enabled = await isCareersModuleEnabled();
  res.json({ enabled });
}));

/** عمومی — کنترل حالت «فقط موبایل/تبلت» (Desktop Gate) */
app.get("/api/desktop-gate-status", asyncHandler(async (_req, res) => {
  const enabled = await isDesktopGateEnabled();
  res.json({ enabled });
}));

function isListingApproved(row) {
  const a = row && row.listing_approval;
  if (a === "approved" || a == null || a === "") return true;
  if (a === "pending") {
    const cat = String(row?.category || "").trim().toLowerCase();
    return (
      row?.exchange_manager_id != null ||
      cat.includes("صراف") ||
      cat.includes("exchange")
    );
  }
  return false;
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

function parseExchangeBannerImageSource(v) {
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

app.use("/api/ai-search", aiSearchRouter);

app.get("/api/businesses", asyncHandler(async (req, res) => {
  const auth = parseAuthHeader(req);
  const isAdmin = auth && auth.typ === "adm";
  const boostOrder = `CASE COALESCE(boost.plan_id, '')
    WHEN 'diamond'  THEN 1
    WHEN 'platinum' THEN 2
    WHEN 'gold'     THEN 3
    WHEN 'silver'   THEN 4
    ELSE 5
  END`;
  const boostJoin = `LEFT JOIN LATERAL (
    SELECT plan_id, ends_at
    FROM ad_boosts
    WHERE business_slug = b.slug
      AND is_active = 1
      AND ends_at > NOW()::TEXT
    ORDER BY ends_at DESC
    LIMIT 1
  ) boost ON TRUE`;
  const rows = isAdmin
    ? await dbAll(`SELECT b.*, boost.plan_id AS active_boost_plan, boost.ends_at AS boost_ends_at
        FROM businesses b ${boostJoin}
        ORDER BY ${boostOrder}, b.name_fa`)
    : await dbAll(
        `SELECT b.*, boost.plan_id AS active_boost_plan, boost.ends_at AS boost_ends_at
         FROM businesses b ${boostJoin}
         WHERE (
             b.listing_approval = 'approved'
             OR b.listing_approval IS NULL
             OR b.listing_approval = ''
             OR (
               b.listing_approval = 'pending'
               AND (
                 b.exchange_manager_id IS NOT NULL
                 OR COALESCE(b.category, '') LIKE '%صراف%'
                 OR lower(COALESCE(b.category, '')) LIKE '%exchange%'
               )
             )
           )
           AND (b.status IS NULL OR b.status = '' OR b.status = 'active')
           ORDER BY ${boostOrder}, b.name_fa`
      );
  res.json(rows);
}));

/** بنرهای تبلیغی صرافی — عمومی */
app.get("/api/exchange-banners", asyncHandler(async (_req, res) => {
  const rows = await dbAll(
    `SELECT id, title, image_url, link_url, placement, sort_order, daily_user_cap
       FROM exchange_banners
       WHERE is_active = 1 AND page_scope = 'exchange'
         AND (start_at IS NULL OR trim(start_at) = '' OR start_at <= NOW()::TEXT)
         AND (end_at IS NULL OR trim(end_at) = '' OR end_at >= NOW()::TEXT)
       ORDER BY (placement = 'top') DESC, sort_order ASC, id DESC`
  );
  res.json(rows);
}));

/** بنرهای تبلیغی دایرکتوری — عمومی */
app.get("/api/directory-banners", asyncHandler(async (_req, res) => {
  const rows = await dbAll(
    `SELECT id, title, image_url, link_url, placement, sort_order, daily_user_cap
       FROM exchange_banners
       WHERE is_active = 1 AND page_scope = 'directory'
         AND (start_at IS NULL OR trim(start_at) = '' OR start_at <= NOW()::TEXT)
         AND (end_at IS NULL OR trim(end_at) = '' OR end_at >= NOW()::TEXT)
       ORDER BY (placement = 'top') DESC, sort_order ASC, id DESC`
  );
  res.json(rows);
}));

/** ثبت کلیک بنر تبلیغاتی (عمومی) */
app.post("/api/banner-clicks", asyncHandler(async (req, res) => {
  try {
    const bannerId = Number.parseInt(String(req.body?.banner_id || "0"), 10);
    if (!Number.isFinite(bannerId) || bannerId <= 0) {
      return res.status(400).json({ error: "bad_banner_id" });
    }
    const row = await dbGet(`SELECT id, page_scope FROM exchange_banners WHERE id = $1`, [bannerId]);
    if (!row) return res.status(404).json({ error: "not_found" });
    const scope = row.page_scope === "directory" ? "directory" : "exchange";
    await dbRun(`INSERT INTO exchange_banner_clicks (banner_id, page_scope) VALUES ($1, $2)`, [bannerId, scope]);
    return res.json({ ok: true });
  } catch (e) {
    console.error("banner-clicks create", e);
    return res.status(500).json({ error: "click_log_failed", hint: String(e.message || e) });
  }
}));

/** بنرهای تبلیغی صرافی — ادمین */
app.get("/api/admin/exchange-banners", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await dbAll(
    `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
              COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
       FROM exchange_banners
       ORDER BY sort_order ASC, id DESC`
  );
  res.json(rows);
}));

app.post("/api/admin/exchange-banners", requireSuperAdmin, (req, res) => {
  uploadExchangeBanner.single("image")(req, res, async (err) => {
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
      let imageUrl = "";
      if (req.file?.buffer?.length) {
        // Upload to S3 if configured, otherwise use local storage
        if (await isS3Enabled()) {
          const key = generateExchangeBannerKey(req.file.originalname);
          const result = await uploadToS3(req.file.buffer, key, req.file.mimetype);
          imageUrl = result.url;
        } else {
          const ext = path.extname(String(req.file.originalname || "")).toLowerCase() || ".jpg";
          const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
          const filename = `exchange-banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
          const absPath = path.join(exchangeBannerDir, filename);
          fs.writeFileSync(absPath, req.file.buffer);
          imageUrl = `/uploads/exchange-banners/${filename}`;
        }
      } else {
        imageUrl = parseExchangeBannerImageSource(req.body?.image_url);
      }
      if (!imageUrl) {
        return res.status(400).json({ error: "missing_image_source", hint: "فایل تصویر یا لینک تصویر لازم است." });
      }
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
      const info = await dbRun(
        `INSERT INTO exchange_banners (title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [title, imageUrl, linkUrl, pageScope, placement, dailyUserCap, startAt, endAt, sortOrder, isActive]
      );
      const newId = info.rows[0].id;
      const row = await dbGet(
        `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
                  COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
           FROM exchange_banners WHERE id = $1`,
        [newId]
      );
      writeSystemLog({
        ...actorFromAuth(req.auth),
        action: "exchange_banner_created",
        targetType: "exchange_banner",
        targetId: String(newId),
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
  uploadExchangeBanner.single("image")(req, res, async (err) => {
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
      const prev = await dbGet(`SELECT id, image_url FROM exchange_banners WHERE id = $1`, [id]);
      if (!prev) return res.status(404).json({ error: "not_found" });
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: "missing_file", hint: "فایل تصویر لازم است." });
      }

      let imageUrl;
      if (await isS3Enabled()) {
        const key = generateExchangeBannerKey(req.file.originalname);
        const result = await uploadToS3(req.file.buffer, key, req.file.mimetype);
        imageUrl = result.url;
      } else {
        const ext = path.extname(String(req.file.originalname || "")).toLowerCase() || ".jpg";
        const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
        const filename = `exchange-banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
        const absPath = path.join(exchangeBannerDir, filename);
        fs.writeFileSync(absPath, req.file.buffer);
        imageUrl = `/uploads/exchange-banners/${filename}`;
      }

      await dbRun(`UPDATE exchange_banners SET image_url = $1 WHERE id = $2`, [imageUrl, id]);

      // Delete old image
      const prevUrl = String(prev.image_url || "");
      if (await isS3Enabled()) {
        const s3Key = await extractS3KeyFromUrl(prevUrl);
        if (s3Key) await deleteFromS3(s3Key);
      } else if (prevUrl.startsWith("/uploads/exchange-banners/")) {
        const prevAbs = path.join(uploadsDir, prevUrl.replace(/^\/uploads\//, ""));
        try {
          if (fs.existsSync(prevAbs)) fs.unlinkSync(prevAbs);
        } catch {}
      }

      const row = await dbGet(
        `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
                  COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
           FROM exchange_banners WHERE id = $1`,
        [id]
      );
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

app.patch("/api/admin/exchange-banners/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.id || "0"), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "bad_id" });
    }
    const prev = await dbGet(`SELECT * FROM exchange_banners WHERE id = $1`, [id]);
    if (!prev) return res.status(404).json({ error: "not_found" });
    const nextImage =
      req.body?.image_url == null ? String(prev.image_url || "") : parseExchangeBannerImageSource(req.body.image_url);
    if (!nextImage) {
      return res.status(400).json({ error: "missing_image_source", hint: "لینک تصویر معتبر لازم است." });
    }
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
    await dbRun(
      `UPDATE exchange_banners
       SET title = $1, image_url = $2, link_url = $3, page_scope = $4, placement = $5, daily_user_cap = $6, start_at = $7, end_at = $8, sort_order = $9, is_active = $10
       WHERE id = $11`,
      [nextTitle, nextImage, nextLink, nextScope, nextPlacement, nextDailyCap, nextStart, nextEnd, nextSort, nextActive, id]
    );
    const row = await dbGet(
      `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
                COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
         FROM exchange_banners WHERE id = $1`,
      [id]
    );
    res.json(row);
  } catch (e) {
    console.error("admin exchange-banners patch", e);
    res.status(500).json({ error: "update_failed", hint: String(e.message || e) });
  }
}));

app.post("/api/admin/exchange-banners/reorder", requireSuperAdmin, asyncHandler(async (req, res) => {
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
    await dbTransaction(async (client) => {
      for (const r of cleaned) {
        await client.query(`UPDATE exchange_banners SET sort_order = $1 WHERE id = $2`, [r.sort_order, r.id]);
      }
    });
    const rows = await dbAll(
      `SELECT id, title, image_url, link_url, page_scope, placement, daily_user_cap, start_at, end_at, sort_order, is_active, created_at,
                COALESCE((SELECT COUNT(*) FROM exchange_banner_clicks c WHERE c.banner_id = exchange_banners.id), 0) AS clicks_count
         FROM exchange_banners
         ORDER BY sort_order ASC, id DESC`
    );
    res.json({ ok: true, items: rows });
  } catch (e) {
    console.error("admin exchange-banners reorder", e);
    res.status(500).json({ error: "reorder_failed", hint: String(e.message || e) });
  }
}));

app.delete("/api/admin/exchange-banners/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.id || "0"), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "bad_id" });
    }
    const row = await dbGet(`SELECT id, image_url FROM exchange_banners WHERE id = $1`, [id]);
    if (!row) return res.status(404).json({ error: "not_found" });
    await dbRun(`DELETE FROM exchange_banners WHERE id = $1`, [id]);

    // Delete image from storage
    const imageUrl = String(row.image_url || "");
    if (await isS3Enabled()) {
      const s3Key = await extractS3KeyFromUrl(imageUrl);
      if (s3Key) await deleteFromS3(s3Key);
    } else if (imageUrl.startsWith("/uploads/exchange-banners/")) {
      const abs = path.join(uploadsDir, imageUrl.replace(/^\/uploads\//, ""));
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
}));

// ─── Blog admin routes ────────────────────────────────────────────────────────

app.get("/api/admin/blog", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await dbAll(`SELECT id, slug, title_fa, excerpt_fa, cover_image_url, category, is_published, view_count, published_at, created_at FROM blog_posts ORDER BY created_at DESC`);
  res.json(rows);
}));

app.post("/api/admin/blog", requireSuperAdmin, asyncHandler(async (req, res) => {
  const { slug, title_fa, excerpt_fa, body_fa, cover_image_url, author, category, tags, is_published, published_at } = req.body;
  if (!slug || !title_fa) return res.status(400).json({ error: "slug and title_fa required" });
  const row = await dbGet(
    `INSERT INTO blog_posts (slug, title_fa, excerpt_fa, body_fa, cover_image_url, author, category, tags, is_published, published_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [slug, title_fa, excerpt_fa||"", body_fa||"", cover_image_url||"", author||"تیم ایرانیو", category||"عمومی", tags||"", is_published===false?0:1, published_at||new Date().toISOString()]
  );
  res.json(row);
}));

app.patch("/api/admin/blog/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
  const { title_fa, excerpt_fa, body_fa, cover_image_url, author, category, tags, is_published, published_at } = req.body;
  const row = await dbGet(
    `UPDATE blog_posts SET title_fa=$1, excerpt_fa=$2, body_fa=$3, cover_image_url=$4, author=$5, category=$6, tags=$7, is_published=$8, published_at=$9, updated_at=NOW()::TEXT WHERE id=$10 RETURNING *`,
    [title_fa, excerpt_fa||"", body_fa||"", cover_image_url||"", author||"تیم ایرانیو", category||"عمومی", tags||"", is_published===false?0:1, published_at, Number(req.params.id)]
  );
  if (!row) return res.status(404).json({ error: "not_found" });
  res.json(row);
}));

app.delete("/api/admin/blog/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
  await dbRun(`DELETE FROM blog_posts WHERE id = $1`, [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ─── Blog source settings ────────────────────────────────────────────────────

app.get("/api/admin/blog-settings", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const row = await dbGet(`SELECT value FROM app_meta WHERE key = 'blog_source'`);
  res.json({ blog_source: row?.value || "both" });
}));

app.post("/api/admin/blog-settings", requireSuperAdmin, asyncHandler(async (req, res) => {
  const source = String(req.body.blog_source || "both");
  if (!["local", "external", "both"].includes(source)) {
    return res.status(400).json({ error: "invalid value" });
  }
  await dbRun(
    `INSERT INTO app_meta (key, value) VALUES ('blog_source', $1) ON CONFLICT (key) DO UPDATE SET value = $1`,
    [source]
  );
  res.json({ ok: true, blog_source: source });
}));

// ─── TfL proxy ───────────────────────────────────────────────────────────────
const TFL_BASE = "https://api.tfl.gov.uk";
const TFL_KEY = (process.env.TFL_APP_KEY || "").trim();
function tflParams(extra = {}) {
  const p = new URLSearchParams(extra);
  if (TFL_KEY) p.set("app_key", TFL_KEY);
  return p.toString() ? `?${p}` : "";
}
async function tflFetch(path) {
  const r = await fetch(`${TFL_BASE}${path}`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`TfL ${r.status}`);
  return r.json();
}

app.get("/api/tfl/status", asyncHandler(async (_req, res) => {
  const data = await tflFetch(`/line/mode/tube,dlr,overground,elizabeth-line/status${tflParams()}`);
  const lines = data.map((l) => ({
    id: l.id,
    name: l.name,
    status: l.lineStatuses?.[0]?.statusSeverityDescription || "Unknown",
    severity: l.lineStatuses?.[0]?.statusSeverity ?? 10,
    reason: l.lineStatuses?.[0]?.reason || null,
  }));
  res.json(lines);
}));

app.get("/api/tfl/journey", asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to required" });
  const extra = { nationalSearch: "false" };
  if (TFL_KEY) extra.app_key = TFL_KEY;
  const p = new URLSearchParams(extra);
  const data = await tflFetch(`/journey/journeyresults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}?${p}`);
  res.json(data);
}));

app.get("/api/tfl/stop-search", asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });
  const p = new URLSearchParams({ query: q, ...(TFL_KEY && { app_key: TFL_KEY }) });
  const data = await tflFetch(`/stoppoint/search?${p}`);
  res.json(data);
}));

// ─── Public blog categories ──────────────────────────────────────────────────
app.get("/api/blog-categories", asyncHandler(async (req, res) => {
  const source = await getBlogSource();
  const cats = new Set();
  if (source === "local" || source === "both") {
    const rows = await dbAll(`SELECT DISTINCT category FROM blog_posts WHERE is_published = 1 AND category IS NOT NULL`);
    rows.forEach((r) => r.category && cats.add(r.category));
  }
  if (source === "external" || source === "both") {
    try {
      const { posts } = await getExternalPosts({ limit: 100, offset: 0 });
      posts.forEach((p) => {
        const cat = p.category?.category_name || p.sub_category?.subcategory_name;
        if (cat) cats.add(cat);
      });
    } catch (e) {
      console.error("[blog-categories] CyberCina error:", e.message);
    }
  }
  res.json({ categories: [...cats].sort() });
}));

// ─── External blog preview (admin only) ──────────────────────────────────────

app.get("/api/admin/external-blog-preview", requireSuperAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(20, parseInt(req.query.limit) || 9);
  const offset = Math.max(0, parseInt(req.query.offset) || 0);
  try {
    const { total, posts } = await getExternalPosts({ limit, offset });
    res.json({ total, posts: posts.map(normalizeExternalPost) });
  } catch (e) {
    res.status(502).json({ error: "external_api_error", message: e.message });
  }
}));

/** Upload business image (cover or gallery) */
app.post("/api/upload/business-image", (req, res) => {
  uploadBusinessImage.single("image")(req, res, async (err) => {
    if (err) {
      if (String(err.message || "").includes("bad_file_type")) {
        return res.status(400).json({ error: "bad_file_type", hint: "فقط تصویر png/jpg/webp/gif مجاز است." });
      }
      if (String(err.message || "").toLowerCase().includes("file too large")) {
        return res.status(400).json({ error: "file_too_large", hint: "حداکثر حجم تصویر ۱۰ مگابایت است." });
      }
      return res.status(400).json({ error: "upload_failed", hint: String(err.message || err) });
    }

    const auth = parseAuthHeader(req);
    if (!auth || (auth.typ !== "mgr" && auth.typ !== "mgrx" && auth.typ !== "adm")) {
      return res.status(401).json({ error: "unauthorized", hint: "Login required" });
    }

    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: "missing_file", hint: "فایل تصویر لازم است" });
    }

    try {
      let imageUrl;
      const businessImagesDir = path.join(uploadsDir, "business-images");
      if (!fs.existsSync(businessImagesDir)) fs.mkdirSync(businessImagesDir, { recursive: true });

      if (await isS3Enabled()) {
        const ext = path.extname(String(req.file.originalname || "")).toLowerCase() || ".jpg";
        const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 8);
        const key = `business-images/business-${timestamp}-${random}${safeExt}`;
        const result = await uploadToS3(req.file.buffer, key, req.file.mimetype);
        imageUrl = result.url;
      } else {
        const ext = path.extname(String(req.file.originalname || "")).toLowerCase() || ".jpg";
        const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
        const filename = `business-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
        const absPath = path.join(businessImagesDir, filename);
        fs.writeFileSync(absPath, req.file.buffer);
        imageUrl = `/uploads/business-images/${filename}`;
      }

      res.json({ ok: true, url: imageUrl });
    } catch (error) {
      console.error("business image upload", error);
      res.status(500).json({ error: "upload_failed", hint: String(error.message || error) });
    }
  });
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
app.get("/api/admin/businesses-search", requireSuperAdmin, asyncHandler(async (req, res) => {
  const raw = String(req.query.q || "").trim();
  let page = parseInt(String(req.query.page || "1"), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  let limit = parseInt(String(req.query.limit || String(ADMIN_BUSINESSES_PAGE_SIZE_DEFAULT)), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = ADMIN_BUSINESSES_PAGE_SIZE_DEFAULT;
  limit = Math.min(ADMIN_BUSINESSES_PAGE_SIZE_MAX, limit);

  const all = await dbAll(
    `SELECT * FROM businesses ORDER BY CASE WHEN listing_approval = 'pending' THEN 0 ELSE 1 END, name_fa`
  );
  const tokens = raw ? raw.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const filtered = tokens.length ? all.filter((row) => adminBusinessMatchesSearchTokens(row, tokens)) : all;
  const total = filtered.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  if (page > totalPages) page = totalPages;
  const offset = (page - 1) * limit;
  const items = filtered.slice(offset, offset + limit);
  res.json({ items, total, page, pageSize: limit, totalPages });
}));

/** حذف دسته‌ای آگهی — فقط سوپرادمین؛ حداکثر ADMIN_BULK_DELETE_MAX نامک */
app.post("/api/admin/businesses/bulk-delete", requireSuperAdmin, asyncHandler(async (req, res) => {
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
        const r = await cascadeDeleteBusinessBySlug(slug);
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
}));

/** پیش‌نمایش آگهی‌های با نام تکراری (پس از یکسان‌سازی فاصله و حروف لاتین) */
app.get("/api/admin/businesses/duplicate-names", requireSuperAdmin, asyncHandler(async (_req, res) => {
  try {
    const { groups, total_remove } = await analyzeDuplicateNames();
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
}));

/**
 * حذف آگهی‌های تکراری با همان نام؛ نسخه با id کم‌تر (قدیمی‌تر) نگه داشته می‌شود.
 * وابستگی‌ها با cascadeDeleteBusinessBySlug پاک می‌شوند.
 */
app.post("/api/admin/businesses/dedupe-by-name", requireSuperAdmin, asyncHandler(async (req, res) => {
  try {
    const maxRemovals = Math.min(
      50000,
      Math.max(1, Number(req.body?.max_removals) || 5000)
    );
    const result = await executeDedupeByName({ maxRemovals });
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
}));

app.get("/api/categories", asyncHandler(async (_req, res) => {
  const rows = await dbAll(
    `SELECT id, name, sort_order, is_active
       FROM business_categories
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`
  );
  res.json(rows);
}));

app.get("/api/cities", asyncHandler(async (_req, res) => {
  const rows = await dbAll(
    `SELECT DISTINCT city
       FROM businesses
       WHERE city IS NOT NULL AND city != ''
       ORDER BY city ASC`
  );
  res.json(rows.map(r => r.city));
}));

app.get("/api/businesses/:slug", asyncHandler(async (req, res) => {
  const row = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [req.params.slug]);
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
  const twilioOn = await isTwilioModuleEnabled();
  const isAuthed = auth && (auth.typ === "adm" || auth.typ === "mgr" || auth.typ === "mgrx");
  const { listing_contact_email: _hidden, ...publicRow } = row;
  const hasEmail = !!String(row.listing_contact_email || "").trim();
  res.json({ ...(isAuthed ? row : publicRow), has_email: hasEmail, twilio_module_enabled: twilioOn });
}));

app.get("/api/businesses/:slug/reveal-email", asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  const row = await dbGet(`SELECT listing_contact_email, listing_approval, status FROM businesses WHERE slug = $1`, [slug]);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (!isBusinessVisibleToPublic(row)) return res.status(404).json({ error: "not_found" });
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin.includes("iraniu.uk") && !origin.includes("localhost")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const email = String(row.listing_contact_email || "").trim();
  if (!email) return res.status(404).json({ error: "no_email" });
  res.json({ ok: true, e: Buffer.from(email).toString("base64") });
}));

app.get("/api/business-report-reasons", (_req, res) => {
  res.json({ reasons: BUSINESS_REPORT_REASONS });
});

app.post("/api/businesses/:slug/report", asyncHandler(async (req, res) => {
  const business_slug = String(req.params.slug || "").trim();
  const biz = await dbGet(`SELECT slug, listing_approval, status FROM businesses WHERE slug = $1`, [business_slug]);
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
  const info = await dbRun(
    `INSERT INTO business_reports (business_slug, reason_key, details, reporter_email) VALUES ($1, $2, $3, $4) RETURNING id`,
    [business_slug, reason_key, details || null, reporter_email]
  );
  const row = await dbGet(`SELECT * FROM business_reports WHERE id = $1`, [info.rows[0].id]);
  res.status(201).json(row);
}));

function generateTempPassword() {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const special = "!@#$%&";
  const all = lower + upper + digits + special;
  const base = [
    lower[Math.floor(Math.random() * lower.length)],
    lower[Math.floor(Math.random() * lower.length)],
    upper[Math.floor(Math.random() * upper.length)],
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 0; i < 6; i++) base.push(all[Math.floor(Math.random() * all.length)]);
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}

async function generateUsernameFromEmail(email) {
  const base =
    String(email || "")
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 24) || "user";
  const validBase = base.length >= 3 ? base : `${base}usr`;
  let username = validBase;
  let i = 2;
  while (true) {
    const taken =
      (await dbGet(`SELECT 1 FROM identity.managers WHERE login_username = $1`, [username])) ||
      (await dbGet(`SELECT 1 FROM identity.exchange_managers WHERE login_username = $1`, [username]));
    if (!taken) break;
    username = `${validBase}_${i++}`;
    if (i > 999) { username = `user_${Date.now().toString(36).slice(-6)}`; break; }
  }
  return username;
}

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

app.post("/api/businesses", asyncHandler(async (req, res) => {
  await ensureRestaurantSafraDemo();
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const slug = String(b.slug || "")
    .trim()
    .toLowerCase();
  const name_fa = String(b.name_fa || "").trim();
  if (!slug || !name_fa) return res.status(400).json({ error: "missing_slug_or_name" });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return res.status(400).json({ error: "invalid_slug", hint: "فقط حروف انگلیسی، اعداد و خط تیره" });
  }
  if (await dbGet(`SELECT 1 FROM businesses WHERE slug = $1`, [slug])) {
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

  if (!(auth && auth.typ === "adm")) {
    const captchaValid = await verifyTurnstileToken(b.captcha_token, clientIp(req));
    if (!captchaValid) {
      return res.status(400).json({ error: "captcha_failed", hint: "تأیید امنیتی ناموفق بود" });
    }
  }

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
  const cta = String(b.cta ?? "").trim() || "تماس با ما";
  const price_range = String(b.price_range ?? "").trim();
  if (!city || !phone || !address || !category || !listing_title || !description || !google_review_url) {
    return res.status(400).json({
      error: "missing_business_fields",
      hint: "شهر، تلفن، آدرس، دسته، عنوان، توضیحات و لینک Google الزامی است",
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

  const postcode = String(b.postcode ?? "").trim();

  await dbRun(
    `INSERT INTO businesses (
      slug, name_fa, name_en, description, category, phone, address, postcode, google_review_url, claimed, package,
      subtitle, hours_json, promo_title, promo_description, cover_image_url, gallery_json,
      listing_title, city, price_range, rating, cta, status, manager_id, biolink_json, listing_approval,
      listing_terms_accepted_at, listing_terms_version, listing_contact_email
    ) VALUES (
      $1, $2, $26, $3, $4, $5, $6, $7, $8, 0, 'basic',
      $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20, NULL, $21, $22,
      $23, $24, $25
    )`,
    [
      slug,
      name_fa,
      description,
      category,
      phone,
      address,
      postcode,
      google_review_url,
      String(b.subtitle ?? ""),
      hours_json,
      String(b.promo_title ?? ""),
      String(b.promo_description ?? ""),
      String(b.cover_image_url ?? ""),
      gallery_json,
      listing_title,
      city,
      price_range,
      rating,
      cta,
      String(b.status || "active") || "active",
      biolink_json,
      listing_approval,
      listing_terms_accepted_at,
      listing_terms_version,
      listing_contact_email,
      String(b.name_en ?? ""),
    ]
  );

  const row = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]);
  if (listing_approval === "pending") {
    try {
      await notifyAdminsNewPendingListing(row);
    } catch (e) {
      console.error("[email] pending listing notify", e);
    }
    // Send "registration received" confirmation email to the applicant
    if (listing_contact_email) {
      try {
        const html = await htmlBusinessRegistrationReceivedFa({ nameFa: name_fa });
        await sendMailViaSettings({
          to: listing_contact_email,
          subject: "درخواست ثبت کسب‌وکار شما در IraniU دریافت شد",
          html,
          text: `درخواست ثبت کسب‌وکار "${name_fa}" دریافت شد. پس از تأیید از طریق ایمیل یا تماس با شما ارتباط خواهیم گرفت.`,
        });
      } catch (e) {
        console.error("[email] business registration received", e);
      }
    }
  }
  if (!(auth && auth.typ === "adm")) {
    try {
      await createSignupVerification(row);
    } catch (e) {
      console.error("[email] signup verification", e);
    }
  } else if (listing_contact_email) {
    // Admin-created listing: send welcome email with listing link, claim link, and signup/login links
    try {
      const html = await htmlAdminAddedBusinessWelcomeFa({
        nameFa: name_fa,
        slug,
        city,
        phone,
        address,
      });
      await sendMailViaSettings({
        to: listing_contact_email,
        subject: `کسب‌وکار شما "${name_fa}" در IraniU ثبت شد`,
        html,
        text: `کسب‌وکار شما "${name_fa}" در IraniU ثبت و منتشر شد. برای مشاهده و مدیریت آگهی خود به ${process.env.PUBLIC_SITE_URL || "https://directory.iraniu.uk"}/business?slug=${encodeURIComponent(slug)} مراجعه کنید.`,
      });
    } catch (e) {
      console.error("[email] admin-added business welcome", e);
    }
  }
  res.status(201).json(row);
}));

app.post("/api/claim-requests", asyncHandler(async (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const business_slug = String(b.business_slug || "").trim();
  const applicant_name = String(b.applicant_name || "").trim();
  const email = String(b.email || "").trim();
  const phone = String(b.phone || "").trim();
  const message = String(b.message || "").trim();
  if (!business_slug || !applicant_name || !email || !phone || !message) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const biz = await dbGet(`SELECT slug, claimed, listing_approval, status FROM businesses WHERE slug = $1`, [business_slug]);
  if (!biz) return res.status(404).json({ error: "business_not_found" });
  if (!isBusinessVisibleToPublic(biz)) {
    return res.status(400).json({
      error: "listing_not_public",
      hint: "این آگهی در سایت منتشر نشده، رد شده یا غیرفعال است",
    });
  }
  if (biz.claimed) return res.status(400).json({ error: "already_claimed" });
  const dup = await dbGet(
    `SELECT id FROM claim_requests WHERE business_slug = $1 AND email = $2 AND status = 'pending'`,
    [business_slug, email]
  );
  if (dup) return res.status(409).json({ error: "duplicate_pending" });

  // Auto-create unverified manager account so admin doesn't need to recreate
  let claim_manager_id = null;
  try {
    const emailLower = email.toLowerCase();
    const existing = await dbGet(`SELECT id FROM identity.managers WHERE email = $1`, [emailLower]);
    if (existing) {
      claim_manager_id = existing.id;
    } else {
      const username = await generateUsernameFromEmail(emailLower);
      const mgr = await dbRun(
        `INSERT INTO identity.managers (email, name, phone, login_username, must_change_password)
         VALUES ($1, $2, $3, $4, 1) RETURNING id`,
        [emailLower, applicant_name, phone || null, username]
      );
      claim_manager_id = mgr.rows[0].id;
    }
  } catch (e) {
    console.error("[claim] auto-create manager", e);
  }

  const info = await dbRun(
    `INSERT INTO claim_requests (business_slug, applicant_name, email, phone, message, status, claim_manager_id)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING id`,
    [business_slug, applicant_name, email, phone || null, message || null, claim_manager_id]
  );
  const row = await dbGet(`SELECT * FROM claim_requests WHERE id = $1`, [info.rows[0].id]);

  // Send claim received email to applicant
  const bizForEmail = await dbGet(`SELECT name_fa FROM businesses WHERE slug = $1`, [business_slug]);
  try {
    const html = await htmlClaimReceivedFa({ businessName: bizForEmail?.name_fa || business_slug });
    await sendMailViaSettings({
      to: email,
      subject: "درخواست مالکیت (Claim) کسب‌وکار شما دریافت شد — IraniU",
      html,
      text: `درخواست مالکیت کسب‌وکار "${bizForEmail?.name_fa || business_slug}" دریافت شد. به زودی از طریق ایمیل یا تماس با شما ارتباط خواهیم گرفت.`,
    });
  } catch (e) {
    console.error("[email] claim received", e);
  }

  res.status(201).json(row);
}));

app.get("/api/admin/claim-requests", requireSuperAdmin, asyncHandler(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  let rows;
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    rows = await dbAll(`SELECT * FROM claim_requests WHERE status = $1 ORDER BY created_at DESC`, [status]);
  } else {
    rows = await dbAll(`SELECT * FROM claim_requests ORDER BY created_at DESC`);
  }
  res.json(rows);
}));

app.get("/api/admin/business-reports", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await dbAll(
    `SELECT r.id, r.business_slug, r.reason_key, r.details, r.reporter_email, r.created_at,
              b.name_fa AS business_name_fa, b.id AS business_id
       FROM business_reports r
       LEFT JOIN businesses b ON b.slug = r.business_slug
       ORDER BY r.created_at DESC`
  );
  const labelByKey = Object.fromEntries(BUSINESS_REPORT_REASONS.map((x) => [x.key, x.label]));
  res.json(rows.map((r) => ({ ...r, reason_label: labelByKey[r.reason_key] || r.reason_key })));
}));

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
app.get("/api/admin/businesses/export-csv", requireSuperAdmin, asyncHandler(async (req, res) => {
  try {
    const preset = String(req.query.preset || "iraniu").toLowerCase();
    if (preset !== "iraniu") {
      return res.status(400).json({
        error: "invalid_preset",
        hint: "فعلاً فقط preset=iraniu پشتیبانی می‌شود (خروجی مطابق جدول businesses)",
      });
    }
    const { csvText, rowCount } = await exportIraniuBusinessesCsv();
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
}));

/**
 * Legacy SQLite database export/import endpoints removed in the PostgreSQL migration.
 * Use CSV export/import (`/api/admin/businesses/export-csv` and `import-csv`) or
 * `pg_dump`/`pg_restore` on the Postgres database instead.
 */
app.all("/api/admin/database/sqlite", requireSuperAdmin, (_req, res) => {
  res.status(410).json({
    error: "sqlite_disabled",
    hint: "این سرویس به PostgreSQL مهاجرت کرده است. از خروجی/ورودی CSV یا pg_dump استفاده کنید.",
  });
});

app.post("/api/admin/businesses/import-csv", requireSuperAdmin, uploadCsv.single("csv"), asyncHandler(async (req, res) => {
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

    const { inserted, skipped, failed } = await runBulkInsert(rows, { onDuplicate: "skip" });

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
}));

app.post("/api/admin/businesses/:slug/approve", requireSuperAdmin, asyncHandler(async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  const rowBefore = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]);
  if (!rowBefore) return res.status(404).json({ error: "not_found" });
  const info = await dbRun(`UPDATE businesses SET listing_approval = 'approved', listing_rejection_reason = NULL WHERE slug = $1`, [slug]);
  if (info.rowCount === 0) return res.status(404).json({ error: "not_found" });
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "listing_approved",
    targetType: "business",
    targetId: slug,
    message: `Listing approved: ${slug}`,
  });
  const row = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]);

  // If no manager account exists yet, create one with a temp password and send Persian activation email
  if (!row.manager_id && row.listing_contact_email) {
    try {
      const emailLower = row.listing_contact_email.toLowerCase();
      const tempPassword = generateTempPassword();
      const hash = hashPassword(tempPassword);
      // Check if a manager with this email already exists
      let existingMgr = await dbGet(`SELECT id FROM identity.managers WHERE LOWER(email) = $1`, [emailLower]);
      let managerId;
      if (existingMgr) {
        managerId = existingMgr.id;
        await dbRun(
          `UPDATE identity.managers SET password_hash = $1, must_change_password = 1 WHERE id = $2`,
          [hash, managerId]
        );
      } else {
        const username = await generateUsernameFromEmail(emailLower);
        const inserted = await dbGet(
          `INSERT INTO identity.managers (login_username, email, password_hash, name, must_change_password)
           VALUES ($1, $2, $3, $4, 1) RETURNING id`,
          [username, emailLower, hash, row.name_fa || username]
        );
        managerId = inserted.id;
      }
      await dbRun(`UPDATE businesses SET manager_id = $1, claimed = 1 WHERE slug = $2`, [managerId, slug]);
      const s = await getEffectiveSmtpSettings();
      const loginUrl = s.siteUrl ? `${String(s.siteUrl).replace(/\/$/, "")}/login` : "/login";
      const mgr = await dbGet(`SELECT login_username FROM identity.managers WHERE id = $1`, [managerId]);
      const html = await htmlBusinessActivatedFa({
        nameFa: row.name_fa,
        username: mgr?.login_username || emailLower,
        tempPassword,
        loginUrl,
      });
      await sendMailViaSettings({
        to: row.listing_contact_email,
        subject: "حساب کاربری شما در IraniU فعال شد",
        html,
        text: `آگهی "${row.name_fa}" تأیید شد. نام کاربری: ${mgr?.login_username || emailLower} — رمز موقت: ${tempPassword} — ${loginUrl}`,
      });
    } catch (e) {
      console.error("listing approve manager create / email", e);
    }
  } else {
    // Manager already linked — ensure claimed = 1 and send approval email
    if (row.manager_id) {
      await dbRun(`UPDATE businesses SET claimed = 1 WHERE slug = $1 AND claimed != 1`, [slug]);
    }
    try {
      await sendListingApprovedEmail({
        to: row.listing_contact_email,
        nameFa: row.name_fa,
        slug: row.slug,
      });
    } catch (e) {
      console.error("listing approve email", e);
    }
  }

  res.json(await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]));
}));

app.post("/api/admin/businesses/:slug/reject", requireSuperAdmin, asyncHandler(async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const reason = String(body.reason ?? "").trim();
  const rowBefore = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]);
  if (!rowBefore) return res.status(404).json({ error: "not_found" });
  const info = await dbRun(
    `UPDATE businesses SET listing_approval = 'rejected', listing_rejection_reason = $1 WHERE slug = $2`,
    [reason || null, slug]
  );
  if (info.rowCount === 0) return res.status(404).json({ error: "not_found" });
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "listing_rejected",
    targetType: "business",
    targetId: slug,
    message: `Listing rejected: ${slug}`,
  });
  const row = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]);
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
}));

app.post("/api/admin/claim-requests/:id/decide", requireSuperAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const action = String((req.body && req.body.action) || "").toLowerCase();
  if (action !== "approve" && action !== "reject") {
    return res.status(400).json({ error: "bad_action" });
  }
  const row = await dbGet(`SELECT * FROM claim_requests WHERE id = $1`, [id]);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.status !== "pending") return res.status(400).json({ error: "already_decided" });
  const now = new Date().toISOString();
  if (action === "reject") {
    await dbRun(`UPDATE claim_requests SET status = 'rejected', decided_at = $1 WHERE id = $2`, [now, id]);
    return res.json(await dbGet(`SELECT * FROM claim_requests WHERE id = $1`, [id]));
  }
  const biz = await dbGet(`SELECT claimed, name_fa FROM businesses WHERE slug = $1`, [row.business_slug]);
  if (!biz) return res.status(404).json({ error: "business_missing" });
  if (biz.claimed) {
    await dbRun(`UPDATE claim_requests SET status = 'rejected', decided_at = $1 WHERE id = $2`, [now, id]);
    return res.status(409).json({ error: "business_already_claimed" });
  }

  // Get or create manager with temp password
  const emailLower = String(row.email || "").toLowerCase();
  let managerId = null;
  let managerUsername = emailLower;
  const tempPassword = generateTempPassword();
  const tempHash = hashPassword(tempPassword);

  // Try pre-created manager from claim submission first
  let mgr = row.claim_manager_id
    ? await dbGet(`SELECT id, login_username FROM identity.managers WHERE id = $1`, [row.claim_manager_id])
    : null;

  // Fallback: lookup by email
  if (!mgr) {
    mgr = await dbGet(`SELECT id, login_username FROM identity.managers WHERE email = $1`, [emailLower]);
  }

  if (mgr) {
    managerId = mgr.id;
    managerUsername = mgr.login_username || emailLower;
    await dbRun(
      `UPDATE identity.managers SET password_hash = $1, must_change_password = 1 WHERE id = $2`,
      [tempHash, managerId]
    );
  } else {
    // Create fresh manager
    const username = await generateUsernameFromEmail(emailLower);
    const newMgr = await dbRun(
      `INSERT INTO identity.managers (email, name, phone, login_username, password_hash, must_change_password)
       VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`,
      [emailLower, row.applicant_name || "Manager", row.phone || null, username, tempHash]
    );
    managerId = newMgr.rows[0].id;
    managerUsername = username;
  }

  // Link business to manager and mark as claimed
  await dbRun(`UPDATE businesses SET claimed = 1, manager_id = $1 WHERE slug = $2`, [managerId, row.business_slug]);
  await dbRun(`UPDATE claim_requests SET status = 'approved', decided_at = $1 WHERE id = $2`, [now, id]);
  // Award claim milestone tokens (fire-and-forget)
  checkAndAwardMilestones(row.business_slug).catch(() => {});

  // Send claim verified email with credentials
  try {
    const s = await getEffectiveSmtpSettings();
    const loginUrl = s.siteUrl
      ? `${String(s.siteUrl).replace(/\/$/, "")}/login`
      : "https://directory.iraniu.uk/login";
    const html = await htmlClaimVerifiedFa({
      businessName: biz.name_fa || row.business_slug,
      username: managerUsername,
      tempPassword,
      loginUrl,
    });
    await sendMailViaSettings({
      to: emailLower,
      subject: "تأیید مالکیت کسب‌وکار و فعال‌سازی حساب کاربری — IraniU",
      html,
      text: `ضمن تبریک، حساب شما فعال شد.\nنام کاربری: ${managerUsername}\nرمز موقت: ${tempPassword}\nلینک ورود: ${loginUrl}`,
    });
  } catch (e) {
    console.error("[email] claim verified", e);
  }

  res.json(await dbGet(`SELECT * FROM claim_requests WHERE id = $1`, [id]));
}));

/** Remove claimed status from a business (admin only) */
app.post("/api/admin/businesses/:slug/unclaim", requireSuperAdmin, asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  const biz = await dbGet(`SELECT slug, claimed FROM businesses WHERE slug = $1`, [slug]);
  if (!biz) return res.status(404).json({ error: "not_found" });
  await dbRun(`UPDATE businesses SET claimed = 0, manager_id = NULL, exchange_manager_id = NULL WHERE slug = $1`, [slug]);
  writeSystemLog({
    level: "info",
    actorType: "superadmin",
    action: "business_unclaimed",
    targetType: "business",
    targetId: slug,
    message: `Admin removed claimed status and manager from ${slug}`,
  });
  res.json({ ok: true, slug });
}));

async function attachLinkedBusinesses(managerRow, kind = "directory") {
  const managerColumn = kind === "exchange" ? "exchange_manager_id" : "manager_id";
  const categoryWhere =
    kind === "exchange"
      ? `AND COALESCE(TRIM(category), '') = 'صرافی'`
      : `AND COALESCE(TRIM(category), '') <> 'صرافی'`;
  const linked_businesses = await dbAll(
    `SELECT id, slug, name_fa, category, status, claimed, package, city
       FROM businesses
       WHERE ${managerColumn} = $1
       ${categoryWhere}
       ORDER BY CASE WHEN COALESCE(TRIM(category), '') = 'صرافی' THEN 0 ELSE 1 END, id DESC`,
    [managerRow.id]
  );
  return {
    ...stripManagerRow(managerRow),
    linked_businesses,
    manager_kind: kind,
    password_set: !!managerRow.password_hash,
    totp_enabled: !!managerRow.totp_enabled,
  };
}

app.get("/api/managers", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await dbAll(`SELECT * FROM identity.managers ORDER BY created_at DESC`);
  res.json(await Promise.all(rows.map((m) => attachLinkedBusinesses(m))));
}));

app.get("/api/managers/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const m = await dbGet(`SELECT * FROM identity.managers WHERE id = $1`, [id]);
  if (!m) return res.status(404).json({ error: "not_found" });
  res.json(await attachLinkedBusinesses(m));
}));

app.get("/api/exchange-managers", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await dbAll(`SELECT * FROM identity.exchange_managers ORDER BY created_at DESC`);
  res.json(await Promise.all(rows.map((m) => attachLinkedBusinesses(m, "exchange"))));
}));

app.get("/api/exchange-managers/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const m = await dbGet(`SELECT * FROM identity.exchange_managers WHERE id = $1`, [id]);
  if (!m) return res.status(404).json({ error: "not_found" });
  res.json(await attachLinkedBusinesses(m, "exchange"));
}));

app.delete("/api/managers/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "bad_id" });
  const existing = await dbGet(`SELECT id, email FROM identity.managers WHERE id = $1`, [id]);
  if (!existing) return res.status(404).json({ error: "not_found" });
  await dbTransaction(async (client) => {
    await client.query(`UPDATE businesses SET manager_id = NULL, claimed = 0 WHERE manager_id = $1`, [id]);
    await client.query(`DELETE FROM identity.managers WHERE id = $1`, [id]);
  });
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "manager_deleted",
    targetType: "manager",
    targetId: id,
    message: `Manager deleted: #${id} (${existing.email})`,
  });
  res.json({ ok: true, id });
}));

app.delete("/api/exchange-managers/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "bad_id" });
  const existing = await dbGet(`SELECT id, email FROM identity.exchange_managers WHERE id = $1`, [id]);
  if (!existing) return res.status(404).json({ error: "not_found" });
  await dbTransaction(async (client) => {
    await client.query(`UPDATE businesses SET exchange_manager_id = NULL, claimed = 0 WHERE exchange_manager_id = $1`, [id]);
    await client.query(`DELETE FROM identity.exchange_managers WHERE id = $1`, [id]);
  });
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "exchange_manager_deleted",
    targetType: "exchange_manager",
    targetId: id,
    message: `Exchange manager deleted: #${id} (${existing.email})`,
  });
  res.json({ ok: true, id });
}));

const MANAGER_LOGIN_USERNAME_RE = /^[a-z0-9_]{3,32}$/;

app.post("/api/managers", requireSuperAdmin, asyncHandler(async (req, res) => {
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
  if (await dbGet(`SELECT id FROM identity.managers WHERE email = $1`, [email])) {
    return res.status(409).json({ error: "email_taken", hint: "این ایمیل قبلاً برای یک مدیر ثبت شده" });
  }
  if (await dbGet(`SELECT id FROM identity.managers WHERE login_username = $1`, [login_username])) {
    return res.status(409).json({ error: "username_taken", hint: "این نام کاربری گرفته شده" });
  }
  try {
    const ph = hashPassword(password);
    const info = await dbRun(
      `INSERT INTO identity.managers (email, name, phone, password_hash, login_username) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email, name, phone, ph, login_username]
    );
    const row = await dbGet(`SELECT * FROM identity.managers WHERE id = $1`, [info.rows[0].id]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "manager_created",
      targetType: "manager",
      targetId: row.id,
      message: `Manager created: ${row.email}`,
    });
    res.status(201).json(await attachLinkedBusinesses(row));
  } catch (e) {
    if (e && (e.code === "23505" || String(e.message || "").includes("UNIQUE"))) {
      return res.status(409).json({
        error: "email_or_username_taken",
        hint: "ایمیل یا نام کاربری تکراری است",
      });
    }
    throw e;
  }
}));

app.post("/api/exchange-managers", requireSuperAdmin, asyncHandler(async (req, res) => {
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
    (await dbGet(`SELECT id FROM identity.exchange_managers WHERE email = $1`, [email])) ||
    (await dbGet(`SELECT id FROM identity.managers WHERE email = $1`, [email]))
  ) {
    return res.status(409).json({ error: "email_taken", hint: "این ایمیل قبلاً برای یک مدیر ثبت شده" });
  }
  if (
    (await dbGet(`SELECT id FROM identity.exchange_managers WHERE login_username = $1`, [login_username])) ||
    (await dbGet(`SELECT id FROM identity.managers WHERE login_username = $1`, [login_username]))
  ) {
    return res.status(409).json({ error: "username_taken", hint: "این نام کاربری گرفته شده" });
  }
  try {
    const ph = hashPassword(password);
    const info = await dbRun(
      `INSERT INTO identity.exchange_managers (email, name, phone, password_hash, login_username) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email, name, phone || null, ph, login_username]
    );
    const row = await dbGet(`SELECT * FROM identity.exchange_managers WHERE id = $1`, [info.rows[0].id]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "exchange_manager_created",
      targetType: "exchange_manager",
      targetId: row.id,
      message: `Exchange manager created: ${row.email}`,
    });
    res.status(201).json(await attachLinkedBusinesses(row, "exchange"));
  } catch (e) {
    if (e && (e.code === "23505" || String(e.message || "").includes("UNIQUE"))) {
      return res.status(409).json({
        error: "email_or_username_taken",
        hint: "ایمیل یا نام کاربری تکراری است",
      });
    }
    throw e;
  }
}));

app.patch("/api/admin/businesses/:slug/manager", requireSuperAdmin, asyncHandler(async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  const exists = await dbGet(`SELECT slug, category FROM businesses WHERE slug = $1`, [slug]);
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
    await dbRun(`UPDATE businesses SET manager_id = NULL, claimed = 0 WHERE slug = $1`, [slug]);
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
        managerRow = await dbGet(`SELECT id FROM identity.managers WHERE id = $1`, [id]);
      } else if (!managerIdentifier) {
        return res.status(400).json({ error: "bad_manager_id" });
      } else {
        source = "email_or_username_after_bad_id";
      }
    } else if (managerIdentifier) {
      source = "email_or_username";
      const mByIdent = await dbGet(
        `SELECT id FROM identity.managers WHERE lower(email) = $1 OR lower(login_username) = $1`,
        [managerIdentifier]
      );
      if (!mByIdent) {
        return res.status(400).json({ error: "invalid_manager_identifier", hint: "ایمیل یا نام‌کاربری مدیر پیدا نشد" });
      }
      id = Number(mByIdent.id);
      managerRow = mByIdent;
    }
    // If ID was sent but no longer valid, fallback to email/login when provided.
    if (!managerRow && managerIdentifier) {
      source = "email_or_username_fallback";
      const mByIdent = await dbGet(
        `SELECT id FROM identity.managers WHERE lower(email) = $1 OR lower(login_username) = $1`,
        [managerIdentifier]
      );
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
    await dbRun(`UPDATE businesses SET manager_id = $1, claimed = 1 WHERE slug = $2`, [id, slug]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "business_manager_linked",
      targetType: "business",
      targetId: slug,
      message: `Manager #${id} linked to business ${slug} (${source})`,
    });
  }
  const row = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]);
  const manager =
    row?.manager_id != null
      ? await dbGet(`SELECT id, name, email, login_username FROM identity.managers WHERE id = $1`, [row.manager_id])
      : null;
  res.json({ ...row, manager });
}));

app.patch("/api/admin/exchange-businesses/:slug/manager", requireSuperAdmin, asyncHandler(async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  const exists = await dbGet(`SELECT slug, category FROM businesses WHERE slug = $1`, [slug]);
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
    await dbRun(`UPDATE businesses SET exchange_manager_id = NULL, claimed = 0 WHERE slug = $1`, [slug]);
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
        managerRow = await dbGet(`SELECT id FROM identity.exchange_managers WHERE id = $1`, [id]);
      } else if (!managerIdentifier) {
        return res.status(400).json({ error: "bad_manager_id" });
      } else {
        source = "email_or_username_after_bad_id";
      }
    } else if (managerIdentifier) {
      source = "email_or_username";
      managerRow = await dbGet(
        `SELECT id FROM identity.exchange_managers WHERE lower(email) = $1 OR lower(login_username) = $1`,
        [managerIdentifier]
      );
      if (managerRow) id = Number(managerRow.id);
    }
    // If ID was sent but no longer valid, fallback to email/login when provided.
    if (!managerRow && managerIdentifier) {
      source = "email_or_username_fallback";
      const mByIdent = await dbGet(
        `SELECT id FROM identity.exchange_managers WHERE lower(email) = $1 OR lower(login_username) = $1`,
        [managerIdentifier]
      );
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
    await dbRun(`UPDATE businesses SET exchange_manager_id = $1, claimed = 1 WHERE slug = $2`, [id, slug]);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "exchange_business_manager_linked",
      targetType: "business",
      targetId: slug,
      message: `Exchange manager #${id} linked to business ${slug} (${source})`,
    });
  }
  const row = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]);
  const manager =
    row?.exchange_manager_id != null
      ? await dbGet(`SELECT id, name, email, login_username FROM identity.exchange_managers WHERE id = $1`, [row.exchange_manager_id])
      : null;
  res.json({ ...row, manager });
}));

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

app.get("/api/admin/categories", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await dbAll(
    `SELECT id, name, icon, sort_order, is_active, created_at
       FROM business_categories
       ORDER BY sort_order ASC, name ASC`
  );
  res.json(rows);
}));

app.post("/api/admin/categories", requireSuperAdmin, asyncHandler(async (req, res) => {
  const name = String((req.body && req.body.name) || "").trim();
  if (!name) return res.status(400).json({ error: "missing_name" });
  const icon = String((req.body && req.body.icon) || "").trim() || null;
  const nextOrder = (await dbGet(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM business_categories`)).n;
  try {
    const info = await dbRun(
      `INSERT INTO business_categories (name, icon, sort_order, is_active) VALUES ($1, $2, $3, 1) RETURNING id`,
      [name, icon, nextOrder]
    );
    const row = await dbGet(
      `SELECT id, name, icon, sort_order, is_active, created_at FROM business_categories WHERE id = $1`,
      [info.rows[0].id]
    );
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "category_created",
      targetType: "category",
      targetId: row.id,
      message: `Category created: ${row.name}`,
    });
    res.status(201).json(row);
  } catch (e) {
    if (e && (e.code === "23505" || String(e.message || "").includes("UNIQUE"))) return res.status(409).json({ error: "name_taken" });
    throw e;
  }
}));

app.patch("/api/admin/categories/:id", requireSuperAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const old = await dbGet(`SELECT id FROM business_categories WHERE id = $1`, [id]);
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
  if ("icon" in b) updates.icon = String(b.icon || "").trim() || null;
  const keys = Object.keys(updates);
  if (!keys.length) return res.status(400).json({ error: "no_fields" });
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => updates[k]);
  await dbRun(`UPDATE business_categories SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
  const row = await dbGet(`SELECT id, name, icon, sort_order, is_active, created_at FROM business_categories WHERE id = $1`, [id]);
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "category_updated",
    targetType: "category",
    targetId: row.id,
    message: `Category updated: ${row.name}`,
    meta: { fields: keys },
  });
  res.json(row);
}));

app.get("/api/admin/billing", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await dbAll(`SELECT * FROM billing_records ORDER BY created_at DESC`);
  res.json(rows);
}));

app.post("/api/admin/billing", requireSuperAdmin, asyncHandler(async (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const business_slug = String(b.business_slug || "").trim();
  const title = String(b.title || "").trim();
  if (!business_slug || !title) return res.status(400).json({ error: "missing_fields" });
  if (!(await dbGet(`SELECT 1 FROM businesses WHERE slug = $1`, [business_slug]))) {
    return res.status(404).json({ error: "business_not_found" });
  }
  const info = await dbRun(
    `INSERT INTO billing_records (business_slug, title, amount, status, note) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      business_slug,
      title,
      String(b.amount ?? ""),
      String(b.status || "pending") || "pending",
      String(b.note ?? ""),
    ]
  );
  const row = await dbGet(`SELECT * FROM billing_records WHERE id = $1`, [info.rows[0].id]);
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "billing_created",
    targetType: "business",
    targetId: business_slug,
    message: `Billing record created for ${business_slug}`,
    meta: { status: row.status, amount: row.amount || null },
  });
  res.status(201).json(row);
}));

app.post("/api/site-chat", asyncHandler(async (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const message = String(b.message || "").trim();
  if (!message) return res.status(400).json({ error: "empty_message" });
  const name = String(b.name || b.visitor_name || "").trim() || null;
  const pathVal = String(b.path || "").trim() || null;
  const info = await dbRun(
    `INSERT INTO site_chat_messages (visitor_name, message, path) VALUES ($1, $2, $3) RETURNING id`,
    [name, message, pathVal]
  );
  const row = await dbGet(`SELECT * FROM site_chat_messages WHERE id = $1`, [info.rows[0].id]);
  res.status(201).json(row);
}));

app.get("/api/admin/site-chat", requireSuperAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || "100"), 10) || 100));
  const rows = await dbAll(`SELECT * FROM site_chat_messages ORDER BY created_at DESC LIMIT $1`, [limit]);
  res.json(rows);
}));

app.get("/api/admin/system-logs", requireSuperAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit || "200"), 10) || 200));
  const level = String(req.query.level || "").trim().toLowerCase();
  const actor = String(req.query.actor_type || "").trim().toLowerCase();
  const search = String(req.query.search || "").trim();
  const dateFrom = String(req.query.from || "").trim();
  const dateTo = String(req.query.to || "").trim();
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
  if (search) {
    where.push("(sl.message ILIKE ? OR sl.action ILIKE ? OR sl.target_type ILIKE ? OR sl.target_id ILIKE ?)");
    const needle = `%${search}%`;
    params.push(needle, needle, needle, needle);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    where.push("sl.created_at >= ?");
    params.push(`${dateFrom} 00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    where.push("sl.created_at <= ?");
    params.push(`${dateTo} 23:59:59`);
  }
  // Build positional placeholders ($1, $2, ...) for the dynamic WHERE, left to right.
  let placeholderIndex = 0;
  const whereSqlBody = where.join(" AND ").replace(/\?/g, () => `$${++placeholderIndex}`);
  const whereSql = where.length ? `WHERE ${whereSqlBody}` : "";
  const limitParamIndex = params.length + 1;
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
    ORDER BY sl.created_at DESC, sl.id DESC
    LIMIT $${limitParamIndex}
  `;
  const rows = await dbAll(q, [...params, limit]);
  res.json(rows);
}));


async function updateBusinessBySlug(req, res) {
  await ensureRestaurantSafraDemo();
  const slug = decodeURIComponent(
    String((req.params && req.params.slug) || (req.body && req.body.slug) || "").trim()
  );
  if (!slug) {
    return res.status(400).json({ error: "missing_slug" });
  }
  const exists = await dbGet(
    `SELECT slug, manager_id, exchange_manager_id FROM businesses WHERE slug = $1`,
    [slug]
  );
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
        const m = await dbGet(`SELECT id FROM identity.managers WHERE id = $1`, [mid]);
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
        const m = await dbGet(`SELECT id FROM identity.exchange_managers WHERE id = $1`, [mid]);
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
    if (!(await isTwilioModuleEnabled())) {
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

  // Fetch current image URLs before overwriting so we can delete removed ones from S3
  const IMAGE_FIELDS = ["cover_image_url", "logo_url"];
  const changingImages = IMAGE_FIELDS.filter((f) => f in updates);
  const changingGallery = "gallery_json" in updates;
  let oldRow = null;
  if ((changingImages.length || changingGallery) && (await isS3Enabled())) {
    oldRow = await dbGet(`SELECT cover_image_url, logo_url, gallery_json FROM businesses WHERE slug = $1`, [slug]);
  }

  const keys = Object.keys(updates);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => updates[k]);
  await dbRun(`UPDATE businesses SET ${setClause} WHERE slug = $${keys.length + 1}`, [...values, slug]);

  // Delete old images from S3 that were replaced or cleared
  if (oldRow && (await isS3Enabled())) {
    const toDelete = [];

    for (const field of IMAGE_FIELDS) {
      if (!(field in updates)) continue;
      const oldUrl = String(oldRow[field] || "");
      const newUrl = String(updates[field] || "");
      if (oldUrl && oldUrl !== newUrl) toDelete.push(oldUrl);
    }

    if (changingGallery) {
      const parseUrls = (raw) => {
        try { return (JSON.parse(raw) || []).flat().map(String).filter(Boolean); } catch { return []; }
      };
      const oldUrls = new Set(parseUrls(oldRow.gallery_json));
      const newUrls = new Set(parseUrls(updates.gallery_json));
      for (const url of oldUrls) if (!newUrls.has(url)) toDelete.push(url);
    }

    // Fire-and-forget: don't block the response
    (async () => {
      for (const url of toDelete) {
        const key = await extractS3KeyFromUrl(url);
        if (key) await deleteFromS3(key);
      }
    })().catch(() => {});
  }
  writeSystemLog({
    ...actorFromAuth(auth),
    action: "business_profile_updated",
    targetType: "business",
    targetId: slug,
    message: `Business profile updated: ${slug}`,
    meta: { fields: keys },
  });
  const row = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]);
  // Fire-and-forget milestone check (non-blocking)
  checkAndAwardMilestones(slug).catch(() => {});
  // Weekly edit bonus — only for manager saves, not admin edits
  if (auth && (auth.typ === "mgr" || auth.typ === "mgrx")) {
    checkWeeklyEditBonus(slug).catch(() => {});
  }
  res.json(row);
}

/** مسیر تخت — بدون بخش /slug/save که روی بعضی سرورها ۴۰۴ می‌شود */
app.post("/api/businesses/update", asyncHandler(updateBusinessBySlug));

/* ─────────────────────────────────────────────────────────────
   Token Wallet — manager endpoints
   ──────────────────────────────────────────────────────────── */
app.get("/api/wallet/plans", (_req, res) => {
  res.json(BOOST_PLANS);
});

app.get("/api/wallet", requireManagerOrSuperAdmin, asyncHandler(async (req, res) => {
  const auth = parseAuthHeader(req);
  let slug;
  if (auth.typ === "mgr") {
    const biz = await dbGet(`SELECT slug FROM businesses WHERE manager_id = $1 LIMIT 1`, [auth.sub]);
    if (!biz) return res.status(404).json({ error: "no_business" });
    slug = biz.slug;
  } else if (auth.typ === "mgrx") {
    const biz = await dbGet(`SELECT slug FROM businesses WHERE exchange_manager_id = $1 LIMIT 1`, [auth.sub]);
    if (!biz) return res.status(404).json({ error: "no_business" });
    slug = biz.slug;
  } else {
    slug = req.query.slug;
    if (!slug) return res.status(400).json({ error: "missing_slug" });
  }
  const data = await getWalletWithTransactions(slug);
  res.json(data);
}));

app.post("/api/wallet/boost", requireManagerOrSuperAdmin, asyncHandler(async (req, res) => {
  const auth = parseAuthHeader(req);
  let slug;
  if (auth.typ === "mgr") {
    const biz = await dbGet(`SELECT slug FROM businesses WHERE manager_id = $1 LIMIT 1`, [auth.sub]);
    if (!biz) return res.status(404).json({ error: "no_business" });
    slug = biz.slug;
  } else if (auth.typ === "mgrx") {
    const biz = await dbGet(`SELECT slug FROM businesses WHERE exchange_manager_id = $1 LIMIT 1`, [auth.sub]);
    if (!biz) return res.status(404).json({ error: "no_business" });
    slug = biz.slug;
  } else {
    slug = req.body?.slug;
    if (!slug) return res.status(400).json({ error: "missing_slug" });
  }
  const { plan_id } = req.body || {};
  if (!plan_id) return res.status(400).json({ error: "missing_plan_id" });
  try {
    const result = await spendTokensForBoost(slug, plan_id);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

/* ─────────────────────────────────────────────────────────────
   Token Wallet — superadmin endpoints
   ──────────────────────────────────────────────────────────── */
app.get("/api/admin/wallets", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await dbAll(`
    SELECT
      b.slug AS business_slug,
      b.name_fa,
      b.category,
      b.status AS biz_status,
      COALESCE(tw.balance, 0) AS balance,
      COALESCE(tw.total_earned, 0) AS total_earned,
      COALESCE(tw.total_spent, 0) AS total_spent,
      tw.updated_at,
      ab.plan_id AS active_boost_plan,
      ab.ends_at AS boost_ends_at
    FROM businesses b
    LEFT JOIN token_wallets tw ON tw.business_slug = b.slug
    LEFT JOIN LATERAL (
      SELECT plan_id, ends_at FROM ad_boosts
      WHERE business_slug = b.slug
        AND is_active = 1
        AND ends_at > NOW()::TEXT
      ORDER BY ends_at DESC LIMIT 1
    ) ab ON TRUE
    ORDER BY COALESCE(tw.balance, 0) DESC, b.name_fa
  `);
  res.json(rows);
}));

app.post("/api/admin/wallets/grant", requireSuperAdmin, asyncHandler(async (req, res) => {
  const { business_slug, amount, description } = req.body || {};
  if (!business_slug || !amount) return res.status(400).json({ error: "missing_fields" });
  const n = parseInt(String(amount), 10);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) return res.status(400).json({ error: "invalid_amount" });
  const biz = await dbGet(`SELECT slug FROM businesses WHERE slug = $1`, [business_slug]);
  if (!biz) return res.status(404).json({ error: "business_not_found" });
  await grantTokens(business_slug, n, description || "اعطای توکن توسط ادمین");
  res.json({ ok: true });
}));

app.get("/api/admin/wallets/boosts", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await dbAll(`
    SELECT ab.*, b.name_fa
    FROM ad_boosts ab
    LEFT JOIN businesses b ON b.slug = ab.business_slug
    ORDER BY ab.created_at DESC
    LIMIT 100
  `);
  res.json(rows);
}));

/** PUT / PATCH / POST — پشتیبان */
app.put("/api/businesses/:slug", asyncHandler(updateBusinessBySlug));
app.patch("/api/businesses/:slug", asyncHandler(updateBusinessBySlug));
app.post("/api/businesses/:slug/save", asyncHandler(updateBusinessBySlug));

/** آمار تجمیعی برای داشبورد سوپرادمین */
app.get("/api/admin/stats", requireSuperAdmin, asyncHandler(async (_req, res) => {
  try {
    const total_businesses = (await dbGet(`SELECT COUNT(*)::int AS c FROM businesses`)).c;
    const active_businesses = (
      await dbGet(`SELECT COUNT(*)::int AS c FROM businesses WHERE status IS NULL OR status = '' OR status = 'active'`)
    ).c;
    const inactive_businesses = (
      await dbGet(`SELECT COUNT(*)::int AS c FROM businesses WHERE status = 'inactive'`)
    ).c;
    const featured_businesses = (
      await dbGet(`SELECT COUNT(*)::int AS c FROM businesses WHERE package = 'featured'`)
    ).c;
    const pending_listing_approvals = (
      await dbGet(`SELECT COUNT(*)::int AS c FROM businesses WHERE listing_approval = 'pending'`)
    ).c;
    const total_qr_scans = (await dbGet(`SELECT COUNT(*)::int AS c FROM qr_scans`)).c;
    const qr_scans_7d = (
      await dbGet(`SELECT COUNT(*)::int AS c FROM qr_scans WHERE scanned_at >= (NOW() - INTERVAL '7 days')::TEXT`)
    ).c;
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
}));

/* ── City Images (homepage) ── */
const CITY_IMAGES_KEY = "homepage_city_images";
const cityImagesDir = path.join(uploadsDir, "city-images");
if (!fs.existsSync(cityImagesDir)) fs.mkdirSync(cityImagesDir, { recursive: true });

const uploadCityImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || "")) { cb(new Error("bad_file_type")); return; }
    cb(null, true);
  },
});

app.get("/api/city-images", asyncHandler(async (_req, res) => {
  const row = await dbGet(`SELECT value FROM app_meta WHERE key = $1`, [CITY_IMAGES_KEY]);
  const data = row ? JSON.parse(row.value || "{}") : {};
  res.json(data);
}));

app.get("/api/admin/city-images", requireSuperAdmin, asyncHandler(async (_req, res) => {
  const row = await dbGet(`SELECT value FROM app_meta WHERE key = $1`, [CITY_IMAGES_KEY]);
  const data = row ? JSON.parse(row.value || "{}") : {};
  res.json(data);
}));

app.patch("/api/admin/city-images", requireSuperAdmin, asyncHandler(async (req, res) => {
  const updates = req.body && typeof req.body === "object" ? req.body : {};
  const row = await dbGet(`SELECT value FROM app_meta WHERE key = $1`, [CITY_IMAGES_KEY]);
  const current = row ? JSON.parse(row.value || "{}") : {};
  const merged = { ...current };
  for (const [city, url] of Object.entries(updates)) {
    const u = String(url || "").trim();
    if (u) merged[city] = u; else delete merged[city];
  }
  await dbRun(
    `INSERT INTO app_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
    [CITY_IMAGES_KEY, JSON.stringify(merged)]
  );
  res.json(merged);
}));

app.post("/api/admin/city-images/:city/upload", requireSuperAdmin, (req, res) => {
  const city = String(req.params.city || "").trim();
  if (!city) return res.status(400).json({ error: "missing_city" });
  uploadCityImage.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "upload_failed", hint: String(err.message || err) });
    if (!req.file) return res.status(400).json({ error: "no_file" });
    const ext = req.file.mimetype.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const filename = `${city.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.${ext}`;
    const filePath = path.join(cityImagesDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    const imageUrl = `/uploads/city-images/${filename}`;
    const row = await dbGet(`SELECT value FROM app_meta WHERE key = $1`, [CITY_IMAGES_KEY]);
    const current = row ? JSON.parse(row.value || "{}") : {};
    current[city] = imageUrl;
    await dbRun(
      `INSERT INTO app_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
      [CITY_IMAGES_KEY, JSON.stringify(current)]
    );
    res.json({ city, imageUrl, all: current });
  });
});

app.get("/api/qr/stats/:bid", asyncHandler(async (req, res) => {
  const bid = sanitizeBid(req.params.bid);
  const key = "qr_" + bid.slice(0, 80);
  const row = await dbGet(`SELECT COUNT(*)::int AS c FROM qr_scans WHERE business_slug = $1`, [key]);
  res.json({ count: row.c, bid: key });
}));

/** تعداد کلیک روی شمارهٔ تماس در صفحهٔ عمومی آگهی */
app.get("/api/phone/stats/:slug", asyncHandler(async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim()).toLowerCase();
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  const row = await dbGet(`SELECT COUNT(*)::int AS c FROM phone_clicks WHERE business_slug = $1`, [slug]);
  res.json({ count: row ? row.c : 0, slug });
}));

app.post("/api/phone-click", asyncHandler(async (req, res) => {
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const slug = String(b.slug || "")
    .trim()
    .toLowerCase();
  if (!slug) return res.status(400).json({ error: "missing_slug" });
  const bizPhone = await dbGet(`SELECT slug, listing_approval, status FROM businesses WHERE slug = $1`, [slug]);
  if (!bizPhone || !isBusinessVisibleToPublic(bizPhone)) {
    return res.status(404).json({ error: "not_found" });
  }
  try {
    await dbRun(`INSERT INTO phone_clicks (business_slug) VALUES ($1)`, [slug]);
  } catch (e) {
    console.error("phone_clicks insert", e);
  }
  res.status(201).json({ ok: true });
}));

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

app.post("/api/twilio/voice/incoming", asyncHandler(async (req, res) => {
  if (!(await isTwilioModuleEnabled())) {
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`);
  }
  const toNumber = normalizePhone(req.body?.To);
  if (!toNumber) return res.status(400).send("missing to");
  const biz = await dbGet(
    `SELECT b.slug, b.call_forward_number, b.phone, b.call_tracking_enabled, b.call_tracking_number,
              m.twilio_phone_number
       FROM businesses b
       LEFT JOIN identity.managers m ON m.id = b.manager_id
       WHERE replace(COALESCE(b.call_tracking_number, m.twilio_phone_number, ''), ' ', '') = $1
       LIMIT 1`,
    [toNumber]
  );
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
}));

app.post("/api/twilio/voice/status", asyncHandler(async (req, res) => {
  if (!(await isTwilioModuleEnabled())) {
    return res.json({ ok: true, skipped: true });
  }
  const slugQ = String(req.query.slug || "").trim().toLowerCase();
  const toNumber = normalizePhone(req.body?.To);
  const slugByTo = toNumber
    ? (
        await dbGet(
          `SELECT b.slug
           FROM businesses b
           LEFT JOIN identity.managers m ON m.id = b.manager_id
           WHERE replace(COALESCE(b.call_tracking_number, m.twilio_phone_number, ''), ' ', '') = $1
           LIMIT 1`,
          [toNumber]
        )
      )?.slug
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
  await dbRun(
    `INSERT INTO call_logs
      (business_slug, call_sid, from_number, to_number, direction, status, duration_seconds, recording_url)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (call_sid) DO UPDATE SET
      business_slug=EXCLUDED.business_slug,
      from_number=EXCLUDED.from_number,
      to_number=EXCLUDED.to_number,
      direction=EXCLUDED.direction,
      status=EXCLUDED.status,
      duration_seconds=EXCLUDED.duration_seconds,
      recording_url=EXCLUDED.recording_url`,
    [
      payload.business_slug,
      payload.call_sid,
      payload.from_number,
      payload.to_number,
      payload.direction,
      payload.status,
      payload.duration_seconds,
      payload.recording_url,
    ]
  );
  res.json({ ok: true });
}));

app.get("/api/manager/call-logs", requireManager, asyncHandler(async (req, res) => {
  if (!(await isTwilioModuleEnabled())) {
    return res.status(403).json({ error: "twilio_module_disabled" });
  }
  const limit = Math.min(300, Math.max(1, parseInt(String(req.query.limit || "100"), 10) || 100));
  const rows = await dbAll(
    `SELECT c.*, b.name_fa AS business_name
       FROM call_logs c
       JOIN businesses b ON b.slug = c.business_slug
       WHERE b.manager_id = $1
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT $2`,
    [req.auth.sub, limit]
  );
  res.json(rows);
}));

app.get("/api/manager/linked-businesses", requireManager, asyncHandler(async (req, res) => {
  const managerColumn = req.auth.typ === "mgrx" ? "exchange_manager_id" : "manager_id";
  const categoryWhere =
    req.auth.typ === "mgrx"
      ? `AND COALESCE(TRIM(category), '') = 'صرافی'`
      : `AND COALESCE(TRIM(category), '') <> 'صرافی'`;
  const rows = await dbAll(
    `SELECT id, slug, name_fa, category, status, claimed, package, city
       FROM businesses
       WHERE ${managerColumn} = $1
       ${categoryWhere}
       ORDER BY CASE WHEN COALESCE(TRIM(category), '') = 'صرافی' THEN 0 ELSE 1 END, id DESC`,
    [req.auth.sub]
  );
  res.json({ linked_businesses: rows });
}));

app.get("/api/manager/twilio-settings", requireManager, asyncHandler(async (req, res) => {
  const m = await dbGet(
    `SELECT twilio_account_sid, twilio_auth_token, twilio_phone_number
       FROM identity.managers WHERE id = $1`,
    [req.auth.sub]
  );
  if (!m) return res.status(404).json({ error: "not_found" });
  const masked =
    m.twilio_auth_token && String(m.twilio_auth_token).length > 4
      ? `••••${String(m.twilio_auth_token).slice(-4)}`
      : m.twilio_auth_token
      ? "••••"
      : null;
  res.json({
    module_enabled: await isTwilioModuleEnabled(),
    twilio_account_sid: m.twilio_account_sid || "",
    twilio_phone_number: m.twilio_phone_number || "",
    twilio_auth_token_set: !!m.twilio_auth_token,
    twilio_auth_token_masked: masked,
  });
}));

app.patch("/api/manager/twilio-settings", requireManager, asyncHandler(async (req, res) => {
  if (!(await isTwilioModuleEnabled())) {
    return res.status(403).json({ error: "twilio_module_disabled", hint: "Twilio module is off in super admin settings" });
  }
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const updates = {};
  if ("twilio_account_sid" in b) updates.twilio_account_sid = String(b.twilio_account_sid || "").trim() || null;
  if ("twilio_phone_number" in b) updates.twilio_phone_number = String(b.twilio_phone_number || "").trim() || null;
  if ("twilio_auth_token" in b) updates.twilio_auth_token = String(b.twilio_auth_token || "").trim() || null;
  const keys = Object.keys(updates);
  if (!keys.length) return res.status(400).json({ error: "no_fields" });
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => updates[k]);
  await dbRun(`UPDATE identity.managers SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, req.auth.sub]);
  writeSystemLog({
    ...actorFromAuth(req.auth),
    action: "manager_twilio_settings_updated",
    targetType: "manager",
    targetId: req.auth.sub,
    message: "Manager updated Twilio settings",
    meta: { fields: keys.filter((k) => k !== "twilio_auth_token") },
  });
  const m = await dbGet(
    `SELECT twilio_account_sid, twilio_auth_token, twilio_phone_number
       FROM identity.managers WHERE id = $1`,
    [req.auth.sub]
  );
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
}));

// ─── Blog public routes ───────────────────────────────────────────────────────

async function getBlogSource() {
  const row = await dbGet(`SELECT value FROM app_meta WHERE key = 'blog_source'`);
  return row?.value || "both";
}

app.get("/api/blog", asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(20, parseInt(req.query.limit) || 9);
  const cat   = (req.query.category || "").trim();
  const q     = (req.query.q || "").trim();
  const offset = (page - 1) * limit;

  const source = await getBlogSource();
  let allPosts = [];

  // Local posts
  if (source === "local" || source === "both") {
    let where = "WHERE is_published = 1";
    const params = [];
    if (cat) { params.push(cat); where += ` AND category = $${params.length}`; }
    if (q) {
      params.push(`%${q}%`);
      const idx = params.length;
      where += ` AND (title_fa ILIKE $${idx} OR excerpt_fa ILIKE $${idx})`;
    }
    const rows = await dbAll(
      `SELECT id, slug, title_fa, excerpt_fa, cover_image_url, author, category, tags, published_at, view_count FROM blog_posts ${where} ORDER BY published_at DESC`,
      params
    );
    allPosts.push(...rows.map((r) => ({ ...r, source: "local" })));
  }

  // External posts (CyberCina)
  if (source === "external" || source === "both") {
    try {
      const { posts: ext } = await getExternalPosts({ limit: 100, offset: 0, ...(q && { search: q }) });
      const normalized = ext.map(normalizeExternalPost);
      const filtered = cat ? normalized.filter((p) => p.category === cat) : normalized;
      allPosts.push(...filtered);
    } catch (e) {
      console.error("[blog] CyberCina fetch error:", e.message);
    }
  }

  // Deduplicate by slug (local wins over external)
  const seen = new Set();
  allPosts = allPosts.filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });

  // Sort newest first
  allPosts.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  const total = allPosts.length;
  const posts = allPosts.slice(offset, offset + limit);

  res.json({ posts, total, page, limit });
}));

app.get("/api/blog/:slug", asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const source = await getBlogSource();

  // Try local first
  if (source === "local" || source === "both") {
    const row = await dbGet(`SELECT * FROM blog_posts WHERE slug = $1 AND is_published = 1`, [slug]);
    if (row) {
      await dbRun(`UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1`, [row.id]);
      return res.json({ ...row, source: "local" });
    }
  }

  // Fall back to external
  if (source === "external" || source === "both") {
    try {
      const { posts } = await getExternalPosts({ slug, limit: 1, offset: 0 });
      if (posts.length > 0) return res.json(normalizeExternalPost(posts[0]));
    } catch (e) {
      console.error("[blog/:slug] CyberCina error:", e.message);
    }
  }

  res.status(404).json({ error: "not_found" });
}));

/** Google review redirect: increment scan counter, redirect to Iraniu profile */
app.get("/go", asyncHandler(async (req, res) => {
  const t = req.query.t;
  const bidRaw = req.query.bid || "default";
  const bid = sanitizeBid(bidRaw);
  const key = "qr_" + bid.slice(0, 80);

  try {
    await dbRun(`INSERT INTO qr_scans (business_slug) VALUES ($1)`, [key]);
  } catch (e) {
    console.error("qr_scans insert", e);
  }

  // Redirect to Iraniu business profile page instead of Google directly
  const profileUrl = `/business?slug=${encodeURIComponent(bid)}`;
  res.redirect(302, profileUrl);
}));

const clientDist = path.join(__dirname, "..", "..", "client", "dist");

app.use("/chatbot/v1", chatbotRouter);

function mountProdStatic() {
  if (!fs.existsSync(clientDist)) {
    console.warn("client/dist not found — run: npm run build --prefix client");
    return;
  }
  const staticMw = express.static(clientDist, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if (/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff|woff2|ttf|eot|gif)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      }
    },
  });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/chatbot") || req.path === "/go") return next();
    return staticMw(req, res, next);
  });
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/chatbot") || req.path === "/go") return next();
    const indexHtml = path.join(clientDist, "index.html");
    if (fs.existsSync(indexHtml)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(indexHtml);
    } else next();
  });
}

async function main() {
  await bootstrapDb();
  await ensureSuperAdminFromEnv();

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

  app.listen(PORT, '0.0.0.0', () => {
    const mode = isProd ? "production" : "development";
    console.log(`Iraniu ${mode} — http://0.0.0.0:${PORT} (site + /api + /go on one port)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
