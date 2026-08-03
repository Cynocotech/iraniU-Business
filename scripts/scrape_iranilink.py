#!/usr/bin/env python3
"""
Scraper for iranilink.co.uk/directory
Extracts business listings via JSON-LD structured data.
All scraped records are inserted with listing_approval='pending' (unpublished).

Usage:
    python3 scrape_iranilink.py           # Run normally
    python3 scrape_iranilink.py --dry-run # Preview without inserting
    python3 scrape_iranilink.py --limit 5 # Stop after 5 new businesses
"""

import argparse
import json
import os
import random
import re
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

# ── Config ────────────────────────────────────────────────────────────────────

BASE_URL = "https://iranilink.co.uk"
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "directory_iraniu_uk",
    "user": "directory_user",
    "password": "26f026561225054737686ac538d41d44",
}

# State file — tracks which business URLs we've already processed
STATE_FILE = Path(__file__).parent / "scrape_state.json"

# Top-level category slugs on iranilink (city-agnostic — covers all cities)
TOP_CATEGORIES = [
    "food-drink",
    "health-medical",
    "legal-immigration",
    "beauty-wellness",
    "financial",
    "education-childcare",
    "home-property",
    "professional",
    "mental-health",
    "events-entertainment",
    "it-technology",
    "automotive",
]

# Persian digit map
_PERSIAN_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

# Day name map: schema.org day URI → Persian
_DAY_FA = {
    "Monday":    "دوشنبه",
    "Tuesday":   "سه‌شنبه",
    "Wednesday": "چهارشنبه",
    "Thursday":  "پنج‌شنبه",
    "Friday":    "جمعه",
    "Saturday":  "شنبه",
    "Sunday":    "یکشنبه",
}

# Day order for consistent output
_DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# ── HTTP Session ───────────────────────────────────────────────────────────────

# Curated desktop Chrome/Firefox UAs — mobile UAs trigger a different (smaller)
# Next.js rendering path that omits the JSON-LD structured data we need.
_DESKTOP_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
]

def make_session() -> requests.Session:
    s = requests.Session()
    # Accept-Encoding intentionally omitted: the site (via Cloudflare + Next.js PPR)
    # serves a 102KB pre-rendered shell when gzip is requested, but delivers the full
    # 900KB server-rendered page (with all JSON-LD data) when encoding is 'identity'.
    s.headers.update({
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9,fa;q=0.8",
        "Accept-Encoding": "identity",
        "Connection":      "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest":  "document",
        "Sec-Fetch-Mode":  "navigate",
        "Sec-Fetch-Site":  "none",
        "Sec-Fetch-User":  "?1",
        "DNT":             "1",
    })
    return s

session = make_session()

def _rotate_ua():
    session.headers["User-Agent"] = random.choice(_DESKTOP_UAS)

def fetch(url: str, referer: str | None = None, retries: int = 3) -> str | None:
    """Fetch a URL with human-like behaviour. Returns HTML or None on failure."""
    _rotate_ua()
    if referer:
        session.headers["Referer"] = referer
    elif "Referer" in session.headers:
        del session.headers["Referer"]

    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=20, allow_redirects=True)
            if resp.status_code == 200:
                return resp.text
            elif resp.status_code in (429, 503):
                wait = 30 + random.uniform(10, 30)
                print(f"  ⚠ Rate limited ({resp.status_code}), waiting {wait:.0f}s …")
                time.sleep(wait)
            elif resp.status_code == 404:
                print(f"  ✗ 404 — {url}")
                return None
            else:
                print(f"  ✗ HTTP {resp.status_code} — {url}")
                if attempt < retries - 1:
                    time.sleep(5 + random.uniform(0, 5))
        except requests.RequestException as e:
            print(f"  ✗ Request error ({e}) — {url}")
            if attempt < retries - 1:
                time.sleep(8 + random.uniform(0, 5))
    return None

def human_pause(short: bool = False):
    """Sleep for a human-like random duration."""
    if short:
        time.sleep(random.uniform(1.5, 3.5))
    else:
        # Occasionally take a longer pause like a real browser user
        base = random.uniform(2.5, 6.0)
        if random.random() < 0.12:  # 12% chance of a longer break
            base += random.uniform(8, 20)
        time.sleep(base)

# ── JSON-LD Extraction ─────────────────────────────────────────────────────────

