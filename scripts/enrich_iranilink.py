#!/usr/bin/env python3
"""
Enrichment pass for iranilink-imported businesses.
For each il- pending business:
  1. Re-fetches the iranilink page to extract website + social links → biolink_json
  2. Downloads images from source (Supabase) → uploads to our S3 → updates cover + gallery
"""

import json, re, time, random, io, os, mimetypes, hashlib
from pathlib import Path
from urllib.parse import urlparse

import requests
import psycopg2
import boto3
from botocore.exceptions import ClientError

# ── Config ─────────────────────────────────────────────────────────────────────

DB_URL   = "postgresql://directory_user:26f026561225054737686ac538d41d44@localhost:5432/directory_iraniu_uk"
BASE_URL = "https://iranilink.co.uk"
SCRIPTS  = Path(__file__).parent
STATE_FILE  = SCRIPTS / "enrich_state.json"
SRC_MAP     = SCRIPTS / "slug_source_map.json"
SCRAPE_STATE = SCRIPTS / "scrape_state.json"

MAX_GALLERY = 4   # slots in our gallery

_DESKTOP_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

# ── Session ────────────────────────────────────────────────────────────────────

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Encoding": "identity",
        "Accept-Language": "en-GB,en;q=0.9,fa;q=0.8",
        "Cache-Control":   "no-cache",
        "Connection":      "keep-alive",
    })
    return s

SESSION = make_session()

def _ua():
    return random.choice(_DESKTOP_UAS)

def fetch_page(url: str, referer: str = BASE_URL) -> str | None:
    for attempt in range(3):
        try:
            SESSION.headers.update({"User-Agent": _ua(), "Referer": referer})
            r = SESSION.get(url, timeout=30)
            if r.status_code == 429 or r.status_code == 503:
                wait = 45 + random.uniform(0, 20)
                print(f"    Rate limited, waiting {wait:.0f}s…")
                time.sleep(wait)
                continue
            if r.status_code != 200:
                return None
            return r.text
        except Exception as e:
            if attempt < 2:
                time.sleep(10)
            else:
                print(f"    Fetch error: {e}")
    return None

def human_pause():
    time.sleep(random.uniform(2.5, 6.0))
    if random.random() < 0.10:
        time.sleep(random.uniform(8, 18))

# ── JSON-LD extraction ─────────────────────────────────────────────────────────

def extract_jsonld(html: str) -> list[dict]:
    blocks = []
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            blocks.append(json.loads(raw.strip()))
        except Exception:
            pass
    # Also scan RSC push format
    for raw in re.findall(r'\\"@type\\":\\"(?:LocalBusiness|Restaurant|Store|[A-Za-z]+)\\".*?(?=\n|$)', html):
        try:
            unescaped = raw.replace('\\"', '"').replace('\\\\', '\\')
            blocks.append(json.loads(unescaped))
        except Exception:
            pass
    return blocks

def find_business_block(blocks: list[dict]) -> dict | None:
    BUSINESS_TYPES = {
        "LocalBusiness","Restaurant","FoodEstablishment","GroceryStore","Store",
        "HealthAndBeautyBusiness","LegalService","MedicalBusiness","FinancialService",
        "RealEstateAgent","TravelAgency","Dentist","MedicalClinic","Optician",
        "Florist","HairSalon","BeautySalon","NailSalon","SpaOrHealthClub",
        "AutoRepair","Locksmith","Electrician","Plumber","GeneralContractor",
        "ClothingStore","JewelryStore","BookStore","PetStore","ShoeStore",
        "EntertainmentBusiness","SportsActivityLocation","CivicStructure",
        "ProfessionalService","Accountant","Attorney","Notary","InsuranceAgency",
        "Bakery","CafeOrCoffeeShop","FastFoodRestaurant","IceCreamShop",
        "Bar","Winery","Brewery","Supermarket","ConvenienceStore","Pharmacy",
        "Veterinarian","ChildCare","EducationalOrganization","School","CollegeOrUniversity",
        "Hotel","LodgingBusiness","Campground","BedAndBreakfast","Motel",
        "RVPark","Hostel","Resort",
    }
    for b in blocks:
        t = b.get("@type", "")
        types = [t] if isinstance(t, str) else (t if isinstance(t, list) else [])
        if any(tp in BUSINESS_TYPES for tp in types):
            return b
    return None

