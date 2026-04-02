#!/usr/bin/env python3
"""
Parse London_Bussines_List.sql (MySQL dump): all INSERT batches for `London_Bussines_List`,
map rows into SQLite `businesses`.

Maps source columns → businesses: slug, name_fa, description, category, phone, address,
google_review_url, city, cover_image_url, hours_json, listing_title, claimed, package.

Usage:
  python3 server/scripts/import_london_businesses_test.py [--sql PATH] [--limit N] [--dry-run] [--verbose]

  --limit 0     Import every row (scan full file; multiple INSERT statements supported).
  --limit N     Stop after N successfully inserted rows (for testing).
  --dry-run     Parse only, no DB writes; still respects --limit for how many to print.
  --verbose     Log each row; default is progress every --progress-every rows.

Default: ../../London_Bussines_List.sql, limit 0 (all), DB from SQLITE_PATH or server/data/iraniu.db
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import uuid
import sys


def unquote_mysql_value(raw: str):
    raw = raw.strip()
    if raw.upper() == "NULL":
        return None
    if len(raw) >= 2 and raw[0] == "'" and raw[-1] == "'":
        return raw[1:-1].replace("''", "'")
    return raw


def split_mysql_row_tuple(inner: str) -> list:
    """Split one row's inner (between outer parens) by commas, respecting quoted strings."""
    parts: list[str] = []
    cur: list[str] = []
    i = 0
    n = len(inner)
    in_str = False
    while i < n:
        c = inner[i]
        if not in_str:
            if c == "'":
                in_str = True
                cur.append(c)
            elif c == ",":
                parts.append("".join(cur))
                cur = []
            else:
                cur.append(c)
        else:
            cur.append(c)
            if c == "'":
                if i + 1 < n and inner[i + 1] == "'":
                    cur.append(inner[i + 1])
                    i += 1
                else:
                    in_str = False
        i += 1
    if cur:
        parts.append("".join(cur))
    return [unquote_mysql_value(p) for p in parts]


def parse_row_line(line: str) -> list | None:
    line = line.strip()
    if not line.startswith("("):
        return None
    # Last row of each INSERT ends with ");" — strip ";" first, not ");" (that would drop the closing ")").
    if line.endswith(";"):
        line = line[:-1].strip()
    if line.endswith(","):
        line = line[:-1].strip()
    if not (line.startswith("(") and line.endswith(")")):
        return None
    inner = line[1:-1]
    return split_mysql_row_tuple(inner)


def row_to_business(cols: list) -> dict:
    """27 columns per INSERT list order."""
    (
        _id,
        name,
        category_1,
        category_2,
        description,
        updated_description,
        phone,
        mobile,
        address,
        postcode,
        google_map,
        image_url,
        _instagram,
        _website,
        _fb,
        _tw,
        _li,
        _tg,
        _cal,
        wh_sat,
        wh_sun,
        wh_mon,
        wh_tue,
        wh_wed,
        wh_thu,
        wh_fri,
        borough,
    ) = (cols + [None] * 27)[:27]

    desc = updated_description or description or None
    cat = category_1 or category_2 or None
    phone_out = phone or mobile or None
    addr = address or ""
    if postcode:
        addr = f"{addr}, {postcode}".strip(", ")

    hours = {
        "sat": wh_sat,
        "sun": wh_sun,
        "mon": wh_mon,
        "tue": wh_tue,
        "wed": wh_wed,
        "thu": wh_thu,
        "fri": wh_fri,
    }
    hours_json = json.dumps(hours, ensure_ascii=False)

    return {
        "name_fa": name or "بدون نام",
        "description": desc,
        "category": cat,
        "phone": phone_out,
        "address": addr or None,
        "google_review_url": google_map,
        "city": borough,
        "cover_image_url": image_url,
        "hours_json": hours_json,
        "listing_title": name,
    }


