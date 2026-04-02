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
export function wrapBrandedEmail(opts) {
  const s = getEffectiveSmtpSettings();
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

export function htmlListingApprovedBranded({ nameFa, slug }) {
  const s = getEffectiveSmtpSettings();
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

export function htmlListingRejectedBranded({ nameFa, slug, reason }) {
  const s = getEffectiveSmtpSettings();
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

export function htmlNewListingInternalNotify({ nameFa, slug, city, listingContactEmail }) {
  const s = getEffectiveSmtpSettings();
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

export function htmlBroadcastBranded({ innerHtml }) {
  return wrapBrandedEmail({
    headerIcon: "✉️",
    title: "Message from Iraniu",
    bodyHtml: `<div style="font-size:0.95rem;line-height:1.75;">${innerHtml}</div>`,
  });
}

export function stripDangerousHtml(html) {
  return String(html || "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}
