/**
 * Branded HTML emails — English, LTR, site colours, header/footer.
 */

import { getEffectiveSmtpSettings } from "./smtpSettings.js";

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{
 *   headerGradient?: string;
 *   headerIcon?: string;
 *   title: string;
 *   subtitle?: string;
 *   bodyHtml: string;
 *   footerNote?: string;
 * }} opts
 */
export async function wrapBrandedEmail(opts) {
  const s = await getEffectiveSmtpSettings();
  const primary = s.primaryColor || "#3a0b47";
  const mid = s.primaryMid || "#5c1f6e";
  const base = (s.siteUrl || "").replace(/\/$/, "");
  const logo = (s.logoUrl || "").trim();
  const gradient = opts.headerGradient || `linear-gradient(135deg, ${mid} 0%, ${primary} 100%)`;
  const subtitle = opts.subtitle != null ? escapeHtml(opts.subtitle) : "Iraniu — Iranian business directory";
  const icon = opts.headerIcon
    ? `<span style="font-size:1.75rem;margin-right:10px;vertical-align:middle;display:inline-block;">${opts.headerIcon}</span>`
    : "";
  const logoBlock = logo
    ? `<img src="${escapeHtml(logo)}" alt="Iraniu" width="120" height="auto" style="max-height:48px;display:block;margin:0 auto 12px;border-radius:8px;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:24px;background:#f4f0f7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(58,11,71,0.12);border:1px solid rgba(58,11,71,0.08);direction:ltr;text-align:left;">
    <tr>
      <td style="background:${gradient};color:#fff;padding:22px 24px;text-align:center;">
        ${logoBlock}
        <h1 style="margin:0;font-size:1.2rem;font-weight:800;line-height:1.45;direction:ltr;">${icon}${escapeHtml(opts.title)}</h1>
        <p style="margin:10px 0 0;opacity:0.92;font-size:0.88rem;">${subtitle}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 24px;color:#1a1520;line-height:1.75;font-size:0.95rem;direction:ltr;text-align:left;">
        ${opts.bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px 22px;color:#6b5f75;font-size:0.8rem;border-top:1px solid rgba(58,11,71,0.1);background:#faf8fc;text-align:center;direction:ltr;">
        ${escapeHtml(opts.footerNote || "This email was sent by Iraniu.")}
        ${base ? `<br><a href="${escapeHtml(base)}" style="color:${primary};font-weight:600;">${escapeHtml(base)}</a>` : ""}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function htmlListingApprovedBranded({ nameFa, slug }) {
  const s = await getEffectiveSmtpSettings();
  const base = (s.siteUrl || "").replace(/\/$/, "");
  const link = base ? `${base}/business?slug=${encodeURIComponent(slug)}` : "";
  const green = s.accentSuccess || "#15803d";
  const title = nameFa || "Your listing";
  const body = `
    <p style="margin:0 0 14px;">Hello,</p>
    <p style="margin:0 0 14px;">Your listing <strong>${escapeHtml(title)}</strong> has been reviewed and <strong style="color:${escapeHtml(green)};">published</strong>.</p>
    <p style="margin:0 0 18px;">You can view your listing and, if you wish, start an <strong>ownership claim</strong> from that page.</p>
    ${
      link
        ? `<p style="margin:0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:${escapeHtml(green)};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">View listing</a></p>`
        : ""
    }`;
  return wrapBrandedEmail({
    headerIcon: "✅",
    title: "Your listing was approved",
    bodyHtml: body,
  });
}

export async function htmlListingRejectedBranded({ nameFa, slug, reason }) {
  const s = await getEffectiveSmtpSettings();
  const base = (s.siteUrl || "").replace(/\/$/, "");
  const listings = base ? `${base}/listings` : "";
  const red = s.accentDanger || "#b91c1c";
  const title = nameFa || "Your listing";
  const reasonText = escapeHtml(String(reason || "").trim() || "No reason was recorded.");
  const body = `
    <p style="margin:0 0 14px;">Hello,</p>
    <p style="margin:0 0 14px;">Unfortunately your listing <strong>${escapeHtml(title)}</strong> (slug: <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px;">${escapeHtml(slug)}</code>) was <strong style="color:${escapeHtml(red)};">not approved</strong> and will not appear in the public directory.</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;margin:16px 0;">
      <p style="margin:0 0 6px;font-size:0.82rem;color:#6b5f75;font-weight:700;">Reason (from moderator)</p>
      <p style="margin:0;white-space:pre-wrap;">${reasonText}</p>
    </div>
    <p style="margin:0 0 14px;">After updating your details you may submit a new listing if you wish.</p>
    ${
      listings
        ? `<p style="margin:0;"><a href="${escapeHtml(listings)}" style="display:inline-block;background:${escapeHtml(red)};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">Browse listings</a></p>`
        : ""
    }`;
  return wrapBrandedEmail({
    headerIcon: "⛔",
    title: "Your listing was rejected",
    bodyHtml: body,
  });
}

export async function htmlNewListingInternalNotify({ nameFa, slug, city, listingContactEmail }) {
  const s = await getEffectiveSmtpSettings();
  const base = (s.siteUrl || "").replace(/\/$/, "");
  const adminLink = base ? `${base}/admin` : "";
  const body = `
    <p style="margin:0 0 12px;"><strong>New listing</strong> is waiting for review.</p>
    <ul style="margin:0;padding-left:1.25rem;list-style:disc;">
      <li><strong>Name:</strong> ${escapeHtml(nameFa || "—")}</li>
      <li><strong>Slug:</strong> ${escapeHtml(slug)}</li>
      <li><strong>City:</strong> ${escapeHtml(city || "—")}</li>
      <li><strong>Listing contact email:</strong> ${escapeHtml(listingContactEmail || "—")}</li>
    </ul>
    ${
      adminLink
        ? `<p style="margin:18px 0 0;"><a href="${escapeHtml(adminLink)}" style="display:inline-block;background:${escapeHtml(s.primaryMid)};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">Open admin panel</a></p>`
        : ""
    }`;
  return wrapBrandedEmail({
    headerIcon: "📋",
    title: "New listing pending review",
    subtitle: "Internal notice — administrators",
    bodyHtml: body,
  });
}

export async function htmlVerifyBusinessSignupBranded({ nameFa, verifyUrl }) {
  const s = await getEffectiveSmtpSettings();
  const primary = s.primaryMid || "#5c1f6e";
  const title = nameFa || "Your listing";
  const body = `
    <p style="margin:0 0 14px;">Hello,</p>
    <p style="margin:0 0 14px;">Thanks for listing <strong>${escapeHtml(title)}</strong> on Iraniu. Confirm your email to set a password and get a manager account linked to this listing automatically.</p>
    ${
      verifyUrl
        ? `<p style="margin:0 0 18px;"><a href="${escapeHtml(verifyUrl)}" style="display:inline-block;background:${escapeHtml(primary)};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">Verify email & set password</a></p>`
        : ""
    }
    <p style="margin:0;font-size:0.82rem;color:#6b5f75;">This link expires in 48 hours. If you didn't submit this listing, you can ignore this email.</p>`;
  return wrapBrandedEmail({
    headerIcon: "✉️",
    title: "Confirm your email",
    bodyHtml: body,
  });
}

export async function htmlPasswordResetBranded({ name, resetUrl }) {
  const s = await getEffectiveSmtpSettings();
  const red = s.accentDanger || "#b91c1c";
  const body = `
    <p style="margin:0 0 14px;">Hello${name ? ` ${escapeHtml(name)}` : ""},</p>
    <p style="margin:0 0 14px;">We received a request to reset your password.</p>
    ${
      resetUrl
        ? `<p style="margin:0 0 18px;"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:${escapeHtml(red)};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">Reset password</a></p>`
        : ""
    }
    <p style="margin:0;font-size:0.82rem;color:#6b5f75;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`;
  return wrapBrandedEmail({
    headerIcon: "🔑",
    title: "Reset your password",
    bodyHtml: body,
  });
}

