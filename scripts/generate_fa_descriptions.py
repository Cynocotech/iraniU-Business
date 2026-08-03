"""
Generate unique Farsi descriptions for pending businesses.
- DuckDuckGo search → scrape real website content
- Gemini Flash → write embedding-optimized Farsi description
- Resumable via generate_fa_desc_state.json
"""

import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus, urlparse, urljoin

import psycopg2
import requests
from bs4 import BeautifulSoup

# ── Config ───────────────────────────────────────────────────────────────────
DB_URL       = "postgresql://directory_user:26f026561225054737686ac538d41d44@localhost:5432/directory_iraniu_uk"
GEMINI_KEY   = "AIzaSyAWyDQN6qodyI4fLqEzI1nNb_nYrEoEi34"
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL   = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
STATE_FILE   = Path(__file__).parent / "generate_fa_desc_state.json"
DELAY        = 2.0   # seconds between businesses

CATEGORY_FA = {
    "food-drink":           "غذا و نوشیدنی",
    "beauty-wellness":      "زیبایی و سلامت",
    "health-medical":       "سلامت و پزشکی",
    "legal-financial":      "حقوقی و مالی",
    "education":            "آموزش",
    "real-estate":          "املاک",
    "travel-tourism":       "سفر و گردشگری",
    "events-entertainment": "رویدادها و سرگرمی",
    "retail-shopping":      "خرده‌فروشی",
    "automotive":           "خودرو",
    "home-services":        "خدمات منزل",
    "professional-services":"خدمات حرفه‌ای",
    "technology":           "فناوری",
    "sports-fitness":       "ورزش و تناسب اندام",
    "arts-culture":         "هنر و فرهنگ",
    "media-publishing":     "رسانه و نشر",
    "religious-community":  "مذهبی و اجتماعی",
    "other":                "سایر خدمات",
}

BLOCKED_HOSTS = {
    "instagram.com", "facebook.com", "twitter.com", "linkedin.com",
    "google.com", "maps.google.com", "yelp.com", "tripadvisor.com",
    "trustpilot.com", "juseat.com", "deliveroo.com", "ubereats.com",
}

# ── HTTP Session ─────────────────────────────────────────────────────────────
SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
})


# ── State ─────────────────────────────────────────────────────────────────────
def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"done": [], "failed": []}

def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2))

# ── Web Scraping ──────────────────────────────────────────────────────────────
def is_blocked(url: str) -> bool:
    host = urlparse(url).netloc.lower().lstrip("www.")
    return any(b in host for b in BLOCKED_HOSTS)

def fetch_html(url: str, timeout: int = 15) -> str | None:
    try:
        r = SESSION.get(url, timeout=timeout, allow_redirects=True)
        if r.status_code == 200 and "text/html" in r.headers.get("content-type", ""):
            return r.text
    except Exception:
        pass
    return None

def extract_text(html: str, max_chars: int = 2500) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "iframe"]):
        tag.decompose()

    chunks = []
    # Priority: meta description, title, h1-h2, first paragraphs
    meta_desc = soup.find("meta", attrs={"name": re.compile(r"description", re.I)})
    if meta_desc and meta_desc.get("content"):
        chunks.append(meta_desc["content"].strip())

    title = soup.find("title")
    if title:
        chunks.append(title.get_text(strip=True))

    for tag in soup.find_all(["h1", "h2", "p"], limit=30):
        text = tag.get_text(" ", strip=True)
        if len(text) > 30:
            chunks.append(text)

    combined = " | ".join(chunks)
    return combined[:max_chars]

def ddg_search(query: str) -> str | None:
    """Return first non-blocked result URL from DuckDuckGo HTML search."""
    try:
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        r = SESSION.get(url, timeout=15, headers={"Referer": "https://duckduckgo.com/"})
        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.select("a.result__a"):
            href = a.get("href", "")
            if href.startswith("http") and not is_blocked(href):
                return href
    except Exception:
        pass
    return None

def _name_keywords(name_en: str) -> list[str]:
    """Extract significant words from English business name for domain matching."""
    stop = {"the", "a", "an", "and", "or", "of", "in", "at", "for", "ltd",
            "limited", "llc", "inc", "co", "&", "-", "uk"}
    return [w.lower() for w in re.split(r"[\s\-&]+", name_en) if len(w) > 2 and w.lower() not in stop]

