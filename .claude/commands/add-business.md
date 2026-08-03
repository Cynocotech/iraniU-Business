# Add Business from Website

Add a new business listing to directory.iraniu.uk by scraping a website URL.

**Usage:** `/add-business <url>`

## Full Workflow

### 1. Scrape the website

Fetch the homepage URL provided in `$ARGUMENTS`. Also try `/contact`, `/about`, `/about-us` pages.

Extract:
- Business name (English)
- Address (full street address + postcode)
- Phone numbers (landline + mobile)
- Email address
- WhatsApp link
- Social media URLs (Instagram, Facebook, LinkedIn, Twitter/X, TikTok)
- Website URL
- Description / about text
- Logo image URL
- Cover/hero image URL
- Gallery image URLs
- Opening hours
- Services offered

### 2. Duplicate check

Run against the DB before inserting:

```
psql "postgresql://directory_user:26f026561225054737686ac538d41d44@localhost:5432/directory_iraniu_uk" -c "
SELECT id, name_fa, name_en, slug, phone, address FROM businesses
WHERE name_en ILIKE '%<name>%'
   OR phone ILIKE '%<phone>%'
   OR address ILIKE '%<street>%'
LIMIT 5;"
```

If a match is found, report it and stop. Do not insert duplicates.

### 3. Download ALL images and upload to S3

**Never store external image URLs in the DB.** Always download first, upload to S3, then use the S3 URL.

S3 credentials are stored in `server/app_meta` DB table (keys: `aws_s3_bucket`, `aws_s3_region`, `aws_s3_access_key_id`, `aws_s3_secret_access_key`). Read them from there at runtime — never hardcode.

Use this Node.js snippet for each image (run from `/root/directory-iraniu-uk/server`):

```js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { pool } from "../src/db.js";

const { rows } = await pool.query("SELECT key, value FROM app_meta WHERE key LIKE 'aws_s3_%'");
const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));

const res = await fetch(imageUrl);
const buffer = Buffer.from(await res.arrayBuffer());
const contentType = res.headers.get("content-type") || "image/jpeg";
const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";

const key = `business-images/business-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

const client = new S3Client({
  region: cfg.aws_s3_region,
  credentials: { accessKeyId: cfg.aws_s3_access_key_id, secretAccessKey: cfg.aws_s3_secret_access_key }
});

await client.send(new PutObjectCommand({ Bucket: cfg.aws_s3_bucket, Key: key, Body: buffer, ContentType: contentType }));
const s3Url = `https://${cfg.aws_s3_bucket}.s3.${cfg.aws_s3_region}.amazonaws.com/${key}`;
```

- First image → `logo_url`
- Second/hero image → `cover_image_url`
- Additional images → `gallery_json` as JSON array of URL strings

### 4. Generate slug

Use the English business name: lowercase, spaces → hyphens, remove special chars.
Example: `"Studywise Group"` → `"studywise-group"`

Check slug is unique:
```sql
SELECT id FROM businesses WHERE slug = '<slug>';
```
If taken, append `-2`, `-3`, etc.

### 5. Write Persian name and description

- Transliterate the English name into Persian script for `name_fa`
- Write a full Persian HTML description using `<p>`, `<ul><li>`, `<h3>` tags
- Base it on real facts extracted from the website — do not invent services
- Set `description_original` = same as description (since this is manually sourced)
- Set `description_rewritten = 1`

### 6. Determine category

Pick the closest match from these common categories used in the DB:
مشاوره تحصیلی، رستوران، سوپرمارکت، خدمات حقوقی، وکیل، خدمات مالی، آرایشگاه، خدمات پزشکی، خدمات ساختمانی، عکاسی، گلفروشی، تالار پذیرایی، خدمات دیجیتال، صرافی، مشاور املاک

### 7. Build biolink_json

```json
{
  "headline": "<catchy Persian tagline>",
  "bio": "<one sentence Persian description>",
  "avatarUrl": "<S3 logo URL>",
  "themeId": 1,
  "backgroundImageUrl": "",
  "backgroundOverlay": "dark",
  "alert": { "enabled": false, "text": "" },
  "links": [
    { "label": "وبسایت", "url": "<website>", "icon": "globe" },
    { "label": "واتس‌اپ", "url": "https://wa.me/<number>", "icon": "message-circle" }
  ],
  "socialLinks": [
    { "platform": "instagram", "url": "<instagram url>" },
    { "platform": "facebook", "url": "<facebook url>" }
  ]
}
```

Only include links/socialLinks that were actually found. Omit missing ones.

### 8. Look up postcode lat/lon

If postcode was found, check if we already have coordinates for a nearby postcode:
```sql
SELECT postcode_latitude, postcode_longitude FROM businesses
WHERE postcode ILIKE '<first 3-4 chars of postcode>%'
  AND postcode_latitude IS NOT NULL LIMIT 1;
```
Use those coordinates. If not found, estimate from London defaults (51.509865, -0.118092) or leave NULL.

### 9. Insert into DB

```sql
INSERT INTO businesses (
  slug, name_fa, name_en, category,
  phone, mobile, address, postcode, city,
  postcode_latitude, postcode_longitude,
  logo_url, cover_image_url, gallery_json,
  description, description_original, description_rewritten,
  listing_title, subtitle,
  biolink_json,
  listing_contact_email,
  status, listing_approval, package, claimed,
  created_at
) VALUES (
  ...,
  'active', 'approved', 'basic', 0,
  now()::text
) RETURNING id, slug, name_en;
```

Fields to leave NULL if not found: `mobile`, `cover_image_url`, `gallery_json`, `listing_contact_email`, `postcode_latitude`, `postcode_longitude`.

### 10. Confirm and report

After inserting, show a summary table:

| Field | Value |
|---|---|
| ID | ... |
| Slug | ... |
| Name (EN) | ... |
| Name (FA) | ... |
| Phone | ... |
| Address | ... |
| Logo | S3 URL |
| Status | active / approved |

Also note any fields that could not be found on the website (so the user can fill them in manually).
