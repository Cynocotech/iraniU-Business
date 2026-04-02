import "./env.js";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db, ensureRestaurantSafraDemo } from "./db.js";
import { base64UrlToString, resolveReviewRedirectUrl, sanitizeBid } from "./lib/redirect.js";
import { parseAuthHeader, stripManagerRow, hashPassword } from "./authUtil.js";
import { requireSuperAdmin, requireManager } from "./authMiddleware.js";
import { registerAuthRoutes, ensureSuperAdminFromEnv } from "./authRoutes.js";
import { sendBusinessDirectoryPost } from "./telegramBusinessChannel.js";
import { actorFromAuth, writeSystemLog } from "./systemLog.js";
import { isTwilioModuleEnabled } from "./twilioModuleSettings.js";
import { sendListingApprovedEmail, sendListingRejectedEmail } from "./listingDecisionEmail.js";

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
  "biolink_json",
  "careers_title",
  "careers_text",
  "reservation_link",
  "call_tracking_enabled",
  "call_tracking_number",
  "call_forward_number",
  "listing_contact_email",
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

app.get("/api/businesses", (req, res) => {
  const auth = parseAuthHeader(req);
  const isAdmin = auth && auth.typ === "adm";
  const rows = isAdmin
    ? db.prepare(`SELECT * FROM businesses ORDER BY name_fa`).all()
    : db
        .prepare(
          `SELECT * FROM businesses WHERE (listing_approval = 'approved' OR listing_approval IS NULL OR listing_approval = '')
           AND (status IS NULL OR status = '' OR status = 'active')
           ORDER BY name_fa`
        )
        .all();
  res.json(rows);
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
const ADMIN_BUSINESSES_PAGE_SIZE_MAX = 100;

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
        Number(row.manager_id) === Number(auth.sub));
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

app.post("/api/businesses", (req, res) => {
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

function attachLinkedBusinesses(managerRow) {
  const linked_businesses = db
    .prepare(
      `SELECT id, slug, name_fa, status, claimed, package, city FROM businesses WHERE manager_id = ? ORDER BY name_fa`
    )
    .all(managerRow.id);
  return {
    ...stripManagerRow(managerRow),
    linked_businesses,
    password_set: !!managerRow.password_hash,
    totp_enabled: !!managerRow.totp_enabled,
  };
}

app.get("/api/managers", requireSuperAdmin, (_req, res) => {
  const rows = db.prepare(`SELECT * FROM managers ORDER BY created_at DESC`).all();
  res.json(rows.map((m) => attachLinkedBusinesses(m)));
});

app.get("/api/managers/:id", requireSuperAdmin, (req, res) => {
  const id = parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const m = db.prepare(`SELECT * FROM managers WHERE id = ?`).get(id);
  if (!m) return res.status(404).json({ error: "not_found" });
  res.json(attachLinkedBusinesses(m));
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
  if (password.length < 8) {
    return res.status(400).json({ error: "password_too_short", hint: "حداقل ۸ کاراکتر برای رمز مدیر" });
  }
  const login_username = login_username_raw;
  if (!MANAGER_LOGIN_USERNAME_RE.test(login_username)) {
    return res.status(400).json({
      error: "invalid_username",
      hint: "نام کاربری ۳ تا ۳۲ کاراکتر؛ فقط a-z، ۰-۹ و _",
    });
  }
  if (db.prepare(`SELECT id FROM managers WHERE login_username = ?`).get(login_username)) {
    return res.status(409).json({ error: "username_taken", hint: "این نام کاربری گرفته شده" });
  }
  try {
    const ph = hashPassword(password);
    const info = db
      .prepare(
        `INSERT INTO managers (email, name, phone, password_hash, login_username) VALUES (?, ?, ?, ?, ?)`
      )
      .run(email, name, phone, ph, login_username);
    const row = db.prepare(`SELECT * FROM managers WHERE id = ?`).get(info.lastInsertRowid);
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

app.patch("/api/admin/businesses/:slug/manager", requireSuperAdmin, (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug || "").trim());
  const exists = db.prepare(`SELECT slug FROM businesses WHERE slug = ?`).get(slug);
  if (!exists) return res.status(404).json({ error: "not_found" });
  const mid = req.body && req.body.manager_id;
  if (mid === null || mid === undefined || mid === "") {
    db.prepare(`UPDATE businesses SET manager_id = NULL WHERE slug = ?`).run(slug);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "business_manager_unlinked",
      targetType: "business",
      targetId: slug,
      message: `Manager unlinked from business ${slug}`,
    });
  } else {
    const id = parseInt(String(mid), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_manager_id" });
    const m = db.prepare(`SELECT id FROM managers WHERE id = ?`).get(id);
    if (!m) return res.status(400).json({ error: "invalid_manager_id" });
    db.prepare(`UPDATE businesses SET manager_id = ? WHERE slug = ?`).run(id, slug);
    writeSystemLog({
      ...actorFromAuth(req.auth),
      action: "business_manager_linked",
      targetType: "business",
      targetId: slug,
      message: `Manager #${id} linked to business ${slug}`,
    });
  }
  const row = db.prepare(`SELECT * FROM businesses WHERE slug = ?`).get(slug);
  res.json(row);
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
  const actorOk = ["system", "superadmin", "manager"].includes(actor);
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
      COALESCE(sa.name, mg.name) AS actor_name
    FROM system_logs sl
    LEFT JOIN super_admins sa
      ON sl.actor_type = 'superadmin'
      AND sl.actor_id IS NOT NULL AND TRIM(sl.actor_id) != ''
      AND sa.id = CAST(sl.actor_id AS INTEGER)
    LEFT JOIN managers mg
      ON sl.actor_type = 'manager'
      AND sl.actor_id IS NOT NULL AND TRIM(sl.actor_id) != ''
      AND mg.id = CAST(sl.actor_id AS INTEGER)
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
  const exists = db.prepare(`SELECT slug, manager_id FROM businesses WHERE slug = ?`).get(slug);
  if (!exists) {
    return res.status(404).json({ error: "not_found", slug, hint: "GET /api/businesses برای فهرست نامک‌ها" });
  }

  const auth = parseAuthHeader(req);
  if (!auth || (auth.typ !== "mgr" && auth.typ !== "adm")) {
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
        const m = db.prepare(`SELECT id FROM managers WHERE id = ?`).get(mid);
        if (!m) return res.status(400).json({ error: "invalid_manager_id" });
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
    if (key === "hours_json" || key === "gallery_json" || key === "biolink_json") {
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
    delete updates.claimed;
    delete updates.package;
    if (!isTwilioModuleEnabled()) {
      delete updates.call_tracking_enabled;
      delete updates.call_tracking_number;
      delete updates.call_forward_number;
    }
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
       LEFT JOIN managers m ON m.id = b.manager_id
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
           LEFT JOIN managers m ON m.id = b.manager_id
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

app.get("/api/manager/twilio-settings", requireManager, (req, res) => {
  const m = db
    .prepare(
      `SELECT twilio_account_sid, twilio_auth_token, twilio_phone_number
       FROM managers WHERE id = ?`
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
  db.prepare(`UPDATE managers SET ${setClause} WHERE id = @id`).run({ ...updates, id: req.auth.sub });
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
       FROM managers WHERE id = ?`
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
