"""
Refix Farsi descriptions for the first ~333 businesses processed with the old
English-name DDG search (which could return wrong companies).
Now uses Farsi name for search — same approach as the fixed main script.
Resumable via generate_fa_refix_state.json
"""

import json
import re
import time
from pathlib import Path
from urllib.parse import quote_plus, urlparse

import psycopg2
import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────
DB_URL      = "postgresql://directory_user:26f026561225054737686ac538d41d44@localhost:5432/directory_iraniu_uk"
GEMINI_KEY  = "AIzaSyAWyDQN6qodyI4fLqEzI1nNb_nYrEoEi34"
GEMINI_MODEL = "gemini-2.5-flash"
MAIN_STATE  = Path(__file__).parent / "generate_fa_desc_state.json"
REFIX_STATE = Path(__file__).parent / "generate_fa_refix_state.json"
DELAY       = 2.0

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
    "google.com", "yelp.com", "tripadvisor.com", "trustpilot.com",
}

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9",
})

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# ── State ─────────────────────────────────────────────────────────────────────
def load_refix_state() -> dict:
    if REFIX_STATE.exists():
        return json.loads(REFIX_STATE.read_text())
    return {"done": [], "failed": []}

def save_refix_state(state: dict):
    REFIX_STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))

# ── Web Scraping ──────────────────────────────────────────────────────────────
def is_blocked(url: str) -> bool:
    host = urlparse(url).netloc.lower().lstrip("www.")
    return any(b in host for b in BLOCKED_HOSTS)

def fetch_html(url: str) -> str | None:
    try:
        r = SESSION.get(url, timeout=15, allow_redirects=True)
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
    meta = soup.find("meta", attrs={"name": re.compile(r"description", re.I)})
    if meta and meta.get("content"):
        chunks.append(meta["content"].strip())
    title = soup.find("title")
    if title:
        chunks.append(title.get_text(strip=True))
    for tag in soup.find_all(["h1", "h2", "p"], limit=30):
        text = tag.get_text(" ", strip=True)
        if len(text) > 30:
            chunks.append(text)
    return " | ".join(chunks)[:max_chars]

def ddg_search(query: str) -> str | None:
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

def get_website_content(name_fa: str, city: str) -> str:
    query = f"{name_fa} {city} UK"
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

# ── AI Description ────────────────────────────────────────────────────────────
def generate_description(biz: dict, web_content: str) -> str:
    category_fa = CATEGORY_FA.get(biz["category"] or "", biz["category"] or "")
    ctx_parts = [
        f"نام کسب‌وکار: {biz['name_fa']}",
        f"نام انگلیسی: {biz['name_en']}" if biz["name_en"] else "",
        f"دسته‌بندی: {category_fa}",
        f"شهر: {biz['city']}" if biz["city"] else "",
        f"آدرس: {biz['address']}" if biz["address"] else "",
    ]
    ctx = "\n".join(p for p in ctx_parts if p)
    if web_content:
        ctx += f"\n\nاطلاعات وب‌سایت:\n{web_content}"

    prompt = f"""یک توصیف فارسی اورجینال ۳ تا ۵ جمله‌ای برای این کسب‌وکار ایرانی در انگلستان بنویس.
- متن روان و طبیعی، بدون هدر یا بولت
- بهینه برای جستجوی معنایی: شامل نوع خدمات، موقعیت، مخاطب
- هیچ چیزی از منابع دیگر کپی نشده باشد
- فقط متن فارسی، هیچ چیز دیگری نه

{ctx}"""
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
        cur.execute("UPDATE businesses SET description = %s WHERE slug = %s", (description, slug))
    conn.commit()

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    # Load the first 333 slugs from the main state (processed before the fix)
    main_state = json.loads(MAIN_STATE.read_text())
    target_slugs = main_state["done"][:333]

    refix_state = load_refix_state()
    done_set = set(refix_state["done"])
    todo = [s for s in target_slugs if s not in done_set]

    print(f"Target: {len(target_slugs)} | Already refixed: {len(done_set)} | To do: {len(todo)}")

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        "SELECT slug, name_fa, name_en, category, city, address FROM businesses WHERE slug = ANY(%s)",
        (target_slugs,)
    )
    biz_map = {row[0]: row for row in cur.fetchall()}
    cur.close()

    for i, slug in enumerate(todo, 1):
        if slug not in biz_map:
            print(f"[{i}] {slug} — not found in DB, skipping")
            refix_state["done"].append(slug)
            save_refix_state(refix_state)
            continue

        _, name_fa, name_en, category, city, address = biz_map[slug]
        total = len(done_set) + i
        print(f"\n[{total}/{len(target_slugs)}] {slug} | {name_fa} | {city}")

        biz = {
            "slug": slug, "name_fa": name_fa, "name_en": name_en or "",
            "category": category or "", "city": city or "", "address": address or "",
        }

        try:
            web_content = get_website_content(name_fa, city or "UK")
            time.sleep(1)
            description = generate_description(biz, web_content)
            print(f"  ✓ {description[:80]}…")
            save_description(conn, slug, description)
            refix_state["done"].append(slug)
            save_refix_state(refix_state)
        except Exception as e:
            print(f"  ✗ ERROR: {e}")
            refix_state["failed"].append({"slug": slug, "error": str(e)})
            save_refix_state(refix_state)

        time.sleep(DELAY)

    conn.close()
    print(f"\n{'='*60}")
    print(f"Refix done. Processed: {len(refix_state['done'])} | Failed: {len(refix_state['failed'])}")

if __name__ == "__main__":
    main()