def domain_matches_name(url: str, name_en: str) -> bool:
    """Return True if at least one keyword from the business name appears in the domain."""
    domain = urlparse(url).netloc.lower().lstrip("www.")
    keywords = _name_keywords(name_en)
    if not keywords:
        return True  # can't verify, allow it
    return any(kw in domain for kw in keywords)

def get_website_content(name_en: str, name_fa: str, city: str) -> str:
    """Try to find and scrape the business website. Returns scraped text or empty."""
    query = f'{name_fa} {city} UK'
    print(f"  → DDG: {query}")
    url = ddg_search(query)
    if not url:
        print("    no results")
        return ""
    print(f"  → {url[:70]}")
    html = fetch_html(url)
    if not html:
        print("    fetch failed")
        return ""
    text = extract_text(html)
    print(f"  → {len(text)} chars scraped")
    return text

# ── AI Description Generator ──────────────────────────────────────────────────
def generate_description(biz: dict, web_content: str) -> str:
    category_fa = CATEGORY_FA.get(biz["category"] or "", biz["category"] or "")

    context_parts = [
        f"نام کسب‌وکار: {biz['name_fa']}",
        f"نام انگلیسی: {biz['name_en']}" if biz["name_en"] else "",
        f"دسته‌بندی: {category_fa}",
        f"شهر: {biz['city']}" if biz["city"] else "",
        f"آدرس: {biz['address']}" if biz["address"] else "",
    ]
    context = "\n".join(p for p in context_parts if p)

    if web_content:
        context += f"\n\nاطلاعات وب‌سایت:\n{web_content}"

    prompt = f"""تو یک نویسنده متخصص برای دایرکتوری کسب‌وکارهای ایرانی در انگلستان هستی.

اطلاعات کسب‌وکار:
{context}

وظیفه:
یک توصیف فارسی منحصربه‌فرد و اورجینال برای این کسب‌وکار بنویس که:
- ۳ تا ۵ جمله روان و طبیعی فارسی باشد (بدون هدر، بدون بولت پوینت)
- برای جستجوی معنایی (embedding) بهینه باشد — شامل نوع خدمات، موقعیت، مخاطب هدف
- هیچ محتوایی از وب‌سایت‌های دیگر کپی نشده باشد، کاملاً اورجینال باشد
- لحن حرفه‌ای و دلنشین داشته باشد
- کلیشه‌ای نباشد

فقط متن توصیف را بنویس، هیچ چیز دیگری اضافه نکن."""

    resp = requests.post(
        GEMINI_URL,
        headers={"x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 400},
        },
        timeout=30,
    )
    resp.raise_for_status()
    candidates = resp.json().get("candidates", [])
    if not candidates:
        raise ValueError("Empty response from Gemini")
    return candidates[0]["content"]["parts"][0]["text"].strip()

# ── DB ────────────────────────────────────────────────────────────────────────
def save_description(conn, slug: str, description: str):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE businesses SET description = %s WHERE slug = %s",
            (description, slug)
        )
    conn.commit()

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    state = load_state()
    done_set = set(state["done"])

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT slug, name_fa, name_en, category, city, address
        FROM businesses
        WHERE listing_approval = 'pending'
        ORDER BY id
    """)
    rows = cur.fetchall()
    cur.close()

    total = len(rows)
    todo = [(s, f, e, c, ci, a) for s, f, e, c, ci, a in rows if s not in done_set]
    print(f"Total pending: {total} | Done: {len(done_set)} | To do: {len(todo)}")

    for i, (slug, name_fa, name_en, category, city, address) in enumerate(todo, 1):
        idx = len(done_set) + i
        print(f"\n[{idx}/{total}] {slug} | {name_fa} | {city}")

        biz = {
            "slug": slug,
            "name_fa": name_fa,
            "name_en": name_en or "",
            "category": category or "",
            "city": city or "",
            "address": address or "",
        }

        try:
            web_content = get_website_content(name_en or name_fa, name_fa, city or "UK")
            time.sleep(1)

            description = generate_description(biz, web_content)
            print(f"  ✓ {description[:80]}…")

            save_description(conn, slug, description)
            state["done"].append(slug)
            save_state(state)

        except Exception as e:
            print(f"  ✗ ERROR: {e}")
            state["failed"].append({"slug": slug, "error": str(e)})
            save_state(state)

        time.sleep(DELAY)

    conn.close()
    print(f"\n{'='*60}")
    print(f"Done. Processed: {len(state['done'])} | Failed: {len(state['failed'])}")

if __name__ == "__main__":
    main()