def extract_jsonld_blocks(html: str) -> list[dict]:
    """Extract all valid JSON-LD blocks from a page."""
    blocks = []

    # Standard <script type="application/ld+json">
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL | re.IGNORECASE
    ):
        try:
            blocks.append(json.loads(m.group(1).strip()))
        except Exception:
            pass

    # Next.js RSC push format: push([1,"...json..."])
    for m in re.finditer(r'push\(\[1,"(\{.*?})"\]\)', html, re.DOTALL):
        raw = m.group(1)
        # Unescape the JSON string
        raw = raw.replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")
        try:
            blocks.append(json.loads(raw))
        except Exception:
            pass

    # Also look for RSC chunks with escaped JSON
    for m in re.finditer(r'"(\{[^"]*@context[^"]*schema\.org[^"]*})"', html):
        raw = m.group(1).replace('\\"', '"').replace("\\n", "\n")
        try:
            blocks.append(json.loads(raw))
        except Exception:
            pass

    return blocks

def find_block(blocks: list[dict], types: list[str]) -> dict | None:
    for b in blocks:
        t = b.get("@type", "")
        if isinstance(t, list):
            if any(x in types for x in t):
                return b
        elif t in types:
            return b
    return None

# ── Data Extraction ────────────────────────────────────────────────────────────

BUSINESS_TYPES = [
    "LocalBusiness", "Restaurant", "FoodEstablishment", "MedicalBusiness",
    "LegalService", "HealthAndBeautyBusiness", "FinancialService",
    "EducationalOrganization", "HomeAndConstructionBusiness", "ProfessionalService",
    "MentalHealthBusiness", "AutomotiveBusiness", "EntertainmentBusiness",
    "Organization", "Store", "Dentist", "Physician",
    # Subtypes observed in the wild on iranilink
    "GroceryStore", "Supermarket", "Bakery", "CafeOrCoffeeShop", "BarOrPub",
    "HairSalon", "BeautySalon", "NailSalon", "SpaOrHealthClub",
    "AccountingService", "InsuranceAgency", "RealEstateAgent",
    "AutoDealer", "AutoRepair", "CarWash",
    "LodgingBusiness", "TravelAgency",
    "Plumber", "Electrician", "GeneralContractor", "HVACBusiness",
    "ChildCare", "School", "TutoringService",
    "Optician", "Pharmacy", "Optometrist",
    "Attorney", "NotaryService",
    "FinancialService", "BankOrCreditUnion",
    "FitnessCenter", "SportsActivityLocation",
    "ClothingStore", "JewelryStore", "ShoeStore", "BookStore",
]

def extract_name_fa(html: str, blocks: list[dict]) -> str:
    """Get Persian business name from og:title or breadcrumb."""
    # og:title is most reliable: "رستوران باروک — غذا و نوشیدنی در منچستر | IraniLink"
    m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html)
    if m:
        title = m.group(1)
        # Strip the " — Category | IraniLink" suffix
        title = re.sub(r'\s*[—–-]\s*.+$', '', title).strip()
        if title:
            return title

    # Fallback: breadcrumb last item
    breadcrumb = find_block(blocks, ["BreadcrumbList"])
    if breadcrumb:
        items = breadcrumb.get("itemListElement", [])
        if items:
            last = max(items, key=lambda x: x.get("position", 0))
            name = last.get("name", "")
            if name and name != "دایرکتوری":
                return name

    return ""

def to_persian_digits(s: str) -> str:
    return s.translate(_PERSIAN_DIGITS)

def convert_hours(spec: list[dict]) -> list[dict]:
    """Convert schema.org openingHoursSpecification to our Persian hours_json format."""
    if not spec:
        return []

    # Group by day
    by_day: dict[str, dict] = {}
    for entry in spec:
        day_uri = entry.get("dayOfWeek", "")
        # Extract day name from URI or direct string
        day_en = day_uri.split("/")[-1] if "/" in day_uri else day_uri
        if day_en not in _DAY_FA:
            continue
        opens  = entry.get("opens", "")
        closes = entry.get("closes", "")
        if opens and closes:
            hours_str = f"{opens}–{closes}"
            by_day[day_en] = {
                "day":   _DAY_FA[day_en],
                "hours": to_persian_digits(hours_str),
            }

    # Return in week order
    return [by_day[d] for d in _DAY_ORDER if d in by_day]

def normalize_phone(phone: str) -> str:
    """Strip everything except digits, return last 10 digits for comparison."""
    digits = re.sub(r"\D", "", phone)
    # Handle +44 prefix → replace with 0
    if digits.startswith("44") and len(digits) > 10:
        digits = "0" + digits[2:]
    return digits[-10:] if len(digits) >= 10 else digits

