#!/usr/bin/env python3
"""
Fetch cover images for INACTIVE businesses that have a website or Instagram URL.
On success: saves image to S3, sets cover_image_url, and re-activates the business.

Sources tried (in order):
  1. og:image / twitter:image / JSON-LD logo from business website
  2. Scored <img> tags from business website
  3. Instagram profile og:image

Run:    python3 scripts/fetch_inactive_images.py
Resume: just re-run — state is tracked in fetch_inactive_images_state.json
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
STATE_FILE = SCRIPTS / "fetch_inactive_images_state.json"

BLOCKED_DOMAINS  = {"iranilink.co.uk", "londoniha.com", "londoniha.co.uk"}
BLOCKED_ACCOUNTS = {"iranilinkapp"}   # iranilink placeholder Instagram accounts
MIN_IMAGE_BYTES  = 4_000
MAX_IMAGE_BYTES  = 10_000_000

_DESKTOP_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

def _ua():
    return random.choice(_DESKTOP_UAS)

SESSION = requests.Session()
SESSION.headers.update({
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Connection":      "keep-alive",
})

def human_pause(base=1.5, extra=2.0):
    time.sleep(base + random.random() * extra)

# ── Helpers ────────────────────────────────────────────────────────────────────

def is_blocked(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower().lstrip("www.")
        return any(host == d or host.endswith("." + d) for d in BLOCKED_DOMAINS)
    except Exception:
        return True

def is_blocked_account(url: str) -> bool:
    try:
        path = urlparse(url).path.strip("/").split("/")[0].lower()
        return path in BLOCKED_ACCOUNTS
    except Exception:
        return False

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
    if any(x in u for x in ["favicon", "16x16", "32x32", "48x48", "64x64", "icon-sm"]):
        return -1
    if re.search(r"-\d{1,2}x\d{1,2}[\._]", u):
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
    if re.search(r"-(?:150|100|80|75|50)x", u):
        score -= 2
    if re.search(r"-(?:300|400|500|600|768|800|900|1024|1200|1920)x", u):
        score += 2
    return score

def extract_from_html(html: str, base_url: str) -> str:
    candidates = []
    for pat in [
        r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']',
    ]:
        for m in re.finditer(pat, html, re.I):
            candidates.append((_abs(m.group(1), base_url), 20))
    for pat in [
        r'<meta[^>]+name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*name=["\']twitter:image["\']',
    ]:
        for m in re.finditer(pat, html, re.I):
            candidates.append((_abs(m.group(1), base_url), 18))
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
    all_srcs = []
    for m in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', html, re.I):
        all_srcs.append(m.group(1))
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
    valid = [(url, s) for url, s in candidates if url and not is_blocked(url) and url.startswith("http")]
    valid.sort(key=lambda x: -x[1])
    return valid[0][0] if valid else ""

def try_instagram_og(instagram_url: str) -> str:
    if not instagram_url or is_blocked_account(instagram_url):
        return ""
    html = fetch_html(instagram_url, referer="https://www.google.com/")
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
        _s3_cfg = {
            "access_key": cfg.get("aws_s3_access_key_id"),
            "secret_key": cfg.get("aws_s3_secret_access_key"),
            "region":     cfg.get("aws_s3_region", "eu-west-2"),
            "bucket":     cfg.get("aws_s3_bucket"),
        }
        _s3_client = boto3.client(
            "s3", region_name=_s3_cfg["region"],
            aws_access_key_id=_s3_cfg["access_key"],
            aws_secret_access_key=_s3_cfg["secret_key"],
        )
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
        WHERE status = 'inactive'
          AND (cover_image_url IS NULL OR cover_image_url = '')
          AND biolink_json IS NOT NULL
          AND biolink_json NOT IN ('[]', 'null', '{}', '')
        ORDER BY slug
    """)
    rows = cur.fetchall()
    cur.close()
    out = []
    for slug, name_fa, name_en, city, biolink_raw in rows:
        website = ""
        instagram = ""
        try:
            bj = json.loads(biolink_raw or "{}")

            # Website: check links[] first, then socialLinks with globe/website preset
            for link in bj.get("links", []):
                url = link.get("url", "").strip()
                if url and url.startswith("http") and not is_blocked(url):
                    website = url
                    break
            if not website:
                for sl in bj.get("socialLinks", []):
                    preset = sl.get("preset", "") or sl.get("platform", "") or sl.get("icon", "")
                    if preset in ("website", "globe", "url"):
                        url = sl.get("url", "").strip()
                        if url and url.startswith("http") and not is_blocked(url):
                            website = url
                            break

            # Instagram: check socialLinks for platform or preset == "instagram"
            for sl in bj.get("socialLinks", []):
                preset = sl.get("preset", "") or sl.get("platform", "")
                if "instagram" in preset.lower():
                    url = sl.get("url", "").strip()
                    if url and not is_blocked_account(url):
                        instagram = url
                        break

        except Exception:
            pass

        # Only include if has at least one usable source
        if not website and not instagram:
            continue

        out.append({
            "slug": slug,
            "name": name_fa or name_en or slug,
            "city": city or "",
            "website": website,
            "instagram": instagram,
        })
    return out

