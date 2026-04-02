import nodemailer from "nodemailer";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  return transporter;
}

function siteBase() {
  return String(process.env.PUBLIC_SITE_URL || process.env.SITE_BASE_URL || "").replace(/\/$/, "");
}

/** قالب تأیید — تم سبز */
export function htmlListingApproved({ nameFa, slug }) {
  const base = siteBase();
  const link = base ? `${base}/business?slug=${encodeURIComponent(slug)}` : "";
  const title = escapeHtml(nameFa || "آگهی شما");
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px;background:#eef2ef;font-family:Tahoma,Segoe UI,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(46,125,50,0.12);">
    <tr>
      <td style="background:linear-gradient(135deg,#2e7d32 0%,#1b5e20 100%);color:#fff;padding:20px 24px;">
        <h1 style="margin:0;font-size:1.25rem;font-weight:700;">آگهی شما تأیید شد</h1>
        <p style="margin:8px 0 0;opacity:0.95;font-size:0.9rem;">ایرانیو — دایرکتوری کسب‌وکارهای ایرانی</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;color:#1a1f24;line-height:1.8;font-size:0.95rem;">
        <p style="margin:0 0 12px;">سلام،</p>
        <p style="margin:0 0 12px;">آگهی <strong>${title}</strong> توسط مدیر بررسی و <strong style="color:#2e7d32;">منتشر شد</strong>.</p>
        <p style="margin:0 0 16px;">اکنون می‌توانید آگهی خود را در سایت ببینید و در صورت تمایل از همان صفحه برای <strong>ادعای مالکیت</strong> اقدام کنید.</p>
        ${
          link
            ? `<p style="margin:0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2e7d32;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">مشاهدهٔ آگهی</a></p>`
            : ""
        }
      </td>
    </tr>
    <tr>
      <td style="padding:12px 24px 20px;color:#5c6670;font-size:0.82rem;border-top:1px solid #e8ebe9;">
        این ایمیل به‌صورت خودکار ارسال شده است.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** قالب رد — تم قرمز */
export function htmlListingRejected({ nameFa, slug, reason }) {
  const base = siteBase();
  const listings = base ? `${base}/listings` : "";
  const title = escapeHtml(nameFa || "آگهی شما");
  const reasonText = escapeHtml(String(reason || "").trim() || "دلیلی در سیستم ثبت نشده است.");
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px;background:#f5ecec;font-family:Tahoma,Segoe UI,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(198,40,40,0.15);">
    <tr>
      <td style="background:linear-gradient(135deg,#c62828 0%,#8e0000 100%);color:#fff;padding:20px 24px;">
        <h1 style="margin:0;font-size:1.25rem;font-weight:700;">آگهی شما رد شد</h1>
        <p style="margin:8px 0 0;opacity:0.95;font-size:0.9rem;">ایرانیو — دایرکتوری کسب‌وکارهای ایرانی</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;color:#1a1f24;line-height:1.8;font-size:0.95rem;">
        <p style="margin:0 0 12px;">سلام،</p>
        <p style="margin:0 0 12px;">متأسفانه آگهی <strong>${title}</strong> (نامک: <span dir="ltr">${escapeHtml(slug)}</span>) <strong style="color:#c62828;">مورد تأیید قرار نگرفت</strong> و در سایت عمومی نمایش داده نمی‌شود.</p>
        <div style="background:#fff5f5;border:1px solid #ffcdd2;border-radius:8px;padding:14px 16px;margin:16px 0;">
          <p style="margin:0 0 6px;font-size:0.82rem;color:#5c6670;font-weight:600;">دلیل (از سوی مدیر)</p>
          <p style="margin:0;white-space:pre-wrap;">${reasonText}</p>
        </div>
        <p style="margin:0 0 12px;">در صورت نیاز می‌توانید پس از اصلاح اطلاعات، دوباره از فرم ثبت کسب‌وکار اقدام کنید.</p>
        ${
          listings
            ? `<p style="margin:0;"><a href="${escapeHtml(listings)}" style="display:inline-block;background:#c62828;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">مشاهدهٔ فهرست آگهی‌ها</a></p>`
            : ""
        }
      </td>
    </tr>
    <tr>
      <td style="padding:12px 24px 20px;color:#5c6670;font-size:0.82rem;border-top:1px solid #fce4ec;">
        این ایمیل به‌صورت خودکار ارسال شده است.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendListingApprovedEmail({ to, nameFa, slug }) {
  const tx = getTransporter();
  if (!tx) return { skipped: true, reason: "smtp_not_configured" };
  const email = String(to || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { skipped: true, reason: "no_valid_email" };
  const from = process.env.EMAIL_FROM?.trim() || "Iraniu <no-reply@iraniu.uk>";
  const html = htmlListingApproved({ nameFa, slug });
  const subj = `آگهی شما تأیید شد — ${nameFa || slug}`;
  await tx.sendMail({
    from,
    to: email,
    subject: subj,
    html,
    text: `آگهی ${nameFa || slug} تأیید و منتشر شد.\n${siteBase()}/business?slug=${slug}`,
  });
  return { ok: true };
}

export async function sendListingRejectedEmail({ to, nameFa, slug, reason }) {
  const tx = getTransporter();
  if (!tx) return { skipped: true, reason: "smtp_not_configured" };
  const email = String(to || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { skipped: true, reason: "no_valid_email" };
  const from = process.env.EMAIL_FROM?.trim() || "Iraniu <no-reply@iraniu.uk>";
  const html = htmlListingRejected({ nameFa, slug, reason });
  const subj = `آگهی شما رد شد — ${nameFa || slug}`;
  await tx.sendMail({
    from,
    to: email,
    subject: subj,
    html,
    text: `آگهی ${nameFa || slug} رد شد.\nدلیل: ${String(reason || "").trim() || "—"}`,
  });
  return { ok: true };
}
