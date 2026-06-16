import { dbAll } from "./db.js";
import { sendMailViaSettings } from "./smtpSettings.js";
import { htmlBroadcastBranded, stripDangerousHtml } from "./emailBranding.js";

export async function getBroadcastRecipientEmails(claimedOnly) {
  const only =
    claimedOnly === true || claimedOnly === 1 || String(claimedOnly || "").toLowerCase() === "true";
  const sql = only
    ? `SELECT DISTINCT listing_contact_email AS em FROM businesses
       WHERE listing_contact_email IS NOT NULL AND trim(listing_contact_email) != ''
       AND claimed = 1`
    : `SELECT DISTINCT listing_contact_email AS em FROM businesses
       WHERE listing_contact_email IS NOT NULL AND trim(listing_contact_email) != ''`;
  const rows = await dbAll(sql);
  const set = new Set();
  for (const r of rows) {
    const e = String(r.em || "")
      .trim()
      .toLowerCase();
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) set.add(e);
  }
  return [...set];
}

/**
 * @param {{ subject: string; body_html: string; claimed_only?: boolean }} opts
 */
export async function sendBroadcastToBusinesses(opts) {
  const subject = String(opts.subject || "").trim();
  if (!subject) return { error: "missing_subject" };
  const inner = stripDangerousHtml(opts.body_html || "");
  if (!inner.trim()) return { error: "missing_body" };
  const html = await htmlBroadcastBranded({ innerHtml: inner });
  const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const recipients = await getBroadcastRecipientEmails(opts.claimed_only);
  const sent = [];
  const failed = [];
  for (const to of recipients) {
    try {
      const r = await sendMailViaSettings({ to, subject, html, text });
      if (r && r.skipped) failed.push({ to, ...r });
      else sent.push(to);
    } catch (e) {
      failed.push({ to, error: String(e.message || e) });
    }
  }
  return {
    ok: true,
    recipient_count: recipients.length,
    sent_count: sent.length,
    failed_count: failed.length,
    failed,
  };
}
