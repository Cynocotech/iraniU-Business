#!/usr/bin/env python3
"""
Fetch cover images for active businesses that have no cover_image_url.
Sources (in priority order):
  1. og:image / twitter:image / JSON-LD logo from business's own website
  2. Scored <img> tags from business's own website (hero, banner, home images)
  3. Instagram profile og:image (if socialLinks has instagram)
  4. Facebook page og:image (if socialLinks has facebook)
  5. DuckDuckGo HTML search — "{name} {city}" as last resort
Never downloads from iranilink.co.uk or londoniha.com.
"""

import json, re, time, random, sys
from pathlib import Path
from urllib.parse import urlparse, urljoin, quote_plus

import requests
import psycopg2
import boto3
from botocore.exceptions import ClientError

# ── Config ─────────────────────────────────────────────────────────────────────

DB_URL     = "postgresql://directory_user:26f026561225054737686ac538d41d44@localhost:5432/directory_iraniu_uk"
SCRIPTS    = Path(__file__).parent
STATE_FILE = SCRIPTS / "fetch_images_state.json"

BLOCKED_DOMAINS = {"iranilink.co.uk", "londoniha.com", "londoniha.co.uk"}
MIN_IMAGE_BYTES = 4_000
MAX_IMAGE_BYTES = 10_000_000

_DESKTOP_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
]

def _ua():
    return random.choice(_DESKTOP_UAS)

SESSION = requests.Session()
SESSION.headers.update({
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Connection":      "keep-alive",
})

def human_pause(base=1.5, extra=2.5):
    time.sleep(base + random.random() * extra)

# ── Helpers ────────────────────────────────────────────────────────────────────

def is_blocked(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower().lstrip("www.")
        return any(host == d or host.endswith("." + d) for d in BLOCKED_DOMAINS)
    except Exception:
        return True

def _abs(url: str, base: str) -> str:
    if not url:
        return ""
    url = url.strip()
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http"):
        return url
    return urljoin(base, url)

def fetch_html(url: str, referer: str = "", timeout: int = 20) -> str | None:
    try:
        SESSION.headers.update({"User-Agent": _ua(), "Referer": referer or url})
        r = SESSION.get(url, timeout=timeout, allow_redirects=True)
        if r.status_code == 200:
            return r.text
    except Exception:
        pass
    return None

def fetch_bytes(url: str, referer: str = "") -> tuple[bytes, str] | None:
    if not url or is_blocked(url):
        return None
    # Use the image's own domain as referer if not provided — bypasses hotlink protection
    if not referer:
        parsed = urlparse(url)
        referer = f"{parsed.scheme}://{parsed.netloc}/"
    try:
        r = requests.get(url, timeout=20, headers={
            "User-Agent": _ua(),
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": referer,
        })
        if r.status_code != 200:
            return None
        ct = r.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
        if not ct.startswith("image/"):
            return None
        data = r.content
        if len(data) < MIN_IMAGE_BYTES or len(data) > MAX_IMAGE_BYTES:
            return None
        return data, ct
    except Exception:
        return None

# ── Image extraction ───────────────────────────────────────────────────────────

def _img_score(url: str) -> int:
    u = url.lower()
    # Skip obvious icons/tiny images
    if any(x in u for x in ["favicon", "16x16", "32x32", "48x48", "64x64", "icon-sm"]):
        return -1
    if re.search(r"-\d{1,2}x\d{1,2}[\._]", u):  # tiny like -16x16.
        return -1
    score = 0
    if any(x in u for x in ["hero", "banner", "home", "header", "cover", "main-img", "front"]):
        score += 6
    if any(x in u for x in ["logo", "brand"]):
        score += 4
    if any(x in u for x in ["about", "team", "profile", "store", "shop", "interior"]):
        score += 2
    if any(ext in u for ext in [".jpg", ".jpeg", ".webp"]):
        score += 1
    if ".png" in u:
        score += 0
    # Penalise tiny size hints in URL
    if re.search(r"-(?:150|100|80|75|50)x", u):
        score -= 2
    if re.search(r"-(?:300|400|500|600|768|800|900|1024|1200|1920)x", u):
        score += 2
    return score

def extract_from_html(html: str, base_url: str) -> str:
    """Extract best image URL from page HTML — og:image first, then scored <img>."""
    candidates = []

    # og:image
    for pat in [
        r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']',
    ]:
        for m in re.finditer(pat, html, re.I):
            candidates.append((_abs(m.group(1), base_url), 20))

    # twitter:image
    for pat in [
        r'<meta[^>]+name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*name=["\']twitter:image["\']',
    ]:
        for m in re.finditer(pat, html, re.I):
            candidates.append((_abs(m.group(1), base_url), 18))

    # JSON-LD logo / image
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            obj = json.loads(raw.strip())
            for field in ["logo", "image"]:
                val = obj.get(field)
                if isinstance(val, dict):
                    val = val.get("url", "")
                elif isinstance(val, list):
                    val = val[0] if val else ""
                if val:
                    candidates.append((_abs(str(val), base_url), 15))
        except Exception:
            pass

    # <img> tags with scoring
    all_srcs = []
    for m in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', html, re.I):
        all_srcs.append(m.group(1))
    # srcset
    for m in re.finditer(r'srcset=["\']([^"\']+)["\']', html, re.I):
        for part in m.group(1).split(","):
            url = part.strip().split(" ")[0]
            if url:
                all_srcs.append(url)

    for src in all_srcs:
        url = _abs(src, base_url)
        if not url.startswith("http"):
            continue
        s = _img_score(url)
        if s >= 0:
            candidates.append((url, s))

    # Filter blocked and sort by score
    valid = [(url, s) for url, s in candidates if url and not is_blocked(url) and url.startswith("http")]
    valid.sort(key=lambda x: -x[1])
    return valid[0][0] if valid else ""

def try_social_og(social_url: str) -> str:
    """Get og:image from a social profile page (Instagram, Facebook)."""
    if not social_url:
        return ""
    html = fetch_html(social_url, referer="https://www.google.com/")
    if not html:
        return ""
    for pat in [
        r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']',
    ]:
        m = re.search(pat, html, re.I)
        if m:
            url = m.group(1).strip()
            if url.startswith("http") and not is_blocked(url):
                return url
    return ""

def ddg_search(query: str) -> str:
    """DuckDuckGo HTML search — scrape image links from result page."""
    try:
        SESSION.headers.update({"User-Agent": _ua(), "Referer": "https://www.google.com/"})
        r = SESSION.get(
            f"https://html.duckduckgo.com/html/?q={quote_plus(query)}",
            timeout=15
        )
        if r.status_code != 200:
            return ""
        html = r.text
        # Look for image URLs in result thumbnails
        imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html, re.I)
        for img in imgs:
            if img.startswith("http") and not is_blocked(img):
                result = fetch_bytes(img)
                if result and result[0]:
                    return img
    except Exception:
        pass
    return ""

