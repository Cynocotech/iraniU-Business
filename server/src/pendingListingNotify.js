import { getEffectiveSmtpSettings, sendMailViaSettings, parseNotifyEmailList } from "./smtpSettings.js";
import { htmlNewListingInternalNotify } from "./emailBranding.js";
import { notifyTelegramNewPendingListing } from "./telegramNotify.js";

/** Notify admins (Telegram + optional email) when a new listing is submitted (pending review). */
export async function notifyAdminsNewPendingListing(row) {
  if (!row) return { skipped: true, reason: "no_row" };

  try {
    await notifyTelegramNewPendingListing(row);
  } catch (e) {
    console.error("[telegram] pending listing notify", e);
  }

  const s = await getEffectiveSmtpSettings();
  if (!s.notifyOnNewListing) return { skipped: true, reason: "disabled" };
  const emails = parseNotifyEmailList(s.notifyEmails);
  if (!emails.length) return { skipped: true, reason: "no_notify_emails" };

  const html = await htmlNewListingInternalNotify({
    nameFa: row.name_fa,
    slug: row.slug,
    city: row.city,
    listingContactEmail: row.listing_contact_email,
  });
  const subject = `New listing pending review — ${row.name_fa || row.slug}`;
  const text = [
    `Name: ${row.name_fa || "—"}`,
    `Slug: ${row.slug}`,
    `City: ${row.city || "—"}`,
    `Listing contact email: ${row.listing_contact_email || "—"}`,
  ].join("\n");

  const results = [];
  for (const to of emails) {
    try {
      const r = await sendMailViaSettings({ to, subject, html, text });
      results.push({ to, ...r });
    } catch (e) {
      console.error("[email] notify pending", to, e);
      results.push({ to, ok: false, error: String(e.message || e) });
    }
  }
  return { ok: true, results };
}