def parse_category_from_url(url: str) -> str:
    """Extract category from iranilink URL path."""
    parts = url.rstrip("/").split("/")
    # URL: /directory/{city}/{category}/{subcategory}/{slug}
    # or   /directory/{category}/{subcategory}/{slug}
    # We want the main category segment
    CITIES = {
        "london", "manchester", "birmingham", "edinburgh", "glasgow",
        "newcastle", "bristol", "leeds", "sheffield", "liverpool",
        "nottingham", "leicester", "cambridge", "brighton",
    }
    if len(parts) >= 3:
        for i, part in enumerate(parts):
            if part == "directory" and i + 1 < len(parts):
                next_part = parts[i + 1]
                if next_part in CITIES and i + 2 < len(parts):
                    return parts[i + 2]  # city/category/...
                else:
                    return next_part      # /directory/category/...
    return ""

def extract_slug_from_url(url: str) -> str:
    """Get the last path segment as slug."""
    return url.rstrip("/").split("/")[-1]

def extract_city_from_url(url: str) -> str:
    CITIES = {
        "london", "manchester", "birmingham", "edinburgh", "glasgow",
        "newcastle", "bristol", "leeds", "sheffield", "liverpool",
        "nottingham", "leicester", "cambridge", "brighton",
    }
    parts = url.rstrip("/").split("/")
    for p in parts:
        if p.lower() in CITIES:
            return p.capitalize()
    return ""

def scrape_business(url: str, referer: str) -> dict | None:
    """Fetch a business detail page and extract all fields. Returns dict or None."""
    html = fetch(url, referer=referer)
    if not html:
        return None

    blocks = extract_jsonld_blocks(html)
    biz_block = find_block(blocks, BUSINESS_TYPES)

    if not biz_block:
        # Fallback: any block with a name + telephone that isn't navigation metadata
        SKIP_TYPES = {"BreadcrumbList", "ItemList", "WebSite", "WebPage", "SearchAction"}
        for b in blocks:
            t = b.get("@type", "")
            if isinstance(t, list):
                t_str = t[0] if t else ""
            else:
                t_str = t
            if t_str not in SKIP_TYPES and ("name" in b or "telephone" in b):
                biz_block = b
                break

    if not biz_block:
        print(f"  ✗ No business JSON-LD found at {url}")
        return None

    # Names
    name_en = biz_block.get("name", "").strip()
    name_fa = extract_name_fa(html, blocks)
    if not name_fa:
        name_fa = name_en  # fallback

    # Contact
    phone   = biz_block.get("telephone", "") or ""
    website = biz_block.get("url", "") or biz_block.get("sameAs", "") or ""
    if isinstance(website, list):
        website = website[0] if website else ""

    # Address
    addr_block = biz_block.get("address", {}) or {}
    street     = addr_block.get("streetAddress", "") or ""
    city_addr  = addr_block.get("addressLocality", "") or ""
    postcode   = addr_block.get("postalCode", "") or ""

    # Combine address
    address_parts = [p for p in [street, city_addr] if p]
    address = ", ".join(address_parts)

    # City: prefer URL-derived (more consistent casing), fallback to JSON-LD
    city_url = extract_city_from_url(url)
    city     = city_url or city_addr or ""

    # Geo
    geo = biz_block.get("geo", {}) or {}
    lat = geo.get("latitude")
    lng = geo.get("longitude")

    # Rating
    agg = biz_block.get("aggregateRating", {}) or {}
    rating = None
    if agg:
        try:
            rating = float(agg.get("ratingValue", 0) or 0)
        except (ValueError, TypeError):
            rating = None

    # Images: collect source URLs for later download — do NOT store in DB
    images = biz_block.get("image", []) or []
    if isinstance(images, str):
        images = [images]
    logo = biz_block.get("logo", "") or ""
    if isinstance(logo, dict):
        logo = logo.get("url", "") or ""
    _source_images = [u for u in ([logo] + images) if u]

    cover_image_url = ""
    gallery_json = "[]"

    # Hours
    hours_spec = biz_block.get("openingHoursSpecification", []) or []
    hours_json = json.dumps(convert_hours(hours_spec), ensure_ascii=False)

    # Category from URL path
    category = parse_category_from_url(url)

    # Description
    description = biz_block.get("description", "") or ""

    # Slug: prefix with 'il-' to namespace iranilink imports
    url_slug = extract_slug_from_url(url)
    slug = f"il-{url_slug}"

    return {
        "slug":              slug,
        "name_fa":           name_fa or name_en,
        "name_en":           name_en,
        "description":       description,
        "category":          category,
        "phone":             phone,
        "address":           address,
        "city":              city,
        "postcode":          postcode,
        "postcode_latitude": lat,
        "postcode_longitude": lng,
        "cover_image_url":   cover_image_url,
        "gallery_json":      gallery_json,
        "hours_json":        hours_json,
        "rating":            rating,
        "source_url":        None,
        "_source_images":    _source_images,  # kept in memory/state only, never written to DB
        "listing_approval":  "pending",
        "status":            "active",
        "package":           "basic",
        "claimed":           0,
    }