# ── Social parsing ─────────────────────────────────────────────────────────────

SOCIAL_MAP = {
    "instagram.com":  "instagram",
    "facebook.com":   "facebook",
    "twitter.com":    "twitter",
    "x.com":          "twitter",
    "t.me":           "telegram",
    "telegram.me":    "telegram",
    "telegram.org":   "telegram",
    "linkedin.com":   "linkedin",
    "youtube.com":    "youtube",
    "tiktok.com":     "tiktok",
    "wa.me":          "whatsapp",
    "whatsapp.com":   "whatsapp",
}

def classify_social_url(url: str) -> str | None:
    try:
        host = urlparse(url).netloc.lower().lstrip("www.")
        for domain, platform in SOCIAL_MAP.items():
            if host == domain or host.endswith("." + domain):
                return platform
    except Exception:
        pass
    return None

def extract_social_from_page(html: str) -> tuple[str, list[dict]]:
    """Returns (website_url, [{platform, url}, ...])"""
    blocks = extract_jsonld(html)
    biz = find_business_block(blocks)
    if not biz:
        return "", []

    website = biz.get("url", "") or ""
    # Filter out the iranilink page URL itself
    if website and "iranilink.co.uk" in website:
        website = ""

    same_as = biz.get("sameAs", []) or []
    if isinstance(same_as, str):
        same_as = [same_as]

    socials = []
    seen_platforms = set()
    for url in same_as:
        platform = classify_social_url(url)
        if platform and platform not in seen_platforms:
            socials.append({"platform": platform, "url": url})
            seen_platforms.add(platform)

    # Also scan page HTML for social links not in JSON-LD
    for href in re.findall(r'href=["\']([^"\']+)["\']', html):
        platform = classify_social_url(href)
        if platform and platform not in seen_platforms:
            # Skip generic homepage URLs
            parsed = urlparse(href)
            if len(parsed.path.strip("/")) > 1:
                socials.append({"platform": platform, "url": href})
                seen_platforms.add(platform)

    return website, socials

def build_biolink_json(website: str, socials: list[dict]) -> str | None:
    if not website and not socials:
        return None
    links = []
    if website:
        links.append({"label": "وبسایت", "url": website, "icon": "globe"})
    return json.dumps({
        "headline": "",
        "bio": "",
        "avatarUrl": "",
        "themeId": "default",
        "backgroundImageUrl": "",
        "backgroundOverlay": False,
        "alert": "",
        "links": links,
        "socialLinks": socials,
    }, ensure_ascii=False)

# ── Image classification ───────────────────────────────────────────────────────

def classify_images(image_urls: list[str]) -> tuple[str, list[str]]:
    """Returns (cover_url, [gallery_url, ...]) from a list of source image URLs."""
    if not image_urls:
        return "", []

    deduped = list(dict.fromkeys(image_urls))  # preserve order, remove dupes

    cover = ""
    gallery = []

    # Prefer cover_ named images, then logo_, then first
    for url in deduped:
        name = urlparse(url).path.split("/")[-1].lower()
        if "cover_" in name and not cover:
            cover = url
    if not cover:
        for url in deduped:
            name = urlparse(url).path.split("/")[-1].lower()
            if "logo_" in name and not cover:
                cover = url
    if not cover:
        cover = deduped[0]

    for url in deduped:
        if url == cover:
            continue
        name = urlparse(url).path.split("/")[-1].lower()
        if "gallery_" in name or "cover_" not in name:
            gallery.append(url)
        if len(gallery) >= MAX_GALLERY:
            break

    return cover, gallery

# ── S3 Upload ──────────────────────────────────────────────────────────────────

