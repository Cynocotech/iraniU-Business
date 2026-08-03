import { sanitizeBid } from "./src/lib/redirect.js";

const dbSlug = "abtin-yeganeh---solicitor";
const sanitized = sanitizeBid(dbSlug);

console.log("Business slug in database:", dbSlug);
console.log("Sanitized for QR tracking:", sanitized);
console.log("\n✅ The QR system will use:", sanitized);
console.log("✅ Scans will be stored as:", `qr_${sanitized}`);
