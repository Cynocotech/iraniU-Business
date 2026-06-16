import { getEffectiveSmtpSettings, sendMailViaSettings } from "./smtpSettings.js";
import { htmlListingApprovedBranded, htmlListingRejectedBranded } from "./emailBranding.js";

async function siteBase() {
  return (
    (await getEffectiveSmtpSettings()).siteUrl ||
    String(process.env.PUBLIC_SITE_URL || process.env.SITE_BASE_URL || "").replace(/\/$/, "")
  );
}

export async function sendListingApprovedEmail({ to, nameFa, slug }) {
  const html = await htmlListingApprovedBranded({ nameFa, slug });
  const base = await siteBase();
  const text = `Your listing "${nameFa || slug}" was approved and published.\n${base ? `${base}/business?slug=${slug}` : ""}`;
  return sendMailViaSettings({
    to,
    subject: `Your listing was approved — ${nameFa || slug}`,
    html,
    text,
  });
}

export async function sendListingRejectedEmail({ to, nameFa, slug, reason }) {
  const html = await htmlListingRejectedBranded({ nameFa, slug, reason });
  const text = `Your listing "${nameFa || slug}" was rejected.\nReason: ${String(reason || "").trim() || "—"}`;
  return sendMailViaSettings({
    to,
    subject: `Your listing was rejected — ${nameFa || slug}`,
    html,
    text,
  });
}

export { htmlListingApprovedBranded as htmlListingApproved, htmlListingRejectedBranded as htmlListingRejected };