# ── S3 ─────────────────────────────────────────────────────────────────────────

_s3_client = _s3_cfg = None

def get_s3():
    global _s3_client, _s3_cfg
    if _s3_client is None:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        cur.execute("SELECT key, value FROM app_meta WHERE key LIKE 'aws_%'")
        cfg = {r[0]: r[1] for r in cur.fetchall()}
        cur.close(); conn.close()
        _s3_cfg = {"access_key": cfg.get("aws_s3_access_key_id"), "secret_key": cfg.get("aws_s3_secret_access_key"),
                   "region": cfg.get("aws_s3_region", "eu-west-2"), "bucket": cfg.get("aws_s3_bucket")}
        _s3_client = boto3.client("s3", region_name=_s3_cfg["region"],
                                  aws_access_key_id=_s3_cfg["access_key"], aws_secret_access_key=_s3_cfg["secret_key"])
    return _s3_client, _s3_cfg

def upload_to_s3(data: bytes, content_type: str) -> str | None:
    s3, cfg = get_s3()
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}.get(content_type, ".jpg")
    key = f"business-images/business-{int(time.time())}-{random.randint(100000,999999)}{ext}"
    try:
        s3.put_object(Bucket=cfg["bucket"], Key=key, Body=data, ContentType=content_type)
        return f"https://{cfg['bucket']}.s3.{cfg['region']}.amazonaws.com/{key}"
    except ClientError as e:
        print(f"    S3 error: {e}")
        return None

def download_and_upload(url: str, label: str, referer: str = "") -> str | None:
    result = fetch_bytes(url, referer=referer)
    if not result:
        return None
    s3_url = upload_to_s3(result[0], result[1])
    if s3_url:
        print(f"  ✓ {label} → S3")
    return s3_url

# ── DB ─────────────────────────────────────────────────────────────────────────

