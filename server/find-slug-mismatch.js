import "./src/env.js";
import { dbAll } from "./src/db.js";

async function findMismatch() {
  console.log("Finding slug mismatch...\n");

  const scans = await dbAll(`SELECT DISTINCT business_slug FROM qr_scans ORDER BY business_slug`);
  const businesses = await dbAll(`SELECT slug, name_fa FROM businesses ORDER BY slug`);

  console.log("QR Scans stored for:");
  scans.forEach(s => {
    const cleanSlug = s.business_slug.replace(/^qr_/, '');
    console.log(`  ${s.business_slug}`);
    console.log(`    → Looking for business: ${cleanSlug}`);
    
    const match = businesses.find(b => b.slug === cleanSlug);
    if (match) {
      console.log(`    ✅ MATCH: ${match.name_fa}`);
    } else {
      console.log(`    ❌ NO MATCH - Business not found!`);
      
      // Find similar
      const similar = businesses.filter(b => 
        b.slug.includes('abtin') || b.slug.includes('yeganeh') ||
        b.slug.includes('supermarket') || b.slug.includes('barakat')
      );
      if (similar.length > 0) {
        console.log(`    Similar businesses found:`);
        similar.forEach(sb => console.log(`      - ${sb.slug} (${sb.name_fa})`));
      }
    }
    console.log();
  });
}

findMismatch().catch(console.error);