# ── Category Crawl ─────────────────────────────────────────────────────────────

def get_business_urls_from_category(category_slug: str) -> list[str]:
    """Crawl a category (and its paginated sub-pages) to collect all business URLs."""
    urls: list[str] = []
    page = 1
    category_url = f"{BASE_URL}/directory/{category_slug}"

    print(f"\n  Crawling category: {category_slug}")

    while True:
        if page == 1:
            url = category_url
        else:
            url = f"{category_url}?page={page}"

        referer = category_url if page > 1 else f"{BASE_URL}/directory"
        html = fetch(url, referer=referer)
        if not html:
            break

        blocks = extract_jsonld_blocks(html)
        item_list = find_block(blocks, ["ItemList"])

        if not item_list:
            if page == 1:
                print(f"    No ItemList found for {category_slug}")
            break

        items = item_list.get("itemListElement", [])
        page_urls = [
            item["url"] for item in items
            if isinstance(item.get("url"), str) and item["url"].startswith("https://iranilink.co.uk/directory/")
        ]

        if not page_urls:
            break

        print(f"    Page {page}: {len(page_urls)} businesses")
        urls.extend(page_urls)

        # Stop when a page returns fewer than 20 items (last page)
        if len(page_urls) < 20:
            break

        page += 1
        human_pause(short=True)

    return urls

# ── Duplicate Detection ────────────────────────────────────────────────────────

def load_existing_phones(conn) -> set[str]:
    """Load normalized phone numbers of all existing businesses."""
    with conn.cursor() as cur:
        cur.execute("SELECT phone, mobile FROM businesses WHERE phone IS NOT NULL OR mobile IS NOT NULL")
        phones = set()
        for row in cur.fetchall():
            for p in row:
                if p:
                    norm = normalize_phone(p)
                    if norm:
                        phones.add(norm)
    return phones

def load_existing_slugs(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT slug FROM businesses")
        return {row[0] for row in cur.fetchall()}

def is_duplicate(biz: dict, existing_slugs: set[str], existing_phones: set[str]) -> str | None:
    """Returns reason string if duplicate, else None."""
    if biz["slug"] in existing_slugs:
        return f"slug match: {biz['slug']}"
    if biz["phone"]:
        norm = normalize_phone(biz["phone"])
        if norm and norm in existing_phones:
            return f"phone match: {biz['phone']}"
    return None

# ── Database Insert ────────────────────────────────────────────────────────────

INSERT_SQL = """
INSERT INTO businesses (
    slug, name_fa, name_en, description, category,
    phone, address, city, postcode,
    postcode_latitude, postcode_longitude,
    cover_image_url, gallery_json, hours_json, rating,
    listing_approval, status, package, claimed,
    created_at
) VALUES (
    %(slug)s, %(name_fa)s, %(name_en)s, %(description)s, %(category)s,
    %(phone)s, %(address)s, %(city)s, %(postcode)s,
    %(postcode_latitude)s, %(postcode_longitude)s,
    %(cover_image_url)s, %(gallery_json)s, %(hours_json)s, %(rating)s,
    %(listing_approval)s, %(status)s, %(package)s, %(claimed)s,
    NOW()::text
)
ON CONFLICT (slug) DO NOTHING
RETURNING id
"""

def insert_business(conn, biz: dict) -> int | None:
    """Insert one business. Returns new ID or None if already existed."""
    with conn.cursor() as cur:
        cur.execute(INSERT_SQL, biz)
        row = cur.fetchone()
        conn.commit()
        return row[0] if row else None

# ── State Management ───────────────────────────────────────────────────────────

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"processed": [], "inserted": [], "skipped": [], "failed": []}