def load_businesses(conn) -> list[dict]:
    cur = conn.cursor()
    cur.execute("""
        SELECT slug, name_fa, name_en, city, biolink_json
        FROM businesses
        WHERE (status IS NULL OR status = '' OR status = 'active')
          AND (listing_approval = 'approved' OR listing_approval IS NULL OR listing_approval = '')
          AND (cover_image_url IS NULL OR cover_image_url = '')
        ORDER BY slug
    """)
    rows = cur.fetchall()
    cur.close()
    out = []
    for slug, name_fa, name_en, city, biolink_raw in rows:
        website = ""
        socials = []
        try:
            bj = json.loads(biolink_raw or "{}")
            links = bj.get("links", [])
            website = next((l.get("url", "") for l in links if l.get("url")), "")
            socials = bj.get("socialLinks", [])
        except Exception:
            pass
        out.append({"slug": slug, "name": name_fa or name_en or slug,
                    "city": city or "", "website": website, "socials": socials})
    return out

def update_cover(conn, slug: str, url: str):
    cur = conn.cursor()
    cur.execute("UPDATE businesses SET cover_image_url = %s WHERE slug = %s", (url, slug))
    conn.commit()
    cur.close()

# ── State ──────────────────────────────────────────────────────────────────────

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"done": [], "found": 0, "not_found": 0}

def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False))

# ── Main process ───────────────────────────────────────────────────────────────

def process(biz: dict, conn) -> bool:
    slug = biz["slug"]

    # Source 1: own website (og:image + smart img scoring)
    if biz["website"] and not is_blocked(biz["website"]):
        html = fetch_html(biz["website"], referer="https://www.google.com/")
        if html:
            img_url = extract_from_html(html, biz["website"])
            if img_url:
                # Use the business website as referer to bypass hotlink protection
                s3_url = download_and_upload(img_url, "website", referer=biz["website"])
                if s3_url:
                    update_cover(conn, slug, s3_url)
                    return True

    # Source 2: Instagram og:image
    instagram_url = next((s["url"] for s in biz["socials"] if s.get("platform") == "instagram"), "")
    if instagram_url:
        human_pause(1, 2)
        print(f"  → Instagram …")
        img_url = try_social_og(instagram_url)
        if img_url:
            s3_url = download_and_upload(img_url, "Instagram")
            if s3_url:
                update_cover(conn, slug, s3_url)
                return True

    # Source 3: Facebook og:image
    facebook_url = next((s["url"] for s in biz["socials"] if s.get("platform") == "facebook"), "")
    if facebook_url:
        human_pause(1, 2)
        print(f"  → Facebook …")
        img_url = try_social_og(facebook_url)
        if img_url:
            s3_url = download_and_upload(img_url, "Facebook")
            if s3_url:
                update_cover(conn, slug, s3_url)
                return True

    # Source 4: DuckDuckGo HTML search
    human_pause(1.5, 2)
    query = f"{biz['name']} {biz['city']} UK"
    print(f"  → DuckDuckGo: {query[:60]} …")
    img_url = ddg_search(query)
    if img_url:
        s3_url = download_and_upload(img_url, "DDG")
        if s3_url:
            update_cover(conn, slug, s3_url)
            return True

    print(f"  ✗ No image found")
    return False

def main():
    print("=" * 60)
    print("Missing image fetch: website + social profiles + search")
    print("=" * 60)

    state = load_state()
    done_set = set(state["done"])

    conn = psycopg2.connect(DB_URL)
    businesses = load_businesses(conn)
    remaining = [b for b in businesses if b["slug"] not in done_set]

    print(f"Total without cover: {len(businesses)}  |  Remaining: {len(remaining)}")
    print(f"Found so far: {state['found']}  |  Not found: {state['not_found']}")
    print()

    for i, biz in enumerate(remaining, 1):
        print(f"[{i}/{len(remaining)}] {biz['slug']} | {biz['name']} | {biz['city']}")
        if biz["website"]:
            print(f"  site: {biz['website'][:70]}")

        human_pause()
        found = process(biz, conn)

        state["done"].append(biz["slug"])
        done_set.add(biz["slug"])
        state["found" if found else "not_found"] += 1
        save_state(state)
        print()

    conn.close()
    print("=" * 60)
    print(f"Done. Found: {state['found']}  |  Not found: {state['not_found']}")

if __name__ == "__main__":
    main()