INSERT_MARKER = "INSERT INTO `London_Bussines_List`"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--sql",
        default=os.path.join(os.path.dirname(__file__), "..", "..", "London_Bussines_List.sql"),
        help="Path to MySQL dump",
    )
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max rows to insert (0 = no limit, import full file)",
    )
    ap.add_argument("--dry-run", action="store_true", help="Parse only, no DB writes")
    ap.add_argument("--verbose", action="store_true", help="Log every row")
    ap.add_argument("--progress-every", type=int, default=500, help="Progress line every N inserts (non-verbose)")
    ap.add_argument(
        "--commit-every",
        type=int,
        default=250,
        help="SQLite commit every N inserts (non-dry-run)",
    )
    args = ap.parse_args()

    sql_path = os.path.abspath(args.sql)
    if not os.path.isfile(sql_path):
        print(f"File not found: {sql_path}", file=sys.stderr)
        return 1

    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    db_path = os.environ.get("SQLITE_PATH") or os.path.join(data_dir, "iraniu.db")

    imported = 0
    skipped_dup = 0
    parse_errors = 0
    in_values = False
    pending_commit = 0
    max_rows = args.limit if args.limit > 0 else None

    conn = None
    if not args.dry_run:
        conn = sqlite3.connect(db_path)

    insert_sql = """
        INSERT INTO businesses (
          slug, name_fa, description, category, phone, address,
          google_review_url, claimed, package, city, cover_image_url,
          hours_json, listing_title
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'basic', ?, ?, ?, ?)
    """

    def maybe_commit():
        nonlocal pending_commit
        if conn and pending_commit >= args.commit_every:
            conn.commit()
            pending_commit = 0

    try:
        with open(sql_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.rstrip("\n")
                if INSERT_MARKER in line and "VALUES" in line:
                    in_values = True
                    continue
                if not in_values:
                    continue
                if not line.strip():
                    continue
                if line.strip().startswith("--"):
                    continue
                cols = parse_row_line(line)
                if not cols or len(cols) < 5:
                    if line.strip().startswith("("):
                        parse_errors += 1
                    continue
                b = row_to_business(cols)
                if args.dry_run:
                    if max_rows is not None and imported >= max_rows:
                        break
                    if args.verbose or imported < 5:
                        print(json.dumps({**b, "slug": "(iu-######## بعد از درج)"}, ensure_ascii=False, indent=2))
                    imported += 1
                else:
                    try:
                        temp_slug = "t" + uuid.uuid4().hex[:24]
                        conn.execute(
                            insert_sql,
                            (
                                temp_slug,
                                b["name_fa"],
                                b["description"],
                                b["category"],
                                b["phone"],
                                b["address"],
                                b["google_review_url"],
                                b["city"],
                                b["cover_image_url"],
                                b["hours_json"],
                                b["listing_title"],
                            ),
                        )
                        new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                        final_slug = f"iu-{int(new_id):08d}"
                        conn.execute("UPDATE businesses SET slug = ? WHERE id = ?", (final_slug, new_id))
                        pending_commit += 1
                        maybe_commit()
                        imported += 1
                        if args.verbose:
                            print(f"OK {imported}: {final_slug} — {b['name_fa'][:60]}...")
                        elif args.progress_every > 0 and imported % args.progress_every == 0:
                            print(f"… {imported} rows inserted", flush=True)
                    except sqlite3.IntegrityError:
                        skipped_dup += 1
                        continue
                    if max_rows is not None and imported >= max_rows:
                        break
        if conn and not args.dry_run:
            conn.commit()
    finally:
        if conn is not None:
            conn.close()

    if imported == 0 and parse_errors == 0:
        print("No rows parsed.", file=sys.stderr)
        return 2

    lim_txt = f"limit {args.limit}" if max_rows is not None else "no limit (full file)"
    print(
        f"Done. inserted={imported} skipped_duplicates={skipped_dup} parse_errors={parse_errors} ({lim_txt}). DB: {db_path}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