def activate_business(conn, slug: str, cover_url: str):
    cur = conn.cursor()
    cur.execute(
        "UPDATE businesses SET cover_image_url = %s, status = 'active' WHERE slug = %s",
        (cover_url, slug)
    )
    conn.commit()
    cur.close()

# ── State ──────────────────────────────────────────────────────────────────────

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"done": [], "activated": 0, "not_found": 0}

def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False))

# ── Main process ───────────────────────────────────────────────────────────────

def process(biz: dict, conn) -> bool:
    # Source 1: own website
    if biz["website"]:
        print(f"  → website: {biz['website'][:70]}")
        html = fetch_html(biz["website"], referer="https://www.google.com/")
        if html:
            img_url = extract_from_html(html, biz["website"])
            if img_url:
                s3_url = download_and_upload(img_url, "website", referer=biz["website"])
                if s3_url:
                    activate_business(conn, biz["slug"], s3_url)
                    return True

    # Source 2: Instagram
    if biz["instagram"]:
        human_pause(1, 2)
        print(f"  → instagram: {biz['instagram'][:70]}")
        img_url = try_instagram_og(biz["instagram"])
        if img_url:
            s3_url = download_and_upload(img_url, "Instagram")
            if s3_url:
                activate_business(conn, biz["slug"], s3_url)
                return True

    print(f"  ✗ no image found")
    return False

def main():
    print("=" * 60)
    print("Fetch images for inactive businesses (website + Instagram)")
    print("=" * 60)

    state = load_state()
    done_set = set(state["done"])

    conn = psycopg2.connect(DB_URL)
    businesses = load_businesses(conn)
    remaining = [b for b in businesses if b["slug"] not in done_set]

    print(f"Inactive with website/instagram: {len(businesses)}  |  Remaining: {len(remaining)}")
    print(f"Activated so far: {state['activated']}  |  Not found: {state['not_found']}")
    print()

    for i, biz in enumerate(remaining, 1):
        sources = []
        if biz["website"]:  sources.append("web")
        if biz["instagram"]: sources.append("ig")
        print(f"[{i}/{len(remaining)}] {biz['slug']} | {biz['name']} [{', '.join(sources)}]")

        human_pause()
        found = process(biz, conn)

        state["done"].append(biz["slug"])
        done_set.add(biz["slug"])
        state["activated" if found else "not_found"] += 1
        save_state(state)
        print()

    conn.close()
    print("=" * 60)
    print(f"Done. Activated: {state['activated']}  |  Not found: {state['not_found']}")

if __name__ == "__main__":
    main()