def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False))

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape iranilink.co.uk/directory")
    parser.add_argument("--dry-run", action="store_true", help="Preview without inserting")
    parser.add_argument("--limit",   type=int, default=0, help="Stop after N new insertions (0 = unlimited)")
    parser.add_argument("--reset",   action="store_true", help="Clear state and restart from scratch")
    parser.add_argument("--category", type=str, default="", help="Only scrape a specific category slug")
    args = parser.parse_args()

    print("=" * 60)
    print("IraniLink → directory.iraniu.uk scraper")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    if args.limit:
        print(f"Limit: {args.limit} new businesses")
    print("=" * 60)

    # Load state
    state = {} if args.reset else load_state()
    state.setdefault("processed", [])
    state.setdefault("inserted",  [])
    state.setdefault("skipped",   [])
    state.setdefault("failed",    [])

    processed_set = set(state["processed"])

    # Connect to DB
    if not args.dry_run:
        conn = psycopg2.connect(**DB_CONFIG)
        existing_slugs  = load_existing_slugs(conn)
        existing_phones = load_existing_phones(conn)
        print(f"\nDB: {len(existing_slugs)} existing businesses, {len(existing_phones)} phone records")
    else:
        conn = None
        existing_slugs  = set()
        existing_phones = set()

    # Warm up the session — visit main directory page first like a real user
    print("\nWarming up session …")
    fetch(f"{BASE_URL}/directory")
    human_pause()
    fetch(f"{BASE_URL}/directory", referer=f"{BASE_URL}/")
    human_pause()

    # Decide which categories to scrape
    categories = [args.category] if args.category else TOP_CATEGORIES
    # Shuffle so we don't always start from the same category
    random.shuffle(categories)

    inserted_count = 0

    for cat in categories:
        if args.limit and inserted_count >= args.limit:
            break

        # Get all business URLs for this category
        business_urls = get_business_urls_from_category(cat)

        if not business_urls:
            continue

        # Shuffle within category — avoid predictable crawl patterns
        random.shuffle(business_urls)

        cat_ref = f"{BASE_URL}/directory/{cat}"

        for biz_url in business_urls:
            if args.limit and inserted_count >= args.limit:
                break

            if biz_url in processed_set:
                print(f"  → Already processed, skipping: {biz_url}")
                continue

            print(f"\n  Fetching: {biz_url}")
            human_pause()

            biz = scrape_business(biz_url, referer=cat_ref)

            # Mark as processed regardless of outcome
            processed_set.add(biz_url)
            state["processed"].append(biz_url)

            if not biz:
                state["failed"].append(biz_url)
                save_state(state)
                continue

            # Check for duplicates
            dup_reason = is_duplicate(biz, existing_slugs, existing_phones)
            if dup_reason:
                print(f"  ⊘ Duplicate ({dup_reason}) — {biz['name_fa']}")
                state["skipped"].append({"url": biz_url, "reason": dup_reason})
                save_state(state)
                continue

            # Show what we'd insert
            print(f"  ✓ {biz['name_fa']} | {biz['name_en']} | {biz['city']} | {biz['phone'] or '—'}")
            if biz["postcode"]:
                print(f"    {biz['address']} {biz['postcode']}")

            if args.dry_run:
                inserted_count += 1
                print(f"    [DRY RUN] Would insert as slug={biz['slug']}")
                # Simulate duplicate tracking
                existing_slugs.add(biz["slug"])
                if biz["phone"]:
                    existing_phones.add(normalize_phone(biz["phone"]))
                continue

            # Insert into DB
            new_id = insert_business(conn, biz)
            if new_id:
                inserted_count += 1
                existing_slugs.add(biz["slug"])
                if biz["phone"]:
                    existing_phones.add(normalize_phone(biz["phone"]))
                state["inserted"].append({
                    "id":     new_id,
                    "slug":   biz["slug"],
                    "url":    biz_url,
                    "name":   biz["name_fa"],
                    "images": biz.get("_source_images", []),
                })
                print(f"    ★ Inserted id={new_id}")
            else:
                state["skipped"].append({"url": biz_url, "reason": "ON CONFLICT"})

            save_state(state)

            # Use the detail page as next referer (natural browsing)
            cat_ref = biz_url

    # Summary
    print("\n" + "=" * 60)
    print(f"Done. Inserted: {len(state['inserted'])}  |  Skipped: {len(state['skipped'])}  |  Failed: {len(state['failed'])}")
    if conn:
        conn.close()


if __name__ == "__main__":
    main()