def get_s3_config() -> dict:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM app_meta WHERE key LIKE 'aws_%'")
    cfg = {r[0]: r[1] for r in cur.fetchall()}
    cur.close(); conn.close()
    return {
        "access_key":  cfg.get("aws_s3_access_key_id"),
        "secret_key":  cfg.get("aws_s3_secret_access_key"),
        "region":      cfg.get("aws_s3_region", "eu-west-2"),
        "bucket":      cfg.get("aws_s3_bucket"),
    }

_s3_client = None
_s3_cfg = None

def get_s3():
    global _s3_client, _s3_cfg
    if _s3_client is None:
        _s3_cfg = get_s3_config()
        _s3_client = boto3.client(
            "s3",
            region_name=_s3_cfg["region"],
            aws_access_key_id=_s3_cfg["access_key"],
            aws_secret_access_key=_s3_cfg["secret_key"],
        )
    return _s3_client, _s3_cfg

def download_image(url: str) -> tuple[bytes, str] | None:
    """Download image, return (bytes, content_type)."""
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": _ua()})
        if r.status_code != 200:
            return None
        ct = r.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
        return r.content, ct
    except Exception as e:
        print(f"    Download error {url}: {e}")
        return None

def upload_to_s3(data: bytes, content_type: str) -> str | None:
    """Upload image bytes to S3, return public URL."""
    s3, cfg = get_s3()
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    ext = ext_map.get(content_type, ".jpg")
    rand = random.randint(100000, 999999)
    key = f"business-images/business-{int(time.time())}-{rand}{ext}"
    try:
        s3.put_object(
            Bucket=cfg["bucket"],
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return f"https://{cfg['bucket']}.s3.{cfg['region']}.amazonaws.com/{key}"
    except ClientError as e:
        print(f"    S3 error: {e}")
        return None

def process_images(image_urls: list[str]) -> tuple[str, list[str]]:
    """Download + upload images, return (s3_cover_url, [s3_gallery_urls])."""
    cover_src, gallery_srcs = classify_images(image_urls)

    s3_cover = ""
    s3_gallery = []

    if cover_src:
        result = download_image(cover_src)
        if result:
            url = upload_to_s3(result[0], result[1])
            if url:
                s3_cover = url
                print(f"    ✓ Cover → S3")

    for src in gallery_srcs[:MAX_GALLERY]:
        result = download_image(src)
        if result:
            url = upload_to_s3(result[0], result[1])
            if url:
                s3_gallery.append(url)
        time.sleep(0.3)

    if s3_gallery:
        print(f"    ✓ Gallery {len(s3_gallery)} images → S3")

    return s3_cover, s3_gallery

# ── DB helpers ─────────────────────────────────────────────────────────────────

def load_all_il_businesses(conn) -> list[dict]:
    cur = conn.cursor()
    cur.execute("""
        SELECT id, slug, cover_image_url, gallery_json, biolink_json
        FROM businesses
        WHERE slug LIKE 'il-%' AND listing_approval = 'pending'
        ORDER BY id
    """)
    rows = cur.fetchall()
    cur.close()
    return [
        {"id": r[0], "slug": r[1], "cover": r[2] or "", "gallery": r[3] or "[]", "biolink": r[4] or ""}
        for r in rows
    ]

def update_business(conn, slug: str, cover: str, gallery: list[str], biolink: str | None):
    cur = conn.cursor()
    fields = []
    params: dict = {"slug": slug}

    if cover:
        fields.append("cover_image_url = %(cover)s")
        params["cover"] = cover
    if gallery is not None:
        fields.append("gallery_json = %(gallery)s")
        params["gallery"] = json.dumps(gallery, ensure_ascii=False)
    if biolink:
        fields.append("biolink_json = %(biolink)s")
        params["biolink"] = biolink

    if not fields:
        cur.close()
        return

    cur.execute(f"UPDATE businesses SET {', '.join(fields)} WHERE slug = %(slug)s", params)
    conn.commit()
    cur.close()

# ── State management ───────────────────────────────────────────────────────────

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"done": [], "failed": []}