export async function htmlBroadcastBranded({ innerHtml }) {
  return wrapBrandedEmail({
    headerIcon: "✉️",
    title: "Message from Iraniu",
    bodyHtml: `<div style="font-size:0.95rem;line-height:1.75;">${innerHtml}</div>`,
  });
}

export function stripDangerousHtml(html) {
  return String(html || "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

/** RTL Persian branded email wrapper */
export async function wrapBrandedEmailFa(opts) {
  const s = await getEffectiveSmtpSettings();
  const primary = s.primaryColor || "#3a0b47";
  const mid = s.primaryMid || "#5c1f6e";
  const base = (s.siteUrl || "").replace(/\/$/, "");
  const logo = (s.logoUrl || "").trim();
  const gradient = opts.headerGradient || `linear-gradient(135deg, ${mid} 0%, ${primary} 100%)`;
  const logoBlock = logo
    ? `<img src="${escapeHtml(logo)}" alt="IraniU" width="120" height="auto" style="max-height:48px;display:block;margin:0 auto 12px;border-radius:8px;" />`
    : "";
  const icon = opts.headerIcon
    ? `<span style="font-size:1.75rem;margin-left:10px;vertical-align:middle;display:inline-block;">${opts.headerIcon}</span>`
    : "";
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:24px;background:#f4f0f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(58,11,71,0.12);border:1px solid rgba(58,11,71,0.08);direction:rtl;text-align:right;">
    <tr>
      <td style="background:${gradient};color:#fff;padding:22px 24px;text-align:center;">
        ${logoBlock}
        <h1 style="margin:0;font-size:1.2rem;font-weight:800;line-height:1.45;direction:rtl;">${icon}${escapeHtml(opts.title)}</h1>
        <p style="margin:10px 0 0;opacity:0.92;font-size:0.88rem;">${escapeHtml(opts.subtitle || "IraniU — فهرست کسب‌وکارهای ایرانی در بریتانیا")}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 24px;color:#1a1520;line-height:1.9;font-size:0.95rem;direction:rtl;text-align:right;">
        ${opts.bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px 22px;color:#6b5f75;font-size:0.8rem;border-top:1px solid rgba(58,11,71,0.1);background:#faf8fc;text-align:center;direction:rtl;">
        این ایمیل توسط IraniU ارسال شده است.
        ${base ? `<br><a href="${escapeHtml(base)}" style="color:${primary};font-weight:600;">${escapeHtml(base)}</a>` : ""}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Template 1: Business registration received (Persian) */
export async function htmlBusinessRegistrationReceivedFa({ nameFa }) {
  const body = `
    <p style="margin:0 0 14px;">با سلام و احترام،</p>
    <p style="margin:0 0 14px;">درخواست شما برای ثبت کسب‌وکار <strong>${escapeHtml(nameFa || "")}</strong> در وب‌سایت IraniU با موفقیت دریافت شد.</p>
    <p style="margin:0 0 14px;">تیم ما در حال بررسی اطلاعات ارسالی شماست. پس از تأیید نهایی، از طریق ایمیل یا تماس تلفنی با شما ارتباط خواهیم گرفت.</p>
    <p style="margin:0 0 14px;padding:10px 14px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;font-size:0.88rem;">📧 لطفاً پوشه <strong>Spam / Junk</strong> ایمیل خود را نیز بررسی کنید تا ایمیل‌های ما را از دست ندهید.</p>
    <p style="margin:0 0 6px;font-size:0.85rem;color:#6b5f75;">از همراهی شما سپاسگزاریم.</p>
    <hr style="border:none;border-top:1px solid #ede9f3;margin:14px 0;" />
    <ul style="margin:0;padding-right:1.25rem;font-size:0.85rem;color:#6b5f75;list-style:disc;">
      <li>وب‌سایت: <a href="https://iraniu.uk" style="color:#5c1f6e;">iraniu.uk</a></li>
    </ul>
    <p style="margin:10px 0 0;font-size:0.85rem;color:#6b5f75;">با احترام،<br><strong>تیم پشتیبانی IraniU</strong></p>`;
  return wrapBrandedEmailFa({ headerIcon: "📩", title: "درخواست ثبت کسب‌وکار دریافت شد", bodyHtml: body });
}

/** Template 2: Business activated with temp password (Persian) */
export async function htmlBusinessActivatedFa({ nameFa, username, tempPassword, loginUrl }) {
  const body = `
    <p style="margin:0 0 14px;">با سلام،</p>
    <p style="margin:0 0 14px;">کسب‌وکار <strong>${escapeHtml(nameFa || "")}</strong> در IraniU تأیید و فعال شد. از این پس می‌توانید اطلاعات خود را مدیریت کنید.</p>
    <div style="background:#f4f0f7;border-radius:10px;padding:14px 16px;margin:14px 0;border:1px solid #ede9f3;">
      <p style="margin:0 0 8px;"><strong>نام کاربری:</strong> <span dir="ltr" style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:4px;">${escapeHtml(username || "")}</span></p>
      <p style="margin:0 0 8px;"><strong>رمز عبور موقت:</strong> <span dir="ltr" style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:4px;">${escapeHtml(tempPassword || "")}</span></p>
      ${loginUrl ? `<p style="margin:0;"><strong>لینک ورود:</strong> <a href="${escapeHtml(loginUrl)}" dir="ltr" style="color:#5c1f6e;">${escapeHtml(loginUrl)}</a></p>` : ""}
    </div>
    <p style="margin:0 0 14px;padding:10px 14px;background:#fff3e0;border-radius:8px;border:1px solid #ffb74d;font-size:0.9rem;">⚠️ <strong>نکته مهم:</strong> لطفاً پس از اولین ورود به حساب کاربری، حتماً رمز عبور خود را تغییر دهید.</p>
    <p style="margin:0 0 14px;padding:10px 14px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;font-size:0.88rem;">📧 لطفاً پوشه <strong>Spam / Junk</strong> ایمیل خود را نیز بررسی کنید.</p>
    <hr style="border:none;border-top:1px solid #ede9f3;margin:14px 0;" />
    <p style="margin:0;font-size:0.85rem;color:#6b5f75;">با احترام،<br><strong>تیم پشتیبانی IraniU</strong></p>`;
  return wrapBrandedEmailFa({ headerIcon: "✅", title: "حساب کاربری شما فعال شد", bodyHtml: body });
}

/** Template 3: Claim received (Persian) */
export async function htmlClaimReceivedFa({ businessName }) {
  const body = `
    <p style="margin:0 0 14px;">با سلام،</p>
    <p style="margin:0 0 14px;">درخواست شما مبنی بر مالکیت (Claim) کسب‌وکار <strong>${escapeHtml(businessName || "")}</strong> در وب‌سایت IraniU دریافت گردید.</p>
    <p style="margin:0 0 14px;">کارشناسان ما در حال بررسی و صحت‌سنجی اطلاعات هستند و به زودی از طریق ایمیل یا تماس تلفنی نتیجه را به شما اعلام خواهیم کرد.</p>
    <p style="margin:0 0 14px;padding:10px 14px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;font-size:0.88rem;">📧 لطفاً پوشه <strong>Spam / Junk</strong> ایمیل خود را نیز بررسی کنید تا از به‌روزرسانی‌های ما مطلع شوید.</p>
    <p style="margin:0 0 6px;font-size:0.85rem;color:#6b5f75;">از شکیبایی شما سپاسگزاریم.</p>
    <hr style="border:none;border-top:1px solid #ede9f3;margin:14px 0;" />
    <p style="margin:0;font-size:0.85rem;color:#6b5f75;">با احترام،<br><strong>تیم پشتیبانی IraniU</strong></p>`;
  return wrapBrandedEmailFa({ headerIcon: "📋", title: "درخواست مالکیت کسب‌وکار دریافت شد", bodyHtml: body });
}

/** Template 5: Welcome email sent by admin when a business is added directly (Persian) */
export async function htmlAdminAddedBusinessWelcomeFa({ nameFa, slug, city, phone, address }) {
  const s = await getEffectiveSmtpSettings();
  const base = (s.siteUrl || "").replace(/\/$/, "");
  const primary = s.primaryMid || "#5c1f6e";
  const listingUrl  = base ? `${base}/business?slug=${encodeURIComponent(slug)}` : "";
  const claimUrl    = base ? `${base}/claim?slug=${encodeURIComponent(slug)}&business=${encodeURIComponent(nameFa || "")}` : "";
  const signupUrl   = base ? `${base}/manager-signup` : "";
  const loginUrl    = base ? `${base}/login` : "";
  const body = `
    <p style="margin:0 0 14px;">با سلام و احترام،</p>
    <p style="margin:0 0 14px;">کسب‌وکار شما با نام <strong>${escapeHtml(nameFa || "")}</strong> در فهرست IraniU ثبت و منتشر شد. از این پس کاربران می‌توانند اطلاعات شما را در سایت مشاهده کنند.</p>

    <div style="background:#f4f0f7;border-radius:10px;padding:14px 16px;margin:14px 0;border:1px solid #ede9f3;">
      <p style="margin:0 0 6px;font-weight:700;font-size:0.9rem;color:#3a0b47;">جزئیات آگهی شما</p>
      <p style="margin:0 0 6px;"><strong>نام:</strong> ${escapeHtml(nameFa || "—")}</p>
      ${city    ? `<p style="margin:0 0 6px;"><strong>شهر:</strong> ${escapeHtml(city)}</p>` : ""}
      ${phone   ? `<p style="margin:0 0 6px;"><strong>تلفن:</strong> <span dir="ltr">${escapeHtml(phone)}</span></p>` : ""}
      ${address ? `<p style="margin:0 0 6px;"><strong>آدرس:</strong> ${escapeHtml(address)}</p>` : ""}
      ${listingUrl ? `<p style="margin:0;"><strong>لینک آگهی:</strong> <a href="${escapeHtml(listingUrl)}" dir="ltr" style="color:${escapeHtml(primary)};">${escapeHtml(listingUrl)}</a></p>` : ""}
    </div>

    <p style="margin:0 0 10px;font-weight:600;">می‌خواهید کسب‌وکارتان را مدیریت کنید؟</p>
    <p style="margin:0 0 14px;font-size:0.92rem;">با ثبت‌نام و دریافت پنل مدیریت می‌توانید اطلاعات، تصاویر و ساعات کاری خود را ویرایش کنید و نشان تأیید مالکیت دریافت کنید.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      <tr>
        ${listingUrl ? `<td style="padding-left:0;padding-left:0;">
          <a href="${escapeHtml(listingUrl)}" style="display:inline-block;background:${escapeHtml(primary)};color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:700;font-size:0.9rem;margin-left:8px;">مشاهده آگهی</a>
        </td>` : ""}
        ${claimUrl ? `<td style="padding-right:0;">
          <a href="${escapeHtml(claimUrl)}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:700;font-size:0.9rem;">ادعای مالکیت (Claim)</a>
        </td>` : ""}
      </tr>
    </table>

    <div style="background:#f0f6ff;border-radius:10px;padding:14px 16px;margin:0 0 14px;border:1px solid #b0c4de;font-size:0.88rem;">
      <p style="margin:0 0 8px;font-weight:700;color:#1a3a5c;">برای مدیریت کسب‌وکار</p>
      ${signupUrl ? `<p style="margin:0 0 6px;">🔐 <strong>ثبت‌نام:</strong> <a href="${escapeHtml(signupUrl)}" dir="ltr" style="color:${escapeHtml(primary)};">${escapeHtml(signupUrl)}</a></p>` : ""}
      ${loginUrl  ? `<p style="margin:0;">🔑 <strong>ورود (اگر حساب دارید):</strong> <a href="${escapeHtml(loginUrl)}" dir="ltr" style="color:${escapeHtml(primary)};">${escapeHtml(loginUrl)}</a></p>` : ""}
    </div>

    <p style="margin:0 0 14px;padding:10px 14px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;font-size:0.88rem;">📧 لطفاً پوشه <strong>Spam / Junk</strong> ایمیل خود را نیز بررسی کنید تا ایمیل‌های ما را از دست ندهید.</p>
    <hr style="border:none;border-top:1px solid #ede9f3;margin:14px 0;" />
    <p style="margin:0;font-size:0.85rem;color:#6b5f75;">با احترام،<br><strong>تیم پشتیبانی IraniU</strong></p>`;
  return wrapBrandedEmailFa({ headerIcon: "🎉", title: "کسب‌وکار شما در IraniU ثبت شد", bodyHtml: body });
}

/** Template 6: Claim verified and account activated with temp password (Persian) */
export async function htmlClaimVerifiedFa({ businessName, username, tempPassword, loginUrl }) {
  const body = `
    <p style="margin:0 0 14px;">با سلام،</p>
    <p style="margin:0 0 14px;">ضمن تبریک، درخواست مالکیت شما برای کسب‌وکار <strong>${escapeHtml(businessName || "")}</strong> در IraniU با موفقیت تأیید شد. دسترسی مدیریت برای شما فعال شده است.</p>
    <div style="background:#f4f0f7;border-radius:10px;padding:14px 16px;margin:14px 0;border:1px solid #ede9f3;">
      <p style="margin:0 0 8px;"><strong>نام کاربری:</strong> <span dir="ltr" style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:4px;">${escapeHtml(username || "")}</span></p>
      <p style="margin:0 0 8px;"><strong>رمز عبور موقت:</strong> <span dir="ltr" style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:4px;">${escapeHtml(tempPassword || "")}</span></p>
      ${loginUrl ? `<p style="margin:0;"><strong>لینک ورود:</strong> <a href="${escapeHtml(loginUrl)}" dir="ltr" style="color:#5c1f6e;">${escapeHtml(loginUrl)}</a></p>` : ""}
    </div>
    <p style="margin:0 0 14px;padding:10px 14px;background:#fff3e0;border-radius:8px;border:1px solid #ffb74d;font-size:0.9rem;">⚠️ <strong>لطفاً جهت حفظ امنیت</strong>، پس از اولین ورود، رمز عبور خود را تغییر دهید.</p>
    <p style="margin:0 0 14px;padding:10px 14px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;font-size:0.88rem;">📧 لطفاً پوشه <strong>Spam / Junk</strong> ایمیل خود را نیز بررسی کنید.</p>
    <hr style="border:none;border-top:1px solid #ede9f3;margin:14px 0;" />
    <p style="margin:0;font-size:0.85rem;color:#6b5f75;">با احترام،<br><strong>تیم پشتیبانی IraniU</strong></p>`;
  return wrapBrandedEmailFa({ headerIcon: "🎉", title: "تأیید مالکیت و فعال‌سازی حساب کاربری", bodyHtml: body });
}