def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False))

# ── Build source map ───────────────────────────────────────────────────────────

def build_source_map() -> dict:
    """slug → {source_url, images}"""
    m = {}

    # From slug_source_map.json (original scrape, has image URLs)
    if SRC_MAP.exists():
        for entry in json.loads(SRC_MAP.read_text()):
            slug = entry.get("slug", "")
            if slug:
                m[slug] = {"source_url": entry.get("source_url", ""), "images": entry.get("images", [])}

    # From scrape_state.json inserted list (newer entries with slug + images)
    if SCRAPE_STATE.exists():
        state = json.loads(SCRAPE_STATE.read_text())
        for entry in state.get("inserted", []):
            slug = entry.get("slug", "")
            if not slug:
                continue
            if slug not in m:
                m[slug] = {"source_url": "", "images": []}
            # Update source URL if missing
            if not m[slug]["source_url"] and entry.get("url"):
                m[slug]["source_url"] = entry["url"]
            # Merge images
            existing = set(m[slug]["images"])
            for img in entry.get("images", []):
                if img not in existing:
                    m[slug]["images"].append(img)
                    existing.add(img)
    return m

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("IraniLink enrichment: social links + images → S3")
    print("=" * 60)

    state = load_state()
    done_set = set(state["done"])

    src_map = build_source_map()
    print(f"Source map: {len(src_map)} slugs with data")

    conn = psycopg2.connect(DB_URL)
    businesses = load_all_il_businesses(conn)
    print(f"DB: {len(businesses)} il- pending businesses to enrich")
    print(f"Already done: {len(done_set)}")
    print()

    total = len(businesses)
    for i, biz in enumerate(businesses, 1):
        slug = biz["slug"]

        if slug in done_set:
            continue

        src = src_map.get(slug, {})
        source_url = src.get("source_url", "")
        image_urls = src.get("images", [])

        already_has_cover  = bool(biz["cover"] and "amazonaws.com" in biz["cover"])
        already_has_images = already_has_cover
        already_has_biolink = bool(biz["biolink"] and len(biz["biolink"]) > 10)

        needs_images  = not already_has_images and bool(image_urls)
        needs_social  = not already_has_biolink and bool(source_url)
        needs_refetch = needs_social  # only re-fetch if we need social data

        print(f"[{i}/{total}] {slug}")
        if not needs_images and not needs_social:
            print(f"  → Nothing to do (images:{already_has_images} biolink:{already_has_biolink})")
            done_set.add(slug)
            state["done"].append(slug)
            save_state(state)
            continue

        # Phase 1: social data via re-fetch
        website = ""
        socials = []
        if needs_refetch:
            human_pause()
            print(f"  Fetching {source_url} …")
            html = fetch_page(source_url, referer=f"{BASE_URL}/directory")
            if html:
                website, socials = extract_social_from_page(html)
                if website:
                    print(f"  ✓ Website: {website}")
                if socials:
                    print(f"  ✓ Socials: {[s['platform'] for s in socials]}")
            else:
                print(f"  ✗ Fetch failed")
                state["failed"].append({"slug": slug, "reason": "fetch_failed"})

        biolink = build_biolink_json(website, socials) if (website or socials) else None

        # Phase 2: images
        s3_cover = ""
        s3_gallery = []
        if needs_images:
            print(f"  Downloading {len(image_urls)} images …")
            s3_cover, s3_gallery = process_images(image_urls)

        # Update DB
        update_business(conn, slug, s3_cover, s3_gallery if s3_cover or s3_gallery else None, biolink)

        done_set.add(slug)
        state["done"].append(slug)
        save_state(state)

        print(f"  ✓ Done (cover:{bool(s3_cover)} gallery:{len(s3_gallery)} biolink:{bool(biolink)})")
        print()

    conn.close()

    print("=" * 60)
    print(f"Done. Enriched: {len(state['done'])}  |  Failed: {len(state['failed'])}")

if __name__ == "__main__":
    main()
